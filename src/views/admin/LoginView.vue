<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { Church } from 'lucide-vue-next'

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
  <div class="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,theme(colors.accent.soft)_0%,theme(colors.paper)_55%)] px-4">
    <div class="w-full max-w-sm space-y-6">
      <div class="flex flex-col items-center gap-2 text-center">
        <div class="flex h-14 w-14 items-center justify-center rounded-full border border-line bg-white shadow-sm">
          <Church class="h-6 w-6 text-accent" stroke-width="1.75" />
        </div>
        <div>
          <p class="label-eyebrow">Admin</p>
          <h1 class="font-display text-xl font-semibold text-ink">Liturgi GKPB</h1>
        </div>
      </div>

      <form class="card space-y-3 shadow-[0_2px_10px_-4px_rgba(30,38,32,0.15)]" @submit.prevent="submit">
        <input v-model="email" type="email" placeholder="Email" class="input" autofocus />
        <input v-model="password" type="password" placeholder="Kata sandi" class="input" />
        <button type="submit" class="btn-primary w-full" :disabled="loading">
          {{ loading ? 'Memproses…' : 'Masuk' }}
        </button>
        <p v-if="error" class="text-sm text-danger">{{ error }}</p>
      </form>
    </div>
  </div>
</template>