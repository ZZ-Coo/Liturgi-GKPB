<script setup lang="ts">
// Admin landing page: "does jemaat X have this week's liturgi yet" — the
// question that actually matters day-to-day — instead of a flat
// chronological ledger of every liturgi ever uploaded (still available at
// /semua for full history browsing). Grouped by daerah the same way the
// public RootView groups its jemaat picker, so triaging a single daerah
// means opening one accordion instead of scanning everyone.
import { ref, computed, onMounted, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { fetchAllJemaat, type JemaatRecord } from '@/lib/tenant'
import { nearestSundayIso, toIsoDate } from '@/lib/date'
import AdminShell from '@/components/admin/AdminShell.vue'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Search,
  Sunrise,
  Sun,
  Sunset,
  Plus,
  CalendarDays,
  Pencil,
  Trash2,
} from 'lucide-vue-next'

type Sesi = 'PAGI' | 'SIANG' | 'SORE'
const SESI_ORDER: Sesi[] = ['PAGI', 'SIANG', 'SORE']
const SESI_ICON = { PAGI: Sunrise, SIANG: Sun, SORE: Sunset } as const
const SESI_LABEL = { PAGI: 'Pagi', SIANG: 'Siang', SORE: 'Sore' } as const

interface SlotInfo {
  id: string
  status: 'DRAFT' | 'PUBLISHED'
  fileUrl: string
}

const jemaatList = ref<JemaatRecord[]>([])
const loading = ref(true)
// jemaatId -> sesi -> slot info (only sessions that actually have a row)
const slotsByJemaat = ref<Map<string, Partial<Record<Sesi, SlotInfo>>>>(new Map())

const query = ref('')
const daerah = ref('Semua')
const daerahList = ref<string[]>([])

// Defaults to the nearest upcoming Sunday (or today, if today IS Sunday) —
// the week an admin actually cares about day-to-day. Prev/next step by a
// full week so it always lands back on a Sunday. (Shared with the public
// LiturgiView's own default — see lib/date.ts.)
const selectedDate = ref<string>(nearestSundayIso())

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
  loading.value = true
  const { data } = await supabase
    .from('liturgi')
    .select('id, jemaatId, sesi, status, fileUrl')
    .eq('tanggal', selectedDate.value)
    // Without this, a soft-deleted slot (see LiturgiListView's Sampah) would
    // still show here as a filled/occupied session chip — the whole point
    // of soft delete is that it's supposed to free the slot back up.
    .is('deletedAt', null)

  const map = new Map<string, Partial<Record<Sesi, SlotInfo>>>()
  for (const row of data ?? []) {
    const entry = map.get(row.jemaatId) ?? {}
    entry[row.sesi as Sesi] = { id: row.id, status: row.status, fileUrl: row.fileUrl }
    map.set(row.jemaatId, entry)
  }
  slotsByJemaat.value = map
  loading.value = false
}

const deletingSlot = ref<string | null>(null)
const actionError = ref<string | null>(null)

// Inline delete straight from a session chip — the whole point of the
// hover actions is not having to detour through the edit page just to
// remove a slot. Refetches afterwards rather than patching the Map by
// hand, since a full week's worth of rows is a cheap, simple query.
//
// Soft delete only, same as LiturgiListView's `remove()` — this chip is
// one accidental click away during a hover, so it must not permanently
// destroy the file. It has to go through the same Sampah/restore path,
// not a shortcut around it.
async function deleteSlot(jemaatName: string, s: Sesi, slot: SlotInfo) {
  if (!confirm(`Hapus liturgi ${jemaatName} — ${SESI_LABEL[s]}? Masih bisa dipulihkan lewat Sampah.`)) return
  deletingSlot.value = slot.id
  actionError.value = null
  try {
    const { error } = await supabase
      .from('liturgi')
      .update({ deletedAt: new Date().toISOString() })
      .eq('id', slot.id)
    if (error) throw error
    await loadSlots()
  } catch (err) {
    actionError.value = err instanceof Error ? `Gagal menghapus: ${err.message}` : 'Gagal menghapus.'
  } finally {
    deletingSlot.value = null
  }
}

