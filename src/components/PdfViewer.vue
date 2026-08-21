<script setup lang="ts">
import { ref, shallowRef, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url'
import { ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Maximize2, Minimize2, Download, HelpCircle, Loader2 } from 'lucide-vue-next'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

const props = defineProps<{
  url: string
  filename?: string
}>()

// ---- state -----------------------------------------------------------

const containerEl = ref<HTMLDivElement | null>(null)
const viewerEl = ref<HTMLDivElement | null>(null)
const pageRefs = ref<HTMLDivElement[]>([])

const status = ref<'loading' | 'ready' | 'error'>('loading')
const errorMessage = ref('')
const numPages = ref(0)
const currentPage = ref(1)

// Zoom is expressed as a multiplier of "fit to screen width".
// 1 = fits the screen exactly, like opening a book to the right size.
const ZOOM_STEPS = [0.75, 1, 1.25, 1.5, 1.75, 2, 2.5]
const zoomIndex = ref(1) // index into ZOOM_STEPS, starts at 1 (100%)
const zoom = ref(ZOOM_STEPS[zoomIndex.value])

const isFullscreen = ref(false)
const showGuide = ref(false)

const GUIDE_SEEN_KEY = 'liturgi_pdf_guide_seen'

// ---- pdf loading -------------------------------------------------------

let pdfDoc: pdfjsLib.PDFDocumentProxy | null = null
// Rendered at a fixed high resolution so zooming in with CSS stays sharp.
const RENDER_SCALE = 2.2

async function renderAllPages() {
  if (!pdfDoc || !containerEl.value) return
  const baseWidth = containerEl.value.clientWidth

  pageRefs.value = []
  const wrapper = viewerEl.value
  if (!wrapper) return
  wrapper.innerHTML = ''

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum)
    const unscaledViewport = page.getViewport({ scale: 1 })
    const fitScale = baseWidth / unscaledViewport.width
    const renderViewport = page.getViewport({ scale: fitScale * RENDER_SCALE })

    const canvas = document.createElement('canvas')
    canvas.width = renderViewport.width
    canvas.height = renderViewport.height
    canvas.style.width = '100%'
    canvas.style.height = 'auto'
    canvas.style.display = 'block'

    const pageBox = document.createElement('div')
    pageBox.className = 'pdf-page mx-auto mb-4 overflow-hidden rounded-lg border border-line bg-white shadow-[0_2px_10px_-4px_rgba(30,38,32,0.15)]'
    pageBox.dataset.pageNumber = String(pageNum)
    pageBox.appendChild(canvas)
    wrapper.appendChild(pageBox)
    pageRefs.value.push(pageBox)

    const ctx = canvas.getContext('2d')
    if (ctx) {
      await page.render({ canvasContext: ctx, viewport: renderViewport }).promise
    }
  }

  observePages()
}

async function loadPdf() {
  status.value = 'loading'
  errorMessage.value = ''
  try {
    const doc = await pdfjsLib.getDocument(props.url).promise
    pdfDoc = doc
    numPages.value = doc.numPages
    await nextTick()
    await renderAllPages()
    status.value = 'ready'
  } catch (err) {
    console.error('PdfViewer failed to load PDF:', err)
    errorMessage.value = 'Liturgi tidak dapat ditampilkan. Coba muat ulang halaman, atau unduh berkasnya.'
    status.value = 'error'
  }
}

// ---- page tracking (which page is currently visible) -------------------

let observer: IntersectionObserver | null = null

function observePages() {
  observer?.disconnect()
  observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
      if (visible) {
        const n = Number((visible.target as HTMLElement).dataset.pageNumber)
        if (n) currentPage.value = n
      }
    },
    { root: containerEl.value, threshold: [0.5] },
  )
  pageRefs.value.forEach((el) => observer!.observe(el))
}

function goToPage(n: number) {
  const target = Math.min(Math.max(n, 1), numPages.value)
  pageRefs.value[target - 1]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// ---- zoom controls -------------------------------------------------------

function zoomIn() {
  zoomIndex.value = Math.min(zoomIndex.value + 1, ZOOM_STEPS.length - 1)
}
function zoomOut() {
  zoomIndex.value = Math.max(zoomIndex.value - 1, 0)
}
function resetZoom() {
  zoomIndex.value = 1
}
watch(zoomIndex, (i) => {
  zoom.value = ZOOM_STEPS[i]
})

// ---- fullscreen -------------------------------------------------------

function toggleFullscreen() {
  if (!containerEl.value) return
  if (!document.fullscreenElement) {
    containerEl.value.requestFullscreen?.()
  } else {
    document.exitFullscreen?.()
  }
}
function handleFullscreenChange() {
  isFullscreen.value = Boolean(document.fullscreenElement)
}

// ---- guide -------------------------------------------------------

function openGuide() {
  showGuide.value = true
}
function closeGuide() {
  showGuide.value = false
  localStorage.setItem(GUIDE_SEEN_KEY, '1')
}

// ---- lifecycle -------------------------------------------------------

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  if (!localStorage.getItem(GUIDE_SEEN_KEY)) showGuide.value = true
  document.addEventListener('fullscreenchange', handleFullscreenChange)

  loadPdf()

  if (containerEl.value) {
    let lastWidth = containerEl.value.clientWidth
    resizeObserver = new ResizeObserver(() => {
      const w = containerEl.value?.clientWidth ?? 0
      // Only re-render when the layout actually changes size meaningfully
      // (rotation, window resize) — not on every pixel of a zoom/scroll.
      if (Math.abs(w - lastWidth) > 24 && status.value === 'ready') {
        lastWidth = w
        renderAllPages()
      }
    })
    resizeObserver.observe(containerEl.value)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  observer?.disconnect()
  resizeObserver?.disconnect()
  pdfDoc?.destroy()
})

