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

export const useLiturgiStore = defineStore('liturgi', {
  state: (): LiturgiState => ({
    current: null,
    loading: false,
    error: null,
  }),

  actions: {
    async fetchByJemaatAndDate(jemaatId: string, tanggal: string, sesi: 'PAGI' | 'SIANG' | 'SORE') {
      this.loading = true
      this.error = null
      this.current = null
      try {
        // maybeSingle (not single): a date/sesi with no liturgi yet is a
        // normal, expected case — not an error. single() makes PostgREST
        // return a 406 for that (noisy in devtools, and not actually a
        // failure), even though the old code already handled it as one.
        const { data, error } = await supabase
          .from('liturgi')
          .select('*')
          .eq('jemaatId', jemaatId)
          .eq('tanggal', tanggal)
          .eq('sesi', sesi)
          .eq('status', 'PUBLISHED')
          .is('deletedAt', null)
          .maybeSingle()

        if (error) throw error
        this.current = data
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
    // liturgi (today counts as "upcoming"), or if nothing's scheduled
    // ahead, the most recent one that already happened. Only used when
    // the URL doesn't already specify a date via /:tanggal.
    async resolveDefaultDate(jemaatId: string, todayIso: string): Promise<string> {
      try {
        const { data: upcoming } = await supabase
          .from('liturgi')
          .select('tanggal')
          .eq('jemaatId', jemaatId)
          .eq('status', 'PUBLISHED')
          .is('deletedAt', null)
          .gte('tanggal', todayIso)
          .order('tanggal', { ascending: true })
          .limit(1)
          .maybeSingle()
        if (upcoming) return upcoming.tanggal

        const { data: past } = await supabase
          .from('liturgi')
          .select('tanggal')
          .eq('jemaatId', jemaatId)
          .eq('status', 'PUBLISHED')
          .is('deletedAt', null)
          .lt('tanggal', todayIso)
          .order('tanggal', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (past) return past.tanggal
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
      jemaatId: string,
      fromTanggal: string,
      direction: 'prev' | 'next',
    ): Promise<string | null> {
      try {
        const query = supabase
          .from('liturgi')
          .select('tanggal')
          .eq('jemaatId', jemaatId)
          .eq('status', 'PUBLISHED')
          .is('deletedAt', null)
          .limit(1)

        const { data } =
          direction === 'next'
            ? await query.gt('tanggal', fromTanggal).order('tanggal', { ascending: true }).maybeSingle()
            : await query.lt('tanggal', fromTanggal).order('tanggal', { ascending: false }).maybeSingle()

        return data?.tanggal ?? null
      } catch (err) {
        console.error('findAdjacentDate failed:', err)
        return null
      }
    },
  },
})