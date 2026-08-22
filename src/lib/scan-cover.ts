// lib/scan-cover.ts
// Best-effort cover-page scanner: reads ONLY page 1 of a PDF (the cover,
// which every Tata Ibadah document in the samples shares the same
// layout for) and regex-extracts the fields admins currently have to
// type by hand. This is deliberately narrow — it does not attempt to
// parse the rest of the document, unlike the block-parser approach that
// got dropped earlier for being unreliable at that scale. A one-page,
// consistently-formatted cover is a much safer bet for regex heuristics
// than 10+ pages of varying liturgical content.
//
// Always treat the result as a *pre-fill*, not ground truth — every
// field stays editable in the form afterward.

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
}

export async function scanPdfCover(file: File): Promise<ScannedCover> {
  const pdfjsLib = await import('pdfjs-dist')
  const pdfjsWorker = (await import('pdfjs-dist/build/pdf.worker.mjs?url')).default
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

  const buffer = await file.arrayBuffer()
  const doc = await pdfjsLib.getDocument({ data: buffer }).promise
  const page = await doc.getPage(1)
  const content = await page.getTextContent()
  const text = (content.items as Array<{ str: string }>).map((i) => i.str).join(' ')

  return parseCoverText(text)
}

export function parseCoverText(text: string): ScannedCover {
  const result: ScannedCover = {}
  const normalized = text.replace(/\s+/g, ' ')

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

  const temaMatch = normalized.match(/Tema\s*:\s*([A-Za-zÀ-Ú .'-]{3,80}?)(?:\s*Warna Liturgi|$)/i)
  if (temaMatch) result.tema = temaMatch[1].trim()

  const warnaMatch = normalized.match(/Warna\s+Liturgi\s*:?\s*(Hijau|Putih|Ungu|Merah|Hitam|Kuning|Emas)/i)
  if (warnaMatch) result.warnaLiturgi = warnaMatch[1]

  const mingguMatch = normalized.match(/TATA IBADAH\s+(MINGGU\s+[IVXLCDM0-9]+)\s*([A-ZÀ-Ú .'-]{3,60})?/i)
  if (mingguMatch) {
    result.mingguKe = [mingguMatch[1], mingguMatch[2]].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
  }

  return result
}

// ── Match the scanned name against known Pendeta records ────────────────

export interface PendetaCandidate {
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

export function matchPendeta(scannedName: string | undefined, candidates: PendetaCandidate[]): string | null {
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
