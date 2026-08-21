<script setup lang="ts">
// Renders .docx inline by converting it to plain HTML in the browser
// (mammoth) — no server round-trip, no LibreOffice/conversion service.
// Trade-off: mammoth keeps structure (headings, bold, lists, tables) but
// drops exact visual layout (columns, precise spacing) — fine for liturgi
// text, not a pixel-perfect Word clone. Download is always offered too.
import { ref, onBeforeUnmount, watch } from 'vue'
import mammoth from 'mammoth'
import { Download, Loader2, Maximize2, Minimize2 } from 'lucide-vue-next'

const props = defineProps<{
  url: string
  filename?: string
}>()

const containerEl = ref<HTMLDivElement | null>(null)
const status = ref<'loading' | 'ready' | 'error'>('loading')
const errorMessage = ref('')
const html = ref('')
const isFullscreen = ref(false)

async function load() {
  status.value = 'loading'
  errorMessage.value = ''
  html.value = ''
  try {
    const res = await fetch(props.url)
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`)
    const arrayBuffer = await res.arrayBuffer()
    const result = await mammoth.convertToHtml({ arrayBuffer })
    html.value = result.value
    status.value = 'ready'
  } catch (err) {
    console.error('DocxViewer failed to load docx:', err)
    errorMessage.value = 'Liturgi tidak dapat ditampilkan. Coba muat ulang halaman, atau unduh berkasnya.'
    status.value = 'error'
  }
}

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

document.addEventListener('fullscreenchange', handleFullscreenChange)
onBeforeUnmount(() => document.removeEventListener('fullscreenchange', handleFullscreenChange))

load()
watch(() => props.url, load)
</script>

<template>
  <div
    ref="containerEl"
    class="relative flex flex-col overflow-hidden rounded-lg border border-line bg-paper"
    :class="isFullscreen ? 'h-screen' : 'min-h-[50vh]'"
  >
    <div class="relative flex-1 overflow-y-auto px-3 pb-20 pt-3 sm:px-6">
      <div
        v-if="status === 'loading'"
        class="flex h-full flex-col items-center justify-center gap-2 py-16 text-center text-sm text-muted"
      >
        <Loader2 class="h-6 w-6 animate-spin text-accent" />
        <p>Memuat liturgi…</p>
      </div>

      <div
        v-else-if="status === 'error'"
        class="flex h-full flex-col items-center justify-center gap-3 px-6 py-16 text-center"
      >
        <p class="text-sm text-danger">{{ errorMessage }}</p>
        <a :href="url" download class="btn-primary">Unduh Liturgi</a>
      </div>

      <!-- mammoth output is plain structural HTML (headings/bold/lists/tables,
           no <script>) generated from the admin's own uploaded file — not
           user-supplied at render time, so this is safe to render directly -->
      <div
        v-else
        class="docx-content mx-auto max-w-2xl rounded-lg border border-line bg-white px-5 py-6 shadow-[0_2px_10px_-4px_rgba(30,38,32,0.15)] sm:px-8 sm:py-8"
        v-html="html"
      />
    </div>

    <div
      v-if="status === 'ready'"
      class="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-3"
    >
      <div
        class="pointer-events-auto flex items-center gap-0.5 rounded-full border border-line/80 bg-white/95 px-2 py-1.5 shadow-[0_8px_24px_-8px_rgba(30,38,32,0.25)] backdrop-blur"
      >
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

        <a :href="url" download class="toolbar-btn" title="Unduh berkas liturgi (Word)" aria-label="Unduh berkas liturgi">
          <Download class="h-4 w-4" />
        </a>
      </div>
    </div>
  </div>
</template>

<style scoped>
.toolbar-btn {
  @apply flex h-8 w-8 items-center justify-center rounded-full text-ink transition-colors hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent;
}

/* mammoth's output is unstyled semantic HTML — give it readable defaults
   without dragging in @tailwindcss/typography just for this one view */
.docx-content :deep(h1) {
  @apply mb-3 font-display text-xl font-semibold text-ink;
}
.docx-content :deep(h2) {
  @apply mb-2 mt-4 font-display text-lg font-semibold text-ink;
}
.docx-content :deep(h3) {
  @apply mb-2 mt-3 font-display text-base font-semibold text-ink;
}
.docx-content :deep(p) {
  @apply mb-3 text-sm leading-relaxed text-ink;
}
.docx-content :deep(ul),
.docx-content :deep(ol) {
  @apply mb-3 ml-5 list-outside space-y-1 text-sm leading-relaxed text-ink;
}
.docx-content :deep(ul) {
  @apply list-disc;
}
.docx-content :deep(ol) {
  @apply list-decimal;
}
.docx-content :deep(table) {
  @apply mb-3 w-full border-collapse text-sm;
}
.docx-content :deep(td),
.docx-content :deep(th) {
  @apply border border-line px-2 py-1 text-left align-top;
}
.docx-content :deep(strong) {
  @apply font-semibold;
}
.docx-content :deep(a) {
  @apply text-accent underline;
}
.docx-content :deep(img) {
  @apply mx-auto my-3 max-w-full rounded;
}
</style>