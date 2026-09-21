<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave, RouterLink } from 'vue-router'
import { ArrowLeft, Save, Loader2, Trash2 } from 'lucide-vue-next'
import AdminShell from '@/components/admin/AdminShell.vue'
import WartaBuilder from '@/components/warta/WartaBuilder.vue'
import WartaDocument from '@/components/warta/WartaDocument.vue'
import { getWarta, saveWarta, trashWarta } from '@/lib/warta/api'
import { fetchAllJemaat } from '@/lib/tenant'
import { pushToast } from '@/composables/toast'
import type { PublishStatus, WartaSection } from '@/lib/warta/types'
import { askConfirm, confirmTrash } from '@/composables/confirm'

const route = useRoute()
const router = useRouter()
const id = route.params.id as string

const loading = ref(true)
const loadError = ref<string | null>(null)
const notFound = ref(false)

const jemaatName = ref('')
const tanggal = ref('')
const sections = ref<WartaSection[]>([])
const status = ref<PublishStatus>('DRAFT')
const saving = ref(false)

// "Unsaved changes" = the current content differs from what was last loaded
// or saved. Compared as JSON, so it's true to what would actually be sent.
const snapshot = () => JSON.stringify({ sections: sections.value, status: status.value })
const saved = ref('')
const dirty = computed(() => !loading.value && !notFound.value && snapshot() !== saved.value)

const tanggalLabel = computed(() =>
  tanggal.value
    ? new Date(tanggal.value + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : '',
)

// Narrow screens can't fit editor and preview side by side; a tab picks one.
const viewTab = ref<'edit' | 'preview'>('edit')

onMounted(async () => {
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('beforeunload', onBeforeUnload)
  try {
    const [record, jemaatList] = await Promise.all([getWarta(id), fetchAllJemaat()])
    if (!record) {
      notFound.value = true
      return
    }
    tanggal.value = record.tanggal
    sections.value = record.sections
    status.value = record.status
    jemaatName.value = jemaatList.find((j) => j.id === record.jemaatId)?.name ?? ''
    saved.value = snapshot()
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : 'Gagal memuat warta'
  } finally {
    loading.value = false
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('beforeunload', onBeforeUnload)
})

async function save() {
  if (saving.value || !dirty.value) return
  saving.value = true
  // Remember exactly what was sent: edits typed while the request is in
  // flight must stay "unsaved".
  const sent = snapshot()
  try {
    await saveWarta(id, { sections: sections.value, status: status.value })
    saved.value = sent
    pushToast(status.value === 'PUBLISHED' ? 'Tersimpan — warta tampil ke jemaat' : 'Draf tersimpan')
  } catch (err) {
    pushToast(err instanceof Error ? err.message : 'Gagal menyimpan', 'error')
  } finally {
    saving.value = false
  }
}

async function trash() {
  if (!(await confirmTrash('warta ini', 'Masih bisa dipulihkan dari Sampah di daftar warta.'))) return
  try {
    await trashWarta(id)
    saved.value = snapshot() // nothing left to lose — skip the leave warning
    pushToast('Warta dihapus')
    router.push({ name: 'admin-warta-list' })
  } catch (err) {
    pushToast(err instanceof Error ? err.message : 'Gagal menghapus', 'error')
  }
}

function onKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault()
    void save()
  }
}

function onBeforeUnload(e: BeforeUnloadEvent) {
  if (!dirty.value) return
  e.preventDefault()
  e.returnValue = ''
}

onBeforeRouteLeave(async () => {
  if (!dirty.value) return
  const leave = await askConfirm({
    title: 'Perubahan belum disimpan',
    message: 'Kalau kamu pergi sekarang, perubahan pada warta ini akan hilang.',
    confirmLabel: 'Tinggalkan',
    cancelLabel: 'Tetap di sini',
    tone: 'danger',
  })
  if (!leave) return false
})
</script>

