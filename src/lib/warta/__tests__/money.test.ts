// src/lib/warta/__tests__/money.test.ts
// money.ts drives the numbers in a published financial report (laporan
// keuangan warta), so a silent bug here means a wrong total goes out to a
// whole jemaat. These tests lock down the parsing rules described in the
// comments at the top of money.ts — especially the "strict on purpose"
// ambiguous-input behaviour — so a future refactor can't loosen them by
// accident.

import { describe, it, expect } from 'vitest'
import { parseAmount, formatAmount, displayAmount, sumColumn } from '../money'

describe('parseAmount', () => {
  it('reads plain digits', () => {
    expect(parseAmount('1892500')).toEqual({ kind: 'ok', value: 1892500 })
  })

  it('reads Indonesian thousands-grouped amounts', () => {
    expect(parseAmount('1.892.500')).toEqual({ kind: 'ok', value: 1892500 })
  })

  it('strips a leading "Rp" (with or without a dot, any case)', () => {
    expect(parseAmount('Rp 1.892.500')).toEqual({ kind: 'ok', value: 1892500 })
    expect(parseAmount('rp1.892.500')).toEqual({ kind: 'ok', value: 1892500 })
    expect(parseAmount('RP. 50.000')).toEqual({ kind: 'ok', value: 50000 })
  })

  it('reads a comma as the decimal separator', () => {
    expect(parseAmount('1.892.500,5')).toEqual({ kind: 'ok', value: 1892500.5 })
    expect(parseAmount('100,25')).toEqual({ kind: 'ok', value: 100.25 })
  })

  it('reads negative amounts, both "-100" and "(100)" style', () => {
    expect(parseAmount('-50.000')).toEqual({ kind: 'ok', value: -50000 })
    expect(parseAmount('(50.000)')).toEqual({ kind: 'ok', value: -50000 })
    expect(parseAmount('−50.000')).toEqual({ kind: 'ok', value: -50000 }) // U+2212 minus sign
  })

  it('treats blank, whitespace, and a lone dash as "blank" (not invalid)', () => {
    expect(parseAmount('').kind).toBe('blank')
    expect(parseAmount('   ').kind).toBe('blank')
    expect(parseAmount('-').kind).toBe('blank')
    expect(parseAmount('—').kind).toBe('blank')
    expect(parseAmount('\u00a0').kind).toBe('blank') // non-breaking space
  })

  // The whole point of being strict: "12.5" is genuinely ambiguous in
  // Indonesian formatting (12 setengah, or salah ketik dari 125?) — must
  // never be silently guessed as either.
  it('rejects ambiguous or malformed input as invalid rather than guessing', () => {
    expect(parseAmount('12.5').kind).toBe('invalid')
    expect(parseAmount('1.89.500').kind).toBe('invalid') // malformed grouping
    expect(parseAmount('abc').kind).toBe('invalid')
    expect(parseAmount('50rb').kind).toBe('invalid')
    expect(parseAmount('1,892,500').kind).toBe('invalid') // US-style grouping, not supported
  })

  it('ignores surrounding/internal whitespace the way a treasurer might type it', () => {
    expect(parseAmount(' 1.892.500 ')).toEqual({ kind: 'ok', value: 1892500 })
  })
})

describe('formatAmount / displayAmount', () => {
  it('formats a number back into Indonesian thousands grouping', () => {
    expect(formatAmount(1892500)).toBe('1.892.500')
    expect(formatAmount(0)).toBe('0')
  })

  it('normalises a valid cell to canonical formatting', () => {
    expect(displayAmount('1892500')).toBe('1.892.500')
    expect(displayAmount('Rp 50.000')).toBe('50.000')
  })

  it('shows blank cells as empty', () => {
    expect(displayAmount('')).toBe('')
    expect(displayAmount('-')).toBe('')
  })

  it('shows invalid cells as typed, not hidden', () => {
    expect(displayAmount('12.5')).toBe('12.5')
    expect(displayAmount('abc')).toBe('abc')
  })
})

describe('sumColumn', () => {
  it('sums only the valid amounts in a column', () => {
    const rows = [
      ['Persembahan minggu 1', '100.000'],
      ['Persembahan minggu 2', '250.000'],
      ['Persembahan minggu 3', '75.500'],
    ]
    expect(sumColumn(rows, 1)).toEqual({ total: 425500, invalidCount: 0 })
  })

  it('ignores blank rows but flags invalid ones without corrupting the total', () => {
    const rows = [
      ['A', '100.000'],
      ['B', '-'], // blank — excluded, not an error
      ['C', '12.5'], // invalid — flagged, excluded from total
      ['D', '50.000'],
    ]
    expect(sumColumn(rows, 1)).toEqual({ total: 150000, invalidCount: 1 })
  })

  it('returns null (not 0) when a column has no valid amounts at all', () => {
    const rows = [
      ['A', '-'],
      ['B', ''],
    ]
    expect(sumColumn(rows, 1)).toEqual({ total: null, invalidCount: 0 })
  })

  it('handles a column that is entirely invalid', () => {
    const rows = [['A', 'abc'], ['B', '12.5']]
    expect(sumColumn(rows, 1)).toEqual({ total: null, invalidCount: 2 })
  })

  it('rounds away floating-point drift from decimal amounts', () => {
    // 0.1 + 0.2 !== 0.3 in floating point — the sum must still come out clean.
    const rows = [['A', '0,1'], ['B', '0,2']]
    expect(sumColumn(rows, 1).total).toBe(0.3)
  })

  it('handles negative amounts correctly in a running total', () => {
    const rows = [
      ['Saldo awal', '500.000'],
      ['Pengeluaran', '-150.000'],
    ]
    expect(sumColumn(rows, 1)).toEqual({ total: 350000, invalidCount: 0 })
  })

  it('is tolerant of a missing cell in a ragged row (treated as blank)', () => {
    const rows = [['A', '100.000'], ['B']]
    expect(sumColumn(rows, 1)).toEqual({ total: 100000, invalidCount: 0 })
  })
})
