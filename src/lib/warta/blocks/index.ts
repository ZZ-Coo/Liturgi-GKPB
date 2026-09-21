// lib/warta/blocks/index.ts
// The block registry: one entry per block type, and the ONLY place that has
// to change to add a new one (after adding it to `WartaBlock` in ../types.ts
// and teaching parse.ts about it).
//
//   Renderer — shows the block. Used by the public page AND the builder's live
//              preview, so what the secretary sees is what jemaat sees. Static
//              import, and kept free of heavy dependencies.
//   Editor   — edits the block's `data` (v-model). Admin only, so it is loaded
//              lazily: TipTap and friends never reach the public bundle.
//   presets  — ready-made starting points ("Tabel ulang tahun", …): the same
//              block type with headers and a suggested title already filled in.

import { defineAsyncComponent, type Component } from 'vue'
import { AlignLeft, Table2, Wallet } from 'lucide-vue-next'
import type { FinanceTableData, TableData, WartaBlock, WartaBlockType } from '../types'
import { emptyRichDoc } from '../richtext'
import { newId } from '../id'
import TextBlockView from '@/components/warta/blocks/TextBlockView.vue'
import TableBlockView from '@/components/warta/blocks/TableBlockView.vue'
import FinanceTableBlockView from '@/components/warta/blocks/FinanceTableBlockView.vue'

export interface BlockPreset {
  key: string
  label: string
  /** suggested item title, e.g. "Warga Jemaat Berulang Tahun" */
  title?: string
  createData: () => WartaBlock['data']
}

export interface BlockDefinition {
  type: WartaBlockType
  label: string
  icon: Component
  createData: () => WartaBlock['data']
  presets: BlockPreset[]
  Renderer: Component
  Editor: Component
}

const blankRow = (width: number) => Array<string>(width).fill('')

function table(headers: string[], opts: { numbered?: boolean; bordered?: boolean } = {}): TableData {
  return {
    columns: headers.map((header) => ({ header, align: 'left' as const })),
    rows: [blankRow(headers.length)],
    showHeader: true,
    bordered: opts.bordered ?? true,
    numbered: opts.numbered ?? false,
  }
}

function finance(columns: FinanceTableData['columns'], totalLabel: string): FinanceTableData {
  return { columns, rows: [blankRow(columns.length)], totalLabel }
}

export const blockRegistry: Record<WartaBlockType, BlockDefinition> = {
  text: {
    type: 'text',
    label: 'Teks',
    icon: AlignLeft,
    createData: () => ({ content: emptyRichDoc() }),
    presets: [],
    Renderer: TextBlockView,
    Editor: defineAsyncComponent(() => import('@/components/warta/blocks/TextBlockEditor.vue')),
  },
  table: {
    type: 'table',
    label: 'Tabel',
    icon: Table2,
    createData: () => table(['Kolom 1', 'Kolom 2']),
    presets: [
      { key: 'ulang-tahun', label: 'Warga berulang tahun', title: 'Warga Jemaat Berulang Tahun', createData: () => table(['Nama Jemaat', 'Tanggal Lahir'], { numbered: true }) },
      { key: 'ulang-tahun-pernikahan', label: 'Ulang tahun pernikahan', title: 'Warga Jemaat Berulang Tahun Pernikahan', createData: () => table(['Nama Suami', 'Nama Istri', 'Tanggal Pernikahan'], { numbered: true }) },
      { key: 'kategorial', label: 'Kegiatan kategorial', title: 'Kegiatan Kategorial', createData: () => table(['Kategorial', 'Waktu', 'Kegiatan'], { numbered: true }) },
      { key: 'petugas', label: 'Petugas dalam ibadah', title: 'Petugas dalam Ibadah', createData: () => table(['Tugas dalam Ibadah', 'Minggu Pagi', 'Minggu Sore']) },
      { key: 'rekening', label: 'Info rekening (tanpa garis)', title: 'Persembahan', createData: () => ({ ...table(['', ''], { bordered: false }), showHeader: false, rows: [['Nama Bank', ''], ['Atas Nama', ''], ['No Rekening', '']] }) },
    ],
    Renderer: TableBlockView,
    Editor: defineAsyncComponent(() => import('@/components/warta/blocks/TableBlockEditor.vue')),
  },
  financeTable: {
    type: 'financeTable',
    label: 'Tabel keuangan',
    icon: Wallet,
    createData: () => finance([{ header: 'Keterangan', kind: 'text' }, { header: 'Jumlah', kind: 'amount' }], 'JUMLAH'),
    presets: [
      {
        key: 'penerimaan',
        label: 'Laporan: penerimaan',
        title: 'Laporan Keuangan — Penerimaan',
        createData: () => finance([{ header: 'Keterangan', kind: 'text' }, { header: 'Jumlah', kind: 'amount' }, { header: 'Kolekta', kind: 'amount' }, { header: 'Syukur', kind: 'amount' }], 'JUMLAH PENERIMAAN'),
      },
      {
        key: 'pengeluaran',
        label: 'Laporan: pengeluaran',
        title: 'Laporan Keuangan — Pengeluaran',
        createData: () => finance([{ header: 'Keterangan', kind: 'text' }, { header: 'Total', kind: 'amount' }], 'TOTAL PENGELUARAN'),
      },
    ],
    Renderer: FinanceTableBlockView,
    Editor: defineAsyncComponent(() => import('@/components/warta/blocks/FinanceTableBlockEditor.vue')),
  },
}

export const blockDefinitions: BlockDefinition[] = Object.values(blockRegistry)

export function createBlock(type: WartaBlockType, title?: string, data?: WartaBlock['data']): WartaBlock {
  const def = blockRegistry[type]
  return { id: newId(), type, ...(title !== undefined ? { title } : {}), data: data ?? def.createData() } as WartaBlock
}
