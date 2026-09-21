<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Loader2, ShieldCheck, UserCog, Copy, Check } from 'lucide-vue-next'
import AdminShell from '@/components/admin/AdminShell.vue'
import { listAdminUsers, revokeAdminUser, type AdminUserRow } from '@/lib/adminUsers'
import { pushToast } from '@/composables/toast'
import { askConfirm } from '@/composables/confirm'

// Visibility + revoke only. Granting access (new jemaat_admin, or promoting
// to super_admin) is a deliberate SQL Editor step — see lib/adminUsers.ts —
// so this page shows the snippet for it rather than a form that would need
// to fake being able to do the same thing.
const rows = ref<AdminUserRow[]>([])
const loading = ref(true)
const loadError = ref<string | null>(null)
const busyId = ref<string | null>(null)

async function load() {
  loading.value = true
  loadError.value = null
  try {
    rows.value = await listAdminUsers()
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : 'Gagal memuat'
  } finally {
    loading.value = false
  }
}
onMounted(load)

const superAdmins = computed(() => rows.value.filter((r) => r.role === 'super_admin'))
const jemaatAdmins = computed(() =>
  [...rows.value.filter((r) => r.role === 'jemaat_admin')].sort((a, b) => (a.jemaatName ?? '').localeCompare(b.jemaatName ?? '')),
)

function formatStamp(value: string) {
  const d = new Date(/[zZ]$|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`)
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

async function revoke(row: AdminUserRow) {
  const ok = await askConfirm({
    title: `Cabut akses ${row.email}?`,
    message: row.jemaatName
      ? `Tidak akan bisa lagi masuk sebagai admin ${row.jemaatName}. Akun Supabase-nya sendiri tidak terhapus.`
      : 'Tidak akan bisa lagi masuk sebagai super admin. Akun Supabase-nya sendiri tidak terhapus.',
    confirmLabel: 'Cabut akses',
    tone: 'danger',
  })
  if (!ok) return
  busyId.value = row.userId
  try {
    await revokeAdminUser(row.userId)
    rows.value = rows.value.filter((r) => r.userId !== row.userId)
    pushToast(`Akses ${row.email} dicabut`)
  } catch (err) {
    pushToast(err instanceof Error ? err.message : 'Gagal mencabut akses', 'error')
  } finally {
    busyId.value = null
  }
}

// One-click copy for the grant snippet — the placeholders still need
// editing, but starting from a correct copy beats retyping it in the SQL
// Editor. Falls back silently (no crash) where Clipboard API isn't
// available, e.g. non-HTTPS localhost some browsers restrict it on.
const copiedKey = ref<string | null>(null)
async function copySnippet(key: string, text: string) {
  try {
    await navigator.clipboard.writeText(text)
    copiedKey.value = key
    setTimeout(() => {
      if (copiedKey.value === key) copiedKey.value = null
    }, 1500)
  } catch {
    pushToast('Tidak bisa menyalin di browser ini — salin manual saja', 'error')
  }
}

const grantSnippet = `insert into public.admin_users (user_id, role, jemaat_id)
  select u.id, 'jemaat_admin', j.id
  from auth.users u, public.jemaat j
  where u.email = 'EMAIL_SEKRETARIS' and j.slug = 'SLUG_JEMAAT'
  on conflict (user_id) do update set role = 'jemaat_admin', jemaat_id = excluded.jemaat_id;`
</script>

<template>
  <AdminShell>
    <div class="mx-auto max-w-2xl space-y-6">
      <div class="space-y-1">
        <p class="label-eyebrow text-accent">Admin</p>
        <h1 class="font-display text-2xl font-semibold text-ink">Kelola Admin</h1>
        <p class="text-sm text-muted">Siapa saja yang punya akses admin, dan ke jemaat mana.</p>
      </div>

      <p v-if="loading" class="flex items-center justify-center gap-2 py-10 text-sm text-muted">
        <Loader2 class="h-4 w-4 animate-spin text-accent" /> Memuat…
      </p>
      <p v-else-if="loadError" class="card py-6 text-center text-sm text-danger">{{ loadError }}</p>

      <template v-else>
        <div class="field-group">
          <p class="field-group-heading flex items-center gap-2"><ShieldCheck class="h-4 w-4 text-accent" /> Super Admin</p>
          <ul class="divide-y divide-line">
            <li v-for="row in superAdmins" :key="row.userId" class="flex items-center gap-3 py-2.5">
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm text-ink">{{ row.email }}</p>
                <p class="text-xs text-muted">Sejak {{ formatStamp(row.createdAt) }}</p>
              </div>
              <button
                type="button"
                class="btn-danger gap-1.5 !py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                :disabled="busyId === row.userId"
                @click="revoke(row)"
              >
                <Loader2 v-if="busyId === row.userId" class="h-3.5 w-3.5 animate-spin" />
                Cabut akses
              </button>
            </li>
          </ul>
          <p v-if="!superAdmins.length" class="py-2 text-center text-sm text-muted">Tidak ada.</p>
        </div>

        <div class="field-group">
          <p class="field-group-heading flex items-center gap-2"><UserCog class="h-4 w-4 text-accent" /> Admin Jemaat</p>
          <ul class="divide-y divide-line">
            <li v-for="row in jemaatAdmins" :key="row.userId" class="flex items-center gap-3 py-2.5">
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm text-ink">{{ row.email }}</p>
                <p class="text-xs text-muted">{{ row.jemaatName ?? '—' }} · sejak {{ formatStamp(row.createdAt) }}</p>
              </div>
              <button
                type="button"
                class="btn-danger gap-1.5 !py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                :disabled="busyId === row.userId"
                @click="revoke(row)"
              >
                <Loader2 v-if="busyId === row.userId" class="h-3.5 w-3.5 animate-spin" />
                Cabut akses
              </button>
            </li>
          </ul>
          <p v-if="!jemaatAdmins.length" class="py-2 text-center text-sm text-muted">Belum ada admin jemaat.</p>
        </div>

        <div class="field-group">
          <p class="field-group-heading">Menambah admin jemaat baru</p>
          <ol class="list-decimal space-y-1.5 pl-4 text-sm text-ink">
            <li>Buat akunnya di Dashboard → Authentication → Users → Add user.</li>
            <li>Jalankan snippet ini di SQL Editor (ganti email dan slug jemaatnya):</li>
          </ol>
          <div class="relative">
            <pre class="overflow-x-auto rounded-xl border border-line bg-paper-deep p-3 text-xs leading-relaxed text-ink"><code>{{ grantSnippet }}</code></pre>
            <button
              type="button"
              class="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md border border-line bg-surface px-2 py-1 text-xs text-muted hover:text-ink"
              @click="copySnippet('grant', grantSnippet)"
            >
              <Check v-if="copiedKey === 'grant'" class="h-3.5 w-3.5 text-accent" />
              <Copy v-else class="h-3.5 w-3.5" />
              {{ copiedKey === 'grant' ? 'Tersalin' : 'Salin' }}
            </button>
          </div>
          <p class="text-xs text-muted">
            Dijaga lewat SQL Editor dengan sengaja — bukan lupa dibuatkan tombolnya — supaya memberi atau menaikkan akses selalu lewat langkah yang disadari betul.
          </p>
        </div>
      </template>
    </div>
  </AdminShell>
</template>
