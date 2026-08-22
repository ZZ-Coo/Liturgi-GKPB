<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { fetchAllJemaat } from '@/lib/tenant'
import { liturgicalTint } from '@/lib/liturgicalColor'
import AdminShell from '@/components/admin/AdminShell.vue'
import { Plus, ChevronDown, FileText, FileType2, Sun, Moon, CheckCircle2, Circle, Trash2, Search } from 'lucide-vue-next'

interface Row {
  id: string
  tanggal: string
  sesi: 'PAGI' | 'SORE'
  mingguKe: string | null
  warnaLiturgi: string | null
  status: 'DRAFT' | 'PUBLISHED'
  fileType: 'PDF' | 'DOCX'
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

const hasMore = computed(() => rows.value.length < total.value)

// Client-side text filter on top of the server-side daerah filter — fast
// enough since PAGE_SIZE keeps the loaded set small, and it means typing
// a church name doesn't need its own round trip.
const visibleRows = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return rows.value
  return rows.value.filter((r) => r.jemaat?.name.toLowerCase().includes(q))
})

function formatTanggal(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

async function load(reset: boolean) {
  if (reset) {
    loading.value = true
    rows.value = []
  } else {
    loadingMore.value = true
  }

  const from = rows.value.length
  const to = from + PAGE_SIZE - 1

  let q = supabase
    .from('liturgi')
    // !inner so filtering on jemaat.category actually narrows the rows
    // (a plain embed would still return every liturgi row).
    .select('id, tanggal, sesi, mingguKe, warnaLiturgi, status, fileType, jemaat:jemaatId!inner(name, category)', {
      count: 'exact',
    })
    .order('tanggal', { ascending: false })
    .range(from, to)

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

onMounted(async () => {
  const jemaat = await fetchAllJemaat()
  const set = new Set(jemaat.map((j) => j.category).filter((c): c is string => !!c))
  daerahList.value = ['Semua', ...Array.from(set).sort()]
  await load(true)
})

async function remove(row: Row) {
  if (!confirm(`Hapus liturgi ${row.jemaat?.name ?? ''} — ${row.tanggal}?`)) return
  const { error } = await supabase.from('liturgi').delete().eq('id', row.id)
  if (!error) {
    rows.value = rows.value.filter((r) => r.id !== row.id)
    total.value = Math.max(0, total.value - 1)
  }
}

async function togglePublish(row: Row) {
  const next = row.status === 'DRAFT' ? 'PUBLISHED' : 'DRAFT'
  const { error } = await supabase.from('liturgi').update({ status: next }).eq('id', row.id)
  if (!error) row.status = next
}
</script>

<template>
  <AdminShell>
    <div class="space-y-6">
      <!-- header: eyebrow + serif title + live count, matches the public page's letterhead voice -->
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p class="label-eyebrow text-accent">Admin</p>
          <h1 class="font-display text-2xl font-semibold text-ink">Semua Liturgi</h1>
          <p v-if="!loading" class="mt-0.5 text-xs text-muted">
            {{ total }} berkas{{ daerah !== 'Semua' ? ` · ${daerah}` : '' }}
          </p>
        </div>
        <RouterLink to="/upload" class="btn-primary gap-1.5">
          <Plus class="h-4 w-4" /> Upload Liturgi
        </RouterLink>
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

      <p v-if="loading" class="py-10 text-center text-sm text-muted">Memuat…</p>

      <template v-else>
        <!-- ledger-style rows: a left rule colored by publish status carries the
             status at a glance, before you even read the pill — like a register -->
        <ul class="card divide-y divide-line p-0">
          <li
            v-for="row in visibleRows"
            :key="row.id"
            class="group flex items-center gap-3 border-l-[3px] py-3 pl-3.5 pr-3 transition-colors hover:bg-accent-soft/30"
            :class="row.status === 'PUBLISHED' ? 'border-l-accent' : 'border-l-line'"
          >
            <component
              :is="row.fileType === 'PDF' ? FileText : FileType2"
              class="h-4 w-4 shrink-0 text-muted"
            />

            <RouterLink :to="`/liturgi/${row.id}/edit`" class="min-w-0 flex-1">
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
                  <component :is="row.sesi === 'PAGI' ? Sun : Moon" class="h-3 w-3" />
                  {{ row.sesi === 'PAGI' ? 'Pagi' : 'Sore' }}
                </span>
                <span v-if="row.jemaat?.category">· {{ row.jemaat.category }}</span>
              </p>
            </RouterLink>

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
          </li>

          <li v-if="!visibleRows.length" class="px-4 py-10 text-center text-sm text-muted">
            <template v-if="query">Tidak ada liturgi yang cocok dengan "{{ query }}".</template>
            <template v-else>
              Belum ada liturgi{{ daerah !== 'Semua' ? ` di ${daerah}` : '' }}.
              <RouterLink to="/upload" class="text-accent hover:underline">Upload yang pertama</RouterLink>.
            </template>
          </li>
        </ul>

        <div v-if="hasMore" class="flex justify-center pt-1">
          <button class="btn" :disabled="loadingMore" @click="load(false)">
            {{ loadingMore ? 'Memuat…' : `Muat lebih banyak (${rows.length}/${total})` }}
          </button>
        </div>
      </template>
    </div>
  </AdminShell>
</template>
