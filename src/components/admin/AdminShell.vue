<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { Church, LogOut } from 'lucide-vue-next'

const auth = useAuthStore()
const router = useRouter()

async function logout() {
  await auth.logout()
  router.push({ name: 'admin-login' })
}
</script>

<template>
  <div class="min-h-screen bg-paper">
    <header class="sticky top-0 z-10 border-b border-line bg-white/85 backdrop-blur-md">
      <div class="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
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
          <span v-if="auth.email" class="hidden text-xs text-muted sm:inline">{{ auth.email }}</span>
          <button class="btn-ghost gap-1.5 text-muted hover:text-danger" @click="logout">
            <LogOut class="h-3.5 w-3.5" />
            <span class="hidden sm:inline">Keluar</span>
          </button>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <slot />
    </main>
  </div>
</template>
