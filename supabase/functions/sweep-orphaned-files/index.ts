// supabase/functions/sweep-orphaned-files/index.ts
//
// Deletes files in the `liturgi-files` bucket that nothing in the database
// points to anymore — the "file mentah yatim" case:
//   - a liturgi/warta-image upload that succeeded in Storage but whose
//     matching insert/update never landed (network drop, RLS mismatch,
//     tab closed mid-save)
//   - a warta image swapped or removed in the editor before the warta was
//     ever saved (removeWartaImage in src/lib/warta/image.ts is
//     best-effort and only runs on an explicit swap/delete inside a saved
//     session — it can't clean up an upload that was simply abandoned)
//
// Deliberately NOT deleted:
//   - anything a soft-deleted (trashed) liturgi/warta still points to —
//     Sampah can restore those rows, and the file needs to still be there
//     when it does
//   - anything younger than GRACE_HOURS — an upload that just happened
//     might still be mid-save; without the grace period this could race
//     an admin who's mid-upload and delete a file out from under them
//
// Deployed with `supabase functions deploy sweep-orphaned-files` and run on
// a schedule by pg_cron (see db/setup.sql, section 8) — never called from
// the client, so it's protected by a shared secret rather than a Supabase
// auth session.

import { createClient } from 'npm:@supabase/supabase-js@2'

const GRACE_HOURS = 24
const BUCKET = 'liturgi-files'

interface ReferencedRow {
  path: string
}

Deno.serve(async (req) => {
  const expected = Deno.env.get('CRON_SECRET')
  const given = req.headers.get('x-cron-secret')
  if (!expected || given !== expected) {
    return json({ error: 'unauthorized' }, 401)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    // Service role: bypasses RLS, which is required here (this needs to see
    // and delete across every jemaat's folder, not just one admin's).
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: referenced, error: refError } = await supabase.rpc('referenced_storage_paths')
  if (refError) return json({ error: `referenced_storage_paths: ${refError.message}` }, 500)
  const referencedSet = new Set((referenced as ReferencedRow[] | null ?? []).map((r) => r.path))

  const cutoff = Date.now() - GRACE_HOURS * 60 * 60 * 1000
  const deleted: string[] = []
  const skippedRecent: string[] = []
  const errors: string[] = []

  // storage-js `list()` only lists one folder at a time (no recursive
  // listing), so walk the tree by hand: top level is one folder per jemaat
  // slug (plus, in principle, stray root files), each of which may itself
  // contain a `warta/` subfolder.
  async function sweepFolder(prefix: string) {
    const { data: entries, error: listError } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000 })
    if (listError) {
      errors.push(`list ${prefix || '(root)'}: ${listError.message}`)
      return
    }
    for (const entry of entries ?? []) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name
      // A "folder" in Supabase Storage has no id of its own — it only
      // exists implicitly through the objects inside it.
      if (!entry.id) {
        await sweepFolder(path)
        continue
      }
      if (referencedSet.has(path)) continue

      const updatedAtMs = entry.updated_at ? new Date(entry.updated_at).getTime() : 0
      if (!updatedAtMs || updatedAtMs > cutoff) {
        skippedRecent.push(path)
        continue
      }

      const { error: removeError } = await supabase.storage.from(BUCKET).remove([path])
      if (removeError) errors.push(`remove ${path}: ${removeError.message}`)
      else deleted.push(path)
    }
  }

  await sweepFolder('')

  return json({ deletedCount: deleted.length, deleted, skippedRecentCount: skippedRecent.length, errors })
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), { status, headers: { 'content-type': 'application/json' } })
}
