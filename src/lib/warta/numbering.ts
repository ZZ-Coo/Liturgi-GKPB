// lib/warta/numbering.ts
// Numbers are derived from order, never stored — so after a drag-and-drop the
// numbering is correct by construction, which is exactly what the secretary
// used to do by hand.
//
//   section: "roman" sections count I., II., III.… ("none" sections take no
//            number and don't use one up — "SAPAAN" doesn't push I. to II.)
//   block:   inside each section, blocks that have a title count 1., 2., 3.…
//            (untitled blocks take no number)

import type { WartaBlock, WartaSection } from './types'

const ROMAN: [number, string][] = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
  [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
]

export function toRoman(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 3999) return String(n)
  let rest = n
  let out = ''
  for (const [value, symbol] of ROMAN) {
    while (rest >= value) {
      out += symbol
      rest -= value
    }
  }
  return out
}

export interface NumberedBlock {
  block: WartaBlock
  /** "1." — empty string when the block has no title. */
  label: string
}

export interface NumberedSection {
  section: WartaSection
  /** "I." — empty string for numbering: 'none'. */
  label: string
  blocks: NumberedBlock[]
}

export function numberSections(sections: WartaSection[]): NumberedSection[] {
  let roman = 0
  return sections.map((section) => {
    let label = ''
    if (section.numbering === 'roman') {
      roman += 1
      label = `${toRoman(roman)}.`
    }

    let item = 0
    const blocks = section.blocks.map((block) => {
      if (block.title?.trim()) {
        item += 1
        return { block, label: `${item}.` }
      }
      return { block, label: '' }
    })

    return { section, label, blocks }
  })
}
