<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { extractStoragePath } from '@/lib/storage'
import { fetchAllJemaat } from '@/lib/tenant'
import { liturgicalTint } from '@/lib/liturgicalColor'
import { simplifiedView } from '@/composables/adminViewMode'
import AdminShell from '@/components/admin/AdminShell.vue'
import {
  Plus,
  ChevronDown,
  FileText,
  FileType2,
  Sunrise,
  Sun,
  Sunset,
  CheckCircle2,
  Circle,
  Trash2,
  Pencil,
  Search,
  X,
  Loader2,
  ArrowLeft,
  RotateCcw,
} from 'lucide-vue-next'

interface Row {
  id: string
  tanggal: string
  sesi: 'PAGI' | 'SIANG' | 'SORE'
  mingguKe: string | null
  warnaLiturgi: string | null
  status: 'DRAFT' | 'PUBLISHED'
  fileType: 'PDF' | 'DOCX'
  fileUrl: string
  deletedAt: string | null
  jemaat: { name: string; category: string | null } | null
}

const PAGE_SIZE = 20

const rows = ref<Row[]>([])
const loading = ref(true) // first load / filter change — replaces the list
const loadingMore = ref(false) // pagination — appends to the list
const total = ref(0)
const daerah = ref('Semua')
const daerahList = ref<string[]>([])
const query = ref('')
const actionError = ref<string | null>(null)
// Sampah (trash) — a separate view of soft-deleted rows, not a filter
// alongside the normal list, since the available actions are completely
// different (restore / delete forever vs. edit / publish / soft-delete).
const showTrash = ref(false)

const hasMore = computed(() => rows.value.length < total.value)

// Client-side text filter on top of the server-side daerah filter — fast
// enough since PAGE_SIZE keeps the loaded set small, and it means typing
// a church name doesn't need its own round trip.
const visibleRows = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return rows.value
  return rows.value.filter((r) => r.jemaat?.name.toLowerCase().includes(q))
})

const SESI_ICON = { PAGI: Sunrise, SIANG: Sun, SORE: Sunset } as const
const SESI_LABEL = { PAGI: 'Pagi', SIANG: 'Siang', SORE: 'Sore' } as const

