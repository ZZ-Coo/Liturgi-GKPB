// composables/toast.ts
// Module-scoped queue (not per-component), so any admin action — in
// LiturgiListView, JemaatAdminHomeView, UploadLiturgiView, wherever —
// can push a confirmation without prop-drilling a handler down to it.
// AdminShell mounts the one <GlobalToast /> that reads this queue, so
// every admin page gets it for free just by being wrapped in AdminShell.
import { ref } from 'vue'

export type ToastKind = 'success' | 'error'

export interface Toast {
  id: number
  message: string
  kind: ToastKind
}

const DEFAULT_DURATION_MS = 3000

export const toasts = ref<Toast[]>([])
let nextId = 1

export function pushToast(message: string, kind: ToastKind = 'success', durationMs = DEFAULT_DURATION_MS) {
  const id = nextId++
  toasts.value.push({ id, message, kind })
  window.setTimeout(() => dismissToast(id), durationMs)
}

export function dismissToast(id: number) {
  toasts.value = toasts.value.filter((t) => t.id !== id)
}