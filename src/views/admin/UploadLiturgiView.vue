<script setup lang="ts">
// Handles both create (/upload) and edit (/liturgi/:id/edit). In edit
// mode, jemaat/tanggal/sesi are locked (they're the identity of the slot)
// — only metadata, the file itself, and publish status can change. Want
// a different date/sesi? Upload a new one instead.
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { extractStoragePath } from '@/lib/storage'
import { fetchAllJemaat, type JemaatRecord } from '@/lib/tenant'
import { scanFileCover, matchPendeta, matchJemaat } from '@/lib/scan-cover'
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
  ScanLine,
  Loader2,
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
  fileUrl: string
}
const existingSlot = ref<ExistingSlot | null>(null)
const checkingSlot = ref(false)
let slotCheckTimer: ReturnType<typeof setTimeout> | undefined
let slotCheckToken = 0

const jemaatList = ref<JemaatRecord[]>([])
const jemaatId = ref('')
const tanggal = ref(new Date().toISOString().slice(0, 10))
const sesi = ref<'PAGI' | 'SIANG' | 'SORE'>('PAGI')
const jamMulai = ref('')
const mingguKe = ref('')
const tema = ref('')
const warnaLiturgi = ref('')
const pendetaId = ref('') // optional soft link — set opportunistically, never required to save
const pendetaNama = ref('') // free text: the actual source of truth for "Dilayani Oleh"
const status = ref<'DRAFT' | 'PUBLISHED'>('DRAFT')
const currentFileUrl = ref<string | null>(null)
const currentFilename = ref<string | null>(null)

interface PendetaOption {
  id: string
  name: string
  titles: string[]
}
const pendetaList = ref<PendetaOption[]>([])

const file = ref<File | null>(null)
const saving = ref(false)
const error = ref<string | null>(null)
const scanning = ref(false)
const scanNote = ref<string | null>(null)

const WARNA_OPTIONS = ['Hijau', 'Putih', 'Ungu', 'Merah', 'Hitam'] as const

// Sesi defaults off whatever jam is typed/scanned in — < 11:00 Pagi,
// 11:00–14:59 Siang, >= 15:00 Sore. Still a normal <select> underneath so
// the admin can override it manually; this only sets a sensible starting
// point instead of always defaulting to Pagi regardless of the actual time.
function deriveSesiFromJam(jam: string): 'PAGI' | 'SIANG' | 'SORE' | null {
  const match = jam.match(/(\d{1,2})[.:]/)
  if (!match) return null
  const hour = Number(match[1])
  if (Number.isNaN(hour)) return null
  if (hour < 11) return 'PAGI'
  if (hour < 15) return 'SIANG'
  return 'SORE'
}

watch(jamMulai, (jam) => {
  // Sesi is part of the slot's locked identity in edit mode (disabled
  // <select>) — don't silently change it out from under the admin just
  // because they tweaked the display-only jam text.
  if (isEdit.value) return
  const derived = deriveSesiFromJam(jam)
  if (derived) sesi.value = derived
})

async function checkSlot() {
  existingSlot.value = null
  if (isEdit.value || !jemaatId.value || !tanggal.value) return

  checkingSlot.value = true
  const token = ++slotCheckToken // guards against an older, slower request
  const { data } = await supabase
    .from('liturgi')
    .select('id, status, originalFilename, fileUrl')
    .eq('jemaatId', jemaatId.value)
    .eq('tanggal', tanggal.value)
    .eq('sesi', sesi.value)
    .is('deletedAt', null)
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

  // Pre-fill from the Overview page's "+" chips (?jemaatId=&tanggal=&sesi=)
  // — falls back to normal defaults for anything not passed, so opening
  // /upload directly still works exactly as before.
  const q = route.query
  if (!isEdit.value) {
    if (typeof q.jemaatId === 'string' && jemaatList.value.some((j) => j.id === q.jemaatId)) {
      jemaatId.value = q.jemaatId
    } else if (jemaatList.value.length && !jemaatId.value) {
      jemaatId.value = jemaatList.value[0].id
    }
    if (typeof q.tanggal === 'string') tanggal.value = q.tanggal
    if (q.sesi === 'PAGI' || q.sesi === 'SIANG' || q.sesi === 'SORE') sesi.value = q.sesi
  }

  const { data: pendetaData } = await supabase.from('pendeta').select('id, name, titles').order('name')
  pendetaList.value = pendetaData ?? []

  if (editId) {
    const { data } = await supabase
      .from('liturgi')
      .select(
        'jemaatId, tanggal, sesi, jamMulai, mingguKe, tema, warnaLiturgi, pendetaId, pendetaNama, status, fileUrl, originalFilename',
      )
      .eq('id', editId)
      .single()
    if (data) {
      jemaatId.value = data.jemaatId
      // Defensive: handles a stray full timestamp gracefully even though
      // the tanggal column is DATE now (should always be plain "YYYY-MM-DD").
      tanggal.value = data.tanggal.includes('T') ? data.tanggal.slice(0, 10) : data.tanggal
      sesi.value = data.sesi
      jamMulai.value = data.jamMulai ?? ''
      mingguKe.value = data.mingguKe ?? ''
      tema.value = data.tema ?? ''
      warnaLiturgi.value = data.warnaLiturgi ?? ''
      pendetaId.value = data.pendetaId ?? ''
      pendetaNama.value = data.pendetaNama ?? ''
      status.value = data.status
      currentFileUrl.value = data.fileUrl
      currentFilename.value = data.originalFilename
    }
  }
})

