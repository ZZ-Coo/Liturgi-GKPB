// stores/liturgiStore.ts
import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabase'

export interface LiturgiRecord {
  id: string
  jemaatId: string
  tanggal: string
  sesi: 'PAGI' | 'SORE'
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
    async fetchByJemaatAndDate(jemaatId: string, tanggal: string, sesi: 'PAGI' | 'SORE') {
      this.loading = true
      this.error = null
      this.current = null
      try {
        const { data, error } = await supabase
          .from('liturgi')
          .select('*')
          .eq('jemaatId', jemaatId)
          .eq('tanggal', tanggal)
          .eq('sesi', sesi)
          .eq('status', 'PUBLISHED')
          .single()

        if (error) {
          if (error.code !== 'PGRST116') throw error
          return // no row for this date/sesi — not an error state, just empty
        }
        this.current = data
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Gagal memuat liturgi'
      } finally {
        this.loading = false
      }
    },
  },
})
