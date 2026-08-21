<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { fetchAllJemaat, buildTenantUrl, type JemaatRecord } from '@/lib/tenant'
import { Church, ChevronDown, MapPin } from 'lucide-vue-next'

const jemaatList = ref<JemaatRecord[]>([])
const loading = ref(true)

onMounted(async () => {
  jemaatList.value = await fetchAllJemaat()
  loading.value = false
})

const UNSPECIFIED = 'Lainnya'

// Grouped by daerah so someone can jump straight to their own region
// instead of scanning one long flat list — each group opens on demand
// (native <details>, no JS state needed for expand/collapse).
const groups = computed(() => {
  const map = new Map<string, JemaatRecord[]>()
  for (const jemaat of jemaatList.value) {
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
</script>

<template>
  <div
    class="min-h-screen bg-[radial-gradient(ellipse_at_top,theme(colors.accent.soft)_0%,theme(colors.paper)_55%)] px-4 py-10"
  >
    <div class="mx-auto max-w-xl space-y-6">
      <div class="flex flex-col items-center gap-2 text-center">
        <div class="flex h-14 w-14 items-center justify-center rounded-full border border-line bg-white shadow-sm">
          <Church class="h-6 w-6 text-accent" stroke-width="1.75" />
        </div>
        <div>
          <p class="label-eyebrow">Liturgi GKPB</p>
          <h1 class="font-display text-xl font-semibold text-ink">Pilih Jemaat</h1>
        </div>
      </div>

      <p v-if="loading" class="text-center text-sm text-muted">Memuat daftar jemaat…</p>

      <div v-else-if="!jemaatList.length" class="card py-6 text-center text-sm text-muted">
        Belum ada jemaat terdaftar. Jalankan <code class="text-xs">npm run seed:jemaat</code> dulu.
      </div>

      <!-- one <details> per daerah — starts closed so the page reads as a
           short list of regions first, not a wall of ~30 church names -->
      <div v-else class="space-y-3">
        <details
          v-for="group in groups"
          :key="group.category"
          class="card group overflow-hidden p-0 open:pb-1"
        >
          <summary
            class="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 select-none"
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
            <li v-for="jemaat in group.jemaat" :key="jemaat.id">
              <a
                :href="buildTenantUrl(jemaat.slug)"
                class="flex items-center justify-between px-4 py-2.5 pl-10 text-sm text-ink hover:bg-accent-soft/40"
              >
                {{ jemaat.name }}
              </a>
            </li>
          </ul>
        </details>
      </div>
    </div>
  </div>
</template>