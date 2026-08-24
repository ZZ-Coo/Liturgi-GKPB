-- ═══════════════════════════════════════════════════════════════════════
-- Liturgi GKPB — setup.sql v4: scope the public-read policy to `anon` only
--
-- THE BUG:
--   The original "published liturgi readable by everyone" policy (from
--   before per-jemaat scoping existed) was created with no `to` clause:
--     using (status = 'PUBLISHED')
--   No `to` clause defaults to role `public`, which in Postgres RLS means
--   EVERY role — anon AND authenticated. Policies for the same command
--   are OR'd together, so a jemaat_admin's SELECT on `liturgi` matched
--   this policy too: any PUBLISHED row from ANY jemaat came back, on top
--   of their own jemaat's rows from the properly-scoped policy. Only
--   published rows leaked (drafts were correctly still hidden), which
--   matches what showed up.
--
--   Also folds in "deletedAt is null" — missing from the live policy
--   (it predates the deletedAt/soft-delete column), so a soft-deleted-
--   but-still-flagged-PUBLISHED row is currently visible on the public
--   site too. Same fix, same statement.
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════

drop policy if exists "published liturgi readable by everyone" on liturgi;
create policy "published liturgi readable by everyone"
  on liturgi for select
  to anon
  using (status = 'PUBLISHED' and "deletedAt" is null);

-- ── Verify — run as the actual kwanji@gkpb.com session (through the app,
-- not as postgres in the SQL editor) or just re-check the app directly:
-- select policyname, cmd, roles, qual from pg_policies
--   where tablename = 'liturgi' order by cmd, policyname;
