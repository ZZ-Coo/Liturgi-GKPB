// lib/warta/starter.ts
// The skeleton a brand-new warta starts from when there is nothing to copy:
// the same sections the printed warta always has, with empty text blocks.
import type { WartaSection } from './types'
import { createBlock } from './blocks'
import { newId } from './id'

export function createStarterSections(): WartaSection[] {
  return [
    { id: newId(), title: 'Sapaan', numbering: 'none', blocks: [createBlock('text', 'Selamat Datang')] },
    { id: newId(), title: 'Kegiatan Ibadah', numbering: 'roman', blocks: [createBlock('text')] },
    { id: newId(), title: 'Informasi', numbering: 'roman', blocks: [createBlock('text', 'Pengumuman')] },
  ]
}
