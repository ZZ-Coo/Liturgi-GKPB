// lib/warta/inline.ts
// Table cells are plain text (a TipTap editor per cell would mean dozens of
// editors on one screen). The only formatting they need — bold names, italic
// notes — is written the lightweight way: **tebal**, *miring*. Line breaks are
// kept (a cell often holds a list of names, one per line).
//
// Text is HTML-escaped BEFORE the markers are converted, and the only tags
// ever produced are <strong>, <em> and <br>, so the result is safe for v-html.

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

export function inlineToHtml(text: string): string {
  return (text ?? '')
    .toString()
    .replace(/[&<>"']/g, (ch) => ESCAPES[ch])
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\r?\n/g, '<br>')
}
