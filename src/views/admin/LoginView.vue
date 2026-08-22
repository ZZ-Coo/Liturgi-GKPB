<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { Church, Mail, Lock } from 'lucide-vue-next'

const email = ref('')
const password = ref('')
const error = ref<string | null>(null)
const loading = ref(false)

const auth = useAuthStore()
const router = useRouter()

async function submit() {
  loading.value = true
  error.value = null
  try {
    await auth.login(email.value, password.value)
    router.push({ name: 'admin-liturgi-list' })
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Login gagal'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="relative flex min-h-screen items-center justify-center overflow-hidden bg-paper px-4">
    <div
      class="pointer-events-none absolute inset-x-0 -top-24 h-72 bg-[radial-gradient(ellipse_at_top,theme(colors.accent.soft)_0%,transparent_65%)]"
    />
    <div class="relative w-full max-w-sm space-y-6">
      <div class="flex flex-col items-center gap-2 text-center">
        <div class="flex h-16 w-16 items-center justify-center rounded-full border border-line bg-white shadow-lift">
          <Church class="h-7 w-7 text-accent" stroke-width="1.6" />
        </div>
        <div>
          <p class="label-eyebrow text-accent">Admin</p>
          <h1 class="font-display text-2xl font-semibold text-ink">Liturgi GKPB</h1>
        </div>
      </div>

      <form class="card space-y-3" @submit.prevent="submit">
        <div class="relative">
          <Mail class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input v-model="email" type="email" placeholder="Email" class="input pl-10" autofocus />
        </div>
        <div class="relative">
          <Lock class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input v-model="password" type="password" placeholder="Kata sandi" class="input pl-10" />
        </div>
        <button type="submit" class="btn-primary w-full" :disabled="loading">
          {{ loading ? 'Memproses…' : 'Masuk' }}
        </button>
        <p v-if="error" class="text-center text-sm text-danger">{{ error }}</p>
      </form>
    </div>
  </div>
</template>
