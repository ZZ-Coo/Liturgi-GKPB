// lib/scan-cover.ts
// Best-effort cover-page scanner: reads ONLY pages 1–2 of a PDF (the cover
// + the letterhead/tema/warna-liturgi block that follows it, which every
// Tata Ibadah document in the samples shares the same layout for) and
// regex-extracts the fields admins currently have to type by hand. This is
// deliberately narrow — it does not attempt to parse the rest of the
// document, unlike the block-parser approach that got dropped earlier for
// being unreliable at that scale. Two fixed, consistently-formatted pages
// are a much safer bet for regex heuristics than 10+ pages of varying
// liturgical content.
//
// Always treat the result as a *pre-fill*, not ground truth — every
// field stays editable in the form afterward.

import type { PDFDocumentProxy } from 'pdfjs-dist'

const BULAN: Record<string, string> = {
  januari: '01', februari: '02', maret: '03', april: '04',
  mei: '05', juni: '06', juli: '07', agustus: '08',
  september: '09', oktober: '10', november: '11', desember: '12',
}

export interface ScannedCover {
  tanggal?: string // YYYY-MM-DD
  jamMulai?: string // "HH:MM"
  pendetaName?: string // raw scanned name, still needs matching against the Pendeta table
  tema?: string
  warnaLiturgi?: string
  mingguKe?: string
  jemaatName?: string // raw scanned congregation name, still needs matching against the Jemaat table
}

async function extractPageText(doc: PDFDocumentProxy, pageNum: number): Promise<string> {
  const page = await doc.getPage(pageNum)
  const content = await page.getTextContent()
  const items = content.items as Array<{ str: string; hasEOL?: boolean }>

  // NOT `.join(' ')` — these Word-exported PDFs split individual words
  // across multiple text-runs with zero gap between them (kerning/justify
  // artifacts), e.g. "Agustus" arriving as two items "A" + "GUSTUS", or
  // "2026" as "202" + "6". Joining every item with a forced space breaks
  // exactly those words apart, which is why the scan used to fill in some
  // fields (tanggal, jam, warna liturgi, tema...) only inconsistently —
  // whether a field happened to survive depended on how its source word
  // got split into runs. Actual spaces are already present in the stream
  // as their own " " items, so no separator is needed between items — the
  // only real line/row boundary we still need to preserve is `hasEOL`.
  let text = ''
  for (const item of items) {
    text += item.str
    if (item.hasEOL) text += '\n'
  }
  return text
}

export async function scanPdfCover(file: File): Promise<ScannedCover> {
  const pdfjsLib = await import('pdfjs-dist')
  const pdfjsWorker = (await import('pdfjs-dist/build/pdf.worker.mjs?url')).default
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

  const buffer = await file.arrayBuffer()
  const doc = await pdfjsLib.getDocument({ data: buffer }).promise

  // Page 1 alone isn't the whole "cover" for this template — tanggal, jam,
  // pendeta, and minggu ke all live on page 1, but Tema and Warna Liturgi
  // sit under the *repeated* letterhead at the top of page 2. Reading only
  // page 1 (the old behaviour) silently left those two fields blank on
  // every real document, which looked like "random" partial fills.
  const page1 = await extractPageText(doc, 1)
  const page2 = doc.numPages >= 2 ? await extractPageText(doc, 2) : ''

  return parseCoverText(page1, page2)
}

// .docx has no page concept at the text-extraction level (mammoth just
// walks paragraphs), so the whole document text arrives in one string —
// no page1/page2 split needed like the PDF path above. Same regex parser
// underneath either way, since the actual cover wording/layout is the
// same regardless of which format the file happens to be saved as.
export async function scanDocxCover(file: File): Promise<ScannedCover> {
  const mammoth = await import('mammoth')
  const buffer = await file.arrayBuffer()
  const { value: text } = await mammoth.extractRawText({ arrayBuffer: buffer })
  return parseCoverText(text)
}

export async function scanFileCover(file: File): Promise<ScannedCover> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.docx')) return scanDocxCover(file)
  return scanPdfCover(file)
}