watch(
  () => props.url,
  () => {
    zoomIndex.value = 1
    loadPdf()
  },
)
</script>

<template>
  <div
    ref="containerEl"
    class="relative flex flex-col overflow-hidden rounded-lg border border-line bg-paper"
    :class="isFullscreen ? 'h-screen' : 'h-[78vh]'"
  >
    <!-- static toolbar (desktop only): sits right at the top, in normal
         flow — not floating over the page like the mobile version, so it
         never overlaps content. Mobile keeps the floating bottom pill
         (thumb-reachable), unchanged. -->
    <div
      v-if="status === 'ready'"
      class="hidden shrink-0 items-center justify-center gap-0.5 border-b border-line bg-white px-2 py-1.5 lg:flex"
    >
      <button type="button" class="toolbar-btn" title="Perkecil tampilan" aria-label="Perkecil tampilan" :disabled="zoomIndex === 0" @click="zoomOut">
        <ZoomOut class="h-4 w-4" />
      </button>
      <button type="button" class="min-w-[3.25rem] rounded-full px-1.5 py-1 text-center text-xs font-medium tabular-nums text-muted hover:text-ink" title="Kembalikan ke ukuran normal (100%)" @click="resetZoom">
        {{ Math.round(zoom * 100) }}%
      </button>
      <button type="button" class="toolbar-btn" title="Perbesar tampilan" aria-label="Perbesar tampilan" :disabled="zoomIndex === ZOOM_STEPS.length - 1" @click="zoomIn">
        <ZoomIn class="h-4 w-4" />
      </button>
      <div class="mx-1 h-5 w-px bg-line" />
      <button type="button" class="toolbar-btn" title="Halaman sebelumnya" aria-label="Halaman sebelumnya" :disabled="currentPage <= 1" @click="goToPage(currentPage - 1)">
        <ChevronLeft class="h-4 w-4" />
      </button>
      <span class="min-w-[3rem] text-center text-xs font-medium tabular-nums text-muted" title="Halaman saat ini">
        {{ currentPage }} / {{ numPages }}
      </span>
      <button type="button" class="toolbar-btn" title="Halaman berikutnya" aria-label="Halaman berikutnya" :disabled="currentPage >= numPages" @click="goToPage(currentPage + 1)">
        <ChevronRight class="h-4 w-4" />
      </button>
      <div class="mx-1 h-5 w-px bg-line" />
      <button type="button" class="toolbar-btn" title="Layar penuh" aria-label="Layar penuh" @click="toggleFullscreen">
        <Maximize2 v-if="!isFullscreen" class="h-4 w-4" />
        <Minimize2 v-else class="h-4 w-4" />
      </button>
      <a :href="url" download class="toolbar-btn" title="Unduh berkas liturgi (PDF)" aria-label="Unduh berkas liturgi">
        <Download class="h-4 w-4" />
      </a>
      <button type="button" class="toolbar-btn" title="Petunjuk penggunaan" aria-label="Petunjuk penggunaan" @click="openGuide">
        <HelpCircle class="h-4 w-4" />
      </button>
    </div>

    <!-- scrollable page area -->
    <div class="relative flex-1 overflow-y-auto overflow-x-hidden px-3 pb-24 pt-3 sm:px-6 lg:pb-6">
      <div
        v-if="status === 'loading'"
        class="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted"
      >
        <Loader2 class="h-6 w-6 animate-spin text-accent" />
        <p>Memuat liturgi…</p>
      </div>

      <div
        v-else-if="status === 'error'"
        class="flex h-full flex-col items-center justify-center gap-3 px-6 text-center"
      >
        <p class="text-sm text-danger">{{ errorMessage }}</p>
        <a :href="url" download class="btn-primary">Unduh Liturgi</a>
      </div>

      <div
        ref="viewerEl"
        v-show="status === 'ready'"
        class="mx-auto origin-top transition-[width] duration-150"
        :style="{ width: `${zoom * 100}%`, maxWidth: zoom <= 1 ? '100%' : 'none' }"
      />
    </div>

    <!-- floating toolbar (mobile/tablet only): kept at the bottom so it's
         easy to reach with a thumb. Desktop uses the static bar above instead. -->
    <div
      v-if="status === 'ready'"
      class="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-3 lg:hidden"
    >
      <div
        class="pointer-events-auto flex items-center gap-0.5 rounded-full border border-line/80 bg-white/95 px-2 py-1.5 shadow-[0_8px_24px_-8px_rgba(30,38,32,0.25)] backdrop-blur"
      >
        <button
          type="button"
          class="toolbar-btn"
          title="Perkecil tampilan"
          aria-label="Perkecil tampilan"
          :disabled="zoomIndex === 0"
          @click="zoomOut"
        >
          <ZoomOut class="h-4 w-4" />
        </button>

        <button
          type="button"
          class="min-w-[3.25rem] rounded-full px-1.5 py-1 text-center text-xs font-medium tabular-nums text-muted hover:text-ink"
          title="Kembalikan ke ukuran normal (100%)"
          @click="resetZoom"
        >
          {{ Math.round(zoom * 100) }}%
        </button>

        <button
          type="button"
          class="toolbar-btn"
          title="Perbesar tampilan"
          aria-label="Perbesar tampilan"
          :disabled="zoomIndex === ZOOM_STEPS.length - 1"
          @click="zoomIn"
        >
          <ZoomIn class="h-4 w-4" />
        </button>

        <div class="mx-1 h-5 w-px bg-line" />

        <button
          type="button"
          class="toolbar-btn"
          title="Halaman sebelumnya"
          aria-label="Halaman sebelumnya"
          :disabled="currentPage <= 1"
          @click="goToPage(currentPage - 1)"
        >
          <ChevronLeft class="h-4 w-4" />
        </button>

        <span class="min-w-[3rem] text-center text-xs font-medium tabular-nums text-muted" title="Halaman saat ini">
          {{ currentPage }} / {{ numPages }}
        </span>

        <button
          type="button"
          class="toolbar-btn"
          title="Halaman berikutnya"
          aria-label="Halaman berikutnya"
          :disabled="currentPage >= numPages"
          @click="goToPage(currentPage + 1)"
        >
          <ChevronRight class="h-4 w-4" />
        </button>

        <div class="mx-1 h-5 w-px bg-line" />

        <button
          type="button"
          class="toolbar-btn"
          title="Layar penuh"
          aria-label="Layar penuh"
          @click="toggleFullscreen"
        >
          <Maximize2 v-if="!isFullscreen" class="h-4 w-4" />
          <Minimize2 v-else class="h-4 w-4" />
        </button>

        <a
          :href="url"
          download
          class="toolbar-btn"
          title="Unduh berkas liturgi (PDF)"
          aria-label="Unduh berkas liturgi"
        >
          <Download class="h-4 w-4" />
        </a>

        <button
          type="button"
          class="toolbar-btn"
          title="Petunjuk penggunaan"
          aria-label="Petunjuk penggunaan"
          @click="openGuide"
        >
          <HelpCircle class="h-4 w-4" />
        </button>
      </div>
    </div>

    <!-- usage guide, shown automatically the first time, reopenable via the "?" button -->
    <div
      v-if="showGuide"
      class="absolute inset-0 z-10 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
      @click.self="closeGuide"
    >
      <div class="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
        <p class="mb-3 text-sm font-semibold text-ink">Cara memakai liturgi digital</p>
        <ul class="space-y-2.5 text-sm text-muted">
          <li class="flex items-start gap-2.5">
            <span class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
              <ZoomIn class="h-3.5 w-3.5" />
            </span>
            <span>Tombol perbesar/perkecil untuk mengatur ukuran tulisan. Bisa juga mencubit layar (pinch) di HP.</span>
          </li>
          <li class="flex items-start gap-2.5">
            <span class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
              <ChevronRight class="h-3.5 w-3.5" />
            </span>
            <span>Tombol panah untuk pindah ke halaman sebelum/berikutnya. Bisa juga langsung geser layar ke atas-bawah.</span>
          </li>
          <li class="flex items-start gap-2.5">
            <span class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Maximize2 class="h-3.5 w-3.5" />
            </span>
            <span>Tombol layar penuh membuat liturgi lebih besar dan tampilan lebih fokus.</span>
          </li>
          <li class="flex items-start gap-2.5">
            <span class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Download class="h-3.5 w-3.5" />
            </span>
            <span>Tombol unduh menyimpan liturgi sebagai file PDF ke HP, bisa dibuka tanpa internet.</span>
          </li>
        </ul>
        <button type="button" class="btn-primary mt-4 w-full" @click="closeGuide">Mengerti</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.toolbar-btn {
  @apply flex h-8 w-8 items-center justify-center rounded-full text-ink transition-colors hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent;
}
</style>