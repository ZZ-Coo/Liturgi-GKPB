// lib/warta/api.ts
// Admin-side access to the `warta` table. Goes through supabase-js and RLS
// like the rest of the admin (super_admin only for now — see db/setup.sql);
// the public page reads through the get_public_warta() function instead.
//
// Every function either resolves with data or throws an Error whose message
// is fit to show in a toast.

import { supabase } from '@/lib/supabase'
import { parseSections } from './parse'
import type { PublishStatus, WartaRecord, WartaSection } from './types'

export interface WartaSummary {
  id: string
  jemaatId: string
  tanggal: string
  status: PublishStatus
  updatedAt: string
  deletedAt: string | null
}

interface DbError {
  code?: string
  message: string
}

function fail(error: DbError, fallback: string): never {
  // 23505 = unique_violation → the partial unique index on (jemaatId, tanggal).
  if (error.code === '23505') throw new Error('Warta untuk jemaat dan tanggal itu sudah ada.')
  console.error(`${fallback}:`, error.message)
  throw new Error(fallback)
}

// Thrown by saveWarta when the row was changed by someone else (another
// admin, another tab) since this editor loaded it — distinct from "not
// found" so the UI can offer "timpa" instead of just bouncing to the list.
export class WartaConflictError extends Error {
  constructor() {
    super('Warta ini sudah diubah pihak lain sejak kamu membukanya.')
    this.name = 'WartaConflictError'
  }
}

const SUMMARY_COLUMNS = 'id, jemaatId, tanggal, status, updatedAt, deletedAt'

// Newest first. `sections` is left out on purpose: it's the heavy column and
// the list only shows metadata.
export async function listWarta(opts: { trashed?: boolean; jemaatId?: string } = {}): Promise<WartaSummary[]> {
  let query = supabase.from('warta').select(SUMMARY_COLUMNS)
  query = opts.trashed ? query.not('deletedAt', 'is', null) : query.is('deletedAt', null)
  if (opts.jemaatId) query = query.eq('jemaatId', opts.jemaatId)

  const { data, error } = await query.order('tanggal', { ascending: false }).limit(200)
  if (error) fail(error, 'Gagal memuat daftar warta')
  return (data ?? []) as WartaSummary[]
}

export async function getWarta(id: string): Promise<WartaRecord | null> {
  const { data, error } = await supabase
    .from('warta')
    .select('id, jemaatId, tanggal, status, sections, updatedAt')
    .eq('id', id)
    .is('deletedAt', null)
    .maybeSingle()
  if (error) fail(error, 'Gagal memuat warta')
  if (!data) return null
  return { ...data, sections: parseSections(data.sections) } as WartaRecord
}

// The jemaat's most recent warta strictly before `tanggal` — the source for
// "copy last week's warta".
export async function findLatestBefore(
  jemaatId: string,
  tanggal: string,
): Promise<{ tanggal: string; sections: WartaSection[] } | null> {
  const { data, error } = await supabase
    .from('warta')
    .select('tanggal, sections')
    .eq('jemaatId', jemaatId)
    .is('deletedAt', null)
    .lt('tanggal', tanggal)
    .order('tanggal', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) fail(error, 'Gagal mencari warta sebelumnya')
  if (!data) return null
  return { tanggal: data.tanggal, sections: parseSections(data.sections) }
}

// New warta always start as DRAFT — nothing reaches jemaat until it is
// explicitly published from the editor.
export async function createWarta(input: { jemaatId: string; tanggal: string; sections: WartaSection[] }): Promise<string> {
  const { data, error } = await supabase
    .from('warta')
    .insert({ jemaatId: input.jemaatId, tanggal: input.tanggal, sections: input.sections, status: 'DRAFT' })
    .select('id')
    .single()
  if (error) fail(error, 'Gagal membuat warta')
  return data.id as string
}

// Optimistic concurrency: normally the update is conditioned on `updatedAt`
// still matching what the editor loaded, so a second admin's save can never
// silently clobber the first admin's without anyone finding out. Passing
// `force: true` (after the editor has asked "timpa perubahan mereka?" and
// the admin said yes) drops that condition and saves unconditionally.
export async function saveWarta(
  id: string,
  input: { sections: WartaSection[]; status: PublishStatus; expectedUpdatedAt: string; force?: boolean },
): Promise<string> {
  let query = supabase
    .from('warta')
    .update({ sections: input.sections, status: input.status })
    .eq('id', id)
    .is('deletedAt', null)
  if (!input.force) query = query.eq('updatedAt', input.expectedUpdatedAt)

  const { data, error } = await query.select('updatedAt')
  if (error) fail(error, 'Gagal menyimpan warta')
  if (data?.length) return data[0].updatedAt as string

  // 0 rows updated — either the row is gone (deleted since the editor
  // opened it), or it's still there but `updatedAt` moved (someone else
  // saved first). A second read tells the two apart.
  const { data: current } = await supabase
    .from('warta')
    .select('deletedAt')
    .eq('id', id)
    .maybeSingle()
  if (!current || current.deletedAt) {
    throw new Error('Warta tidak ditemukan — mungkin sudah dihapus.')
  }
  throw new WartaConflictError()
}

export async function trashWarta(id: string): Promise<void> {
  const { error } = await supabase.from('warta').update({ deletedAt: new Date().toISOString() }).eq('id', id)
  if (error) fail(error, 'Gagal menghapus warta')
}

export async function restoreWarta(id: string): Promise<void> {
  const { error } = await supabase.from('warta').update({ deletedAt: null }).eq('id', id)
  if (error) fail(error, 'Gagal memulihkan warta')
}

export async function deleteWartaForever(id: string): Promise<void> {
  const { error } = await supabase.from('warta').delete().eq('id', id)
  if (error) fail(error, 'Gagal menghapus permanen')
}
