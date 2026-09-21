-- ═══════════════════════════════════════════════════════════════════════
-- Liturgi GKPB — db/setup.sql  (FINAL, menggantikan setup-rls v1–v6)
--
-- Urutan: reset-public.sql → `npx prisma migrate dev --name init` → file ini.
-- Jalankan sekali utuh di Supabase SQL Editor (sebagai postgres). Aman
-- di-run ulang: semua statement idempotent.
--
-- Prisma memegang tabel/kolom/enum/FK. File ini memegang sisanya:
--   1. trigger updatedAt
--   2. partial unique index (soft delete)
--   3. admin_users + fungsi helper role
--   4. GRANT + RLS  (anon TIDAK punya akses tabel sama sekali)
--   5. fungsi baca publik per-slug  ← satu-satunya pintu masuk anon
--   6. bucket liturgi-files + storage policy
--
-- Model akses lewat tabel:
--   super_admin  → semua jemaat: baca/tulis/hapus liturgi, warta, file; kelola
--                  jemaat dan pendeta.
--   jemaat_admin → HANYA jemaatnya sendiri (admin_users.jemaat_id): liturgi,
--                  warta, dan file di folder <slug jemaat>/ di bucket.
--                  Tidak bisa melihat jemaat lain, mengubah jemaat/pendeta,
--                  atau mengubah hak akses (admin_users tanpa policy tulis).
--   anon         → tidak ada akses tabel; hanya fungsi baca publik (bagian 5).
-- ═══════════════════════════════════════════════════════════════════════


-- ── 1. updatedAt trigger ────────────────────────────────────────────────
-- Prisma's @updatedAt cuma jalan di client Prisma; update lewat supabase-js
-- tidak menyentuhnya. Trigger DB menutup celah itu.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new."updatedAt" = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['jemaat', 'liturgi', 'warta'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);
  end loop;
end
$$;


-- ── 2. Partial unique index (hanya baris yang belum di-soft-delete) ─────
-- Tanpa WHERE, slot yang sudah di sampah akan memblokir jemaat+tanggal(+sesi)
-- itu selamanya.

create unique index if not exists liturgi_jemaat_tanggal_sesi_active_key
  on public.liturgi ("jemaatId", tanggal, sesi)
  where "deletedAt" is null;

create unique index if not exists warta_jemaat_tanggal_active_key
  on public.warta ("jemaatId", tanggal)
  where "deletedAt" is null;


-- ── 3. admin_users + helper role ────────────────────────────────────────
-- Sumber kebenaran siapa boleh apa. Sengaja TANPA policy insert/update/
-- delete: memberi/mengubah akses hanya lewat SQL Editor / service role.

create table if not exists public.admin_users (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  jemaat_id  text references public.jemaat (id) on delete cascade,
  role       text not null check (role in ('jemaat_admin', 'super_admin')),
  created_at timestamptz not null default now(),
  constraint jemaat_admin_needs_jemaat check (role <> 'jemaat_admin' or jemaat_id is not null)
);

-- SECURITY DEFINER supaya lookup ke admin_users tidak kena RLS-nya sendiri
-- (itu penyebab infinite recursion di versi lama).
create or replace function public.current_admin_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.admin_users where user_id = auth.uid()
$$;

create or replace function public.current_admin_jemaat_id()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select jemaat_id from public.admin_users where user_id = auth.uid()
$$;

-- Slug jemaat milik admin ini — untuk policy storage, yang mencocokkan nama
-- folder file dengan slug. Dibuat sebagai fungsi (bukan subquery di policy)
-- supaya tidak terkena RLS tabel jemaat dan tidak ada kolom `name` yang
-- ambigu antara jemaat.name dan objects.name.
create or replace function public.current_admin_jemaat_slug()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select j.slug
  from public.admin_users a
  join public.jemaat j on j.id = a.jemaat_id
  where a.user_id = auth.uid()
$$;

-- Supabase memberi EXECUTE ke anon secara default → cabut, kasih ke authenticated saja.
revoke all on function public.current_admin_role() from public, anon;
revoke all on function public.current_admin_jemaat_id() from public, anon;
revoke all on function public.current_admin_jemaat_slug() from public, anon;
grant execute on function public.current_admin_role() to authenticated;
grant execute on function public.current_admin_jemaat_id() to authenticated;
grant execute on function public.current_admin_jemaat_slug() to authenticated;

