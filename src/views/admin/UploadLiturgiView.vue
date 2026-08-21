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
    <div class="mx-auto max-w-md space-y-6">
      <div>
        <p class="label-eyebrow">Admin</p>
        <h1 class="font-display text-2xl font-semibold text-ink">{{ isEdit ? 'Edit Liturgi' : 'Upload Liturgi' }}</h1>
      </div>

      <form class="card space-y-3" @submit.prevent="submit">
      <div>
        <label class="label-eyebrow mb-1 block">Jemaat</label>
        <select v-model="jemaatId" class="input" :disabled="isEdit">
          <option v-for="j in jemaatList" :key="j.id" :value="j.id">{{ j.name }}</option>
        </select>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="label-eyebrow mb-1 block">Tanggal</label>
          <input v-model="tanggal" type="date" class="input" :disabled="isEdit" />
        </div>
        <div>
          <label class="label-eyebrow mb-1 block">Sesi</label>
          <select v-model="sesi" class="input" :disabled="isEdit">
            <option value="PAGI">Pagi</option>
            <option value="SORE">Sore</option>
          </select>
        </div>
      </div>

      <!-- create-mode only: warns before the identity fields lock in, so a
           forgotten date/sesi doesn't quietly overwrite an existing file -->
      <p v-if="!isEdit && checkingSlot" class="text-xs text-muted">Mengecek slot…</p>
      <div
        v-else-if="!isEdit && existingSlot"
        class="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800"
      >
        Slot ini udah ada liturgi: <strong>{{ existingSlot.originalFilename }}</strong>
        ({{ existingSlot.status === 'PUBLISHED' ? 'Terbit' : 'Draf' }}). Simpan di sini akan menimpanya.
      </div>

      <div>
        <label class="label-eyebrow mb-1 block">Minggu ke (opsional)</label>
        <input v-model="mingguKe" type="text" class="input" placeholder="Minggu X Sesudah Trinitatis" />
      </div>
      <div>
        <label class="label-eyebrow mb-1 block">Tema (opsional)</label>
        <input v-model="tema" type="text" class="input" />
      </div>
      <div>
        <label class="label-eyebrow mb-1 block">Warna Liturgi (opsional)</label>
        <input v-model="warnaLiturgi" type="text" class="input" placeholder="Hijau / Putih / Ungu / Merah" />
      </div>

      <div>
        <label class="label-eyebrow mb-1 block">
          {{ isEdit ? 'Ganti file (opsional)' : 'File (PDF atau Word)' }}
        </label>
        <p v-if="isEdit && currentFilename" class="mb-1 text-xs text-muted">
          File saat ini: {{ currentFilename }}
        </p>
        <input
          type="file"
          accept=".pdf,.docx"
          class="input file:mr-3 file:border-0 file:bg-accent-soft file:px-3 file:py-1.5 file:text-accent"
          @change="onFileChange"
        />
      </div>

      <div>
        <label class="label-eyebrow mb-1 block">Status</label>
        <select v-model="status" class="input">
          <option value="DRAFT">Draf</option>
          <option value="PUBLISHED">Terbit</option>
        </select>
      </div>

      <div class="flex gap-2 pt-1">
        <button type="submit" class="btn-primary flex-1" :disabled="saving">
          {{ saving ? 'Menyimpan…' : 'Simpan' }}
        </button>
        <button v-if="isEdit" type="button" class="btn-danger" @click="remove">Hapus</button>
        </div>
        <p v-if="error" class="text-sm text-danger">{{ error }}</p>
      </form>
    </div>
  </AdminShell>
</template>