<script setup lang="ts">
// Dedicated home for a jemaat_admin — everything scoped to their one
// congregation, on purpose no `fetchAllJemaat()` call anywhere in this
// file. That's not just tidiness: every past leak in this admin (the
// daerah filter listing every jemaat, "published liturgi readable by
// everyone" missing `to anon`) came from a widget built for the
// super_admin's "all jemaat" surface being reused as-is for a scoped
// account. This page has no all-jemaat data path to leak from at all.
//
// Two things share one screen: this week's 3 sessions at a glance
// (mirrors AdminOverviewView's chip pattern, just for a single jemaat),
// and a searchable history grouped by month — grouping by jemaat like
// the super_admin's Simpel view would make here, since there's only ever
// one.
import { ref, computed, onMounted, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { extractStoragePath } from '@/lib/storage'
import { nearestSundayIso, toIsoDate } from '@/lib/date'
import { useAuthStore } from '@/stores/authStore'
import AdminShell from '@/components/admin/AdminShell.vue'
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Search,
  Sunrise,
  Sun,
  Sunset,
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
  ArrowLeft,
  History,
} from 'lucide-vue-next'

type Sesi = 'PAGI' | 'SIANG' | 'SORE'
const SESI_ORDER: Sesi[] = ['PAGI', 'SIANG', 'SORE']
const SESI_ICON = { PAGI: Sunrise, SIANG: Sun, SORE: Sunset } as const
const SESI_LABEL = { PAGI: 'Pagi', SIANG: 'Siang', SORE: 'Sore' } as const

interface Row {
  id: string
  tanggal: string
  sesi: Sesi
  status: 'DRAFT' | 'PUBLISHED'
  fileUrl: string
  deletedAt: string | null
}

const auth = useAuthStore()
const jemaatName = ref('')
const loading = ref(true)
const actionError = ref<string | null>(null)
const showTrash = ref(false)

// ── This week's 3 slots ──
const selectedDate = ref<string>(nearestSundayIso())
const weekRows = ref<Row[]>([])
const selectedDateLabel = computed(() =>
  new Date(selectedDate.value + 'T00:00:00').toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }),
)
function shiftWeek(delta: number) {
  const d = new Date(selectedDate.value + 'T00:00:00')
  d.setDate(d.getDate() + delta * 7)
  selectedDate.value = toIsoDate(d)
}
function slotFor(s: Sesi) {
  return weekRows.value.find((r) => r.sesi === s) ?? null
}
async function loadWeek() {
  if (!auth.adminJemaatId) return
  const { data } = await supabase
    .from('liturgi')
    .select('id, tanggal, sesi, status, fileUrl, deletedAt')
    .eq('jemaatId', auth.adminJemaatId)
    .eq('tanggal', selectedDate.value)
    .is('deletedAt', null)
  weekRows.value = (data ?? []) as Row[]
}
watch(selectedDate, loadWeek)

const deletingId = ref<string | null>(null)
async function quickDelete(s: Sesi, row: Row) {
  if (!confirm(`Hapus liturgi ${SESI_LABEL[s]}? Masih bisa dipulihkan lewat Sampah di bawah.`)) return
  deletingId.value = row.id
  actionError.value = null
  try {
    const { error } = await supabase.from('liturgi').update({ deletedAt: new Date().toISOString() }).eq('id', row.id)
    if (error) throw error
    await loadWeek()
    await loadHistory()
  } catch (err) {
    actionError.value = err instanceof Error ? `Gagal menghapus: ${err.message}` : 'Gagal menghapus.'
  } finally {
    deletingId.value = null
  }
}

// ── Riwayat — full history, grouped by month, searched client-side ──
// One jemaat's worth of weekly uploads is a small, cheap table to pull
// in one go (a few hundred rows even after years of use) — no need for
// the page/offset machinery LiturgiListView needs across 86 congregations.
const historyRows = ref<Row[]>([])
const trashRows = ref<Row[]>([])
const query = ref('')

async function loadHistory() {
  if (!auth.adminJemaatId) return
  const { data } = await supabase
    .from('liturgi')
    .select('id, tanggal, sesi, status, fileUrl, deletedAt')
    .eq('jemaatId', auth.adminJemaatId)
    .is('deletedAt', null)
    .order('tanggal', { ascending: false })
  historyRows.value = (data ?? []) as Row[]
}
async function loadTrash() {
  if (!auth.adminJemaatId) return
  const { data } = await supabase
    .from('liturgi')
    .select('id, tanggal, sesi, status, fileUrl, deletedAt')
    .eq('jemaatId', auth.adminJemaatId)
    .not('deletedAt', 'is', null)
    .order('deletedAt', { ascending: false })
  trashRows.value = (data ?? []) as Row[]
}

function formatTanggal(iso: string) {
  const datePart = iso.includes('T') ? iso.slice(0, 10) : iso
  return new Date(datePart + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

const filteredHistory = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return historyRows.value
  return historyRows.value.filter((r) => formatTanggal(r.tanggal).toLowerCase().includes(q) || r.sesi.toLowerCase().includes(q))
})

