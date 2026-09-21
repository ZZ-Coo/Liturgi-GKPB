// lib/warta/parse.ts
// Everything that comes back from the database goes through here first.
// `warta.sections` is a JSONB column — the database will happily store any
// JSON — so this is where "whatever is in there" becomes a WartaSection[] the
// UI can trust: unknown block types are dropped (a newer version of the app
// may have written them), missing ids/fields are filled in, and rich-text
// documents are checked to be documents at all.

import {
  WARTA_BLOCK_TYPES,
  type ColumnAlign,
  type FinanceTableData,
  type RichDoc,
  type SectionNumbering,
  type TableData,
  type WartaBlock,
  type WartaBlockType,
  type WartaSection,
} from './types'
import { emptyRichDoc } from './richtext'
import { newId } from './id'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseRichDoc(value: unknown): RichDoc {
  if (isRecord(value) && value.type === 'doc') return value as unknown as RichDoc
  return emptyRichDoc()
}

const asString = (value: unknown): string =>
  typeof value === 'string' ? value : typeof value === 'number' ? String(value) : ''

// Rows come back as whatever was stored. Make every row exactly as wide as the
// column list (pad with '', drop extras) so the renderers and the grid editor
// never have to guess, and coerce every cell to a string.
function parseRows(value: unknown, width: number): string[][] {
  const rows = Array.isArray(value) ? value : []
  const parsed = rows.map((row) => {
    const cells = Array.isArray(row) ? row.map(asString) : []
    while (cells.length < width) cells.push('')
    return cells.slice(0, width)
  })
  return parsed.length ? parsed : [Array(width).fill('')]
}

const parseAlign = (value: unknown): ColumnAlign => (value === 'center' || value === 'right' ? value : 'left')

function parseTableData(data: Record<string, unknown>): TableData {
  const rawColumns = Array.isArray(data.columns) ? data.columns.filter(isRecord) : []
  const columns = rawColumns.length
    ? rawColumns.map((c) => ({ header: asString(c.header), align: parseAlign(c.align) }))
    : [{ header: '', align: 'left' as const }]
  return {
    columns,
    rows: parseRows(data.rows, columns.length),
    showHeader: data.showHeader !== false,
    bordered: data.bordered !== false,
    numbered: data.numbered === true,
  }
}

function parseFinanceData(data: Record<string, unknown>): FinanceTableData {
  const rawColumns = Array.isArray(data.columns) ? data.columns.filter(isRecord) : []
  const columns = rawColumns.length
    ? rawColumns.map((c) => ({ header: asString(c.header), kind: c.kind === 'amount' ? ('amount' as const) : ('text' as const) }))
    : [{ header: '', kind: 'text' as const }]
  return { columns, rows: parseRows(data.rows, columns.length), totalLabel: asString(data.totalLabel) }
}

function parseBlock(value: unknown): WartaBlock | null {
  if (!isRecord(value)) return null
  const type = value.type as WartaBlockType
  if (!WARTA_BLOCK_TYPES.includes(type)) return null

  const id = typeof value.id === 'string' && value.id ? value.id : newId()
  const data = isRecord(value.data) ? value.data : {}
  // `title` is left out entirely when absent (not set to undefined), so parsed
  // data is identical to what the editor created.
  const title = typeof value.title === 'string' ? { title: value.title } : {}

  switch (type) {
    case 'table':
      return { id, type, ...title, data: parseTableData(data) }
    case 'financeTable':
      return { id, type, ...title, data: parseFinanceData(data) }
    default:
      return { id, type: 'text', ...title, data: { content: parseRichDoc(data.content) } }
  }
}

function parseSection(value: unknown): WartaSection | null {
  if (!isRecord(value)) return null
  const numbering: SectionNumbering = value.numbering === 'none' ? 'none' : 'roman'
  const blocks = Array.isArray(value.blocks)
    ? value.blocks.map(parseBlock).filter((b): b is WartaBlock => b !== null)
    : []
  return {
    id: typeof value.id === 'string' && value.id ? value.id : newId(),
    title: typeof value.title === 'string' ? value.title : '',
    numbering,
    blocks,
  }
}

export function parseSections(value: unknown): WartaSection[] {
  if (!Array.isArray(value)) return []
  return value.map(parseSection).filter((s): s is WartaSection => s !== null)
}

// Deep copy with fresh ids everywhere — for "copy last week's warta": the new
// document must not share ids (or object references) with the old one.
export function cloneSections(sections: WartaSection[]): WartaSection[] {
  return sections.map((section) => ({
    ...section,
    id: newId(),
    blocks: section.blocks.map((block) => ({
      ...block,
      id: newId(),
      data: JSON.parse(JSON.stringify(block.data)),
    })),
  }))
}
