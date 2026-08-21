<script setup lang="ts">
import { ref, onMounted, defineAsyncComponent } from 'vue'
import { useRoute } from 'vue-router'
import { fetchTenantBySlug } from '@/lib/tenant'
import { useLiturgiStore } from '@/stores/liturgiStore'
import { tenant } from '@/router'
import { Sun, Moon, CalendarDays, BookOpenText, Loader2, MapPinOff, CircleAlert, CalendarX } from 'lucide-vue-next'

// Lazy-loaded so a jemaat viewing a PDF never downloads mammoth (and vice
// versa) — each pulls in a real dependency (pdfjs-dist / mammoth) that's
// only needed for its own file type.
const PdfViewer = defineAsyncComponent(() => import('@/components/PdfViewer.vue'))
const DocxViewer = defineAsyncComponent(() => import('@/components/DocxViewer.vue'))

const route = useRoute()
const liturgi = useLiturgiStore()

type Sesi = 'PAGI' | 'SORE'
const sesi = ref<Sesi>('PAGI')
const jemaatId = ref<string | null>(null)
const jemaatName = ref<string | null>(null)
const tanggal = ref<string>((route.params.tanggal as string) ?? new Date().toISOString().slice(0, 10))
const tenantLoading = ref(true)

const tanggalLabel = new Date(tanggal.value + 'T00:00:00').toLocaleDateString('id-ID', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

async function load() {
  if (!jemaatId.value) return
  await liturgi.fetchByJemaatAndDate(jemaatId.value, tanggal.value, sesi.value)
}

function switchSesi(next: Sesi) {
  if (sesi.value === next) return
  sesi.value = next
  load()
}

onMounted(async () => {
  if (tenant.kind !== 'tenant') {
    tenantLoading.value = false
    return
  }

  const jemaat = await fetchTenantBySlug(tenant.slug)
  tenantLoading.value = false
  if (!jemaat) return
  jemaatId.value = jemaat.id
  jemaatName.value = jemaat.name

  await load()
  if (!liturgi.current) await switchSesi('SORE')
})
</script>

<template>
  <div class="min-h-screen bg-[radial-gradient(ellipse_at_top,theme(colors.accent.soft)_0%,theme(colors.paper)_55%)]">
    <!-- thin decorative bar echoing the church's colours -->
    <div class="h-1.5 w-full bg-gradient-to-r from-accent via-accent-hover to-accent" />

    <div class="mx-auto max-w-5xl px-3 py-6 sm:px-4 sm:py-8 lg:grid lg:grid-cols-[280px_1fr] lg:items-start lg:gap-8">
      <!-- letterhead-style header — sticky on desktop, with a vertical rule
           on its right so the two columns read like a printed bulletin -->
      <div
        class="flex flex-col items-center gap-3 text-center lg:sticky lg:top-8 lg:items-center lg:border-r lg:border-line lg:pr-8"
      >
        <div class="space-y-0.5">
          <p v-if="jemaatName" class="font-display text-lg font-semibold leading-tight text-ink">{{ jemaatName }}</p>
          <p class="flex items-center justify-center gap-1.5 text-xs text-muted">
            <CalendarDays class="h-3.5 w-3.5" />
            {{ tanggalLabel }}
          </p>
        </div>

        <!-- session toggle: sliding pill with icons for quick, non-text recognition -->
        <div class="relative inline-flex rounded-full border border-line bg-white p-1 shadow-sm">
          <div
            class="absolute inset-y-1 w-[calc(50%-0.25rem)] rounded-full bg-accent transition-transform duration-200 ease-out"
            :class="sesi === 'SORE' ? 'translate-x-[calc(100%+0.5rem)]' : 'translate-x-0'"
          />
          <button
            class="relative z-10 flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-medium transition-colors"
            :class="sesi === 'PAGI' ? 'text-white' : 'text-muted hover:text-ink'"
            @click="switchSesi('PAGI')"
          >
            <Sun class="h-4 w-4" /> Pagi
          </button>
          <button
            class="relative z-10 flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-medium transition-colors"
            :class="sesi === 'SORE' ? 'text-white' : 'text-muted hover:text-ink'"
            @click="switchSesi('SORE')"
          >
            <Moon class="h-4 w-4" /> Sore
          </button>
        </div>

        <!-- tema card also lives in the left column on desktop — it's about
             the service, same as the header above it, not the file viewer -->
        <div
          v-if="liturgi.current?.tema"
          class="hidden w-full items-start gap-3 rounded-xl border border-line border-l-4 border-l-accent bg-white px-4 py-3 text-left shadow-sm lg:mt-2 lg:flex"
        >
          <BookOpenText class="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <div>
            <p v-if="liturgi.current.mingguKe" class="label-eyebrow">{{ liturgi.current.mingguKe }}</p>
            <h2 class="font-display text-base font-semibold leading-snug text-ink">{{ liturgi.current.tema }}</h2>
          </div>
        </div>
      </div>

      <!-- right column: everything content-related (status/error/loading
           states and the viewer itself). mt-5 only kicks in on mobile,
           where this stacks below the header instead of beside it. -->
      <div class="mt-5 space-y-5 lg:mt-0">
        <!-- tenant not resolved (bad link / not on a jemaat subdomain) -->
        <div v-if="!tenantLoading && tenant.kind !== 'tenant'" class="card mx-auto flex max-w-sm flex-col items-center gap-2 py-10 text-center">
          <MapPinOff class="h-6 w-6 text-muted" stroke-width="1.5" />
          <p class="text-sm text-muted">Tautan ini tidak mengarah ke jemaat manapun. Periksa kembali alamat yang Anda buka.</p>
        </div>
        <div v-else-if="!tenantLoading && tenant.kind === 'tenant' && !jemaatId" class="card mx-auto flex max-w-sm flex-col items-center gap-2 py-10 text-center">
          <MapPinOff class="h-6 w-6 text-muted" stroke-width="1.5" />
          <p class="text-sm text-muted">Jemaat tidak ditemukan. Periksa kembali tautan yang Anda buka.</p>
        </div>

        <div v-else-if="tenantLoading || liturgi.loading" class="flex flex-col items-center gap-2 py-10 text-sm text-muted">
          <Loader2 class="h-5 w-5 animate-spin text-accent" />
          <p>Memuat…</p>
        </div>
        <div v-else-if="liturgi.error" class="card mx-auto flex max-w-sm flex-col items-center gap-2 py-10 text-center">
          <CircleAlert class="h-6 w-6 text-danger" stroke-width="1.5" />
          <p class="text-sm text-danger">{{ liturgi.error }}</p>
        </div>

        <template v-else-if="liturgi.current">
          <!-- shown on mobile only — desktop shows the copy in the left column instead -->
          <div v-if="liturgi.current.tema" class="mx-auto flex max-w-lg items-start gap-3 rounded-xl border border-line border-l-4 border-l-accent bg-white px-4 py-3 shadow-sm lg:hidden">
            <BookOpenText class="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <div class="text-left">
              <p v-if="liturgi.current.mingguKe" class="label-eyebrow">{{ liturgi.current.mingguKe }}</p>
              <h2 class="font-display text-base font-semibold leading-snug text-ink">{{ liturgi.current.tema }}</h2>
            </div>
          </div>

          <!-- PDF: rendered ourselves so every phone shows the same clear,
               zoomable view instead of relying on each browser's own PDF plugin
               (which is inconsistent, especially on mobile). -->
          <PdfViewer
            v-if="liturgi.current.fileType === 'PDF'"
            :url="liturgi.current.fileUrl"
            :filename="liturgi.current.originalFilename"
          />

          <!-- DOCX: browsers can't render Word natively, so convert to HTML
               in-browser (mammoth) and display it — download stays available
               in the toolbar for the exact original file. -->
          <DocxViewer
            v-else
            :url="liturgi.current.fileUrl"
            :filename="liturgi.current.originalFilename"
          />
        </template>

        <p v-else class="card mx-auto flex max-w-sm flex-col items-center gap-2 py-10 text-center text-sm text-muted">
          <CalendarX class="h-6 w-6 text-muted" stroke-width="1.5" />
          Belum ada liturgi untuk sesi ini.
        </p>
      </div>
    </div>
  </div>
</template>