watch(selectedDate, loadSlots)

onMounted(async () => {
  jemaatList.value = await fetchAllJemaat()
  const set = new Set(jemaatList.value.map((j) => j.category).filter((c): c is string => !!c))
  daerahList.value = ['Semua', ...Array.from(set).sort()]
  await loadSlots()
})

function jemaatStatus(id: string): 'kosong' | 'draf' | 'terbit' {
  const slots = slotsByJemaat.value.get(id)
  if (!slots) return 'kosong'
  const values = Object.values(slots) as SlotInfo[]
  if (values.some((s) => s.status === 'PUBLISHED')) return 'terbit'
  if (values.length) return 'draf'
  return 'kosong'
}

const filteredJemaat = computed(() => {
  const q = query.value.trim().toLowerCase()
  return jemaatList.value.filter((j) => {
    if (daerah.value !== 'Semua' && j.category !== daerah.value) return false
    if (q && !j.name.toLowerCase().includes(q)) return false
    return true
  })
})

const groups = computed(() => {
  const map = new Map<string, JemaatRecord[]>()
  for (const j of filteredJemaat.value) {
    const key = j.category || 'Lainnya'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(j)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, list]) => ({
      category,
      jemaat: list.slice().sort((a, b) => a.name.localeCompare(b.name)),
      terbitCount: list.filter((j) => jemaatStatus(j.id) === 'terbit').length,
    }))
})

const isFiltering = computed(() => query.value.trim().length > 0 || daerah.value !== 'Semua')

// Summary strip — the "at a glance" number an admin actually wants before
// drilling into any single daerah.
const summary = computed(() => {
  const total = jemaatList.value.length
  const terbit = jemaatList.value.filter((j) => jemaatStatus(j.id) === 'terbit').length
  const draf = jemaatList.value.filter((j) => jemaatStatus(j.id) === 'draf').length
  return { total, terbit, draf, kosong: total - terbit - draf }
})
</script>

