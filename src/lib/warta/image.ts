// lib/warta/image.ts
// Admin-side upload/removal for the Gambar block (QRIS, etc.). Same bucket
// as liturgi files (db/setup.sql already scopes any <slug>/... path to that
// jemaat's admin, subfolder or not, so <slug>/warta/... needs no new policy).
//
// Unlike a liturgi file, a warta can hold several Image blocks and any one
// of them can be replaced independently, so there's no single deterministic
// slot to upsert into — each upload gets its own randomly-suffixed name.
import { supabase } from '@/lib/supabase'
import { extractStoragePath } from '@/lib/storage'

const MAX_BYTES = 5 * 1024 * 1024 // 5 MB — generous for a QRIS/photo, small enough to stay snappy on a jemaat member's mobile data
const ALLOWED_EXT: Record<string, string> = { png: 'png', jpg: 'jpg', jpeg: 'jpg', webp: 'webp' }

export function validateImageFile(file: File): string | null {
  const ext = file.name.toLowerCase().split('.').pop() ?? ''
  if (!ALLOWED_EXT[ext]) return 'Hanya file PNG, JPG, atau WEBP yang didukung.'
  if (file.size > MAX_BYTES) return 'Ukuran file maksimal 5 MB.'
  return null
}

export interface UploadedImage {
  url: string
  path: string
}

export async function uploadWartaImage(jemaatSlug: string, file: File): Promise<UploadedImage> {
  const invalid = validateImageFile(file)
  if (invalid) throw new Error(invalid)

  const ext = ALLOWED_EXT[file.name.toLowerCase().split('.').pop() ?? '']
  const random = Math.random().toString(36).slice(2, 10)
  const path = `${jemaatSlug}/warta/${Date.now()}-${random}.${ext}`

  const { error } = await supabase.storage.from('liturgi-files').upload(path, file)
  if (error) {
    console.error('uploadWartaImage failed:', error.message)
    throw new Error('Gagal mengunggah gambar')
  }
  const { data } = supabase.storage.from('liturgi-files').getPublicUrl(path)
  return { url: data.publicUrl, path }
}

// Best-effort: a warta being edited without ever being saved shouldn't leave
// an orphaned file behind if the admin swaps the image or deletes the block.
// Failure here is never surfaced to the admin — the old file just sits in
// storage unused, which is harmless (unlike leaving the DB pointing at a
// missing file, which this order of operations also avoids: remove only
// after a successful re-upload/re-save, never before).
export async function removeWartaImage(image: { url: string; path?: string }): Promise<void> {
  const path = image.path || extractStoragePath(image.url)
  if (!path) return
  try {
    await supabase.storage.from('liturgi-files').remove([path])
  } catch (err) {
    console.error('removeWartaImage failed (non-fatal):', err)
  }
}
