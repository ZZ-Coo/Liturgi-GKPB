// Maps the free-text `warnaLiturgi` field (Hijau/Putih/Ungu/Merah/Hitam, as
// typed by admins) to a tint for the reading experience — so each week's
// page carries the actual liturgical colour of the day instead of a flat
// generic accent. Falls back to the default green when unset/unrecognised.
export interface LiturgicalTint {
  label: string
  text: string
  border: string
  soft: string
  dot: string
}

// Every class below is written out in full (not built with string
// concatenation) so Tailwind's content scanner can actually find it —
// dynamically-assembled class names like `border-l-${colour}` get
// silently purged from the production build.
const MAP: Record<string, LiturgicalTint> = {
  hijau: {
    label: 'Hijau',
    text: 'text-liturgi-hijau',
    border: 'border-l-liturgi-hijau',
    soft: 'bg-liturgi-hijau-soft',
    dot: 'bg-liturgi-hijau',
  },
  ungu: {
    label: 'Ungu',
    text: 'text-liturgi-ungu',
    border: 'border-l-liturgi-ungu',
    soft: 'bg-liturgi-ungu-soft',
    dot: 'bg-liturgi-ungu',
  },
  merah: {
    label: 'Merah',
    text: 'text-liturgi-merah',
    border: 'border-l-liturgi-merah',
    soft: 'bg-liturgi-merah-soft',
    dot: 'bg-liturgi-merah',
  },
  putih: {
    label: 'Putih',
    text: 'text-liturgi-putih',
    border: 'border-l-liturgi-putih',
    soft: 'bg-liturgi-putih-soft',
    dot: 'bg-liturgi-putih',
  },
  kuning: {
    label: 'Kuning',
    text: 'text-liturgi-putih',
    border: 'border-l-liturgi-putih',
    soft: 'bg-liturgi-putih-soft',
    dot: 'bg-liturgi-putih',
  },
  emas: {
    label: 'Emas',
    text: 'text-liturgi-putih',
    border: 'border-l-liturgi-putih',
    soft: 'bg-liturgi-putih-soft',
    dot: 'bg-liturgi-putih',
  },
  hitam: {
    label: 'Hitam',
    text: 'text-liturgi-hitam',
    border: 'border-l-liturgi-hitam',
    soft: 'bg-liturgi-hitam-soft',
    dot: 'bg-liturgi-hitam',
  },
}

export function liturgicalTint(warna?: string | null): LiturgicalTint | null {
  if (!warna) return null
  const key = warna.trim().toLowerCase()
  return MAP[key] ?? null
}
