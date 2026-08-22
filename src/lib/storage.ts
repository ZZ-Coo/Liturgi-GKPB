// lib/storage.ts
// Shared helper for turning a Supabase Storage public URL back into the
// bucket-relative path Storage APIs (remove, etc.) actually need.

export function extractStoragePath(publicUrl: string, bucket = 'liturgi-files'): string | null {
  const marker = `/${bucket}/`
  const idx = publicUrl.indexOf(marker)
  if (idx === -1) return null
  return decodeURIComponent(publicUrl.slice(idx + marker.length))
}
