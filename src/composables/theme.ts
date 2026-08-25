// composables/theme.ts
import { ref } from 'vue'

const STORAGE_KEY = 'liturgi-theme'

function systemPrefersDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function readStored(): 'light' | 'dark' | null {
  const v = localStorage.getItem(STORAGE_KEY)
  return v === 'light' || v === 'dark' ? v : null
}

export const isDark = ref((() => {
  const stored = readStored()
  return stored ? stored === 'dark' : systemPrefersDark()
})())

function apply() {
  document.documentElement.classList.toggle('dark', isDark.value)
}

// Called once from main.ts, synchronously, before the app mounts — this is
// what prevents a light-mode flash for someone who has dark saved.
export function initTheme() {
  apply()
}

export function toggleTheme() {
  isDark.value = !isDark.value
  localStorage.setItem(STORAGE_KEY, isDark.value ? 'dark' : 'light')
  apply()
}