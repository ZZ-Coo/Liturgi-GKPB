<script setup lang="ts">
import { inject, ref, type Ref } from 'vue'
import { ImageUp, Loader2, X } from 'lucide-vue-next'
import type { ImageData, ImageWidth } from '@/lib/warta/types'
import { uploadWartaImage, removeWartaImage, validateImageFile } from '@/lib/warta/image'
import { pushToast } from '@/composables/toast'

// Needs the jemaat's slug (for the storage path) but the registry's Editor
// contract only passes the block's own `data` — every other block type is
// self-contained, so threading a wider "context" prop through WartaBuilder
// for this one case isn't worth it. Provided once, high up, by whichever
// view hosts the builder (WartaEditView) — see lib/warta/WARTA_SLUG_KEY.
import { WARTA_SLUG_KEY } from '@/lib/warta/context'

const data = defineModel<ImageData>({ required: true })
const jemaatSlug = inject<Ref<string>>(WARTA_SLUG_KEY)

const uploading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const WIDTHS: { value: ImageWidth; label: string }[] = [
  { value: 'small', label: 'Kecil' },
  { value: 'medium', label: 'Sedang' },
  { value: 'large', label: 'Besar' },
  { value: 'full', label: 'Penuh' },
]

async function onFileChosen(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = '' // let the same file be re-picked later if needed
  if (!file) return

  const invalid = validateImageFile(file)
  if (invalid) {
    pushToast(invalid, 'error')
    return
  }
  if (!jemaatSlug?.value) {
    pushToast('Tidak bisa mengunggah — jemaat belum diketahui.', 'error')
    return
  }

  const previous = data.value.url ? { url: data.value.url, path: data.value.path } : null
  uploading.value = true
  try {
    const uploaded = await uploadWartaImage(jemaatSlug.value, file)
    data.value = { ...data.value, url: uploaded.url, path: uploaded.path }
    if (previous) void removeWartaImage(previous) // old file is now unused — best-effort cleanup
  } catch (err) {
    pushToast(err instanceof Error ? err.message : 'Gagal mengunggah gambar', 'error')
  } finally {
    uploading.value = false
  }
}

function remove() {
  if (data.value.url) void removeWartaImage({ url: data.value.url, path: data.value.path })
  data.value = { ...data.value, url: '', path: '' }
}
</script>

<template>
  <div class="space-y-3">
    <div v-if="data.url" class="relative inline-block">
      <img :src="data.url" alt="" class="max-h-40 rounded-lg border border-line object-contain" />
      <button
        type="button"
        class="absolute -right-2 -top-2 rounded-full border border-line bg-surface p-1 text-muted shadow-soft hover:text-danger"
        title="Hapus gambar"
        aria-label="Hapus gambar"
        @click="remove"
      >
        <X class="h-3.5 w-3.5" />
      </button>
    </div>

    <div>
      <input ref="fileInput" type="file" accept=".png,.jpg,.jpeg,.webp" class="hidden" @change="onFileChosen" />
      <button type="button" class="btn gap-1.5 !py-1.5 text-xs" :disabled="uploading" @click="fileInput?.click()">
        <Loader2 v-if="uploading" class="h-3.5 w-3.5 animate-spin" />
        <ImageUp v-else class="h-3.5 w-3.5" />
        {{ data.url ? 'Ganti gambar' : 'Unggah gambar' }}
      </button>
      <span class="ml-2 text-xs text-muted">PNG/JPG/WEBP, maks 5 MB</span>
    </div>

    <div class="grid gap-3 sm:grid-cols-2">
      <label class="space-y-1.5">
        <span class="label-eyebrow">Ukuran tampil</span>
        <select v-model="data.width" class="input">
          <option v-for="w in WIDTHS" :key="w.value" :value="w.value">{{ w.label }}</option>
        </select>
      </label>
      <label class="space-y-1.5">
        <span class="label-eyebrow">Teks alternatif</span>
        <input v-model="data.alt" class="input" placeholder="mis. QRIS BRI GKPB Hosana Kwanji" />
      </label>
    </div>
    <label class="block space-y-1.5">
      <span class="label-eyebrow">Keterangan (opsional)</span>
      <input v-model="data.caption" class="input" placeholder="Tampil kecil di bawah gambar" />
    </label>
  </div>
</template>