interface MonthGroup {
  key: string
  label: string
  entries: Row[]
}
const groupedHistory = computed<MonthGroup[]>(() => {
  const map = new Map<string, MonthGroup>()
  for (const row of filteredHistory.value) {
    const key = row.tanggal.slice(0, 7) // "YYYY-MM" — rows are already tanggal-desc, so insertion order stays newest-first
    let g = map.get(key)
    if (!g) {
      const label = new Date(row.tanggal.slice(0, 10) + 'T00:00:00').toLocaleDateString('id-ID', {
        month: 'long',
        year: 'numeric',
      })
      g = { key, label, entries: [] }
      map.set(key, g)
    }
    g.entries.push(row)
  }
  return Array.from(map.values())
})

async function toggleTrash() {
  showTrash.value = !showTrash.value
  query.value = ''
  if (showTrash.value && !trashRows.value.length) await loadTrash()
}

async function removeFromHistory(row: Row) {
  if (!confirm(`Hapus liturgi ${SESI_LABEL[row.sesi]} — ${formatTanggal(row.tanggal)}? Masih bisa dipulihkan lewat Sampah.`))
    return
  actionError.value = null
  const { error } = await supabase.from('liturgi').update({ deletedAt: new Date().toISOString() }).eq('id', row.id)
  if (error) {
    actionError.value = `Gagal menghapus: ${error.message}`
    return
  }
  historyRows.value = historyRows.value.filter((r) => r.id !== row.id)
  await loadWeek()
}

async function restore(row: Row) {
  actionError.value = null
  const { error } = await supabase.from('liturgi').update({ deletedAt: null }).eq('id', row.id)
  if (error) {
    actionError.value = `Gagal memulihkan: ${error.message}`
    return
  }
  trashRows.value = trashRows.value.filter((r) => r.id !== row.id)
  await loadHistory()
  await loadWeek()
}

async function permanentDelete(row: Row) {
  if (!confirm(`Hapus permanen liturgi ${SESI_LABEL[row.sesi]} — ${formatTanggal(row.tanggal)}? Tindakan ini TIDAK BISA dibatalkan.`))
    return
  actionError.value = null
  const { error } = await supabase.from('liturgi').delete().eq('id', row.id)
  if (error) {
    actionError.value = `Gagal menghapus permanen: ${error.message}`
    return
  }
  const path = extractStoragePath(row.fileUrl)
  if (path) await supabase.storage.from('liturgi-files').remove([path])
  trashRows.value = trashRows.value.filter((r) => r.id !== row.id)
}

onMounted(async () => {
  loading.value = true
  if (auth.adminJemaatId) {
    const { data } = await supabase.from('jemaat').select('name').eq('id', auth.adminJemaatId).maybeSingle()
    jemaatName.value = data?.name ?? ''
  }
  await Promise.all([loadWeek(), loadHistory()])
  loading.value = false
})
</script>

