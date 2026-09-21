// lib/warta/money.ts
// Amounts in the finance table are typed the way a treasurer writes them:
// "1.892.500", "Rp 1.892.500", "1892500", "-" for nothing. Indonesian
// convention: dot = thousands separator, comma = decimal separator.
//
// Kept strict on purpose. "12.5" could mean 12 and a half or 125 — a wrong
// total in a published financial report is worse than a flagged cell, so
// anything ambiguous is reported as invalid instead of guessed.

export type AmountKind = 'blank' | 'ok' | 'invalid'

export interface ParsedAmount {
  kind: AmountKind
  /** 0 unless kind === 'ok' */
  value: number
}

const BLANK = /^[\s\u00a0]*[-–—]?[\s\u00a0]*$/

export function parseAmount(input: string): ParsedAmount {
  const raw = (input ?? '').toString()
  if (BLANK.test(raw)) return { kind: 'blank', value: 0 }

  let text = raw.replace(/rp\.?/gi, '').replace(/[\s\u00a0]/g, '')
  let negative = false
  if (text.startsWith('-') || text.startsWith('−')) {
    negative = true
    text = text.slice(1)
  } else if (text.startsWith('(') && text.endsWith(')')) {
    negative = true
    text = text.slice(1, -1)
  }

  // digits, optional ".ddd" groups, optional ",dd" decimals — or plain digits
  const grouped = /^\d{1,3}(\.\d{3})+(,\d+)?$/
  const plain = /^\d+(,\d+)?$/
  if (!grouped.test(text) && !plain.test(text)) return { kind: 'invalid', value: 0 }

  const value = Number(text.replace(/\./g, '').replace(',', '.'))
  if (!Number.isFinite(value)) return { kind: 'invalid', value: 0 }
  return { kind: 'ok', value: negative ? -value : value }
}

const formatter = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 })

export function formatAmount(value: number): string {
  return formatter.format(value)
}

// What a cell shows once published: blank stays blank, a valid amount is
// normalised ("1892500" → "1.892.500"), an invalid one is shown as typed
// rather than silently hidden.
export function displayAmount(input: string): string {
  const parsed = parseAmount(input)
  if (parsed.kind === 'ok') return formatAmount(parsed.value)
  if (parsed.kind === 'blank') return ''
  return input
}

export interface ColumnTotal {
  /** null = the column has no valid amounts at all (rendered "-") */
  total: number | null
  invalidCount: number
}

export function sumColumn(rows: string[][], columnIndex: number): ColumnTotal {
  let total = 0
  let counted = 0
  let invalidCount = 0
  for (const row of rows) {
    const parsed = parseAmount(row[columnIndex] ?? '')
    if (parsed.kind === 'ok') {
      total += parsed.value
      counted += 1
    } else if (parsed.kind === 'invalid') {
      invalidCount += 1
    }
  }
  // round away floating-point drift from decimal amounts
  return { total: counted ? Math.round(total * 100) / 100 : null, invalidCount }
}
