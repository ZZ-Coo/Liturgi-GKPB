<script setup lang="ts">
// Handles both create (/upload) and edit (/liturgi/:id/edit). In edit
// mode, jemaat/tanggal/sesi are locked (they're the identity of the slot)
// — only metadata, the file itself, and publish status can change. Want
// a different date/sesi? Upload a new one instead.
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { fetchAllJemaat, type JemaatRecord } from '@/lib/tenant'
import AdminShell from '@/components/admin/AdminShell.vue'
import {
  CalendarDays,
  BookOpenText,
  UploadCloud,
  Radio,
  ChevronDown,
  AlertTriangle,
  FileCheck2,
  Trash2,
} from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const editId = route.params.id as string | undefined
const isEdit = computed(() => !!editId)

// In create mode, warns if jemaat+tanggal+sesi already has a row — so a
// forgotten date/sesi field doesn't silently overwrite someone else's
// liturgi. Re-checked (debounced) whenever any of the three change.
interface ExistingSlot {
  id: string
  status: 'DRAFT' | 'PUBLISHED'
  originalFilename: string
}
const existingSlot = ref<ExistingSlot | null>(null)
const checkingSlot = ref(false)
let slotCheckTimer: ReturnType<typeof setTimeout> | undefined
let slotCheckToken = 0

const jemaatList = ref<JemaatRecord[]>([])
const jemaatId = ref('')
const tanggal = ref(new Date().toISOString().slice(0, 10))
const sesi = ref<'PAGI' | 'SORE'>('PAGI')
const mingguKe = ref('')
const tema = ref('')
const warnaLiturgi = ref('')
const status = ref<'DRAFT' | 'PUBLISHED'>('DRAFT')
const currentFileUrl = ref<string | null>(null)
const currentFilename = ref<string | null>(null)

const file = ref<File | null>(null)
const saving = ref(false)
const error = ref<string | null>(null)

const WARNA_OPTIONS = ['Hijau', 'Putih', 'Ungu', 'Merah', 'Hitam'] as const

async function checkSlot() {
  existingSlot.value = null
  if (isEdit.value || !jemaatId.value || !tanggal.value) return

  checkingSlot.value = true
  const token = ++slotCheckToken // guards against an older, slower request
  const { data } = await supabase
    .from('liturgi')
    .select('id, status, originalFilename')
    .eq('jemaatId', jemaatId.value)
    .eq('tanggal', tanggal.value)
    .eq('sesi', sesi.value)
    .maybeSingle()

  if (token !== slotCheckToken) return // a newer check already superseded this one
  existingSlot.value = data
  checkingSlot.value = false
}

watch([jemaatId, tanggal, sesi], () => {
  clearTimeout(slotCheckTimer)
  slotCheckTimer = setTimeout(checkSlot, 300)
})

onMounted(async () => {
  jemaatList.value = await fetchAllJemaat()
  if (jemaatList.value.length && !jemaatId.value) jemaatId.value = jemaatList.value[0].id

  if (editId) {
    const { data } = await supabase
      .from('liturgi')
      .select('jemaatId, tanggal, sesi, mingguKe, tema, warnaLiturgi, status, fileUrl, originalFilename')
      .eq('id', editId)
      .single()
    if (data) {
      jemaatId.value = data.jemaatId
      tanggal.value = data.tanggal
      sesi.value = data.sesi
      mingguKe.value = data.mingguKe ?? ''
      tema.value = data.tema ?? ''
      warnaLiturgi.value = data.warnaLiturgi ?? ''
      status.value = data.status
      currentFileUrl.value = data.fileUrl
      currentFilename.value = data.originalFilename
    }
  }
})

function onFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  file.value = target.files?.[0] ?? null
}

function jemaatSlug(id: string) {
  return jemaatList.value.find((j) => j.id === id)?.slug ?? id
}

