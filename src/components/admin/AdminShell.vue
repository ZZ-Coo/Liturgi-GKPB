<script setup lang="ts">
import { watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { simplifiedView } from '@/composables/adminViewMode'
import { Church, LogOut, Rows3, LayoutGrid } from 'lucide-vue-next'
import GlobalToast from '@/components/admin/GlobalToast.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'

const auth = useAuthStore()
const router = useRouter()

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
          <div class="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-paper">
            <Church class="h-4 w-4 text-accent" stroke-width="1.75" />
          </div>
          <div class="leading-tight">
            <p class="font-display text-sm font-semibold text-ink">Liturgi GKPB</p>
            <p class="label-eyebrow -mt-0.5">Admin</p>
          </div>
        </div>

        <div class="flex items-center gap-3">
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
      <slot />
    </main>

    <GlobalToast />
  </div>
</template>