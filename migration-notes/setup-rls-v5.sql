-- ═══════════════════════════════════════════════════════════════════════
-- Liturgi GKPB — setup.sql v5: fix `j.name` typo in storage.objects policies
--
-- THE BUG:
--   The three `liturgi-files` storage policies (insert/update/delete) are
--   supposed to let a jemaat_admin write only into their own jemaat's
--   folder, by comparing the first path segment of the file being
--   written against that admin's jemaat slug:
--
--     j.slug = (storage.foldername(name))[1]
--
--   `name` here is meant to be unqualified so it resolves to the outer
--   table's column — storage.objects.name, i.e. the actual file path
--   being inserted/updated/deleted (e.g. "hosana-kwanji/2026-08-30-pagi.pdf").
--
--   Somewhere between writing this and what's actually live, it became:
--
--     j.slug = (storage.foldername(j.name))[1]
--
--   `j` is the alias for the `jemaat` table in the EXISTS subquery, and
--   `jemaat` also has a `name` column (the display name, e.g.
--   `Jemaat "Hosana" – Kwanji`). So `j.name` silently resolved to THAT
--   instead of the file path. That string has no `/` in it, so
--   `storage.foldername()` just returns it whole — which can never equal
--   a jemaat's `slug`. The EXISTS clause was therefore always false for
--   every jemaat_admin, no matter what they uploaded or to which folder.
--
--   Net effect: only `super_admin` could ever pass these three policies.
--   Every jemaat_admin upload/replace/delete of a liturgi file failed
--   with a storage 403 ("new row violates row-level security policy" /
--   AccessDenied) — even though the `liturgi` TABLE policies (insert/
--   update/delete/select) were correct the whole time. This is why the
--   `admin_users` row, the `liturgi` table policies, and the jemaat data
--   all checked out fine, yet uploads still failed for jemaat_admin
--   accounts specifically: the failing request was the file upload to
--   the `liturgi-files` bucket, not the `liturgi` table insert.
--
-- THE FIX:
--   Re-create all three policies with the correct, unqualified `name`
--   (storage.objects.name), matching what setup-rls-v3.sql always
--   intended.
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════

drop policy if exists "liturgi-files: admin writes own jemaat or all" on storage.objects;
create policy "liturgi-files: admin writes own jemaat or all"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'liturgi-files'
    and (
      current_admin_role() = 'super_admin'
      or exists (
        select 1 from jemaat j
        where j.id = current_admin_jemaat_id() and j.slug = (storage.foldername(name))[1]
      )
    )
  );

drop policy if exists "liturgi-files: admin updates own jemaat or all" on storage.objects;
create policy "liturgi-files: admin updates own jemaat or all"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'liturgi-files'
    and (
      current_admin_role() = 'super_admin'
      or exists (
        select 1 from jemaat j
        where j.id = current_admin_jemaat_id() and j.slug = (storage.foldername(name))[1]
      )
    )
  );

drop policy if exists "liturgi-files: admin deletes own jemaat or all" on storage.objects;
create policy "liturgi-files: admin deletes own jemaat or all"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'liturgi-files'
    and (
      current_admin_role() = 'super_admin'
      or exists (
        select 1 from jemaat j
        where j.id = current_admin_jemaat_id() and j.slug = (storage.foldername(name))[1]
      )
    )
  );

-- ── Verify — run as the actual jemaat_admin session (through the app,
-- not as postgres in the SQL editor):
-- select policyname, cmd, roles, qual, with_check from pg_policies
--   where tablename = 'objects' and schemaname = 'storage'
--   order by cmd, policyname;
--
-- Then log in as e.g. kwanji@gkpb.com and try uploading a liturgi file
-- for their own jemaat — it should now succeed.