<template>
  <AdminShell>
    <div class="space-y-6">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p class="label-eyebrow text-accent">Admin</p>
          <h1 class="font-display text-2xl font-semibold text-ink">Ringkasan Mingguan</h1>
          <p v-if="!loading" class="mt-0.5 text-xs text-muted">
            {{ summary.terbit }} terbit · {{ summary.draf }} draf · {{ summary.kosong }} belum ada dari
            {{ summary.total }} jemaat
          </p>
        </div>
        <RouterLink to="/upload" class="btn-primary gap-1.5">
          <Plus class="h-4 w-4" /> Upload Liturgi
        </RouterLink>
      </div>

      <!-- week navigator — this is what makes the page "which week am I
           looking at", not just "everything, always" -->
      <div class="flex items-center justify-center gap-3 rounded-2xl border border-line bg-white px-4 py-3 shadow-card">
        <button class="btn-ghost !px-2" aria-label="Minggu sebelumnya" @click="shiftWeek(-1)">
          <ChevronLeft class="h-4 w-4" />
        </button>
        <div class="flex items-center gap-1.5 text-sm font-medium text-ink">
          <CalendarDays class="h-4 w-4 text-accent" />
          {{ selectedDateLabel }}
        </div>
        <button class="btn-ghost !px-2" aria-label="Minggu berikutnya" @click="shiftWeek(1)">
          <ChevronRight class="h-4 w-4" />
        </button>
      </div>

      <!-- toolbar: search + daerah filter, same pattern as /semua -->
      <div class="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div class="relative flex-1">
          <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input v-model="query" type="text" placeholder="Cari nama jemaat…" class="input pl-9" />
        </div>
        <div v-if="daerahList.length > 2" class="relative shrink-0">
          <select v-model="daerah" class="input w-full appearance-none pr-8 sm:w-auto">
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

      <div v-else-if="!groups.length" class="card py-10 text-center text-sm text-muted">
        Tidak ada jemaat yang cocok.
      </div>

      <div v-else class="space-y-3">
        <details
          v-for="group in groups"
          :key="group.category"
          class="card group overflow-hidden p-0 open:pb-1"
          :open="isFiltering"
        >
          <summary class="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3.5 select-none">
            <span class="flex items-center gap-2 text-sm font-medium text-ink">
              <MapPin class="h-4 w-4 text-accent" stroke-width="1.75" />
              {{ group.category }}
            </span>
            <span class="flex items-center gap-2">
              <span
                class="rounded-full px-2 py-0.5 text-xs font-medium"
                :class="group.terbitCount === group.jemaat.length ? 'bg-accent-soft text-accent' : 'bg-line/70 text-muted'"
              >
                {{ group.terbitCount }}/{{ group.jemaat.length }} terbit
              </span>
              <ChevronDown class="h-4 w-4 text-muted transition-transform group-open:rotate-180" />
            </span>
          </summary>

          <ul class="divide-y divide-line border-t border-line">
            <li
              v-for="jemaat in group.jemaat"
              :key="jemaat.id"
              class="flex flex-wrap items-center justify-between gap-2 px-4 py-3 pl-10"
            >
              <span class="text-sm text-ink">{{ jemaat.name }}</span>

              <!-- three session chips: filled = colored, hover reveals inline
                   Edit/Delete (no detour through the edit page just to
                   remove a slot); empty = dashed "+" & links to upload
                   pre-filled for that exact jemaat/tanggal/sesi. This IS
                   the sorting tool — an admin scans for dashed chips, not
                   rows in a giant table. -->
              <div class="flex items-center gap-1.5">
                <template v-for="s in SESI_ORDER" :key="s">
                  <div
                    v-if="slotsByJemaat.get(jemaat.id)?.[s]"
                    class="group/chip relative"
                  >
                    <!-- base label — hidden on hover -->
                    <span
                      class="chip gap-1 border px-2 py-1 text-xs transition-opacity group-hover/chip:opacity-0"
                      :class="
                        slotsByJemaat.get(jemaat.id)![s]!.status === 'PUBLISHED'
                          ? 'border-accent/30 bg-accent-soft text-accent'
                          : 'border-gold/30 bg-gold-soft text-gold'
                      "
                    >
                      <component :is="SESI_ICON[s]" class="h-3 w-3" /> {{ SESI_LABEL[s] }}
                    </span>

                    <!-- hover overlay: edit + delete, same footprint -->
                    <div
                      class="absolute inset-0 flex items-stretch gap-0.5 opacity-0 transition-opacity group-hover/chip:opacity-100"
                    >
                      <RouterLink
                        :to="`/liturgi/${slotsByJemaat.get(jemaat.id)![s]!.id}/edit`"
                        class="flex flex-1 items-center justify-center rounded-l-full border border-accent/30 bg-white text-accent"
                        title="Edit"
                      >
                        <Pencil class="h-3 w-3" />
                      </RouterLink>
                      <button
                        type="button"
                        class="flex flex-1 items-center justify-center rounded-r-full border border-danger/30 bg-white text-danger disabled:opacity-50"
                        title="Hapus"
                        :disabled="deletingSlot === slotsByJemaat.get(jemaat.id)![s]!.id"
                        @click="deleteSlot(jemaat.name, s, slotsByJemaat.get(jemaat.id)![s]!)"
                      >
                        <Trash2 class="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  <RouterLink
                    v-else
                    :to="{ path: '/upload', query: { jemaatId: jemaat.id, tanggal: selectedDate, sesi: s } }"
                    class="chip gap-1 border border-dashed border-line px-2 py-1 text-xs text-muted transition-colors hover:border-accent-line hover:text-accent"
                  >
                    <Plus class="h-3 w-3" /> {{ SESI_LABEL[s] }}
                  </RouterLink>
                </template>
              </div>
            </li>
          </ul>
        </details>
      </div>
    </div>
  </AdminShell>
</template>
