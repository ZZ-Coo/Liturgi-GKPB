// lib/warta/richtext.ts
// JSON → HTML for the warta's rich text, with NO dependency on TipTap: the
// public page only needs to *show* text, and shipping an editor to every
// jemaat member just to do that would defeat the point. TipTap is loaded only
// by the admin editor (components/warta/RichTextEditor.vue).
//
// Safe to feed to v-html: every text node is escaped, only a fixed set of tags
// is ever emitted, and the single attribute allowed through (`start` on an
// ordered list) is coerced to an integer. Unknown nodes are dropped (their
// children are still rendered), unknown marks are ignored.

import type { RichNode } from './types'

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch])
}

const MARK_TAGS: Record<string, string> = {
  bold: 'strong',
  italic: 'em',
  underline: 'u',
}

function renderChildren(node: RichNode): string {
  return (node.content ?? []).map(renderNode).join('')
}

function renderNode(node: RichNode): string {
  switch (node.type) {
    case 'text': {
      let html = escapeHtml(node.text ?? '')
      // Alphabetical order (bold → italic → underline) so the nesting is the
      // same however ProseMirror happened to order the marks array.
      for (const mark of [...(node.marks ?? [])].sort((a, b) => a.type.localeCompare(b.type))) {
        const tag = MARK_TAGS[mark.type]
        if (tag) html = `<${tag}>${html}</${tag}>`
      }
      return html
    }
    case 'hardBreak':
      return '<br>'
    case 'paragraph': {
      const inner = renderChildren(node)
      // An empty paragraph is a deliberate blank line in the source document.
      return `<p>${inner || '<br>'}</p>`
    }
    case 'orderedList': {
      const start = Number(node.attrs?.start)
      const startAttr = Number.isInteger(start) && start > 1 ? ` start="${start}"` : ''
      return `<ol${startAttr}>${renderChildren(node)}</ol>`
    }
    case 'listItem':
      return `<li>${renderChildren(node)}</li>`
    case 'doc': {
      // Blank paragraphs at the very END of a block are never intentional —
      // spacing between blocks comes from the layout — but editors like to
      // append one after a list. Drop them; blank lines in the middle stay.
      const nodes = [...(node.content ?? [])]
      while (nodes.length && nodes[nodes.length - 1].type === 'paragraph' && isRichEmpty(nodes[nodes.length - 1])) {
        nodes.pop()
      }
      return nodes.map(renderNode).join('')
    }
    default:
      // Anything unrecognised: just its content.
      return renderChildren(node)
  }
}

export function richToHtml(doc: RichNode | null | undefined): string {
  return doc ? renderNode(doc) : ''
}

// True when the document has no visible text at all (only blank paragraphs).
export function isRichEmpty(doc: RichNode | null | undefined): boolean {
  if (!doc) return true
  if (doc.type === 'text') return !(doc.text ?? '').trim()
  return (doc.content ?? []).every(isRichEmpty)
}

export function emptyRichDoc(): RichNode & { type: 'doc' } {
  return { type: 'doc', content: [{ type: 'paragraph' }] }
}
