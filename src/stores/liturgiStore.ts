// stores/liturgiStore.ts
import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabase'

export interface LiturgiRecord {
  id: string
  jemaatId: string
  tanggal: string
  sesi: 'PAGI' | 'SIANG' | 'SORE'
  mingguKe: string | null
  tema: string | null
  warnaLiturgi: string | null
  status: 'DRAFT' | 'PUBLISHED'
  fileUrl: string
  fileType: 'PDF' | 'DOCX'
  originalFilename: string
}

interface LiturgiState {
  current: LiturgiRecord | null
  loading: boolean
  error: string | null
}

// Every public read goes through a per-slug Postgres function (db/setup.sql,
// section 5) — anon has no direct table access. The functions already filter
// to PUBLISHED + not soft-deleted, and only for the slug that was asked for.

// All dates that have something published for this jemaat (ISO yyyy-mm-dd).
// One row per week or so, so fetching the whole list is cheap, and the
// default-date / prev / next logic below runs on it client-side.
async function fetchPublishedDates(slug: string): Promise<string[]> {
  const { data, error } = await supabase.rpc('get_public_dates', { p_slug: slug })
  if (error) throw error
  return ((data ?? []) as { tanggal: string }[]).map((row) => row.tanggal)
}

export const useLiturgiStore = defineStore('liturgi', {
  state: (): LiturgiState => ({
    current: null,
    loading: false,
    error: null,
  }),

  actions: {
    async fetchBySlugAndDate(slug: string, tanggal: string, sesi: 'PAGI' | 'SIANG' | 'SORE') {
      this.loading = true
      this.error = null
      this.current = null
      try {
        // The function returns 0 or 1 row; an empty array is a normal,
        // expected case (nothing published for that date/sesi yet) — not an
        // error, and no .single()/.maybeSingle() 406 noise either.
        const { data, error } = await supabase.rpc('get_public_liturgi', {
          p_slug: slug,
          p_tanggal: tanggal,
          p_sesi: sesi,
        })

        if (error) throw error
        this.current = ((data ?? []) as LiturgiRecord[])[0] ?? null
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Gagal memuat liturgi'
      } finally {
        this.loading = false
      }
    },

    // What date should the public page open to by default? Church
    // services here aren't always Sunday — some jemaat run midweek
    // services (Kamis, etc.) too — so this can't assume a fixed weekday.
    // Instead it asks the data directly: the nearest upcoming published
    // date (today counts as "upcoming"), or if nothing's scheduled
    // ahead, the most recent one that already happened. Only used when
    // the URL doesn't already specify a date via /:tanggal.
    async resolveDefaultDate(slug: string, todayIso: string): Promise<string> {
      try {
        const dates = await fetchPublishedDates(slug)
        const upcoming = dates.filter((d) => d >= todayIso).sort()[0]
        if (upcoming) return upcoming
        const past = dates.filter((d) => d < todayIso).sort().reverse()[0]
        if (past) return past
      } catch (err) {
        console.error('resolveDefaultDate failed:', err)
      }
      // Nothing published for this jemaat at all yet — today is as
      // reasonable a default as any; the page will just read "belum ada".
      return todayIso
    },

    // Same idea as resolveDefaultDate, but relative to whatever date is
    // currently open — for the ◀▶ archive-browsing arrows. Finds the
    // nearest OTHER published date (any sesi), not a blind ±7-day jump —
    // a jemaat with only monthly uploads shouldn't land on empty pages.
    async findAdjacentDate(
      slug: string,
      fromTanggal: string,
      direction: 'prev' | 'next',
    ): Promise<string | null> {
      try {
        const dates = await fetchPublishedDates(slug)
        if (direction === 'next') {
          return dates.filter((d) => d > fromTanggal).sort()[0] ?? null
        }
        return dates.filter((d) => d < fromTanggal).sort().reverse()[0] ?? null
      } catch (err) {
        console.error('findAdjacentDate failed:', err)
        return null
      }
    },
  },
})