async function detectFromFile() {
  const name = file.value?.name.toLowerCase() ?? ''
  if (!file.value || !(name.endsWith('.pdf') || name.endsWith('.docx'))) {
    scanNote.value = 'Deteksi otomatis cuma jalan buat file PDF atau Word (.docx).'
    return
  }

  scanning.value = true
  scanNote.value = null
  try {
    const scanned = await scanFileCover(file.value)
    const filled: string[] = []

    // Jemaat is locked in edit mode (it's part of the slot's identity),
    // so only auto-select it while creating a new upload.
    if (!isEdit.value && scanned.jemaatName) {
      const matchedJemaatId = matchJemaat(scanned.jemaatName, jemaatList.value)
      if (matchedJemaatId) {
        jemaatId.value = matchedJemaatId
        filled.push('jemaat')
      } else {
        scanNote.value = `Terdeteksi jemaat "${scanned.jemaatName}" tapi gak cocok dengan daftar — cek dropdown jemaat manual.`
      }
    }

    if (scanned.tanggal) { tanggal.value = scanned.tanggal; filled.push('tanggal') }
    if (scanned.jamMulai) { jamMulai.value = scanned.jamMulai; filled.push('jam') }
    if (scanned.mingguKe) { mingguKe.value = scanned.mingguKe; filled.push('minggu ke') }
    if (scanned.tema) { tema.value = scanned.tema; filled.push('tema') }
    if (scanned.warnaLiturgi) { warnaLiturgi.value = scanned.warnaLiturgi; filled.push('warna liturgi') }

    if (scanned.pendetaName) {
      // Free text always wins — this is what actually shows up, exactly as
      // scanned (gelar and all), regardless of whether it matches anyone
      // in the seeded Pendeta table.
      pendetaNama.value = scanned.pendetaName
      filled.push('pendeta')

      const matchedId = matchPendeta(scanned.pendetaName, pendetaList.value)
      if (matchedId) pendetaId.value = matchedId // bonus soft link, not required
    }

    if (filled.length && !scanNote.value) {
      scanNote.value = `Terisi otomatis: ${filled.join(', ')}. Cek ulang sebelum simpan.`
    } else if (!filled.length) {
      scanNote.value = 'Gak nemu pola cover yang dikenali di halaman 1 — isi manual aja.'
    }
  } catch (err) {
    scanNote.value = err instanceof Error ? `Gagal deteksi: ${err.message}` : 'Gagal deteksi dari file.'
  } finally {
    scanning.value = false
  }
}

function onFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  file.value = target.files?.[0] ?? null
  scanNote.value = null
}

// The dropdown of seeded pendeta is a shortcut, not the source of truth —
// picking one just pre-fills the free-text field (still editable after).
function applyPendetaShortcut(e: Event) {
  const select = e.target as HTMLSelectElement
  const picked = pendetaList.value.find((p) => p.id === select.value)
  if (picked) {
    pendetaNama.value = picked.name + (picked.titles?.length ? `, ${picked.titles.join(', ')}` : '')
    pendetaId.value = picked.id
  }
  select.value = '' // it's a one-shot trigger, not a persistent selection
}

