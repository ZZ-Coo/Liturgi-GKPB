<script setup lang="ts">
import { isDark, toggleTheme } from '@/composables/theme'
import { Sun, Moon } from 'lucide-vue-next'
</script>

<template>
  <button
    type="button"
    class="btn-ghost !px-2"
    :title="isDark ? 'Mode terang' : 'Mode gelap'"
    :aria-label="isDark ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'"
    @click="toggleTheme"
  >
    <Sun v-if="isDark" class="h-4 w-4" />
    <Moon v-else class="h-4 w-4" />
  </button>
</template>