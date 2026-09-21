// composables/confirm.ts
// Promise-based replacement for window.confirm(): `await askConfirm(...)`
// resolves true (confirmed) or false (cancelled / dismissed). Module-scoped
// like toast.ts, so any admin view can ask without wiring a component in;
// AdminShell mounts the one <ConfirmDialog /> that reads this state.
import { ref } from 'vue'

export interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  /** 'danger' = destructive: red confirm button, and Cancel is focused first. */
  tone?: 'default' | 'danger'
}

export interface PendingConfirm extends ConfirmOptions {
  resolve: (confirmed: boolean) => void
}

export const pendingConfirm = ref<PendingConfirm | null>(null)

export function askConfirm(options: ConfirmOptions): Promise<boolean> {
  // Only one dialog at a time: a newer question supersedes (cancels) the old.
  pendingConfirm.value?.resolve(false)
  return new Promise<boolean>((resolve) => {
    pendingConfirm.value = { ...options, resolve }
  })
}

export function settleConfirm(confirmed: boolean) {
  const pending = pendingConfirm.value
  pendingConfirm.value = null
  pending?.resolve(confirmed)
}

// The two questions the admin asks most, worded once.
export function confirmTrash(subject: string, message = 'Masih bisa dipulihkan lewat Sampah.') {
  return askConfirm({ title: `Hapus ${subject}?`, message, confirmLabel: 'Hapus', tone: 'danger' })
}

export function confirmDestroy(subject: string) {
  return askConfirm({
    title: `Hapus permanen ${subject}?`,
    message: 'Tindakan ini tidak bisa dibatalkan.',
    confirmLabel: 'Hapus permanen',
    tone: 'danger',
  })
}