// Once the admin hand-edits the name, we can no longer be sure it still
// matches the linked Pendeta record — drop the soft link rather than risk
// it silently pointing at the wrong person.
function onPendetaNamaInput() {
  pendetaId.value = ''
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
      // naturally replaces the old file instead of piling up orphans...
      // but only when the extension matches. If this write changes the
      // file type (PDF -> DOCX or vice versa), the path itself changes,
      // so the old file at the old path is never touched by `upsert` and
      // would otherwise sit there forever. Delete it explicitly whenever
      // we're about to write to a genuinely different path — true both in
      // edit mode (currentFileUrl) AND when overwriting an existing slot
      // from the create form (existingSlot, confirmed above) — the latter
      // used to be missed entirely, orphaning the old file silently.
      const path = `${jemaatSlug(jemaatId.value)}/${tanggal.value}-${sesi.value.toLowerCase()}.${ext}`
      const oldFileUrl = isEdit.value ? currentFileUrl.value : existingSlot.value?.fileUrl ?? null

      if (oldFileUrl) {
        const oldPath = extractStoragePath(oldFileUrl)
        if (oldPath && oldPath !== path) {
          await supabase.storage.from('liturgi-files').remove([oldPath])
        }
      }

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
      jamMulai: jamMulai.value || null,
      mingguKe: mingguKe.value || null,
      tema: tema.value || null,
      warnaLiturgi: warnaLiturgi.value || null,
      pendetaId: pendetaId.value || null,
      pendetaNama: pendetaNama.value || null,
      status: status.value,
      fileUrl,
      fileType: fileType ?? undefined, // omit if unchanged in edit mode
      originalFilename,
    }

    if (isEdit.value) {
      const { error: updateError } = await supabase.from('liturgi').update(payload).eq('id', editId)
      if (updateError) throw updateError
    } else if (existingSlot.value) {
      // An active row already occupies this jemaat+tanggal+sesi (confirmed
      // above via the overwrite dialog) — update it directly by id.
      //
      // NOT `.upsert(payload, { onConflict: 'jemaatId,tanggal,sesi' })`
      // here: since the slot's uniqueness moved to a *partial* unique index
      // (`... WHERE "deletedAt" IS NULL`, see schema.prisma) so that a
      // soft-deleted row doesn't block the slot forever, Postgres can no
      // longer use it as an ON CONFLICT arbiter from a plain column list —
      // arbiter inference against a partial index requires the INSERT's
      // ON CONFLICT clause to repeat that same WHERE predicate, which
      // PostgREST's upsert() has no way to express. It fails with
      // "42P10: no unique or exclusion constraint matching the ON
      // CONFLICT specification", surfaced to the client as a 400.
      const { error: updateError } = await supabase
        .from('liturgi')
        .update(payload)
        .eq('id', existingSlot.value.id)
      if (updateError) throw updateError
    } else {
      // No active row at this slot — a plain insert is safe even if an
      // old *soft-deleted* row happens to share the same jemaat/tanggal/
      // sesi, since the partial index only constrains active rows.
      const { error: insertError } = await supabase.from('liturgi').insert(payload)
      if (insertError) throw insertError
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
  if (!confirm('Hapus liturgi ini? Masih bisa dipulihkan lewat Sampah di daftar liturgi.')) return
  // Soft delete — the file stays in storage untouched (restore needs it
  // back). Permanent removal (row + storage file) only happens from the
  // Sampah view in the list, as a separate, more deliberate action.
  const { error: deleteError } = await supabase
    .from('liturgi')
    .update({ deletedAt: new Date().toISOString() })
    .eq('id', editId)
  if (deleteError) return

  router.push('/')
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
                  <option value="SIANG">Siang</option>
                  <option value="SORE">Sore</option>
                </select>
                <ChevronDown class="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
              </div>
            </div>
          </div>

          <div>
            <label class="label-eyebrow mb-1 block">Jam (opsional)</label>
            <input v-model="jamMulai" type="text" class="input" placeholder="07.30 Wita" />
            <p class="mt-1 text-xs text-muted">Bukan jam tetap — jadwal bisa geser tiap minggu, isi ulang aja kalau beda.</p>
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
            <label class="label-eyebrow mb-1 block">Dilayani Oleh</label>
            <input
              v-model="pendetaNama"
              type="text"
              class="input"
              placeholder="Pdt. Nama Lengkap, gelar"
              @input="onPendetaNamaInput"
            />
            <!-- shortcut only — picking one just fills the text field above,
                 which stays freely editable. Not required, and no name has
                 to exist here for the text field to be saved. -->
            <div v-if="pendetaList.length" class="relative mt-1.5">
              <select class="input appearance-none pr-8 text-xs text-muted" @change="applyPendetaShortcut">
                <option value="">Isi cepat dari data pendeta…</option>
                <option v-for="p in pendetaList" :key="p.id" :value="p.id">
                  {{ p.name }}{{ p.titles?.length ? `, ${p.titles.join(', ')}` : '' }}
                </option>
              </select>
              <ChevronDown class="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            </div>
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

          <button
            v-if="file"
            type="button"
            class="btn w-full justify-center gap-1.5"
            :disabled="scanning"
            @click="detectFromFile"
          >
            <Loader2 v-if="scanning" class="h-4 w-4 animate-spin" />
            <ScanLine v-else class="h-4 w-4" />
            {{ scanning ? 'Membaca cover…' : 'Deteksi dari Berkas' }}
          </button>
          <p v-if="scanNote" class="text-xs text-muted">{{ scanNote }}</p>
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