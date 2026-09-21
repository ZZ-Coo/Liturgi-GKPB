<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { Plus, Loader2, PencilLine, Trash2, RotateCcw, X, ChevronDown } from 'lucide-vue-next'
import AdminShell from '@/components/admin/AdminShell.vue'
import Combobox, { type ComboboxOption } from '@/components/admin/Combobox.vue'
import { fetchAllJemaat, type JemaatRecord } from '@/lib/tenant'
import {
  listWarta, findLatestBefore, createWarta, trashWarta, restoreWarta, deleteWartaForever,
  type WartaSummary,
} from '@/lib/warta/api'
import { cloneSections } from '@/lib/warta/parse'
import { createStarterSections } from '@/lib/warta/starter'
import { createDummySections } from '@/lib/warta/dummy'
import { upcomingSundayIso } from '@/lib/date'
import { pushToast } from '@/composables/toast'
import type { WartaSection } from '@/lib/warta/types'
import { confirmTrash, confirmDestroy } from '@/composables/confirm'

const router = useRouter()

const jemaatList = ref<JemaatRecord[]>([])
const rows = ref<WartaSummary[]>([])
const loading = ref(true)
const loadError = ref<string | null>(null)

const jemaatName = (jemaatId: string) => jemaatList.value.find((j) => j.id === jemaatId)?.name ?? '—'
const jemaatOptions = computed<ComboboxOption[]>(() =>
  jemaatList.value.map((j) => ({ id: j.id, label: j.name, sublabel: j.category ?? undefined })),
)
const filterOptions = computed<ComboboxOption[]>(() => [{ id: '', label: 'Semua jemaat' }, ...jemaatOptions.value])