// Simplified mode. Groups by name (rows here don't carry a bare
// jemaatId — only the embedded jemaat object — and duplicate names
// within one daerah aren't a real-world case). Within each jemaat,
// keeps at most the most recent row per sesi (rows already arrive
// tanggal-desc, so "first seen wins"), which is what caps it at up to
// 3 entries and matches "only sessions that actually have a liturgi" —
// jemaat/sessions with nothing uploaded yet just don't appear at all.
interface JemaatGroup {
  name: string
  category: string | null
  entries: Row[]
}
const groupedByJemaat = computed<JemaatGroup[]>(() => {
  const map = new Map<string, JemaatGroup>()
  for (const row of visibleRows.value) {
    const name = row.jemaat?.name ?? '—'
    let group = map.get(name)
    if (!group) {
      group = { name, category: row.jemaat?.category ?? null, entries: [] }
      map.set(name, group)
    }
    if (!group.entries.some((e) => e.sesi === row.sesi)) group.entries.push(row)
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
})

function formatTanggal(iso: string) {
  // Defensive: handles a plain "2026-08-22" (the normal case now that the
  // column is DATE) as well as a stray full timestamp, so this never
  // silently regresses back into "Invalid Date" if the column type changes.
  const datePart = iso.includes('T') ? iso.slice(0, 10) : iso
  return new Date(datePart + 'T00:00:00').toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

async function load(reset: boolean) {
  if (reset) {
    loading.value = true
    rows.value = []
    selected.value.clear()
  } else {
    loadingMore.value = true
  }

  const from = rows.value.length
  const to = from + PAGE_SIZE - 1

  let q = supabase
    .from('liturgi')
    // !inner so filtering on jemaat.category actually narrows the rows
    // (a plain embed would still return every liturgi row).
    .select(
      'id, tanggal, sesi, mingguKe, warnaLiturgi, status, fileType, fileUrl, deletedAt, jemaat:jemaatId!inner(name, category)',
      { count: 'exact' },
    )
    .order('tanggal', { ascending: false })
    .range(from, to)

  q = showTrash.value ? q.not('deletedAt', 'is', null) : q.is('deletedAt', null)
  if (daerah.value !== 'Semua') q = q.eq('jemaat.category', daerah.value)

  const { data, count } = await q
  rows.value = rows.value.concat((data as unknown as Row[]) ?? [])
  total.value = count ?? rows.value.length
  loading.value = false
  loadingMore.value = false
}

async function onDaerahChange() {
  await load(true)
}

async function toggleTrash() {
  showTrash.value = !showTrash.value
  await load(true)
}

onMounted(async () => {
  const jemaat = await fetchAllJemaat()
  const set = new Set(jemaat.map((j) => j.category).filter((c): c is string => !!c))
  daerahList.value = ['Semua', ...Array.from(set).sort()]
  await load(true)
})

async function remove(row: Row) {
  if (!confirm(`Hapus liturgi ${row.jemaat?.name ?? ''} — ${row.tanggal}? Masih bisa dipulihkan lewat Sampah.`)) return
  actionError.value = null
  // Soft delete only — file stays in storage untouched (restore needs it
  // back). Permanent removal is a separate, more deliberate action from
  // within the Sampah view.
  const { error } = await supabase.from('liturgi').update({ deletedAt: new Date().toISOString() }).eq('id', row.id)
  if (error) {
    actionError.value = `Gagal menghapus: ${error.message}`
    return
  }

  rows.value = rows.value.filter((r) => r.id !== row.id)
  selected.value.delete(row.id)
  total.value = Math.max(0, total.value - 1)
}

async function restore(row: Row) {
  actionError.value = null
  const { error } = await supabase.from('liturgi').update({ deletedAt: null }).eq('id', row.id)
  if (error) {
    actionError.value = `Gagal memulihkan: ${error.message}`
    return
  }
  rows.value = rows.value.filter((r) => r.id !== row.id)
  total.value = Math.max(0, total.value - 1)
}

async function permanentDelete(row: Row) {
  if (!confirm(`Hapus permanen liturgi ${row.jemaat?.name ?? ''} — ${row.tanggal}? Tindakan ini TIDAK BISA dibatalkan.`))
    return
  actionError.value = null
  const { error } = await supabase.from('liturgi').delete().eq('id', row.id)
  if (error) {
    actionError.value = `Gagal menghapus permanen: ${error.message}`
    return
  }
  const path = extractStoragePath(row.fileUrl)
  if (path) await supabase.storage.from('liturgi-files').remove([path])

  rows.value = rows.value.filter((r) => r.id !== row.id)
  total.value = Math.max(0, total.value - 1)
}

async function togglePublish(row: Row) {
  actionError.value = null
  const next = row.status === 'DRAFT' ? 'PUBLISHED' : 'DRAFT'
  const { error } = await supabase.from('liturgi').update({ status: next }).eq('id', row.id)
  if (error) {
    actionError.value = `Gagal mengubah status: ${error.message}`
    return
  }
  row.status = next
}

// ── Bulk selection ────────────────────────────────────────────────────
const selected = ref<Set<string>>(new Set())
const bulkDeleting = ref(false)

const allVisibleSelected = computed(
  () => visibleRows.value.length > 0 && visibleRows.value.every((r) => selected.value.has(r.id)),
)

function toggleRow(id: string) {
  if (selected.value.has(id)) selected.value.delete(id)
  else selected.value.add(id)
}

function toggleSelectAllVisible() {
  if (allVisibleSelected.value) {
    for (const r of visibleRows.value) selected.value.delete(r.id)
  } else {
    for (const r of visibleRows.value) selected.value.add(r.id)
  }
}

async function bulkDelete() {
  const ids = Array.from(selected.value)
  if (!ids.length) return
  if (!confirm(`Hapus ${ids.length} liturgi terpilih? Masih bisa dipulihkan lewat Sampah.`)) return

  bulkDeleting.value = true
  actionError.value = null
  try {
    // Soft delete — no storage cleanup here, matches single-row remove().
    const { error } = await supabase
      .from('liturgi')
      .update({ deletedAt: new Date().toISOString() })
      .in('id', ids)
    if (error) throw error

    rows.value = rows.value.filter((r) => !selected.value.has(r.id))
    total.value = Math.max(0, total.value - ids.length)
    selected.value.clear()
  } catch (err) {
    actionError.value = err instanceof Error ? `Gagal menghapus massal: ${err.message}` : 'Gagal menghapus massal.'
  } finally {
    bulkDeleting.value = false
  }
}
</script>

<template>
  <AdminShell>
    <div class="space-y-6">
      <!-- header: eyebrow + serif title + live count, matches the public page's letterhead voice -->
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p class="label-eyebrow text-accent">Admin</p>
          <h1 class="font-display text-2xl font-semibold text-ink">{{ showTrash ? 'Sampah' : 'Semua Liturgi' }}</h1>
          <p v-if="!loading" class="mt-0.5 text-xs text-muted">
            {{ total }} berkas{{ daerah !== 'Semua' ? ` · ${daerah}` : '' }}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <button class="btn gap-1.5" @click="toggleTrash">
            <component :is="showTrash ? ArrowLeft : Trash2" class="h-4 w-4" />
            {{ showTrash ? 'Kembali' : 'Sampah' }}
          </button>
          <RouterLink v-if="!showTrash" to="/upload" class="btn-primary gap-1.5">
            <Plus class="h-4 w-4" /> Upload Liturgi
          </RouterLink>
        </div>
      </div>

      <!-- toolbar: search + custom-chevron select, side by side on wider screens -->
      <div class="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div class="relative flex-1">
          <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input v-model="query" type="text" placeholder="Cari nama jemaat…" class="input pl-9" />
        </div>
        <div v-if="daerahList.length > 2" class="relative shrink-0">
          <select v-model="daerah" class="input w-full appearance-none pr-8 sm:w-auto" @change="onDaerahChange">
            <option v-for="d in daerahList" :key="d" :value="d">
              {{ d === 'Semua' ? 'Semua Daerah' : d }}
            </option>
          </select>
          <ChevronDown class="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
        </div>
      </div>

      <p v-if="actionError" class="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
        {{ actionError }}
      </p>

      <p v-if="loading" class="py-10 text-center text-sm text-muted">Memuat…</p>

      <template v-else>
        <!-- Simplified: one row per jemaat, sessions hidden until hover.
             Bulk-select stays a Normal-mode-only tool — grouped rows don't
             map cleanly onto "select these exact liturgi rows". Never used
             in Sampah — restore/hapus-permanen need per-row visibility,
             not a hover-to-reveal group. -->
        <ul v-if="simplifiedView && !showTrash" class="card divide-y divide-line p-0">
          <li
            v-for="group in groupedByJemaat"
            :key="group.name"
            class="group/row px-4 py-3"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="text-sm font-medium text-ink">{{ group.name }}</span>
              <span class="text-xs text-muted">{{ group.entries.length }} sesi</span>
            </div>

            <!-- hidden by default; height/opacity transition on row hover -->
            <ul
              class="mt-0 max-h-0 space-y-0.5 overflow-hidden opacity-0 transition-all duration-150 group-hover/row:mt-2 group-hover/row:max-h-32 group-hover/row:opacity-100"
            >
              <li
                v-for="entry in group.entries"
                :key="entry.id"
                class="flex items-center justify-between gap-2 rounded-lg py-1 pl-1 pr-1.5 text-xs hover:bg-accent-soft/40"
              >
                <span class="flex items-center gap-1.5 text-muted">
                  <span
                    class="h-1.5 w-1.5 rounded-full"
                    :class="entry.status === 'PUBLISHED' ? 'bg-accent' : 'bg-line'"
                  />
                  <component :is="SESI_ICON[entry.sesi]" class="h-3 w-3" />
                  {{ SESI_LABEL[entry.sesi] }} · {{ formatTanggal(entry.tanggal) }}
                </span>
                <span class="flex items-center gap-0.5">
                  <RouterLink
                    :to="`/liturgi/${entry.id}/edit`"
                    class="rounded p-1 text-accent hover:bg-accent-soft"
                    title="Edit"
                  >
                    <Pencil class="h-3 w-3" />
                  </RouterLink>
                  <button
                    type="button"
                    class="rounded p-1 text-danger hover:bg-danger/10"
                    title="Hapus"
                    @click="remove(entry)"
                  >
                    <Trash2 class="h-3 w-3" />
                  </button>
                </span>
              </li>
            </ul>
          </li>

          <li v-if="!groupedByJemaat.length" class="px-4 py-10 text-center text-sm text-muted">
            <template v-if="query">Tidak ada liturgi yang cocok dengan "{{ query }}".</template>
            <template v-else>
              Belum ada liturgi{{ daerah !== 'Semua' ? ` di ${daerah}` : '' }}.
              <RouterLink to="/upload" class="text-accent hover:underline">Upload yang pertama</RouterLink>.
            </template>
          </li>
        </ul>

        <!-- Normal: the original flat, one-row-per-liturgi ledger. Also
             what Sampah uses (no grouped/simplified view there). -->
        <template v-else>
        <!-- select-all + bulk action bar — Normal mode only, not shown in
             Sampah (no bulk restore/hapus-permanen yet, keep it simple). -->
        <div v-if="!showTrash" class="flex items-center justify-between gap-3">
          <label class="flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              class="h-3.5 w-3.5 rounded border-line accent-accent"
              :checked="allVisibleSelected"
              :disabled="!visibleRows.length"
              @change="toggleSelectAllVisible"
            />
            Pilih semua
          </label>

          <div v-if="selected.size" class="flex items-center gap-2">
            <span class="text-xs text-muted">{{ selected.size }} dipilih</span>
            <button class="btn-ghost !px-2 text-muted" title="Batalkan pilihan" @click="selected.clear()">
              <X class="h-3.5 w-3.5" />
            </button>
            <button class="btn-danger gap-1.5" :disabled="bulkDeleting" @click="bulkDelete">
              <Loader2 v-if="bulkDeleting" class="h-3.5 w-3.5 animate-spin" />
              <Trash2 v-else class="h-3.5 w-3.5" />
              {{ bulkDeleting ? 'Menghapus…' : `Hapus ${selected.size}` }}
            </button>
          </div>
        </div>
        <p v-else class="text-xs text-muted">Liturgi yang dihapus tersimpan di sini sampai dipulihkan atau dihapus permanen.</p>

        <!-- ledger-style rows: a left rule colored by publish status carries the
             status at a glance, before you even read the pill — like a register -->
        <ul class="card divide-y divide-line p-0">
          <li
            v-for="row in visibleRows"
            :key="row.id"
            class="group flex items-center gap-3 border-l-[3px] py-3 pl-3.5 pr-3 transition-colors hover:bg-accent-soft/30"
            :class="[
              row.status === 'PUBLISHED' ? 'border-l-accent' : 'border-l-line',
              selected.has(row.id) ? 'bg-accent-soft/40' : '',
            ]"
          >
            <input
              v-if="!showTrash"
              type="checkbox"
              class="h-3.5 w-3.5 shrink-0 rounded border-line accent-accent"
              :checked="selected.has(row.id)"
              @change="toggleRow(row.id)"
            />

            <component
              :is="row.fileType === 'PDF' ? FileText : FileType2"
              class="h-4 w-4 shrink-0 text-muted"
            />

            <!-- Sampah rows aren't editable (they're deleted) — plain text
                 instead of a RouterLink into the edit form. -->
            <component :is="showTrash ? 'div' : RouterLink" :to="showTrash ? undefined : `/liturgi/${row.id}/edit`" class="min-w-0 flex-1">
              <p class="flex items-center gap-1.5 truncate text-sm font-medium text-ink group-hover:text-accent">
                <span
                  v-if="liturgicalTint(row.warnaLiturgi)"
                  class="h-2 w-2 shrink-0 rounded-full"
                  :class="liturgicalTint(row.warnaLiturgi)!.dot"
                  :title="`Warna Liturgi: ${liturgicalTint(row.warnaLiturgi)!.label}`"
                />
                {{ row.jemaat?.name }}
              </p>
              <p class="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted">
                <span>{{ formatTanggal(row.tanggal) }}</span>
                <span class="inline-flex items-center gap-0.5">
                  <component :is="SESI_ICON[row.sesi]" class="h-3 w-3" />
                  {{ SESI_LABEL[row.sesi] }}
                </span>
                <span v-if="row.jemaat?.category">· {{ row.jemaat.category }}</span>
                <span v-if="showTrash && row.deletedAt">· dihapus {{ formatTanggal(row.deletedAt) }}</span>
              </p>
            </component>

            <!-- Normal mode: publish toggle + soft-delete -->
            <template v-if="!showTrash">
              <button
                class="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
                :class="row.status === 'PUBLISHED' ? 'bg-accent-soft text-accent' : 'bg-line/70 text-muted'"
                :title="row.status === 'PUBLISHED' ? 'Terbit — klik untuk jadikan draf' : 'Draf — klik untuk terbitkan'"
                @click="togglePublish(row)"
              >
                <component :is="row.status === 'PUBLISHED' ? CheckCircle2 : Circle" class="h-3 w-3" />
                {{ row.status === 'PUBLISHED' ? 'Terbit' : 'Draf' }}
              </button>

              <button
                class="shrink-0 rounded-md p-1.5 text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                title="Hapus liturgi"
                aria-label="Hapus liturgi"
                @click="remove(row)"
              >
                <Trash2 class="h-4 w-4" />
              </button>
            </template>

            <!-- Sampah mode: restore, or delete forever -->
            <template v-else>
              <button
                class="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent-line"
                title="Pulihkan liturgi ini"
                @click="restore(row)"
              >
                <RotateCcw class="h-3 w-3" /> Pulihkan
              </button>

              <button
                class="shrink-0 rounded-md p-1.5 text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                title="Hapus permanen — tidak bisa dibatalkan"
                aria-label="Hapus permanen"
                @click="permanentDelete(row)"
              >
                <Trash2 class="h-4 w-4" />
              </button>
            </template>
          </li>

          <li v-if="!visibleRows.length" class="px-4 py-10 text-center text-sm text-muted">
            <template v-if="showTrash">Sampah kosong.</template>
            <template v-else-if="query">Tidak ada liturgi yang cocok dengan "{{ query }}".</template>
            <template v-else>
              Belum ada liturgi{{ daerah !== 'Semua' ? ` di ${daerah}` : '' }}.
              <RouterLink to="/upload" class="text-accent hover:underline">Upload yang pertama</RouterLink>.
            </template>
          </li>
        </ul>
        </template>

        <div v-if="hasMore" class="flex justify-center pt-1">
          <button class="btn" :disabled="loadingMore" @click="load(false)">
            {{ loadingMore ? 'Memuat…' : `Muat lebih banyak (${rows.length}/${total})` }}
          </button>
        </div>
      </template>
    </div>
  </AdminShell>
</template>