<template>
  <AdminShell>
    <div class="space-y-6">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p class="label-eyebrow text-accent">Admin</p>
          <h1 class="font-display text-2xl font-semibold text-ink">{{ jemaatName || 'Jemaat Saya' }}</h1>
          <p class="mt-0.5 text-sm text-muted">Kelola jadwal dan riwayat liturgi jemaat kamu.</p>
        </div>
        <RouterLink to="/upload" class="btn-primary gap-1.5">
          <Plus class="h-4 w-4" /> Upload Liturgi
        </RouterLink>
      </div>

      <p v-if="actionError" class="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
        {{ actionError }}
      </p>

      <!-- ── Minggu ini ── -->
      <div class="field-group">
        <p class="field-group-heading">
          <CalendarDays class="h-4 w-4 text-accent" /> Minggu Ini
        </p>

        <div class="flex items-center justify-center gap-3 rounded-2xl border border-line bg-paper px-4 py-2.5">
          <button class="btn-ghost !px-2" aria-label="Minggu sebelumnya" @click="shiftWeek(-1)">
            <ChevronLeft class="h-4 w-4" />
          </button>
          <div class="text-sm font-medium text-ink">{{ selectedDateLabel }}</div>
          <button class="btn-ghost !px-2" aria-label="Minggu berikutnya" @click="shiftWeek(1)">
            <ChevronRight class="h-4 w-4" />
          </button>
        </div>

        <ul class="mt-3 divide-y divide-line">
          <li v-for="s in SESI_ORDER" :key="s" class="flex items-center justify-between gap-2 py-2.5">
            <span class="flex items-center gap-2 text-sm text-ink">
              <component :is="SESI_ICON[s]" class="h-4 w-4 text-muted" />
              {{ SESI_LABEL[s] }}
            </span>

            <template v-if="slotFor(s)">
              <div class="flex items-center gap-2">
                <span
                  class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
                  :class="slotFor(s)!.status === 'PUBLISHED' ? 'bg-accent-soft text-accent' : 'bg-gold-soft text-gold'"
                >
                  {{ slotFor(s)!.status === 'PUBLISHED' ? 'Terbit' : 'Draf' }}
                </span>
                <RouterLink :to="`/liturgi/${slotFor(s)!.id}/edit`" class="rounded p-1.5 text-accent hover:bg-accent-soft" title="Edit">
                  <Pencil class="h-3.5 w-3.5" />
                </RouterLink>
                <button
                  type="button"
                  class="rounded p-1.5 text-danger hover:bg-danger/10 disabled:opacity-50"
                  title="Hapus"
                  :disabled="deletingId === slotFor(s)!.id"
                  @click="quickDelete(s, slotFor(s)!)"
                >
                  <Trash2 class="h-3.5 w-3.5" />
                </button>
              </div>
            </template>
            <RouterLink
              v-else
              :to="{ path: '/upload', query: { tanggal: selectedDate, sesi: s } }"
              class="chip gap-1 border border-dashed border-line px-2.5 py-1 text-xs text-muted transition-colors hover:border-accent-line hover:text-accent"
            >
              <Plus class="h-3 w-3" /> Upload
            </RouterLink>
          </li>
        </ul>
      </div>

      <!-- ── Riwayat ── -->
      <div class="field-group">
        <div class="flex items-center justify-between gap-2">
          <p class="field-group-heading">
            <History class="h-4 w-4 text-accent" /> {{ showTrash ? 'Sampah' : 'Riwayat' }}
          </p>
          <button class="btn-ghost gap-1.5 text-xs text-muted" @click="toggleTrash">
            <component :is="showTrash ? ArrowLeft : Trash2" class="h-3.5 w-3.5" />
            {{ showTrash ? 'Kembali' : 'Sampah' }}
          </button>
        </div>

        <div v-if="!showTrash" class="relative mt-1">
          <Search class="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input v-model="query" type="text" placeholder="Cari tanggal atau sesi…" class="input pl-8 text-sm" />
        </div>

        <p v-if="loading" class="py-8 text-center text-sm text-muted">Memuat…</p>

        <!-- Normal: grouped by month -->
        <template v-else-if="!showTrash">
          <div v-if="!groupedHistory.length" class="py-8 text-center text-sm text-muted">
            {{ query ? `Tidak ada yang cocok dengan "${query}".` : 'Belum ada riwayat liturgi.' }}
          </div>
          <div v-else class="mt-2 space-y-4">
            <div v-for="group in groupedHistory" :key="group.key">
              <p class="label-eyebrow mb-1.5">{{ group.label }}</p>
              <ul class="card divide-y divide-line p-0">
                <li
                  v-for="row in group.entries"
                  :key="row.id"
                  class="flex items-center justify-between gap-2 px-3.5 py-2.5"
                >
                  <RouterLink :to="`/liturgi/${row.id}/edit`" class="flex items-center gap-2 text-sm text-ink hover:text-accent">
                    <span class="h-1.5 w-1.5 rounded-full" :class="row.status === 'PUBLISHED' ? 'bg-accent' : 'bg-line'" />
                    <component :is="SESI_ICON[row.sesi]" class="h-3.5 w-3.5 text-muted" />
                    {{ SESI_LABEL[row.sesi] }} · {{ formatTanggal(row.tanggal) }}
                  </RouterLink>
                  <div class="flex items-center gap-0.5">
                    <RouterLink :to="`/liturgi/${row.id}/edit`" class="rounded p-1.5 text-accent hover:bg-accent-soft" title="Edit">
                      <Pencil class="h-3.5 w-3.5" />
                    </RouterLink>
                    <button type="button" class="rounded p-1.5 text-danger hover:bg-danger/10" title="Hapus" @click="removeFromHistory(row)">
                      <Trash2 class="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </template>

        <!-- Sampah: flat list, restore / hapus permanen -->
        <template v-else>
          <p class="mt-1 text-xs text-muted">Liturgi yang dihapus tersimpan di sini sampai dipulihkan atau dihapus permanen.</p>
          <div v-if="!trashRows.length" class="py-8 text-center text-sm text-muted">Sampah kosong.</div>
          <ul v-else class="card mt-2 divide-y divide-line p-0">
            <li v-for="row in trashRows" :key="row.id" class="flex items-center justify-between gap-2 px-3.5 py-2.5">
              <span class="flex items-center gap-2 text-sm text-ink">
                <component :is="SESI_ICON[row.sesi]" class="h-3.5 w-3.5 text-muted" />
                {{ SESI_LABEL[row.sesi] }} · {{ formatTanggal(row.tanggal) }}
                <span class="text-xs text-muted">· dihapus {{ formatTanggal(row.deletedAt!) }}</span>
              </span>
              <div class="flex items-center gap-0.5">
                <button type="button" class="rounded p-1.5 text-accent hover:bg-accent-soft" title="Pulihkan" @click="restore(row)">
                  <RotateCcw class="h-3.5 w-3.5" />
                </button>
                <button type="button" class="rounded p-1.5 text-danger hover:bg-danger/10" title="Hapus permanen" @click="permanentDelete(row)">
                  <Trash2 class="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          </ul>
        </template>
      </div>
    </div>
  </AdminShell>
</template>
