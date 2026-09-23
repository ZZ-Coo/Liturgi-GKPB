<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { fetchAllJemaat, buildTenantUrl, type JemaatRecord } from '@/lib/tenant'
import { ChevronDown, MapPin, Search, X, Copy, Check } from 'lucide-vue-next'
import ThemeToggle from '@/components/ThemeToggle.vue'
import AdminQuickNav from '@/components/AdminQuickNav.vue'
import BrandMark from '@/components/BrandMark.vue'

const jemaatList = ref<JemaatRecord[]>([])
const loading = ref(true)
const query = ref('')

// A jemaat with an accessCode has a link that isn't guessable/typable
// (that's the point) — so give super_admin a copy button instead of
// expecting them to read it off the screen and retype it somewhere.
const copiedId = ref<string | null>(null)
async function copyLink(jemaat: JemaatRecord) {
  try {
    await navigator.clipboard.writeText(buildTenantUrl(jemaat.slug, jemaat.accessCode))
    copiedId.value = jemaat.id
    setTimeout(() => {
      if (copiedId.value === jemaat.id) copiedId.value = null
    }, 1500)
  } catch {
    // Clipboard API can fail (permissions, insecure context) — not worth a
    // toast system just for this; the link is still visible/clickable.
  }
}

onMounted(async () => {
  jemaatList.value = await fetchAllJemaat()
  loading.value = false
})

const UNSPECIFIED = 'Lainnya'

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return jemaatList.value
  return jemaatList.value.filter((j) => j.name.toLowerCase().includes(q))
})

// Grouped by daerah so someone can jump straight to their own region
// instead of scanning one long flat list — each group opens on demand
// (native <details>, no JS state needed for expand/collapse). While
// searching, groups auto-open via the `open` attribute below.
const groups = computed(() => {
  const map = new Map<string, JemaatRecord[]>()
  for (const jemaat of filtered.value) {
    const key = jemaat.category || UNSPECIFIED
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(jemaat)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, jemaat]) => ({
      category,
      jemaat: jemaat.slice().sort((a, b) => a.name.localeCompare(b.name)),
    }))
})

const isSearching = computed(() => query.value.trim().length > 0)
</script>

<template>
  <div class="relative min-h-screen overflow-hidden bg-paper px-4 py-12 sm:py-16">
    <div class="absolute right-4 top-4 z-10 flex items-center gap-2 sm:right-6 sm:top-6">
      <AdminQuickNav :links="['admin']" />
      <ThemeToggle />
    </div>

    <!-- soft mesh backdrop instead of a flat colour, kept subtle so the
         list stays the focus -->
    <div
      class="pointer-events-none absolute inset-x-0 -top-24 h-72 bg-[radial-gradient(ellipse_at_top,theme(colors.accent.soft)_0%,transparent_65%)]"
    />
    <div
      class="pointer-events-none absolute inset-x-0 top-40 -z-10 h-56 bg-[radial-gradient(ellipse_at_center,theme(colors.gold.soft)_0%,transparent_70%)] opacity-60"
    />

    <div class="relative mx-auto max-w-xl space-y-7">
      <div class="flex flex-col items-center gap-3 text-center">
        <BrandMark size="lg" />
        <div class="space-y-1">
          <p class="label-eyebrow text-accent">Liturgi GKPB</p>
          <h1 class="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Pilih Jemaat Anda
          </h1>
          <p class="text-sm text-muted">Tata ibadah minggu ini, langsung dari jemaat masing-masing.</p>
        </div>
      </div>

      <!-- search — turns a long alphabet-soup list into something you can
           type your way through, especially useful once daerah groups grow -->
      <div class="relative">
        <Search class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          v-model="query"
          type="text"
          placeholder="Cari nama jemaat…"
          class="input rounded-full !py-3 pl-10 pr-9 shadow-soft"
        />
        <button
          v-if="query"
          class="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
          aria-label="Bersihkan pencarian"
          @click="query = ''"
        >
          <X class="h-4 w-4" />
        </button>
      </div>

      <p v-if="loading" class="py-6 text-center text-sm text-muted">Memuat daftar jemaat…</p>

      <div v-else-if="!jemaatList.length" class="card py-8 text-center text-sm text-muted">
        Belum ada jemaat terdaftar. Jalankan <code class="text-xs">npm run seed:jemaat</code> dulu.
      </div>

      <div v-else-if="!groups.length" class="card py-8 text-center text-sm text-muted">
        Tidak ada jemaat yang cocok dengan “{{ query }}”.
      </div>

      <div v-else class="space-y-3">
        <details
          v-for="group in groups"
          :key="group.category"
          class="card group overflow-hidden p-0 open:pb-1"
          :open="isSearching"
        >
          <summary
            class="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3.5 select-none"
          >
            <span class="flex items-center gap-2 text-sm font-medium text-ink">
              <MapPin class="h-4 w-4 text-accent" stroke-width="1.75" />
              {{ group.category }}
            </span>
            <span class="flex items-center gap-2">
              <span class="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">
                {{ group.jemaat.length }}
              </span>
              <ChevronDown class="h-4 w-4 text-muted transition-transform group-open:rotate-180" />
            </span>
          </summary>

          <ul class="border-t border-line">
            <li v-for="jemaat in group.jemaat" :key="jemaat.id" class="flex items-center">
              <a
                :href="buildTenantUrl(jemaat.slug, jemaat.accessCode)"
                class="flex flex-1 items-center justify-between px-4 py-3 pl-10 text-sm text-ink transition-colors hover:bg-accent-soft/50"
              >
                {{ jemaat.name }}
              </a>
              <button
                v-if="jemaat.accessCode"
                type="button"
                title="Salin link (link ini pakai kode akses, tidak bisa ditebak/diketik ulang)"
                class="mr-3 rounded-md p-1.5 text-muted transition-colors hover:bg-accent-soft hover:text-accent"
                @click="copyLink(jemaat)"
              >
                <Check v-if="copiedId === jemaat.id" class="h-4 w-4 text-accent" />
                <Copy v-else class="h-4 w-4" />
              </button>
            </li>
          </ul>
        </details>
      </div>

      <p class="pt-2 text-center text-xs text-muted">
        Tidak menemukan jemaat Anda? Hubungi admin gereja setempat.
      </p>
    </div>
  </div>
</template>