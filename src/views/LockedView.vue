<script setup lang="ts">
import { Lock } from 'lucide-vue-next'
import ThemeToggle from '@/components/ThemeToggle.vue'
</script>

<template>
  <!-- Deliberately neutral: no app name, no hint of who can get in or how.
       Someone who typed the bare domain just sees that this page isn't for them. -->
  <div class="relative flex min-h-screen items-center justify-center bg-paper px-4">
    <div class="absolute right-4 top-4 sm:right-6 sm:top-6">
      <ThemeToggle />
    </div>

    <div class="flex flex-col items-center gap-3 text-center">
      <div class="flex h-16 w-16 items-center justify-center rounded-full border border-line bg-surface shadow-lift">
        <Lock class="h-7 w-7 text-muted" stroke-width="1.6" />
      </div>
      <h1 class="font-display text-xl font-semibold text-ink">Halaman ini tidak tersedia</h1>
      <p class="max-w-xs text-sm text-muted">
        Untuk melihat tata ibadah, gunakan tautan yang diberikan oleh jemaat Anda.
      </p>
    </div>
  </div>
</template>
