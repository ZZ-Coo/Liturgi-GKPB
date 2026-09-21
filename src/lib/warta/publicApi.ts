// lib/warta/publicApi.ts
// Public (anon) read of a published warta. Goes through get_public_warta()
// (db/setup.sql, section 5): PUBLISHED only, not soft-deleted, only for the
// slug that was asked for. Resolves to [] when there is none.
import { supabase } from '@/lib/supabase'
import { parseSections } from './parse'
import type { WartaSection } from './types'

export async function fetchPublicWarta(slug: string, tanggal: string): Promise<WartaSection[]> {
  const { data, error } = await supabase.rpc('get_public_warta', { p_slug: slug, p_tanggal: tanggal })
  if (error) throw error
  const row = ((data ?? []) as { sections: unknown }[])[0]
  return row ? parseSections(row.sections) : []
}
