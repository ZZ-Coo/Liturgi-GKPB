-- ═══════════════════════════════════════════════════════════════════════
-- Liturgi GKPB — RLS setup draft (per-jemaat admin scoping)
--
-- Safe to re-run: every statement is guarded (IF NOT EXISTS / DROP POLICY
-- IF EXISTS before CREATE), same style the old setup.sql used.
--
-- ⚠️ IMPORTANT BEFORE YOU RUN THIS:
--   This script turns RLS ON for `jemaat`, `pendeta`, and `liturgi` and
--   then adds policies. If RLS was already ON in your project with
--   *different* policies than what's below, those old policies stay —
--   this only adds new ones, it doesn't know what already exists. Check
--   Supabase Dashboard → Authentication → Policies for each table first
--   so you're not layering conflicting rules.
--
--   Also: the moment RLS is ON on a table with zero matching policies for
--   a given role/action, that role gets ZERO rows — default deny. Run
--   this in one shot (not line-by-line), and test the public site +
--   admin login right after, before you close the SQL editor tab.
-- ═══════════════════════════════════════════════════════════════════════


-- ── 1. admin_users — maps an authenticated Supabase user to a jemaat + role ──
-- This table IS the access-control source of truth. It has no INSERT/
-- UPDATE/DELETE policy on purpose: granting/changing someone's access has
-- to go through the Supabase dashboard (Table Editor) or a service-role
-- script, never the client anon/user key that this same table is meant to
-- restrict.

create table if not exists admin_users (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  jemaat_id  text references jemaat(id) on delete set null, -- null = fine for super_admin, meaningless for jemaat_admin
  role       text not null check (role in ('jemaat_admin', 'super_admin')),
  created_at timestamptz not null default now()
);

alter table admin_users enable row level security;

drop policy if exists "admin_users: self reads own row" on admin_users;
create policy "admin_users: self reads own row"
  on admin_users for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "admin_users: super_admin reads all rows" on admin_users;
create policy "admin_users: super_admin reads all rows"
  on admin_users for select
  to authenticated
  using (
    exists (
      select 1 from admin_users au
      where au.user_id = auth.uid() and au.role = 'super_admin'
    )
  );
-- (Policies for the same command on the same table are OR'd together, so
-- a jemaat_admin matches the first policy — sees only themself — and a
-- super_admin additionally matches the second — sees everyone.)


-- ── 2. jemaat / pendeta — read-only reference data ──
-- Nothing in the client ever writes to these (seeded via `npm run
-- seed:jemaat` / `seed:pendeta`, which use the service-role key and so
-- bypass RLS entirely) — only SELECT policies are needed here. Both need
-- to stay open to `anon` too: the public site resolves the tenant by
-- slug and needs to read `jemaat` before anyone has logged in at all.

alter table jemaat enable row level security;
drop policy if exists "jemaat: anyone can read" on jemaat;
create policy "jemaat: anyone can read"
  on jemaat for select
  to anon, authenticated
  using (true);

alter table pendeta enable row level security;
drop policy if exists "pendeta: anyone can read" on pendeta;
create policy "pendeta: anyone can read"
  on pendeta for select
  to anon, authenticated
  using (true);


-- ── 3. liturgi — the actual per-jemaat scoping ──

alter table liturgi enable row level security;

-- Public: read-only, and only what's actually meant to be public —
-- published, not soft-deleted. Drafts and trash stay invisible to anon
-- no matter what the frontend's query looks like.
drop policy if exists "liturgi: public reads published" on liturgi;
create policy "liturgi: public reads published"
  on liturgi for select
  to anon
  using (status = 'PUBLISHED' and "deletedAt" is null);

-- Admin read: jemaat_admin sees only their own jemaat's rows (drafts +
-- trash included — the admin panel needs those); super_admin sees all.
drop policy if exists "liturgi: admin reads own jemaat or all" on liturgi;
create policy "liturgi: admin reads own jemaat or all"
  on liturgi for select
  to authenticated
  using (
    exists (
      select 1 from admin_users au
      where au.user_id = auth.uid()
        and (au.role = 'super_admin' or au.jemaat_id = liturgi."jemaatId")
    )
  );

-- Admin insert: WITH CHECK (not USING — there's no existing row yet) on
-- the row being created, so a jemaat_admin literally cannot submit a form
-- with a different jemaat's id in it, even if the UI dropdown were somehow
-- tampered with.
drop policy if exists "liturgi: admin inserts own jemaat or all" on liturgi;
create policy "liturgi: admin inserts own jemaat or all"
  on liturgi for insert
  to authenticated
  with check (
    exists (
      select 1 from admin_users au
      where au.user_id = auth.uid()
        and (au.role = 'super_admin' or au.jemaat_id = "jemaatId")
    )
  );

-- Admin update: USING gates which existing rows you can even target;
-- WITH CHECK gates what the row is allowed to become. Both matter here —
-- without WITH CHECK, a jemaat_admin could UPDATE their own row and
-- reassign its jemaatId to someone else's congregation.
drop policy if exists "liturgi: admin updates own jemaat or all" on liturgi;
create policy "liturgi: admin updates own jemaat or all"
  on liturgi for update
  to authenticated
  using (
    exists (
      select 1 from admin_users au
      where au.user_id = auth.uid()
        and (au.role = 'super_admin' or au.jemaat_id = liturgi."jemaatId")
    )
  )
  with check (
    exists (
      select 1 from admin_users au
      where au.user_id = auth.uid()
        and (au.role = 'super_admin' or au.jemaat_id = "jemaatId")
    )
  );

-- Admin delete: only used for the "permanent delete" action in Sampah —
-- the normal delete button in the UI is a soft delete (an UPDATE setting
-- deletedAt), already covered above.
drop policy if exists "liturgi: admin deletes own jemaat or all" on liturgi;
create policy "liturgi: admin deletes own jemaat or all"
  on liturgi for delete
  to authenticated
  using (
    exists (
      select 1 from admin_users au
      where au.user_id = auth.uid()
        and (au.role = 'super_admin' or au.jemaat_id = liturgi."jemaatId")
    )
  );


-- ── 4. Verify ──
-- select * from admin_users;
-- select tablename, policyname, roles, cmd from pg_policies
--   where tablename in ('admin_users','jemaat','pendeta','liturgi')
--   order by tablename, cmd;
