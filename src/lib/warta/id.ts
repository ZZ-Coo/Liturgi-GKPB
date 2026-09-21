// lib/warta/id.ts
// Stable ids for sections/blocks (drag-and-drop keys, v-for keys). crypto.randomUUID
// only exists in secure contexts (https / localhost), so fall back for plain http.
export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