-- List of who has admin access to what, for the "Kelola Admin" screen.
-- SECURITY DEFINER to read auth.users.email (not otherwise exposed via the
-- API) and to bypass admin_users' own RLS (which only lets a super_admin see
-- ALL rows via the select policy above — this just adds the email + jemaat
-- name/slug in one call instead of three round trips). The `where` clause
-- does the real access check: a non-super_admin gets zero rows, not an error.
create or replace function public.list_admin_users()
returns table (
  user_id uuid,
  email text,
  role text,
  jemaat_id text,
  jemaat_slug text,
  jemaat_name text,
  created_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select a.user_id, u.email, a.role, a.jemaat_id, j.slug, j.name, a.created_at
  from public.admin_users a
  join auth.users u on u.id = a.user_id
  left join public.jemaat j on j.id = a.jemaat_id
  where public.current_admin_role() = 'super_admin'
  order by (a.role = 'super_admin') desc, j.name nulls first, u.email
$$;

revoke all on function public.list_admin_users() from public, anon;
grant execute on function public.list_admin_users() to authenticated;


-- ── 4. GRANT + RLS ──────────────────────────────────────────────────────
-- Tabel buatan Prisma tidak selalu mewarisi grant Supabase, dan sebaliknya
-- default Supabase bisa terlalu longgar untuk anon. Semuanya dieksplisitkan.

-- anon: nol akses tabel. Baca publik HANYA lewat fungsi di bagian 5.
revoke all on public.jemaat, public.pendeta, public.liturgi, public.warta, public.admin_users from anon;

-- Tabel bawaan Prisma juga dibersihkan (ada kalau pakai `migrate`, tidak
-- ada kalau `db push`, makanya dicek dulu).
do $$
begin
  if to_regclass('public._prisma_migrations') is not null then
    revoke all on public._prisma_migrations from anon, authenticated;
  end if;
end
$$;

-- Tabel baru yang dibuat Prisma nanti tidak otomatis terbuka ke anon.
alter default privileges for role postgres in schema public revoke all on tables from anon;

grant select, insert, update, delete on public.jemaat, public.pendeta, public.liturgi, public.warta to authenticated;
grant select, delete on public.admin_users to authenticated; -- delete: revoke policy below; insert/update deliberately withheld
grant all on public.jemaat, public.pendeta, public.liturgi, public.warta, public.admin_users to service_role;

alter table public.admin_users enable row level security;
alter table public.jemaat      enable row level security;
alter table public.pendeta     enable row level security;
alter table public.liturgi     enable row level security;
alter table public.warta       enable row level security;

-- admin_users: baca baris sendiri; super_admin baca semua.
drop policy if exists "admin_users: self reads own row" on public.admin_users;
create policy "admin_users: self reads own row"
  on public.admin_users for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "admin_users: super_admin reads all" on public.admin_users;
create policy "admin_users: super_admin reads all"
  on public.admin_users for select
  to authenticated
  using (public.current_admin_role() = 'super_admin');

-- Revoking (removing) access is allowed from the client — a super_admin
-- should be able to cut off a lost laptop or a departed secretary without
-- reaching for the SQL Editor. GRANTING access (insert) and CHANGING a
-- role/jemaat (update) stay SQL-Editor-only, on purpose: minting a new
-- admin or promoting one to super_admin is a rarer, higher-stakes action
-- where the extra friction is worth it. `user_id <> auth.uid()` blocks a
-- super_admin from revoking their own access by accident from the UI —
-- doing that to yourself is still possible, deliberately, via SQL Editor.
drop policy if exists "admin_users: super_admin revokes others" on public.admin_users;
create policy "admin_users: super_admin revokes others"
  on public.admin_users for delete
  to authenticated
  using (public.current_admin_role() = 'super_admin' and user_id <> auth.uid());

-- jemaat: super_admin lihat semua (daftar di root); jemaat_admin cuma jemaatnya.
drop policy if exists "jemaat: admin reads" on public.jemaat;
create policy "jemaat: admin reads"
  on public.jemaat for select
  to authenticated
  using (public.current_admin_role() = 'super_admin' or id = public.current_admin_jemaat_id());

drop policy if exists "jemaat: super_admin writes" on public.jemaat;
create policy "jemaat: super_admin writes"
  on public.jemaat for all
  to authenticated
  using (public.current_admin_role() = 'super_admin')
  with check (public.current_admin_role() = 'super_admin');

-- pendeta: daftar rujukan untuk form upload — semua admin boleh baca.
drop policy if exists "pendeta: admins read" on public.pendeta;
create policy "pendeta: admins read"
  on public.pendeta for select
  to authenticated
  using (public.current_admin_role() is not null);

drop policy if exists "pendeta: super_admin writes" on public.pendeta;
create policy "pendeta: super_admin writes"
  on public.pendeta for all
  to authenticated
  using (public.current_admin_role() = 'super_admin')
  with check (public.current_admin_role() = 'super_admin');

-- liturgi & warta: super_admin untuk semua jemaat; jemaat_admin hanya untuk
-- baris dengan "jemaatId" = jemaatnya (baca draf + sampah, tulis, hapus).
-- WITH CHECK yang sama mencegah jemaat_admin membuat baris untuk jemaat lain
-- atau "memindahkan" baris miliknya ke jemaat lain. Untuk pengguna tanpa baris
-- admin_users, kedua fungsi mengembalikan NULL → perbandingan NULL → ditolak.
drop policy if exists "liturgi: super_admin all" on public.liturgi;
drop policy if exists "liturgi: admin manages own jemaat" on public.liturgi;
create policy "liturgi: admin manages own jemaat"
  on public.liturgi for all
  to authenticated
  using (public.current_admin_role() = 'super_admin' or "jemaatId" = public.current_admin_jemaat_id())
  with check (public.current_admin_role() = 'super_admin' or "jemaatId" = public.current_admin_jemaat_id());

drop policy if exists "warta: super_admin all" on public.warta;
drop policy if exists "warta: admin manages own jemaat" on public.warta;
create policy "warta: admin manages own jemaat"
  on public.warta for all
  to authenticated
  using (public.current_admin_role() = 'super_admin' or "jemaatId" = public.current_admin_jemaat_id())
  with check (public.current_admin_role() = 'super_admin' or "jemaatId" = public.current_admin_jemaat_id());


-- ── 5. Fungsi baca publik (per-slug) ────────────────────────────────────
-- SECURITY DEFINER = jalan sebagai owner, melewati RLS, jadi filternya
-- ditulis eksplisit di tiap fungsi: hanya PUBLISHED, hanya belum dihapus,
-- hanya milik slug yang diminta. Tidak ada fungsi yang mengembalikan
-- daftar semua jemaat.
-- Kolom dikualifikasi (j.name, l.tanggal, ...) karena `returns table`
-- membuat parameter OUT bernama sama — jebakan yang sama dengan bug
-- `name` di storage policy dulu.

create or replace function public.get_public_jemaat(p_slug text)
returns table (id text, slug text, name text, category text)
language sql
security definer
stable
set search_path = public
as $$
  select j.id, j.slug, j.name, j.category
  from public.jemaat j
  where j.slug = p_slug
  limit 1
$$;

create or replace function public.get_public_liturgi(p_slug text, p_tanggal date, p_sesi public."Sesi")
returns setof public.liturgi
language sql
security definer
stable
set search_path = public
as $$
  select l.*
  from public.liturgi l
  join public.jemaat j on j.id = l."jemaatId"
  where j.slug = p_slug
    and l.tanggal = p_tanggal
    and l.sesi = p_sesi
    and l.status = 'PUBLISHED'
    and l."deletedAt" is null
  limit 1
$$;

create or replace function public.get_public_warta(p_slug text, p_tanggal date)
returns setof public.warta
language sql
security definer
stable
set search_path = public
as $$
  select w.*
  from public.warta w
  join public.jemaat j on j.id = w."jemaatId"
  where j.slug = p_slug
    and w.tanggal = p_tanggal
    and w.status = 'PUBLISHED'
    and w."deletedAt" is null
  limit 1
$$;

-- Tanggal yang punya liturgi ATAU warta terbit — untuk tanggal default
-- dan panah ◀▶ di halaman publik (dihitung di client dari daftar ini).
create or replace function public.get_public_dates(p_slug text)
returns table (tanggal date)
language sql
security definer
stable
set search_path = public
as $$
  select l.tanggal
  from public.liturgi l
  join public.jemaat j on j.id = l."jemaatId"
  where j.slug = p_slug and l.status = 'PUBLISHED' and l."deletedAt" is null
  union
  select w.tanggal
  from public.warta w
  join public.jemaat j on j.id = w."jemaatId"
  where j.slug = p_slug and w.status = 'PUBLISHED' and w."deletedAt" is null
  order by 1 desc
$$;

revoke all on function public.get_public_jemaat(text) from public;
revoke all on function public.get_public_liturgi(text, date, public."Sesi") from public;
revoke all on function public.get_public_warta(text, date) from public;
revoke all on function public.get_public_dates(text) from public;
grant execute on function public.get_public_jemaat(text) to anon, authenticated;
grant execute on function public.get_public_liturgi(text, date, public."Sesi") to anon, authenticated;
grant execute on function public.get_public_warta(text, date) to anon, authenticated;
grant execute on function public.get_public_dates(text) to anon, authenticated;


-- ── 6. Storage: bucket liturgi-files ────────────────────────────────────
-- Bucket public → URL file bisa dibuka tanpa policy select. Tipe file
-- (PDF/DOCX/gambar) sengaja divalidasi di aplikasi, bukan lewat
-- allowed_mime_types: browser Windows kadang mengirim DOCX dengan
-- Content-Type kosong dan upload sekre bisa gagal tanpa alasan jelas.
-- Konvensi path: <slug>/<file>  dan  <slug>/warta/<gambar>

insert into storage.buckets (id, name, public, file_size_limit)
values ('liturgi-files', 'liturgi-files', true, 15728640) -- 15 MB
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit;

-- Akses file: super_admin ke semua; jemaat_admin hanya ke folder pertama =
-- slug jemaatnya (<slug>/2026-08-23-pagi.pdf, <slug>/warta/qris.png). File di
-- root bucket (tanpa folder) tidak bisa disentuh jemaat_admin.
-- select ikut diperlukan: upload({ upsert: true }) butuh insert + update + select.
drop policy if exists "liturgi-files: super_admin select" on storage.objects;
drop policy if exists "liturgi-files: super_admin insert" on storage.objects;
drop policy if exists "liturgi-files: super_admin update" on storage.objects;
drop policy if exists "liturgi-files: super_admin delete" on storage.objects;
drop policy if exists "liturgi-files: admin select" on storage.objects;
drop policy if exists "liturgi-files: admin insert" on storage.objects;
drop policy if exists "liturgi-files: admin update" on storage.objects;
drop policy if exists "liturgi-files: admin delete" on storage.objects;

create policy "liturgi-files: admin select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'liturgi-files'
    and (
      public.current_admin_role() = 'super_admin'
      or (storage.foldername(objects.name))[1] = public.current_admin_jemaat_slug()
    )
  );

