<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { RouterLink } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { extractStoragePath } from '@/lib/storage'
import { fetchAllJemaat, type JemaatRecord } from '@/lib/tenant'
import { liturgicalTint } from '@/lib/liturgicalColor'
import { nearestSundayIso, toIsoDate } from '@/lib/date'
import { simplifiedView } from '@/composables/adminViewMode'
import { pushToast } from '@/composables/toast'
import AdminShell from '@/components/admin/AdminShell.vue'
import {
  Plus,
  Filter,
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
  LayoutDashboard,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  MapPin,
  CircleDashed,
} from 'lucide-vue-next'

type Sesi = 'PAGI' | 'SIANG' | 'SORE'

interface Row {
  id: string
  tanggal: string
  sesi: Sesi
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
const jemaatList = ref<JemaatRecord[]>([]) // kept in full now — Ringkasan mode needs id, not just category strings
const query = ref('')
const actionError = ref<string | null>(null)
const filterOpen = ref(false)
const filterRootEl = ref<HTMLElement | null>(null)
function onClickOutsideFilter(e: MouseEvent) {
  if (filterOpen.value && filterRootEl.value && !filterRootEl.value.contains(e.target as Node)) filterOpen.value = false
}
document.addEventListener('mousedown', onClickOutsideFilter)
onBeforeUnmount(() => document.removeEventListener('mousedown', onClickOutsideFilter))

// Three mutually-exclusive modes sharing one page/header, not three
// routes — Sampah and Ringkasan swap out the whole content area, same
// idea, so they can't both be open at once.
const showTrash = ref(false)
const showRingkasan = ref(false)

// When this is on, every action button below drops its text label down
// to just the icon (+ a title tooltip) — the whole page reads noticeably
// lighter with ~85 jemaat's worth of rows on screen.
const compact = computed(() => simplifiedView.value)

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
const SESI_ORDER: Sesi[] = ['PAGI', 'SIANG', 'SORE']

// Simplified mode. Groups by name (rows here don't carry a bare
// jemaatId — only the embedded jemaat object — and duplicate names
// within one daerah aren't a real-world case). Within each jemaat,
// keeps at most the most recent row per sesi (rows already arrive
// tanggal-desc, so "first seen wins"), which is what caps it at up to
// 3 entries and matches "only sessions that actually have a liturgi" —
// jemaat/sessions with nothing uploaded yet just don't appear at all.
// (This is deliberately NOT date-anchored — it's "most recent ever",
// which is a different question from Ringkasan's "this specific week".
// That's exactly why Ringkasan stayed a separate mode instead of folding
// in here: conflating the two would make the dots quietly mean two
// different things depending on a sub-toggle.)
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

async function onDaerahSelect(d: string) {
  daerah.value = d
  filterOpen.value = false
  if (showRingkasan.value) return // Ringkasan filters its own already-loaded jemaatList client-side
  await load(true)
}

async function toggleTrash() {
  showTrash.value = !showTrash.value
  if (showTrash.value) showRingkasan.value = false
  await load(true)
}

// ── Ringkasan: this week's 3 sessions, per jemaat, at a glance ──
// Folded in from the old standalone Overview page/route — same job
// (which jemaat still needs this week's liturgi), but as a mode within
// this page instead of a second destination, since the two ended up
// showing near-identical jemaat+status information anyway. Deliberately
// its own state (selectedDate-scoped), not reusing groupedByJemaat above,
// because that one shows "most recent ever" — a genuinely different
// question from "this specific week".
interface SlotInfo {
  id: string
  status: 'DRAFT' | 'PUBLISHED'
  fileUrl: string
}
const selectedDate = ref<string>(nearestSundayIso())
const slotsByJemaat = ref(new Map<string, Partial<Record<Sesi, SlotInfo>>>())
const ringkasanLoading = ref(false)
const deletingSlot = ref<string | null>(null)

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

async function loadSlots() {
  ringkasanLoading.value = true
  const { data } = await supabase
    .from('liturgi')
    .select('id, jemaatId, sesi, status, fileUrl')
    .eq('tanggal', selectedDate.value)
    .is('deletedAt', null) // a soft-deleted slot should read as open again, not still "filled"

  const map = new Map<string, Partial<Record<Sesi, SlotInfo>>>()
  for (const row of data ?? []) {
    const entry = map.get(row.jemaatId) ?? {}
    entry[row.sesi as Sesi] = { id: row.id, status: row.status, fileUrl: row.fileUrl }
    map.set(row.jemaatId, entry)
  }
  slotsByJemaat.value = map
  ringkasanLoading.value = false
}

function jemaatStatus(id: string): 'kosong' | 'draf' | 'terbit' {
  const slots = slotsByJemaat.value.get(id)
  if (!slots || !Object.keys(slots).length) return 'kosong'
  return Object.values(slots).some((s) => s?.status === 'PUBLISHED') ? 'terbit' : 'draf'
}

// Shared by both Ringkasan badge renderings (Simpel + Normal) so the
// icon/label pairing can't drift out of sync between the two.
const JEMAAT_STATUS_ICON = { terbit: CheckCircle2, draf: Circle, kosong: CircleDashed } as const
const JEMAAT_STATUS_LABEL = { terbit: 'Terbit', draf: 'Draf', kosong: 'Kosong' } as const

async function deleteSlot(jemaatName: string, s: Sesi, slot: SlotInfo) {
  if (!confirm(`Hapus liturgi ${jemaatName} — ${SESI_LABEL[s]}? Masih bisa dipulihkan lewat Sampah.`)) return
  deletingSlot.value = slot.id
  actionError.value = null
  try {
    const { error } = await supabase.from('liturgi').update({ deletedAt: new Date().toISOString() }).eq('id', slot.id)
    if (error) throw error
    await loadSlots()
    pushToast('Liturgi dihapus — masih bisa dipulihkan lewat Sampah')
  } catch (err) {
    const message = err instanceof Error ? `Gagal menghapus: ${err.message}` : 'Gagal menghapus.'
    actionError.value = message
    pushToast(message, 'error')
  } finally {
    deletingSlot.value = null
  }
}

async function toggleRingkasan() {
  showRingkasan.value = !showRingkasan.value
  if (showRingkasan.value) {
    showTrash.value = false
    await loadSlots()
  }
}

// Ringkasan reuses the same `daerah` + `query` state as the normal list —
// grouped by category, filtered client-side against jemaatList (fetched
// once on mount, not re-fetched per mode).
interface DaerahGroup {
  name: string
  jemaat: JemaatRecord[]
  terbitCount: number
}
const ringkasanGroups = computed<DaerahGroup[]>(() => {
  const q = query.value.trim().toLowerCase()
  const filtered = jemaatList.value.filter((j) => {
    if (daerah.value !== 'Semua' && j.category !== daerah.value) return false
    if (q && !j.name.toLowerCase().includes(q)) return false
    return true
  })
  const map = new Map<string, JemaatRecord[]>()
  for (const j of filtered) {
    const key = j.category ?? 'Lainnya'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(j)
  }
  return Array.from(map.entries())
    .map(([name, jemaat]) => ({
      name,
      jemaat: jemaat.sort((a, b) => a.name.localeCompare(b.name)),
      terbitCount: jemaat.filter((j) => jemaatStatus(j.id) === 'terbit').length,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
})

// Only auto-expand every daerah accordion while actively searching by name
// — that's the one case where a match could be hiding inside a collapsed
// group. Otherwise (including a single daerah picked via the Filter
// button) groups stay collapsed, which is the whole point: scan the
// terbit-count badges first, only open the daerah that needs attention.
const isRingkasanFiltering = computed(() => query.value.trim().length > 0)

onMounted(async () => {
  jemaatList.value = await fetchAllJemaat()
  const set = new Set(jemaatList.value.map((j) => j.category).filter((c): c is string => !!c))
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
    const message = `Gagal menghapus: ${error.message}`
    actionError.value = message
    pushToast(message, 'error')
    return
  }

  rows.value = rows.value.filter((r) => r.id !== row.id)
  selected.value.delete(row.id)
  total.value = Math.max(0, total.value - 1)
  pushToast('Liturgi dihapus — masih bisa dipulihkan lewat Sampah')
}

async function restore(row: Row) {
  actionError.value = null
  const { error } = await supabase.from('liturgi').update({ deletedAt: null }).eq('id', row.id)
  if (error) {
    const message = `Gagal memulihkan: ${error.message}`
    actionError.value = message
    pushToast(message, 'error')
    return
  }
  rows.value = rows.value.filter((r) => r.id !== row.id)
  total.value = Math.max(0, total.value - 1)
  pushToast('Liturgi dipulihkan')
}

async function permanentDelete(row: Row) {
  if (!confirm(`Hapus permanen liturgi ${row.jemaat?.name ?? ''} — ${row.tanggal}? Tindakan ini TIDAK BISA dibatalkan.`))
    return
  actionError.value = null
  const { error } = await supabase.from('liturgi').delete().eq('id', row.id)
  if (error) {
    const message = `Gagal menghapus permanen: ${error.message}`
    actionError.value = message
    pushToast(message, 'error')
    return
  }
  const path = extractStoragePath(row.fileUrl)
  if (path) await supabase.storage.from('liturgi-files').remove([path])

  rows.value = rows.value.filter((r) => r.id !== row.id)
  total.value = Math.max(0, total.value - 1)
  pushToast('Liturgi dihapus permanen')
}

async function togglePublish(row: Row) {
  actionError.value = null
  const next = row.status === 'DRAFT' ? 'PUBLISHED' : 'DRAFT'
  const { error } = await supabase.from('liturgi').update({ status: next }).eq('id', row.id)
  if (error) {
    const message = `Gagal mengubah status: ${error.message}`
    actionError.value = message
    pushToast(message, 'error')
    return
  }
  row.status = next
  pushToast(next === 'PUBLISHED' ? 'Liturgi diterbitkan' : 'Liturgi dijadikan draf')
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
    pushToast(`${ids.length} liturgi dihapus — masih bisa dipulihkan lewat Sampah`)
  } catch (err) {
    const message = err instanceof Error ? `Gagal menghapus massal: ${err.message}` : 'Gagal menghapus massal.'
    actionError.value = message
    pushToast(message, 'error')
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
          <h1 class="font-display text-2xl font-semibold text-ink">
            {{ showTrash ? 'Sampah' : showRingkasan ? 'Ringkasan Mingguan' : 'Semua Liturgi' }}
          </h1>
          <p v-if="showRingkasan" class="mt-0.5 text-xs text-muted">{{ selectedDateLabel }}</p>
          <p v-else-if="!loading" class="mt-0.5 text-xs text-muted">
            {{ total }} berkas{{ daerah !== 'Semua' ? ` · ${daerah}` : '' }}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <button class="btn gap-1.5" :title="showRingkasan ? 'Kembali' : 'Ringkasan mingguan lintas jemaat'" @click="toggleRingkasan">
            <component :is="showRingkasan ? ArrowLeft : LayoutDashboard" class="h-4 w-4" />
            <span v-if="!compact">{{ showRingkasan ? 'Kembali' : 'Ringkasan' }}</span>
          </button>
          <button v-if="!showRingkasan" class="btn gap-1.5" :title="showTrash ? 'Kembali' : 'Sampah'" @click="toggleTrash">
            <component :is="showTrash ? ArrowLeft : Trash2" class="h-4 w-4" />
            <span v-if="!compact">{{ showTrash ? 'Kembali' : 'Sampah' }}</span>
          </button>
          <RouterLink v-if="!showTrash && !showRingkasan" to="/upload" class="btn-primary gap-1.5" title="Upload Liturgi">
            <Plus class="h-4 w-4" /> <span v-if="!compact">Upload Liturgi</span>
          </RouterLink>
        </div>
      </div>

      <!-- toolbar: search + icon-group daerah filter -->
      <div class="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div class="relative flex-1">
          <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input v-model="query" type="text" placeholder="Cari nama jemaat…" class="input pl-9" />
        </div>

        <div v-if="daerahList.length > 2" ref="filterRootEl" class="relative shrink-0">
          <button
            type="button"
            class="btn gap-1.5"
            :class="daerah !== 'Semua' && 'border-accent-line bg-accent-soft text-accent'"
            :title="daerah === 'Semua' ? 'Filter daerah' : `Daerah: ${daerah}`"
            @click="filterOpen = !filterOpen"
          >
            <Filter class="h-4 w-4" />
            <span v-if="!compact">{{ daerah === 'Semua' ? 'Filter' : daerah }}</span>
          </button>
          <div v-if="filterOpen" class="card absolute right-0 z-20 mt-1.5 w-44 flex-wrap gap-1 p-2">
            <button
              v-for="d in daerahList"
              :key="d"
              type="button"
              class="block w-full rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors"
              :class="d === daerah ? 'bg-accent-soft text-accent' : 'text-ink hover:bg-paper-deep/70'"
              @click="onDaerahSelect(d)"
            >
              {{ d === 'Semua' ? 'Semua Daerah' : d }}
            </button>
          </div>
        </div>
      </div>

      <p v-if="actionError" class="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
        {{ actionError }}
      </p>

      <!-- ═══ Ringkasan mode ═══ -->
      <template v-if="showRingkasan">
        <div class="flex items-center justify-center gap-3 rounded-2xl border border-line bg-paper px-4 py-2.5">
          <button class="btn-ghost !px-2" aria-label="Minggu sebelumnya" @click="shiftWeek(-1)">
            <ChevronLeft class="h-4 w-4" />
          </button>
          <div class="text-sm font-medium text-ink">{{ selectedDateLabel }}</div>
          <button class="btn-ghost !px-2" aria-label="Minggu berikutnya" @click="shiftWeek(1)">
            <ChevronRight class="h-4 w-4" />
          </button>
        </div>

        <p v-if="ringkasanLoading" class="py-10 text-center text-sm text-muted">Memuat…</p>
        <template v-else>
          <!-- Simplified: same global toggle as the ledger below — collapsed
               per-daerah accordions with a terbit-count badge, so scanning
               many daerah doesn't mean scrolling past every jemaat in each
               one first. -->
          <div v-if="compact" class="space-y-3">
            <details
              v-for="group in ringkasanGroups"
              :key="group.name"
              class="card group/daerah overflow-hidden p-0 open:pb-1"
              :open="isRingkasanFiltering"
            >
              <summary class="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 select-none">
                <span class="flex items-center gap-2 text-sm font-medium text-ink">
                  <MapPin class="h-4 w-4 text-accent" stroke-width="1.75" />
                  {{ group.name }}
                </span>
                <span class="flex items-center gap-2">
                  <span
                    class="rounded-full px-2 py-0.5 text-xs font-medium"
                    :class="group.terbitCount === group.jemaat.length ? 'bg-accent-soft text-accent' : 'bg-line/70 text-muted'"
                  >
                    {{ group.terbitCount }}/{{ group.jemaat.length }} terbit
                  </span>
                  <ChevronDown class="h-4 w-4 text-muted transition-transform group-open/daerah:rotate-180" />
                </span>
              </summary>

              <ul class="divide-y divide-line border-t border-line">
                <li v-for="j in group.jemaat" :key="j.id" class="group/row px-3.5 py-2.5">
                  <div class="flex items-center justify-between gap-2">
                    <span class="truncate text-sm font-medium text-ink">{{ j.name }}</span>
                    <span
                      class="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                      :class="{
                        'bg-accent-soft text-accent': jemaatStatus(j.id) === 'terbit',
                        'bg-gold-soft text-gold': jemaatStatus(j.id) === 'draf',
                        'bg-line/60 text-muted': jemaatStatus(j.id) === 'kosong',
                      }"
                    >
                      <component :is="JEMAAT_STATUS_ICON[jemaatStatus(j.id)]" class="h-3 w-3" />
                      {{ JEMAAT_STATUS_LABEL[jemaatStatus(j.id)] }}
                    </span>
                  </div>
                  <ul class="mt-0 max-h-0 space-y-0.5 overflow-hidden opacity-0 transition-all duration-150 group-hover/row:mt-2 group-hover/row:max-h-32 group-hover/row:opacity-100">
                    <li v-for="s in SESI_ORDER" :key="s" class="flex items-center justify-between gap-2 rounded-lg py-1 pl-1 pr-1.5 text-xs hover:bg-accent-soft/40">
                      <span class="flex items-center gap-1.5 text-muted">
                        <component :is="SESI_ICON[s]" class="h-3 w-3" /> {{ SESI_LABEL[s] }}
                      </span>
                      <span class="flex items-center gap-0.5">
                        <template v-if="slotsByJemaat.get(j.id)?.[s]">
                          <RouterLink :to="`/liturgi/${slotsByJemaat.get(j.id)![s]!.id}/edit`" class="rounded p-1 text-accent hover:bg-accent-soft" title="Edit">
                            <Pencil class="h-3 w-3" />
                          </RouterLink>
                          <button
                            type="button"
                            class="rounded p-1 text-danger hover:bg-danger/10 disabled:opacity-50"
                            title="Hapus"
                            :disabled="deletingSlot === slotsByJemaat.get(j.id)![s]!.id"
                            @click="deleteSlot(j.name, s, slotsByJemaat.get(j.id)![s]!)"
                          >
                            <Trash2 class="h-3 w-3" />
                          </button>
                        </template>
                        <RouterLink
                          v-else
                          :to="{ path: '/upload', query: { jemaatId: j.id, tanggal: selectedDate, sesi: s } }"
                          class="rounded p-1 text-muted hover:bg-accent-soft hover:text-accent"
                          title="Upload"
                        >
                          <Plus class="h-3 w-3" />
                        </RouterLink>
                      </span>
                    </li>
                  </ul>
                </li>
              </ul>
            </details>
            <p v-if="!ringkasanGroups.length" class="py-10 text-center text-sm text-muted">Gak ada jemaat yang cocok.</p>
          </div>

          <!-- Normal: original always-expanded per-daerah lists, unchanged. -->
          <div v-else class="space-y-5">
            <div v-for="group in ringkasanGroups" :key="group.name">
              <p class="label-eyebrow mb-1.5">{{ group.name }}</p>
              <ul class="card divide-y divide-line p-0">
                <li v-for="j in group.jemaat" :key="j.id" class="group/row px-3.5 py-2.5">
                  <div class="flex items-center justify-between gap-2">
                    <span class="truncate text-sm font-medium text-ink">{{ j.name }}</span>
                    <span
                      class="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                      :class="{
                        'bg-accent-soft text-accent': jemaatStatus(j.id) === 'terbit',
                        'bg-gold-soft text-gold': jemaatStatus(j.id) === 'draf',
                        'bg-line/60 text-muted': jemaatStatus(j.id) === 'kosong',
                      }"
                    >
                      <component :is="JEMAAT_STATUS_ICON[jemaatStatus(j.id)]" class="h-3 w-3" />
                      {{ JEMAAT_STATUS_LABEL[jemaatStatus(j.id)] }}
                    </span>
                  </div>
                  <ul class="mt-0 max-h-0 space-y-0.5 overflow-hidden opacity-0 transition-all duration-150 group-hover/row:mt-2 group-hover/row:max-h-32 group-hover/row:opacity-100">
                    <li v-for="s in SESI_ORDER" :key="s" class="flex items-center justify-between gap-2 rounded-lg py-1 pl-1 pr-1.5 text-xs hover:bg-accent-soft/40">
                      <span class="flex items-center gap-1.5 text-muted">
                        <component :is="SESI_ICON[s]" class="h-3 w-3" /> {{ SESI_LABEL[s] }}
                      </span>
                      <span class="flex items-center gap-0.5">
                        <template v-if="slotsByJemaat.get(j.id)?.[s]">
                          <RouterLink :to="`/liturgi/${slotsByJemaat.get(j.id)![s]!.id}/edit`" class="rounded p-1 text-accent hover:bg-accent-soft" title="Edit">
                            <Pencil class="h-3 w-3" />
                          </RouterLink>
                          <button
                            type="button"
                            class="rounded p-1 text-danger hover:bg-danger/10 disabled:opacity-50"
                            title="Hapus"
                            :disabled="deletingSlot === slotsByJemaat.get(j.id)![s]!.id"
                            @click="deleteSlot(j.name, s, slotsByJemaat.get(j.id)![s]!)"
                          >
                            <Trash2 class="h-3 w-3" />
                          </button>
                        </template>
                        <RouterLink
                          v-else
                          :to="{ path: '/upload', query: { jemaatId: j.id, tanggal: selectedDate, sesi: s } }"
                          class="rounded p-1 text-muted hover:bg-accent-soft hover:text-accent"
                          title="Upload"
                        >
                          <Plus class="h-3 w-3" />
                        </RouterLink>
                      </span>
                    </li>
                  </ul>
                </li>
              </ul>
            </div>
            <p v-if="!ringkasanGroups.length" class="py-10 text-center text-sm text-muted">Gak ada jemaat yang cocok.</p>
          </div>
        </template>
      </template>

      <!-- ═══ Normal / Simplified / Sampah ═══ -->
      <template v-else>
        <p v-if="loading" class="py-10 text-center text-sm text-muted">Memuat…</p>

        <template v-else>
          <!-- Simplified: grouped by jemaat, status dots visible without hover -->
          <ul v-if="simplifiedView && !showTrash" class="card divide-y divide-line p-0">
            <li
              v-for="group in groupedByJemaat"
              :key="group.name"
              class="group/row px-3.5 py-2.5"
            >
              <div class="flex items-center justify-between gap-2">
                <span class="text-sm font-medium text-ink">{{ group.name }}</span>
                <span class="flex items-center gap-1">
                  <span
                    v-for="s in SESI_ORDER"
                    :key="s"
                    class="h-2 w-2 rounded-full"
                    :class="
                      group.entries.find((e) => e.sesi === s)?.status === 'PUBLISHED'
                        ? 'bg-accent'
                        : group.entries.some((e) => e.sesi === s)
                          ? 'bg-gold'
                          : 'bg-line'
                    "
                    :title="`${SESI_LABEL[s]}: ${
                      group.entries.find((e) => e.sesi === s)?.status === 'PUBLISHED'
                        ? 'Terbit'
                        : group.entries.some((e) => e.sesi === s)
                          ? 'Draf'
                          : 'Belum ada'
                    }`"
                  />
                </span>
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
              <button class="btn-danger gap-1.5" :disabled="bulkDeleting" :title="`Hapus ${selected.size}`" @click="bulkDelete">
                <Loader2 v-if="bulkDeleting" class="h-3.5 w-3.5 animate-spin" />
                <Trash2 v-else class="h-3.5 w-3.5" />
                <span v-if="!compact">{{ bulkDeleting ? 'Menghapus…' : `Hapus ${selected.size}` }}</span>
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
                  <span v-if="!compact">{{ row.status === 'PUBLISHED' ? 'Terbit' : 'Draf' }}</span>
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
                  <RotateCcw class="h-3 w-3" /> <span v-if="!compact">Pulihkan</span>
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
      </template>
    </div>
  </AdminShell>
</template>