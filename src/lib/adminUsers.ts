// lib/adminUsers.ts
// Super_admin-only visibility into who has admin access to what. Backed by
// public.list_admin_users() (db/setup.sql, section 3) — a jemaat_admin
// calling it gets an empty list, not an error, so this file doesn't need to
// check the role itself.
//
// Granting access (creating a jemaat_admin) is deliberately NOT self-service
// from this UI: admin_users has no insert/update policy, on purpose, so
// minting a new admin or promoting one to super_admin always goes through
// the Supabase SQL Editor (see the commented snippets at the end of
// db/setup.sql). Revoking is the one write this UI does support — a lost
// laptop or a departed secretary shouldn't have to wait for someone to open
// the SQL Editor.
import { supabase } from './supabase'

export type AdminRole = 'jemaat_admin' | 'super_admin'

export interface AdminUserRow {
  userId: string
  email: string
  role: AdminRole
  jemaatId: string | null
  jemaatSlug: string | null
  jemaatName: string | null
  createdAt: string
}

export async function listAdminUsers(): Promise<AdminUserRow[]> {
  const { data, error } = await supabase.rpc('list_admin_users')
  if (error) {
    console.error('listAdminUsers failed:', error.message)
    throw new Error('Gagal memuat daftar admin')
  }
  return (data ?? []).map((row: any) => ({
    userId: row.user_id,
    email: row.email,
    role: row.role,
    jemaatId: row.jemaat_id,
    jemaatSlug: row.jemaat_slug,
    jemaatName: row.jemaat_name,
    createdAt: row.created_at,
  }))
}

// Removes the admin_users row only — the underlying Supabase Auth account
// (and their ability to log in) is untouched. To fully cut them off, delete
// the Auth user too from Dashboard → Authentication.
export async function revokeAdminUser(userId: string): Promise<void> {
  const { error, count } = await supabase.from('admin_users').delete({ count: 'exact' }).eq('user_id', userId)
  if (error) {
    console.error('revokeAdminUser failed:', error.message)
    throw new Error('Gagal mencabut akses')
  }
  // 0 rows: either already revoked, or the RLS self-protection kicked in
  // (a super_admin can't revoke their own access from here — see setup.sql).
  if (!count) throw new Error('Tidak ada yang dicabut — mungkin ini akunmu sendiri, atau akses itu sudah dicabut.')
}
