// src/lib/warta/__tests__/numbering.test.ts
// Numbers are derived from array order, never stored (see the comment at
// the top of numbering.ts) — so these tests are really testing "does the
// numbering survive a drag-and-drop reorder, and does it skip the right
// things" (untitled blocks, 'none' sections).

import { describe, it, expect } from 'vitest'
import { toRoman, numberSections } from '../numbering'
import type { WartaSection, TextBlock } from '../types'

function textBlock(id: string, title?: string): TextBlock {
  return { id, type: 'text', title, data: { content: { type: 'doc', content: [] } } }
}

describe('toRoman', () => {
  it('converts common small numbers', () => {
    expect(toRoman(1)).toBe('I')
    expect(toRoman(2)).toBe('II')
    expect(toRoman(3)).toBe('III')
    expect(toRoman(4)).toBe('IV')
    expect(toRoman(5)).toBe('V')
    expect(toRoman(9)).toBe('IX')
    expect(toRoman(10)).toBe('X')
  })

  it('converts a realistic liturgi/warta section count (double digits)', () => {
    expect(toRoman(14)).toBe('XIV')
    expect(toRoman(19)).toBe('XIX')
    expect(toRoman(40)).toBe('XL')
    expect(toRoman(90)).toBe('XC')
  })

  it('falls back to the plain number for input it cannot represent', () => {
    expect(toRoman(0)).toBe('0')
    expect(toRoman(-1)).toBe('-1')
    expect(toRoman(1.5)).toBe('1.5')
    expect(toRoman(4000)).toBe('4000')
  })
})

describe('numberSections', () => {
  it('numbers "roman" sections I., II., III.… in order', () => {
    const sections: WartaSection[] = [
      { id: 's1', title: 'Pembukaan', numbering: 'roman', blocks: [] },
      { id: 's2', title: 'Firman', numbering: 'roman', blocks: [] },
      { id: 's3', title: 'Penutup', numbering: 'roman', blocks: [] },
    ]
    const numbered = numberSections(sections)
    expect(numbered.map((s) => s.label)).toEqual(['I.', 'II.', 'III.'])
  })

  it('"none" sections take no number and do not consume a roman slot', () => {
    const sections: WartaSection[] = [
      { id: 's1', title: 'SAPAAN', numbering: 'none', blocks: [] },
      { id: 's2', title: 'Pembukaan', numbering: 'roman', blocks: [] },
      { id: 's3', title: 'Penutup', numbering: 'roman', blocks: [] },
    ]
    const numbered = numberSections(sections)
    // SAPAAN gets '' and doesn't bump Pembukaan to II.
    expect(numbered.map((s) => s.label)).toEqual(['', 'I.', 'II.'])
  })

  it('numbers only titled blocks within a section, 1., 2., 3.…', () => {
    const sections: WartaSection[] = [
      {
        id: 's1',
        title: 'Warta',
        numbering: 'roman',
        blocks: [textBlock('b1', 'Ulang tahun'), textBlock('b2', 'Kegiatan'), textBlock('b3', 'Info rekening')],
      },
    ]
    const [section] = numberSections(sections)
    expect(section.blocks.map((b) => b.label)).toEqual(['1.', '2.', '3.'])
  })

  it('untitled blocks take no number and do not consume a slot', () => {
    const sections: WartaSection[] = [
      {
        id: 's1',
        title: 'Warta',
        numbering: 'roman',
        blocks: [textBlock('b1', 'Ulang tahun'), textBlock('b2'), textBlock('b3', 'Kegiatan')],
      },
    ]
    const [section] = numberSections(sections)
    // untitled b2 gets '' and doesn't bump Kegiatan to 3.
    expect(section.blocks.map((b) => b.label)).toEqual(['1.', '', '2.'])
  })

  it('a title of only whitespace counts as untitled (matches block.title?.trim())', () => {
    const sections: WartaSection[] = [
      { id: 's1', title: 'Warta', numbering: 'roman', blocks: [textBlock('b1', '   '), textBlock('b2', 'Kegiatan')] },
    ]
    const [section] = numberSections(sections)
    expect(section.blocks.map((b) => b.label)).toEqual(['', '1.'])
  })

  it('block numbering restarts fresh in each section', () => {
    const sections: WartaSection[] = [
      { id: 's1', title: 'A', numbering: 'roman', blocks: [textBlock('b1', 'X'), textBlock('b2', 'Y')] },
      { id: 's2', title: 'B', numbering: 'roman', blocks: [textBlock('b3', 'Z')] },
    ]
    const numbered = numberSections(sections)
    expect(numbered[0].blocks.map((b) => b.label)).toEqual(['1.', '2.'])
    expect(numbered[1].blocks.map((b) => b.label)).toEqual(['1.'])
  })

  it('stays correct after a reorder — numbering is purely positional', () => {
    const original: WartaSection[] = [
      { id: 's1', title: 'Pembukaan', numbering: 'roman', blocks: [] },
      { id: 's2', title: 'Firman', numbering: 'roman', blocks: [] },
    ]
    const reordered = [original[1], original[0]] // drag Firman above Pembukaan
    const numbered = numberSections(reordered)
    expect(numbered.map((s) => `${s.label} ${s.section.title}`)).toEqual(['I. Firman', 'II. Pembukaan'])
  })

  it('returns an empty array for an empty warta', () => {
    expect(numberSections([])).toEqual([])
  })
})
