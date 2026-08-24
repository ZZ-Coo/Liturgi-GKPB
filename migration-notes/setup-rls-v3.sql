-- ═══════════════════════════════════════════════════════════════════════
-- Liturgi GKPB — setup.sql v3: fix infinite recursion in admin_users RLS
--
-- Patch on top of v2. Doesn't touch the `admin_users` TABLE or its data
-- (your super_admin row is untouched) — only redefines the POLICIES.
-- Safe to re-run.
--
-- THE BUG:
--   "admin_users: super_admin reads all rows" checked role by querying
--   admin_users FROM WITHIN admin_users' own policy:
--     using (exists (select 1 from admin_users au where ... role = 'super_admin'))
--   That inner select is itself subject to admin_users' RLS — which
--   includes this very policy — so Postgres re-evaluates it, which
--   queries admin_users again, forever. Same story for jemaat/liturgi/
--   storage policies: they also do `select ... from admin_users`, so they
--   inherit the same infinite loop the moment admin_users' own policy
--   recurses.
--
-- THE FIX:
--   Two SECURITY DEFINER functions that look up the current user's row
--   in admin_users running as the function owner (not the calling user),
--   which bypasses RLS for that one internal lookup — breaking the
--   self-reference. Every policy that used to inline
--   `exists (select 1 from admin_users au where ...)` now calls one of
--   these instead.
-- ═══════════════════════════════════════════════════════════════════════

create or replace function public.current_admin_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from admin_users where user_id = auth.uid()
$$;

create or replace function public.current_admin_jemaat_id()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select jemaat_id from admin_users where user_id = auth.uid()
$$;

grant execute on function public.current_admin_role() to anon, authenticated;
grant execute on function public.current_admin_jemaat_id() to anon, authenticated;


-- ── admin_users ──
drop policy if exists "admin_users: super_admin reads all rows" on admin_users;
create policy "admin_users: super_admin reads all rows"
  on admin_users for select
  to authenticated
  using (current_admin_role() = 'super_admin');
-- "admin_users: self reads own row" is untouched — it was never
-- recursive (`user_id = auth.uid()` doesn't query admin_users again).


-- ── jemaat ──
drop policy if exists "jemaat: super_admin writes" on jemaat;
create policy "jemaat: super_admin writes"
  on jemaat for all
  to authenticated
  using (current_admin_role() = 'super_admin')
  with check (current_admin_role() = 'super_admin');


-- ── liturgi ──
drop policy if exists "liturgi: admin reads own jemaat or all" on liturgi;
create policy "liturgi: admin reads own jemaat or all"
  on liturgi for select
  to authenticated
  using (current_admin_role() = 'super_admin' or current_admin_jemaat_id() = "jemaatId");

drop policy if exists "liturgi: admin inserts own jemaat or all" on liturgi;
create policy "liturgi: admin inserts own jemaat or all"
  on liturgi for insert
  to authenticated
  with check (current_admin_role() = 'super_admin' or current_admin_jemaat_id() = "jemaatId");

drop policy if exists "liturgi: admin updates own jemaat or all" on liturgi;
create policy "liturgi: admin updates own jemaat or all"
  on liturgi for update
  to authenticated
  using (current_admin_role() = 'super_admin' or current_admin_jemaat_id() = "jemaatId")
  with check (current_admin_role() = 'super_admin' or current_admin_jemaat_id() = "jemaatId");

drop policy if exists "liturgi: admin deletes own jemaat or all" on liturgi;
create policy "liturgi: admin deletes own jemaat or all"
  on liturgi for delete
  to authenticated
  using (current_admin_role() = 'super_admin' or current_admin_jemaat_id() = "jemaatId");


-- ── storage: liturgi-files bucket ──
-- jemaat itself is safe to query directly here (its own policy, "jemaat
-- readable by everyone", doesn't reference admin_users, so no recursion).
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


-- ── Verify ──
-- select public.current_admin_role(), public.current_admin_jemaat_id();
-- (run this logged in as your own user via the app / a JWT — running it
--  raw in the SQL Editor as `postgres` will just return null, since
--  auth.uid() is null outside a real user session)
