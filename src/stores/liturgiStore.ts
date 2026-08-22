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
          .maybeSingle()

        if (error) throw error
        this.current = data
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Gagal memuat liturgi'
      } finally {
        this.loading = false
      }
    },
  },
})