// `extraText` covers the case (very common in the real templates) where
// Tema/Warna Liturgi sit on page 2, under a repeated letterhead, rather
// than on the page 1 cover itself.
export function parseCoverText(text: string, extraText = ''): ScannedCover {
  const result: ScannedCover = {}
  const normalized = text.replace(/\s+/g, ' ')
  // Keeps line breaks (only collapses spaces/tabs) — needed for mingguKe
  // below, whose optional continuation group must stop at the end of the
  // visual line/row instead of running on into whatever text follows.
  const lineNormalized = text.replace(/[ \t]+/g, ' ')
  // Search page 1 first (it's the authoritative cover), then fall back to
  // page 2 for anything page 1 didn't have — never let page 2 clobber a
  // field page 1 already found.
  const combined = `${normalized} ${extraText.replace(/\s+/g, ' ')}`.trim()

  const tanggalMatch = normalized.match(
    /(\d{1,2})\s+(Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)\s+(\d{4})/i
  )
  if (tanggalMatch) {
    const day = tanggalMatch[1].padStart(2, '0')
    const month = BULAN[tanggalMatch[2].toLowerCase()]
    result.tanggal = `${tanggalMatch[3]}-${month}-${day}`
  }

  const jamMatch = normalized.match(/Pukul\s*:?\s*(\d{1,2})[.:](\d{2})/i)
  if (jamMatch) result.jamMulai = `${jamMatch[1].padStart(2, '0')}:${jamMatch[2]}`

  const pendetaMatch = normalized.match(/Dilayani\s+Oleh\s*:?\s*(Pdt\.?\s?[A-Za-zÀ-Ú.,\s]{3,60}?)(?:\s{2,}|AYAT|$)/i)
  if (pendetaMatch) result.pendetaName = pendetaMatch[1].trim().replace(/,$/, '')

  // Tema is a bonus pre-fill only — per the actual workflow, the pastor
  // fills this in by hand, so a miss here is expected/fine, not a bug.
  const temaMatch = combined.match(/Tema\s*:\s*([A-Za-zÀ-Ú .'-]{3,80}?)(?:\s*Warna Liturgi|$)/i)
  if (temaMatch) result.tema = temaMatch[1].trim()

  const warnaMatch = combined.match(/Warna\s+Liturgi\s*:?\s*(Hijau|Putih|Ungu|Merah|Hitam|Kuning|Emas)/i)
  if (warnaMatch) result.warnaLiturgi = warnaMatch[1]

  const mingguMatch = lineNormalized.match(/TATA IBADAH\s+(MINGGU\s+[IVXLCDM0-9]+)\s*\n?\s*([A-ZÀ-Ú .'-]{3,60})?/i)
  if (mingguMatch) {
    result.mingguKe = [mingguMatch[1], mingguMatch[2]].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
  }

  // Congregation name — the letterhead's "JEMAAT <NAME> CONGREGATION OF
  // ..." line (bilingual GKPB template). Bounded by "CONGREGATION"/"Jln."/
  // "Jl." so it doesn't run on into the street address.
  const jemaatMatch = normalized.match(
    /\bJEMAAT\s+([A-ZÀ-Ú][A-ZÀ-Ú.,'-]*(?:\s+[A-ZÀ-Ú.,'-]+){0,4}?)(?:\s+CONGREGATION\b|\s+Jln?\.|$)/
  )
  if (jemaatMatch) result.jemaatName = jemaatMatch[1].trim()

  return result
}

// ── Match the scanned name against known Pendeta/Jemaat records ─────────

export interface PendetaCandidate {
  id: string
  name: string
}

export interface JemaatCandidate {
  id: string
  name: string
}

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/pdt\.?|m\.?th\.?|s\.?si\.?|teol\.?|kons\.?|m\.?si\.?/g, '')
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Shared best-match-by-token-overlap scorer — same approach for a scanned
// pendeta name and a scanned jemaat name, just different candidate lists.
function bestOverlapMatch(
  scannedName: string | undefined,
  candidates: Array<{ id: string; name: string }>,
): string | null {
  if (!scannedName || !candidates.length) return null
  const target = new Set(normalizeName(scannedName).split(' ').filter(Boolean))
  if (!target.size) return null

  let best: { id: string; score: number } | null = null
  for (const c of candidates) {
    const cTokens = new Set(normalizeName(c.name).split(' ').filter(Boolean))
    let overlap = 0
    for (const t of target) if (cTokens.has(t)) overlap++
    const score = overlap / Math.max(target.size, cTokens.size, 1)
    if (!best || score > best.score) best = { id: c.id, score }
  }

  // Require a fairly strong overlap before auto-selecting — a weak/no
  // match should leave the dropdown for the admin to pick manually
  // rather than confidently guessing wrong.
  return best && best.score >= 0.5 ? best.id : null
}

export function matchPendeta(scannedName: string | undefined, candidates: PendetaCandidate[]): string | null {
  return bestOverlapMatch(scannedName, candidates)
}

export function matchJemaat(scannedName: string | undefined, candidates: JemaatCandidate[]): string | null {
  return bestOverlapMatch(scannedName, candidates)
}