-- ═══════════════════════════════════════════════════════════════════════
-- Liturgi GKPB — setup.sql v6: actually fix `name` resolving to `j.name`
-- (v5 did not fix this — see below)
--
-- WHY v5 DIDN'T WORK:
--   v5 "fixed" the three liturgi-files storage policies by changing
--   `(storage.foldername(j.name))[1]` back to the unqualified
--   `(storage.foldername(name))[1]` — which is exactly what
--   setup-rls-v3.sql already had. Turns out that was never actually
--   fixed, because the bug isn't a typo that crept in later — it's how
--   Postgres resolves an unqualified column name.
--
--   Inside `exists (select 1 from jemaat j where ...)`, an unqualified
--   `name` is resolved against the closest enclosing FROM clause first —
--   which is `jemaat j`, and `jemaat` has its own `name` column (the
--   display name). So `name` binds to `j.name` regardless of intent,
--   silently shadowing `storage.objects.name` (the actual file path)
--   from the outer policy. Re-running v5's "fix" reproduces the exact
--   same `j.name` every time, which is exactly what you saw when
--   re-checking pg_policies after applying it.
--
-- THE ACTUAL FIX:
--   Qualify the outer column explicitly as `objects.name` — `objects`
--   is the implicit correlation name for `storage.objects` (the table
--   the policy is defined `on`), so this unambiguously refers to the
--   file path being written, not `jemaat.name`.
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
        where j.id = current_admin_jemaat_id() and j.slug = (storage.foldername(objects.name))[1]
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
        where j.id = current_admin_jemaat_id() and j.slug = (storage.foldername(objects.name))[1]
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
        where j.id = current_admin_jemaat_id() and j.slug = (storage.foldername(objects.name))[1]
      )
    )
  );

-- ── Verify — this time the with_check/using text itself should show
-- `storage.foldername(objects.name)`, NOT `storage.foldername(j.name)`:
-- select policyname, cmd, with_check
--   from pg_policies
--   where tablename = 'objects' and schemaname = 'storage' and cmd = 'INSERT';
--
-- Then log in as e.g. kwanji@gkpb.com (through the app, not as postgres)
-- and try uploading a liturgi file for their own jemaat — it should now
-- actually succeed.