async function submit() {
  if (saving.value) return // guards double-submit (double-click, Enter repeat, etc.)

  if (!jemaatId.value) {
    error.value = 'Pilih jemaat dulu.'
    return
  }
  if (!isEdit.value && !file.value) {
    error.value = 'Pilih file PDF atau Word dulu.'
    return
  }

  // Re-confirm right before writing, not just from the banner state — the
  // banner can be stale if a check is still in flight when Simpan is hit.
  if (!isEdit.value) {
    await checkSlot()
    if (existingSlot.value) {
      const ok = confirm(
        `Slot ini sudah ada liturgi: "${existingSlot.value.originalFilename}" (${
          existingSlot.value.status === 'PUBLISHED' ? 'Terbit' : 'Draf'
        }).\n\nLanjut menimpa file itu?`,
      )
      if (!ok) return
    }
  }

  saving.value = true
  error.value = null

  try {
    let fileUrl = currentFileUrl.value
    let fileType: 'PDF' | 'DOCX' | null = null
    let originalFilename = currentFilename.value

    if (file.value) {
      const isPdf = file.value.name.toLowerCase().endsWith('.pdf')
      const isDocx = file.value.name.toLowerCase().endsWith('.docx')
      if (!isPdf && !isDocx) {
        error.value = 'Hanya file .pdf atau .docx yang didukung.'
        saving.value = false
        return
      }
      fileType = isPdf ? 'PDF' : 'DOCX'
      const ext = isPdf ? 'pdf' : 'docx'
      // Deterministic path — re-uploading for the same jemaat/tanggal/sesi
      // naturally replaces the old file instead of piling up orphans.
      const path = `${jemaatSlug(jemaatId.value)}/${tanggal.value}-${sesi.value.toLowerCase()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('liturgi-files')
        .upload(path, file.value, { upsert: true })
      if (uploadError) throw uploadError

      const { data: publicUrl } = supabase.storage.from('liturgi-files').getPublicUrl(path)
      fileUrl = publicUrl.publicUrl
      originalFilename = file.value.name
    }

    const payload = {
      jemaatId: jemaatId.value,
      tanggal: tanggal.value,
      sesi: sesi.value,
      mingguKe: mingguKe.value || null,
      tema: tema.value || null,
      warnaLiturgi: warnaLiturgi.value || null,
      status: status.value,
      fileUrl,
      fileType: fileType ?? undefined, // omit if unchanged in edit mode
      originalFilename,
    }

    if (isEdit.value) {
      const { error: updateError } = await supabase.from('liturgi').update(payload).eq('id', editId)
      if (updateError) throw updateError
    } else {
      const { error: upsertError } = await supabase
        .from('liturgi')
        .upsert(payload, { onConflict: 'jemaatId,tanggal,sesi' })
      if (upsertError) throw upsertError
    }

    router.push('/')
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Gagal menyimpan'
  } finally {
    saving.value = false
  }
}

async function remove() {
  if (!editId) return
  if (!confirm('Hapus liturgi ini?')) return
  const { error: deleteError } = await supabase.from('liturgi').delete().eq('id', editId)
  if (!deleteError) router.push('/')
}
</script>

<template>
  <AdminShell>
    <div class="mx-auto max-w-lg space-y-6">
      <div>
        <p class="label-eyebrow text-accent">Admin</p>
        <h1 class="font-display text-2xl font-semibold text-ink">{{ isEdit ? 'Edit Liturgi' : 'Upload Liturgi' }}</h1>
        <p class="mt-0.5 text-sm text-muted">
          {{ isEdit ? 'Perbarui detail atau berkas liturgi ini.' : 'Tetapkan jadwal, lalu unggah berkas tata ibadah.' }}
        </p>
      </div>

      <form class="space-y-4" @submit.prevent="submit">
        <!-- section 1: jadwal — jemaat + tanggal + sesi, the identity of the slot -->
        <div class="field-group">
          <p class="field-group-heading">
            <CalendarDays class="h-4 w-4 text-accent" /> Jadwal
          </p>

          <div>
            <label class="label-eyebrow mb-1 block">Jemaat</label>
            <div class="relative">
              <select v-model="jemaatId" class="input appearance-none pr-8" :disabled="isEdit">
                <option v-for="j in jemaatList" :key="j.id" :value="j.id">{{ j.name }}</option>
              </select>
              <ChevronDown class="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="label-eyebrow mb-1 block">Tanggal</label>
              <input v-model="tanggal" type="date" class="input" :disabled="isEdit" />
            </div>
            <div>
              <label class="label-eyebrow mb-1 block">Sesi</label>
              <div class="relative">
                <select v-model="sesi" class="input appearance-none pr-8" :disabled="isEdit">
                  <option value="PAGI">Pagi</option>
                  <option value="SORE">Sore</option>
                </select>
                <ChevronDown class="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
              </div>
            </div>
          </div>

          <!-- create-mode only: warns before the identity fields lock in, so a
               forgotten date/sesi doesn't quietly overwrite an existing file -->
          <p v-if="!isEdit && checkingSlot" class="text-xs text-muted">Mengecek slot…</p>
          <div
            v-else-if="!isEdit && existingSlot"
            class="flex items-start gap-2 rounded-lg border border-gold/40 bg-gold-soft px-3 py-2.5 text-xs text-ink/80"
          >
            <AlertTriangle class="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
            <span>
              Slot ini udah ada liturgi: <strong>{{ existingSlot.originalFilename }}</strong>
              ({{ existingSlot.status === 'PUBLISHED' ? 'Terbit' : 'Draf' }}). Simpan di sini akan menimpanya.
            </span>
          </div>
        </div>

        <!-- section 2: detail ibadah — the descriptive metadata, incl. the liturgical colour -->
        <div class="field-group">
          <p class="field-group-heading">
            <BookOpenText class="h-4 w-4 text-accent" /> Detail Ibadah
            <span class="ml-auto text-xs font-normal text-muted">Opsional</span>
          </p>

          <div>
            <label class="label-eyebrow mb-1 block">Minggu ke</label>
            <input v-model="mingguKe" type="text" class="input" placeholder="Minggu X Sesudah Trinitatis" />
          </div>
          <div>
            <label class="label-eyebrow mb-1 block">Tema</label>
            <input v-model="tema" type="text" class="input" placeholder="Tema khotbah minggu ini" />
          </div>
          <div>
            <label class="label-eyebrow mb-1 block">Warna Liturgi</label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="w in WARNA_OPTIONS"
                :key="w"
                type="button"
                class="chip border px-3 py-1.5 text-sm transition-colors"
                :class="
                  warnaLiturgi === w
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-line text-muted hover:border-accent-line hover:text-ink'
                "
                @click="warnaLiturgi = warnaLiturgi === w ? '' : w"
              >
                {{ w }}
              </button>
            </div>
          </div>
        </div>

        <!-- section 3: berkas -->
        <div class="field-group">
          <p class="field-group-heading">
            <UploadCloud class="h-4 w-4 text-accent" /> Berkas
          </p>

          <div v-if="isEdit && currentFilename" class="flex items-center gap-2 rounded-lg border border-line bg-paper-deep/50 px-3 py-2 text-xs text-muted">
            <FileCheck2 class="h-3.5 w-3.5 shrink-0 text-accent" />
            File saat ini: <span class="font-medium text-ink">{{ currentFilename }}</span>
          </div>

          <div>
            <label class="label-eyebrow mb-1 block">
              {{ isEdit ? 'Ganti file (opsional)' : 'File PDF atau Word' }}
            </label>
            <input
              type="file"
              accept=".pdf,.docx"
              class="input cursor-pointer file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-accent-soft file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-accent"
              @change="onFileChange"
            />
          </div>
        </div>

        <!-- section 4: publikasi -->
        <div class="field-group">
          <p class="field-group-heading">
            <Radio class="h-4 w-4 text-accent" /> Publikasi
          </p>
          <div class="flex gap-2">
            <button
              type="button"
              class="chip flex-1 justify-center border px-3 py-2 text-sm font-medium transition-colors"
              :class="
                status === 'DRAFT'
                  ? 'border-line bg-paper-deep text-ink'
                  : 'border-line text-muted hover:text-ink'
              "
              @click="status = 'DRAFT'"
            >
              Draf
            </button>
            <button
              type="button"
              class="chip flex-1 justify-center border px-3 py-2 text-sm font-medium transition-colors"
              :class="
                status === 'PUBLISHED'
                  ? 'border-accent bg-accent-soft text-accent'
                  : 'border-line text-muted hover:text-ink'
              "
              @click="status = 'PUBLISHED'"
            >
              Terbit
            </button>
          </div>
          <p class="text-xs text-muted">Jemaat hanya bisa melihat liturgi yang berstatus "Terbit".</p>
        </div>

        <p v-if="error" class="text-sm text-danger">{{ error }}</p>

        <div class="flex gap-2 pt-1">
          <button type="submit" class="btn-primary flex-1" :disabled="saving">
            {{ saving ? 'Menyimpan…' : 'Simpan' }}
          </button>
          <button v-if="isEdit" type="button" class="btn-danger gap-1.5" @click="remove">
            <Trash2 class="h-4 w-4" /> Hapus
          </button>
        </div>
      </form>
    </div>
  </AdminShell>
</template>