create policy "liturgi-files: admin insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'liturgi-files'
    and (
      public.current_admin_role() = 'super_admin'
      or (storage.foldername(objects.name))[1] = public.current_admin_jemaat_slug()
    )
  );

create policy "liturgi-files: admin update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'liturgi-files'
    and (
      public.current_admin_role() = 'super_admin'
      or (storage.foldername(objects.name))[1] = public.current_admin_jemaat_slug()
    )
  )
  with check (
    bucket_id = 'liturgi-files'
    and (
      public.current_admin_role() = 'super_admin'
      or (storage.foldername(objects.name))[1] = public.current_admin_jemaat_slug()
    )
  );

create policy "liturgi-files: admin delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'liturgi-files'
    and (
      public.current_admin_role() = 'super_admin'
      or (storage.foldername(objects.name))[1] = public.current_admin_jemaat_slug()
    )
  );


-- ── 7. Memberi akses ────────────────────────────────────────────────────
-- Buat dulu akunnya di Dashboard → Authentication → Users (Add user), lalu:
--
-- Super admin (kamu):
-- insert into public.admin_users (user_id, role)
--   select id, 'super_admin' from auth.users where email = 'GANTI_EMAIL_KAMU'
--   on conflict (user_id) do update set role = 'super_admin', jemaat_id = null;
--
-- Admin jemaat (mis. sekretaris) — hanya jemaat yang dipilih lewat slug-nya:
-- insert into public.admin_users (user_id, role, jemaat_id)
--   select u.id, 'jemaat_admin', j.id
--   from auth.users u, public.jemaat j
--   where u.email = 'GANTI_EMAIL_SEKRETARIS' and j.slug = 'hosana-kwanji'
--   on conflict (user_id) do update set role = 'jemaat_admin', jemaat_id = excluded.jemaat_id;
--
-- Mencabut akses (akunnya tetap ada, tapi bukan admin lagi):
-- delete from public.admin_users where user_id = (select id from auth.users where email = 'GANTI_EMAIL');


-- ── Verify ──────────────────────────────────────────────────────────────
-- Tabel public tanpa RLS (harus 0 baris):
--   select tablename from pg_tables where schemaname = 'public' and not rowsecurity;
-- anon tidak boleh punya privilege tabel apa pun (harus 0 baris):
--   select table_name, privilege_type from information_schema.role_table_grants
--     where grantee = 'anon' and table_schema = 'public';
-- Fungsi publik (setelah seed:jemaat):
--   select * from public.get_public_jemaat('hosana-kwanji');
