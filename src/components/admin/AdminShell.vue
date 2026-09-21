<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/lib/supabase'
import { simplifiedView } from '@/composables/adminViewMode'
import { LogOut, Rows3, LayoutGrid } from 'lucide-vue-next'
import GlobalToast from '@/components/admin/GlobalToast.vue'
import ConfirmDialog from '@/components/admin/ConfirmDialog.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import AdminQuickNav from '@/components/AdminQuickNav.vue'
import BrandMark from '@/components/BrandMark.vue'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

// A jemaat_admin has exactly one jemaat, so the header can link straight to
// its public page. A super_admin has none of their own — they get "Semua
// jemaat" instead and pick one from there.
const jemaatSlug = ref<string | undefined>()
onMounted(async () => {
  if (!auth.scopedJemaatId) return
  const { data } = await supabase.from('jemaat').select('slug').eq('id', auth.scopedJemaatId).maybeSingle()
  jemaatSlug.value = data?.slug ?? undefined
})

async function logout() {
  await auth.logout()
  router.push({ name: 'admin-login' })
}

// authStore now stays live-synced with the real Supabase session (see
// authStore.ts). Catches token expiry or a logout from another tab while
// this tab is just sitting on an admin page — otherwise the admin would
// only find out something's wrong the next time a save/delete fails.
watch(
  () => auth.isAuthenticated,
  (authed) => {
    if (!authed && router.currentRoute.value.name !== 'admin-login') {
      router.push({ name: 'admin-login' })
    }
  }
)
</script>

<template>
  <div class="min-h-screen bg-paper">
    <header class="sticky top-0 z-10 border-b border-line bg-surface/85 backdrop-blur-md">
      <div class="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        <div class="flex items-center gap-2.5">
          <BrandMark size="sm" />
          <div class="leading-tight">
            <p class="font-display text-sm font-semibold text-ink">Liturgi GKPB</p>
            <p class="label-eyebrow -mt-0.5">Admin</p>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <AdminQuickNav :links="['root', 'jemaat']" :jemaat-slug="jemaatSlug" />

          <!-- Normal/Simpel — a 2-segment icon pill, same sliding-pill
               pattern as the public page's Pagi/Siang/Sore toggle. No
               longer super_admin-only: a jemaat_admin's Riwayat also
               groups by month, so Simpel collapsing those groups (plus
               the Upload/Edit form's optional section, plus dropping
               action-button text to icon-only) is just as useful there —
               shown on every admin page via AdminShell, not just List. -->
          <div class="relative inline-flex rounded-full border border-line bg-paper p-0.5">
            <div
              class="absolute inset-y-0.5 w-[calc(50%-0.125rem)] rounded-full bg-accent shadow-soft transition-transform duration-200 ease-out"
              :class="simplifiedView ? 'translate-x-[calc(100%+0.25rem)]' : 'translate-x-0'"
            />
            <button
              type="button"
              class="relative z-10 flex items-center justify-center rounded-full px-2.5 py-1.5 transition-colors"
              :class="!simplifiedView ? 'text-white' : 'text-muted hover:text-ink'"
              title="Normal — tampilan lengkap"
              aria-label="Tampilan normal"
              @click="simplifiedView = false"
            >
              <Rows3 class="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              class="relative z-10 flex items-center justify-center rounded-full px-2.5 py-1.5 transition-colors"
              :class="simplifiedView ? 'text-white' : 'text-muted hover:text-ink'"
              title="Simpel — tampilan ringkas"
              aria-label="Tampilan simpel"
              @click="simplifiedView = true"
            >
              <LayoutGrid class="h-3.5 w-3.5" />
            </button>
          </div>

          <span v-if="auth.email" class="hidden text-xs text-muted sm:inline">{{ auth.email }}</span>
          <ThemeToggle />
          <button class="btn-ghost gap-1.5 text-muted hover:text-danger" @click="logout">
            <LogOut class="h-3.5 w-3.5" />
            <span class="hidden sm:inline">Keluar</span>
          </button>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <!-- Liturgi | Warta. Only a super_admin has a Warta section (its RLS
           policies are super_admin-only), so nobody else gets the tabs. -->
      <nav v-if="auth.isSuperAdmin" class="mb-6 inline-flex rounded-full border border-line bg-surface p-0.5 shadow-soft" aria-label="Bagian admin">
        <RouterLink
          v-for="tab in [
            { to: '/', label: 'Liturgi', active: !route.path.startsWith('/warta') },
            { to: '/warta', label: 'Warta', active: route.path.startsWith('/warta') },
          ]"
          :key="tab.to"
          :to="tab.to"
          class="rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
          :class="tab.active ? 'bg-accent text-white shadow-soft' : 'text-muted hover:text-ink'"
        >
          {{ tab.label }}
        </RouterLink>
      </nav>
      <slot />
    </main>

    <GlobalToast />
    <ConfirmDialog />
  </div>
</template>