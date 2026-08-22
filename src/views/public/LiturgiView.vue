<script setup lang="ts">
import { ref, computed, onMounted, defineAsyncComponent } from 'vue'
import { useRoute } from 'vue-router'
import { fetchTenantBySlug, buildRootUrl } from '@/lib/tenant'
import { useLiturgiStore } from '@/stores/liturgiStore'
import { tenant } from '@/router'
import { liturgicalTint } from '@/lib/liturgicalColor'
import { Church, Sun, Moon, CalendarDays, BookOpenText, Loader2, ChevronLeft } from 'lucide-vue-next'

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
const jemaatCategory = ref<string | null>(null)
const tanggal = ref<string>((route.params.tanggal as string) ?? new Date().toISOString().slice(0, 10))
const tenantLoading = ref(true)

const tanggalLabel = new Date(tanggal.value + 'T00:00:00').toLocaleDateString('id-ID', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

// Ties the page's accent to the actual liturgical colour of the day
// (as entered by the admin), so each week reads distinctly instead of
// every service looking like a copy of the last.
const tint = computed(() => liturgicalTint(liturgi.current?.warnaLiturgi))

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
  jemaatCategory.value = jemaat.category

  await load()
  if (!liturgi.current) await switchSesi('SORE')
})
</script>

<template>
  <div class="relative min-h-screen bg-paper">
    <!-- thin decorative bar — takes the day's liturgical colour once known,
         falls back to the church-green accent before/without one -->
    <div
      class="h-1.5 w-full transition-colors duration-300"
      :class="tint ? tint.dot : 'bg-gradient-to-r from-accent via-accent-hover to-accent'"
    />
    <div
      class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 bg-[radial-gradient(ellipse_at_top,theme(colors.accent.soft)_0%,transparent_65%)]"
    />

    <div class="mx-auto max-w-6xl px-3 py-5 sm:px-4 sm:py-8 lg:grid lg:grid-cols-[320px_1fr] lg:items-start lg:gap-10 xl:max-w-7xl xl:gap-14">
      <!-- left column: back-link + letterhead card wrapped together as ONE
           grid child, matching the 2 explicit columns above — 3 loose
           children in a 2-column grid silently mis-places the third
           (that was the "desktop layout looks broken/tiny" bug). -->
      <div class="lg:sticky lg:top-8 lg:self-start">
        <!-- letterhead card — everything about the SERVICE (who, when, which
             session, what colour) lives in one solid card instead of loose
             elements floating on the gradient, so the header reads as a
             deliberate "cover page" even before any liturgi has loaded. -->
        <div class="flex flex-col items-center gap-4 rounded-2xl border border-line bg-white px-5 py-6 text-center shadow-card sm:px-6">
          <div class="flex h-16 w-16 items-center justify-center rounded-full border border-line bg-paper shadow-soft">
            <Church class="h-7 w-7 text-accent" stroke-width="1.6" />
          </div>

          <div class="space-y-1.5">
            <p v-if="jemaatCategory" class="label-eyebrow text-accent">{{ jemaatCategory }}</p>
            <p v-if="jemaatName" class="font-display text-xl font-semibold leading-tight text-ink">{{ jemaatName }}</p>
            <p class="flex items-center justify-center gap-1.5 text-xs text-muted">
              <CalendarDays class="h-3.5 w-3.5" />
              {{ tanggalLabel }}
            </p>
          </div>

          <div class="h-px w-16 bg-line" />

          <!-- session toggle: sliding pill with icons for quick, non-text recognition -->
          <div class="relative inline-flex rounded-full border border-line bg-paper p-1">
            <div
              class="absolute inset-y-1 w-[calc(50%-0.25rem)] rounded-full bg-accent shadow-soft transition-transform duration-200 ease-out"
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

          <!-- tema lives inside the same letterhead card on desktop, under
               a divider, instead of a second separate card below it -->
          <template v-if="liturgi.current?.tema">
            <div class="h-px w-16 bg-line" />
            <div class="hidden w-full items-start gap-3 rounded-xl px-1 text-left lg:flex" :class="tint ? tint.soft : 'bg-accent-soft'">
              <div class="w-full rounded-xl px-3 py-3">
                <BookOpenText class="mb-1.5 h-4 w-4" :class="tint ? tint.text : 'text-accent'" />
                <p v-if="liturgi.current.mingguKe" class="label-eyebrow" :class="tint ? tint.text : 'text-accent'">{{ liturgi.current.mingguKe }}</p>
                <h2 class="font-display text-base font-semibold leading-snug text-ink">{{ liturgi.current.tema }}</h2>
                <span v-if="tint" class="chip mt-2 bg-white/70" :class="tint.text">
                  <span class="h-1.5 w-1.5 rounded-full" :class="tint.dot" />
                  Warna Liturgi: {{ tint.label }}
                </span>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- right column: everything content-related (status/error/loading
           states and the viewer itself). mt-5 only kicks in on mobile,
           where this stacks below the header instead of beside it. -->
      <div class="mt-5 space-y-5 lg:mt-0">
        <!-- tenant not resolved (bad link / not on a jemaat subdomain) -->
        <p v-if="!tenantLoading && tenant.kind !== 'tenant'" class="text-center text-sm text-muted">
          Tautan ini tidak mengarah ke jemaat manapun. Periksa kembali alamat yang Anda buka.
        </p>
        <p v-else-if="!tenantLoading && tenant.kind === 'tenant' && !jemaatId" class="text-center text-sm text-muted">
          Jemaat tidak ditemukan. Periksa kembali tautan yang Anda buka.
        </p>

        <div v-else-if="tenantLoading || liturgi.loading" class="flex flex-col items-center gap-2 py-14 text-sm text-muted">
          <Loader2 class="h-5 w-5 animate-spin text-accent" />
          <p>Memuat…</p>
        </div>
        <p v-else-if="liturgi.error" class="text-center text-sm text-danger">{{ liturgi.error }}</p>

        <template v-else-if="liturgi.current">
          <!-- shown on mobile only — desktop shows the copy inside the letterhead card instead -->
          <div
            v-if="liturgi.current.tema"
            class="mx-auto flex max-w-lg items-start gap-3 rounded-2xl border border-line bg-white px-4 py-3.5 shadow-card lg:hidden"
            :class="tint ? ['border-l-4', tint.border] : 'border-l-4 border-l-accent'"
          >
            <BookOpenText class="mt-0.5 h-4 w-4 shrink-0" :class="tint ? tint.text : 'text-accent'" />
            <div class="text-left">
              <p v-if="liturgi.current.mingguKe" class="label-eyebrow">{{ liturgi.current.mingguKe }}</p>
              <h2 class="font-display text-base font-semibold leading-snug text-ink">{{ liturgi.current.tema }}</h2>
              <span
                v-if="tint"
                class="chip mt-1.5"
                :class="[tint.soft, tint.text]"
              >
                <span class="h-1.5 w-1.5 rounded-full" :class="tint.dot" />
                Warna Liturgi: {{ tint.label }}
              </span>
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

        <p v-else class="text-center text-sm text-muted">Belum ada liturgi untuk sesi ini.</p>
      </div>
    </div>
  </div>
</template>