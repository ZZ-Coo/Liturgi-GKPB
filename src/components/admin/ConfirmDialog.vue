<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { AlertTriangle, HelpCircle } from 'lucide-vue-next'
import { pendingConfirm, settleConfirm } from '@/composables/confirm'

// Mounted once, in AdminShell. Renders whatever askConfirm() queued.
const pending = pendingConfirm
const danger = computed(() => pending.value?.tone === 'danger')

const cancelEl = ref<HTMLButtonElement | null>(null)
const confirmEl = ref<HTMLButtonElement | null>(null)
let previouslyFocused: HTMLElement | null = null

watch(
  () => pending.value,
  async (now, before) => {
    if (now && !before) {
      previouslyFocused = document.activeElement as HTMLElement | null
      document.documentElement.classList.add('overflow-hidden')
      await nextTick()
      // Destructive: land on "Batal" so a stray Enter can't delete anything.
      ;(danger.value ? cancelEl.value : confirmEl.value)?.focus()
    } else if (!now && before) {
      document.documentElement.classList.remove('overflow-hidden')
      previouslyFocused?.focus?.()
      previouslyFocused = null
    }
  },
)

onBeforeUnmount(() => {
  document.documentElement.classList.remove('overflow-hidden')
  // A dialog left open when the page goes away must not leave its promise hanging.
  if (pending.value) settleConfirm(false)
})

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    settleConfirm(false)
    return
  }
  // Two buttons only: keep Tab inside the dialog.
  if (e.key === 'Tab') {
    const first = cancelEl.value
    const last = confirmEl.value
    if (!first || !last) return
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="confirm">
      <div
        v-if="pending"
        class="fixed inset-0 z-[70] flex items-end justify-center bg-ink/45 p-4 backdrop-blur-[2px] sm:items-center"
        @mousedown.self="settleConfirm(false)"
        @keydown="onKeydown"
      >
        <div
          class="confirm-panel w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-card"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          :aria-describedby="pending.message ? 'confirm-message' : undefined"
        >
          <div class="flex items-start gap-4">
            <div
              class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
              :class="danger ? 'bg-danger/10 text-danger' : 'bg-accent-soft text-accent'"
            >
              <AlertTriangle v-if="danger" class="h-5 w-5" />
              <HelpCircle v-else class="h-5 w-5" />
            </div>
            <div class="min-w-0 space-y-1.5 pt-0.5">
              <h2 id="confirm-title" class="font-display text-lg font-semibold leading-snug text-ink">{{ pending.title }}</h2>
              <p v-if="pending.message" id="confirm-message" class="whitespace-pre-line text-sm leading-relaxed text-muted">{{ pending.message }}</p>
            </div>
          </div>

          <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button ref="cancelEl" type="button" class="btn sm:min-w-[6.5rem]" @click="settleConfirm(false)">
              {{ pending.cancelLabel ?? 'Batal' }}
            </button>
            <button
              ref="confirmEl"
              type="button"
              class="btn sm:min-w-[6.5rem]"
              :class="danger ? '!border-danger !bg-danger !text-paper hover:!opacity-90 hover:!text-paper' : 'btn-primary'"
              @click="settleConfirm(true)"
            >
              {{ pending.confirmLabel ?? 'Ya, lanjut' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.confirm-enter-active,
.confirm-leave-active {
  transition: opacity 0.16s ease;
}
.confirm-enter-active .confirm-panel,
.confirm-leave-active .confirm-panel {
  transition: transform 0.18s cubic-bezier(0.2, 0.9, 0.3, 1.1), opacity 0.16s ease;
}
.confirm-enter-from,
.confirm-leave-to {
  opacity: 0;
}
.confirm-enter-from .confirm-panel,
.confirm-leave-to .confirm-panel {
  opacity: 0;
  transform: translateY(12px) scale(0.97);
}
</style>
