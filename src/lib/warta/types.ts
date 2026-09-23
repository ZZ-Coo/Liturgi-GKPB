// lib/warta/types.ts
// Shape of the `sections` JSONB column on the `warta` table (db schema:
// prisma/schema.prisma). The database stores it opaquely; this file is the
// source of truth for what's inside.
//
//   warta.sections = WartaSection[]
//     └─ section  { id, title, numbering, blocks[] }
//          └─ block { id, type, title?, data }   ← `data` depends on `type`
//
// Nesting stops here on purpose: sections hold blocks, blocks hold content,
// nothing holds sections. Adding a block type = add a member to `WartaBlock`,
// register it in lib/warta/blocks/index.ts, done.

// A deliberately tiny subset of the ProseMirror/TipTap JSON document format —
// only what the editor can actually produce (paragraphs, bold/italic/underline,
// line breaks, numbered lists). The public renderer (richtext.ts) understands
// exactly this and ignores anything else, so it can render without TipTap.
export interface RichNode {
  type: string
  text?: string
  marks?: { type: string }[]
  attrs?: Record<string, unknown>
  content?: RichNode[]
}
export type RichDoc = RichNode & { type: 'doc' }

// 'roman' → "I.", "II.", … (counted only across roman sections);
// 'none'  → heading without a number (e.g. the opening "SAPAAN").
export type SectionNumbering = 'roman' | 'none'

export interface TextBlock {
  id: string
  type: 'text'
  // When set, shown as a numbered item heading ("1. SELAMAT DATANG").
  // Blocks without a title take no number (footnotes, follow-up paragraphs).
  title?: string
  data: { content: RichDoc }
}

export type ColumnAlign = 'left' | 'center' | 'right'

export interface TableColumn {
  header: string
  align: ColumnAlign
}

// General-purpose table: birthdays, activities, who serves at which service…
// Cells are plain text; **bold**, *italic* and line breaks are understood
// (lib/warta/inline.ts). The "No" column is generated, not stored.
export interface TableData {
  columns: TableColumn[]
  rows: string[][] // rows[r].length === columns.length, always (parse.ts enforces it)
  showHeader: boolean
  bordered: boolean
  numbered: boolean
}

export interface TableBlock {
  id: string
  type: 'table'
  title?: string
  data: TableData
}

// Finance report table: "amount" columns are right-aligned, normalised to
// Indonesian number format, and summed into a total row (lib/warta/money.ts).
export interface FinanceColumn {
  header: string
  kind: 'text' | 'amount'
}

export interface FinanceTableData {
  columns: FinanceColumn[]
  rows: string[][]
  /** Label of the total row ("JUMLAH PENERIMAAN"); empty = no total row. */
  totalLabel: string
}

export interface FinanceTableBlock {
  id: string
  type: 'financeTable'
  title?: string
  data: FinanceTableData
}

export type ImageWidth = 'small' | 'medium' | 'large' | 'full'

// `path` is the bucket-relative path (<slug>/warta/<file>) — kept alongside
// the public `url` so a replace/remove doesn't have to re-derive it by
// string-slicing the URL (lib/storage.ts already does that as a fallback for
// files uploaded before this field existed).
export interface ImageData {
  url: string
  path: string
  alt: string
  caption: string
  width: ImageWidth
}

export interface ImageBlock {
  id: string
  type: 'image'
  title?: string
  data: ImageData
}

export type WartaBlock = TextBlock | TableBlock | FinanceTableBlock | ImageBlock
export type WartaBlockType = WartaBlock['type']
// Runtime list of the same thing, for validating data read back from the
// database (parse.ts) without importing the block registry (and with it,
// Vue components) into plain-logic code.
export const WARTA_BLOCK_TYPES: readonly WartaBlockType[] = ['text', 'table', 'financeTable', 'image']

export interface WartaSection {
  id: string
  title: string
  numbering: SectionNumbering
  blocks: WartaBlock[]
}

export type PublishStatus = 'DRAFT' | 'PUBLISHED'

// A row of the `warta` table, with `sections` already validated (parse.ts).
export interface WartaRecord {
  id: string
  jemaatId: string
  tanggal: string // yyyy-mm-dd
  status: PublishStatus
  sections: WartaSection[]
  updatedAt: string
}