<template>
  <AdminShell>
    <div v-if="loading" class="flex items-center justify-center gap-2 py-20 text-sm text-muted">
      <Loader2 class="h-4 w-4 animate-spin text-accent" /> Memuat warta…
    </div>

    <div v-else-if="loadError || notFound" class="card mx-auto max-w-md space-y-3 py-8 text-center">
      <p class="text-sm" :class="loadError ? 'text-danger' : 'text-muted'">
        {{ loadError ?? 'Warta tidak ditemukan — mungkin sudah dihapus.' }}
      </p>
      <RouterLink :to="{ name: 'admin-warta-list' }" class="btn">Kembali ke daftar warta</RouterLink>
    </div>

    <div v-else class="space-y-5">
      <div class="flex items-start gap-3">
        <RouterLink :to="{ name: 'admin-warta-list' }" class="btn-ghost mt-1" title="Kembali ke daftar warta" aria-label="Kembali ke daftar warta">
          <ArrowLeft class="h-4 w-4" />
        </RouterLink>
        <div class="min-w-0 flex-1 space-y-0.5">
          <p class="label-eyebrow text-accent">Warta Jemaat</p>
          <h1 class="truncate font-display text-xl font-semibold text-ink sm:text-2xl">{{ jemaatName || 'Jemaat' }}</h1>
          <p class="text-sm text-muted">{{ tanggalLabel }}</p>
        </div>
        <button type="button" class="btn-danger" title="Hapus warta" aria-label="Hapus warta" @click="trash">
          <Trash2 class="h-4 w-4" />
        </button>
      </div>

      <!-- phone/tablet: pick editor or preview -->
      <div class="relative inline-flex rounded-full border border-line bg-paper p-0.5 lg:hidden">
        <button
          v-for="tab in ([['edit', 'Sunting'], ['preview', 'Pratinjau']] as const)"
          :key="tab[0]"
          type="button"
          class="rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
          :class="viewTab === tab[0] ? 'bg-accent text-white shadow-soft' : 'text-muted hover:text-ink'"
          @click="viewTab = tab[0]"
        >
          {{ tab[1] }}
        </button>
      </div>

      <div class="grid gap-6 lg:grid-cols-2 lg:items-start">
        <div :class="viewTab === 'preview' ? 'hidden lg:block' : ''">
          <WartaBuilder v-model="sections" />
        </div>
        <div :class="viewTab === 'edit' ? 'hidden lg:block' : ''" class="lg:sticky lg:top-20">
          <p class="label-eyebrow mb-2 hidden lg:block">Pratinjau</p>
          <WartaDocument :sections="sections" />
        </div>
      </div>

      <!-- always-reachable save bar -->
      <div class="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface/95 px-4 py-3 shadow-card backdrop-blur">
        <div class="flex flex-wrap items-center gap-3">
          <div class="relative inline-flex rounded-full border border-line bg-paper p-0.5" role="group" aria-label="Status warta">
            <button
              type="button"
              class="rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors"
              :class="status === 'DRAFT' ? 'bg-ink text-paper shadow-soft' : 'text-muted hover:text-ink'"
              @click="status = 'DRAFT'"
            >
              Draf
            </button>
            <button
              type="button"
              class="rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors"
              :class="status === 'PUBLISHED' ? 'bg-accent text-white shadow-soft' : 'text-muted hover:text-ink'"
              @click="status = 'PUBLISHED'"
            >
              Terbit
            </button>
          </div>
          <p class="text-xs text-muted">
            <template v-if="dirty && status === 'PUBLISHED'">Belum disimpan — perubahan langsung tampil ke jemaat setelah disimpan.</template>
            <template v-else-if="dirty">Belum disimpan.</template>
            <template v-else>Semua perubahan tersimpan.</template>
          </p>
        </div>
        <button type="button" class="btn-primary" :disabled="!dirty || saving" @click="save">
          <Loader2 v-if="saving" class="h-4 w-4 animate-spin" />
          <Save v-else class="h-4 w-4" />
          Simpan
        </button>
      </div>
    </div>
  </AdminShell>
</template>
