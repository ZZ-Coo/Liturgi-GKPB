// composables/adminViewMode.ts
// Module-scoped (not per-component) ref, so the navbar toggle and the
// Semua Liturgi page share one source of truth without prop drilling.
// Persisted to localStorage purely as a convenience — reopening the tab
// keeps whichever mode was last picked; it's not meaningful data, just a
// UI preference, so no backend/store round-trip needed for it.
import { ref, watch } from 'vue'

const STORAGE_KEY = 'liturgi-admin-list-mode'

function readInitial(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'simplified'
  } catch {
    return false
  }
}

export const simplifiedView = ref<boolean>(readInitial())

watch(simplifiedView, (val) => {
  try {
    localStorage.setItem(STORAGE_KEY, val ? 'simplified' : 'normal')
  } catch {
    // localStorage unavailable (private mode, etc.) — fine, just won't persist
  }
})
