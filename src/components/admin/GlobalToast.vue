<script setup lang="ts">
// Fixed bottom-center stack, newest on top — mounted once by AdminShell so
// it survives route changes within the admin section (a save that redirects
// to `/` right after shouldn't cut the toast off mid-fade).
import { TransitionGroup } from 'vue'
import { toasts, dismissToast } from '@/composables/toast'
import { CheckCircle2, AlertTriangle, X } from 'lucide-vue-next'
</script>

<template>
  <div class="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col-reverse items-center gap-2 px-4">
    <TransitionGroup
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 translate-y-2"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-for="t in toasts"
        :key="t.id"
        class="card pointer-events-auto flex max-w-sm items-center gap-2 py-2 pl-3 pr-2 shadow-card"
        :class="t.kind === 'error' ? 'border-danger/30' : 'border-accent/30'"
      >
        <component
          :is="t.kind === 'error' ? AlertTriangle : CheckCircle2"
          class="h-4 w-4 shrink-0"
          :class="t.kind === 'error' ? 'text-danger' : 'text-accent'"
        />
        <span class="text-sm text-ink">{{ t.message }}</span>
        <button
          type="button"
          class="ml-1 shrink-0 rounded p-1 text-muted hover:bg-paper-deep/70"
          aria-label="Tutup notifikasi"
          @click="dismissToast(t.id)"
        >
          <X class="h-3.5 w-3.5" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>