function formatTanggal(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

// updatedAt/deletedAt come back as UTC without a timezone marker; without the
// "Z" the browser would read them as local time and be off by the UTC offset.
function formatStamp(value: string) {
  const d = new Date(/[zZ]$|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`)
  return d.toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// ── list + filter ─────────────────────────────────────────────────────
const filterJemaatId = ref('')

async function loadRows() {
  loading.value = true
  loadError.value = null
  try {
    rows.value = await listWarta({ jemaatId: filterJemaatId.value || undefined })
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : 'Gagal memuat daftar warta'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  jemaatList.value = await fetchAllJemaat()
  await loadRows()
})
watch(filterJemaatId, loadRows)

// ── create ────────────────────────────────────────────────────────────
type Source = 'copy' | 'starter' | 'sample'

const showCreate = ref(false)
const newJemaatId = ref('')
const newTanggal = ref(upcomingSundayIso())
const source = ref<Source>('starter')
const previous = ref<{ tanggal: string; sections: WartaSection[] } | null>(null)
const creating = ref(false)

// Rows only cover the current filter, so this is checked against the server
// too (createWarta reports a duplicate) — this just gives the early warning.
const existing = computed(() => rows.value.find((r) => r.jemaatId === newJemaatId.value && r.tanggal === newTanggal.value))

// Look up "last week's warta" whenever jemaat/date change. `lookupToken`
// drops answers that arrive after the inputs already changed again.
let lookupToken = 0
watch([newJemaatId, newTanggal], async ([jemaatId, tanggal]) => {
  const token = ++lookupToken
  previous.value = null
  if (!jemaatId || !tanggal) return
  try {
    const found = await findLatestBefore(jemaatId, tanggal)
    if (token !== lookupToken) return
    previous.value = found
    source.value = found ? 'copy' : source.value === 'copy' ? 'starter' : source.value
  } catch {
    // Not fatal: the option just isn't offered.
  }
})

async function create() {
  if (!newJemaatId.value || !newTanggal.value || creating.value) return
  creating.value = true
  try {
    const sections =
      source.value === 'copy' && previous.value
        ? cloneSections(previous.value.sections)
        : source.value === 'sample'
          ? createDummySections()
          : createStarterSections()
    const id = await createWarta({ jemaatId: newJemaatId.value, tanggal: newTanggal.value, sections })
    router.push({ name: 'admin-warta-edit', params: { id } })
  } catch (err) {
    pushToast(err instanceof Error ? err.message : 'Gagal membuat warta', 'error')
  } finally {
    creating.value = false
  }
}

// ── delete / trash ────────────────────────────────────────────────────
async function trash(row: WartaSummary) {
  if (!(await confirmTrash(`warta ${jemaatName(row.jemaatId)} — ${formatTanggal(row.tanggal)}`))) return
  try {
    await trashWarta(row.id)
    pushToast('Warta dihapus')
    await loadRows()
    if (trashLoaded.value) await loadTrash()
  } catch (err) {
    pushToast(err instanceof Error ? err.message : 'Gagal menghapus', 'error')
  }
}

const trashRows = ref<WartaSummary[]>([])
const trashLoaded = ref(false)

async function loadTrash() {
  try {
    trashRows.value = await listWarta({ trashed: true })
    trashLoaded.value = true
  } catch (err) {
    pushToast(err instanceof Error ? err.message : 'Gagal memuat sampah', 'error')
  }
}

function onTrashToggle(e: Event) {
  if ((e.target as HTMLDetailsElement).open && !trashLoaded.value) void loadTrash()
}

async function restore(row: WartaSummary) {
  try {
    await restoreWarta(row.id)
    pushToast('Warta dipulihkan')
    await Promise.all([loadRows(), loadTrash()])
  } catch (err) {
    pushToast(err instanceof Error ? err.message : 'Gagal memulihkan', 'error')
  }
}

async function removeForever(row: WartaSummary) {
  if (!(await confirmDestroy(`warta ${jemaatName(row.jemaatId)} — ${formatTanggal(row.tanggal)}`))) return
  try {
    await deleteWartaForever(row.id)
    pushToast('Dihapus permanen')
    await loadTrash()
  } catch (err) {
    pushToast(err instanceof Error ? err.message : 'Gagal menghapus permanen', 'error')
  }
}
</script>

<template>
  <AdminShell>
    <div class="mx-auto max-w-3xl space-y-6">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div class="space-y-1">
          <p class="label-eyebrow text-accent">Admin</p>
          <h1 class="font-display text-2xl font-semibold text-ink">Warta Jemaat</h1>
        </div>
        <button v-if="!showCreate" type="button" class="btn-primary gap-1.5" @click="showCreate = true">
          <Plus class="h-4 w-4" /> Buat warta
        </button>
      </div>

      <!-- create -->
      <div v-if="showCreate" class="field-group">
        <div class="flex items-center justify-between">
          <p class="field-group-heading">Warta baru</p>
          <button type="button" class="btn-ghost" aria-label="Tutup" @click="showCreate = false"><X class="h-4 w-4" /></button>
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <label class="space-y-1.5">
            <span class="label-eyebrow">Jemaat</span>
            <Combobox v-model="newJemaatId" :options="jemaatOptions" placeholder="Pilih jemaat…" search-placeholder="Cari jemaat…" />
          </label>
          <label class="space-y-1.5">
            <span class="label-eyebrow">Tanggal</span>
            <input v-model="newTanggal" type="date" class="input" />
          </label>
        </div>

        <fieldset v-if="newJemaatId && newTanggal" class="space-y-2">
          <legend class="label-eyebrow mb-1.5">Mulai dari</legend>
          <label v-if="previous" class="flex cursor-pointer items-start gap-2 text-sm text-ink">
            <input v-model="source" type="radio" value="copy" class="mt-1 accent-[rgb(var(--color-accent))]" />
            <span>Salin dari warta {{ formatTanggal(previous.tanggal) }} <span class="text-muted">(paling baru sebelum tanggal ini)</span></span>
          </label>
          <label class="flex cursor-pointer items-start gap-2 text-sm text-ink">
            <input v-model="source" type="radio" value="starter" class="mt-1 accent-[rgb(var(--color-accent))]" />
            <span>Kerangka kosong <span class="text-muted">(Sapaan, Kegiatan Ibadah, Informasi)</span></span>
          </label>
          <label class="flex cursor-pointer items-start gap-2 text-sm text-ink">
            <input v-model="source" type="radio" value="sample" class="mt-1 accent-[rgb(var(--color-accent))]" />
            <span>Data contoh <span class="text-muted">(fiktif, untuk mencoba)</span></span>
          </label>
        </fieldset>

        <p v-if="existing" class="rounded-lg bg-gold-soft px-3 py-2 text-sm text-ink">
          Warta jemaat ini untuk tanggal tersebut sudah ada.
          <RouterLink :to="{ name: 'admin-warta-edit', params: { id: existing.id } }" class="font-medium text-accent underline">Buka</RouterLink>
        </p>

        <div class="flex justify-end">
          <button type="button" class="btn-primary" :disabled="!newJemaatId || !newTanggal || !!existing || creating" @click="create">
            <Loader2 v-if="creating" class="h-4 w-4 animate-spin" />
            Buat &amp; sunting
          </button>
        </div>
      </div>

      <!-- filter -->
      <div class="max-w-xs">
        <Combobox v-model="filterJemaatId" :options="filterOptions" placeholder="Semua jemaat" search-placeholder="Cari jemaat…" />
      </div>

      <!-- list -->
      <p v-if="loading" class="flex items-center justify-center gap-2 py-10 text-sm text-muted">
        <Loader2 class="h-4 w-4 animate-spin text-accent" /> Memuat…
      </p>
      <p v-else-if="loadError" class="card py-6 text-center text-sm text-danger">{{ loadError }}</p>
      <p v-else-if="!rows.length" class="card py-8 text-center text-sm text-muted">Belum ada warta. Klik “Buat warta” untuk memulai.</p>

      <ul v-else class="space-y-2">
        <li v-for="row in rows" :key="row.id" class="card flex items-center gap-3 !p-3.5">
          <RouterLink :to="{ name: 'admin-warta-edit', params: { id: row.id } }" class="min-w-0 flex-1 space-y-0.5">
            <p class="truncate text-sm font-medium text-ink">{{ jemaatName(row.jemaatId) }}</p>
            <p class="text-xs text-muted">{{ formatTanggal(row.tanggal) }} · diubah {{ formatStamp(row.updatedAt) }}</p>
          </RouterLink>
          <span class="chip" :class="row.status === 'PUBLISHED' ? 'bg-accent-soft text-accent' : 'bg-paper-deep text-muted'">
            {{ row.status === 'PUBLISHED' ? 'Terbit' : 'Draf' }}
          </span>
          <RouterLink :to="{ name: 'admin-warta-edit', params: { id: row.id } }" class="btn-ghost" title="Sunting" aria-label="Sunting">
            <PencilLine class="h-4 w-4" />
          </RouterLink>
          <button type="button" class="btn-danger px-2.5" title="Hapus" aria-label="Hapus" @click="trash(row)">
            <Trash2 class="h-4 w-4" />
          </button>
        </li>
      </ul>

      <!-- trash -->
      <details class="card group !p-0" @toggle="onTrashToggle">
        <summary class="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-muted select-none">
          Sampah
          <ChevronDown class="h-4 w-4 transition-transform group-open:rotate-180" />
        </summary>
        <div class="border-t border-line">
          <p v-if="!trashLoaded" class="px-4 py-4 text-center text-sm text-muted">Memuat…</p>
          <p v-else-if="!trashRows.length" class="px-4 py-4 text-center text-sm text-muted">Sampah kosong.</p>
          <ul v-else class="divide-y divide-line">
            <li v-for="row in trashRows" :key="row.id" class="flex items-center gap-3 px-4 py-3">
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm text-ink">{{ jemaatName(row.jemaatId) }}</p>
                <p class="text-xs text-muted">{{ formatTanggal(row.tanggal) }}</p>
              </div>
              <button type="button" class="btn gap-1.5 !py-1.5 text-xs" @click="restore(row)"><RotateCcw class="h-3.5 w-3.5" /> Pulihkan</button>
              <button type="button" class="btn-danger px-2.5" title="Hapus permanen" aria-label="Hapus permanen" @click="removeForever(row)">
                <Trash2 class="h-4 w-4" />
              </button>
            </li>
          </ul>
        </div>
      </details>
    </div>
  </AdminShell>
</template>
