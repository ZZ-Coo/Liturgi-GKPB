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
-- Model akses saat ini: hanya super_admin yang bisa baca/tulis lewat tabel.
-- Admin per-jemaat = nanti; kolom admin_users.jemaat_id sudah disiapkan,
-- tinggal tambah klausa di policy (lihat komentar "PER-JEMAAT NANTI").
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

-- Supabase memberi EXECUTE ke anon secara default → cabut, kasih ke authenticated saja.
revoke all on function public.current_admin_role() from public, anon;
revoke all on function public.current_admin_jemaat_id() from public, anon;
grant execute on function public.current_admin_role() to authenticated;
grant execute on function public.current_admin_jemaat_id() to authenticated;


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
grant select on public.admin_users to authenticated;
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

-- liturgi & warta: super_admin penuh (baca draft + sampah, tulis, hapus).
-- PER-JEMAAT NANTI: tambahkan di using DAN with check masing-masing:
--   or public.current_admin_jemaat_id() = "jemaatId"
drop policy if exists "liturgi: super_admin all" on public.liturgi;
create policy "liturgi: super_admin all"
  on public.liturgi for all
  to authenticated
  using (public.current_admin_role() = 'super_admin')
  with check (public.current_admin_role() = 'super_admin');

drop policy if exists "warta: super_admin all" on public.warta;
create policy "warta: super_admin all"
  on public.warta for all
  to authenticated
  using (public.current_admin_role() = 'super_admin')
  with check (public.current_admin_role() = 'super_admin');


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

-- select ikut diperlukan: upload({ upsert: true }) butuh insert + update + select.
drop policy if exists "liturgi-files: super_admin select" on storage.objects;
create policy "liturgi-files: super_admin select"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'liturgi-files' and public.current_admin_role() = 'super_admin');

drop policy if exists "liturgi-files: super_admin insert" on storage.objects;
create policy "liturgi-files: super_admin insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'liturgi-files' and public.current_admin_role() = 'super_admin');

drop policy if exists "liturgi-files: super_admin update" on storage.objects;
create policy "liturgi-files: super_admin update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'liturgi-files' and public.current_admin_role() = 'super_admin');

drop policy if exists "liturgi-files: super_admin delete" on storage.objects;
create policy "liturgi-files: super_admin delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'liturgi-files' and public.current_admin_role() = 'super_admin');

-- PER-JEMAAT NANTI: tambahkan ke tiap policy di atas
--   or exists (
--     select 1 from public.jemaat j
--     where j.id = public.current_admin_jemaat_id()
--       and j.slug = (storage.foldername(objects.name))[1]   -- WAJIB `objects.name`, bukan `name`
--   )


-- ── 7. Jadikan dirimu super_admin (akun Auth-mu sudah ada, cukup jalankan ini) ──
-- insert into public.admin_users (user_id, role)
--   select id, 'super_admin' from auth.users where email = 'GANTI_EMAIL_KAMU'
--   on conflict (user_id) do update set role = 'super_admin';


-- ── Verify ──────────────────────────────────────────────────────────────
-- Tabel public tanpa RLS (harus 0 baris):
--   select tablename from pg_tables where schemaname = 'public' and not rowsecurity;
-- anon tidak boleh punya privilege tabel apa pun (harus 0 baris):
--   select table_name, privilege_type from information_schema.role_table_grants
--     where grantee = 'anon' and table_schema = 'public';
-- Fungsi publik (setelah seed:jemaat):
--   select * from public.get_public_jemaat('hosana-kwanji');
