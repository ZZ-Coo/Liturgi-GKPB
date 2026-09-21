-- ═══════════════════════════════════════════════════════════════════════
-- Liturgi GKPB — db/reset-public.sql   ⚠️ DESTRUKTIF
--
-- Menghapus SEMUA tabel/tipe/fungsi milik app Liturgi di skema public,
-- plus policy storage untuk bucket liturgi-files. Data di dalamnya hilang.
--
-- TIDAK menyentuh: skema auth (akun login tetap ada), skema storage itu
-- sendiri, project Supabase, dan tabel lain di public yang bukan milik
-- app ini. Sengaja pakai daftar eksplisit, bukan "drop semua tabel di
-- public", supaya aman kalau project ini dipakai app lain juga.
--
-- Sebelum menjalankan:
--   1. Kosongkan bucket liturgi-files lewat Dashboard → Storage
--      (pilih semua file → Delete). JANGAN lewat `delete from storage.objects`
--      di SQL: barisnya hilang tapi file aslinya tertinggal di storage.
--   2. Hapus folder prisma/migrations/<timestamp>_init di lokal.
-- ═══════════════════════════════════════════════════════════════════════

-- Policy storage lama untuk bucket ini (nama-nama v1–v6 + apa pun yang
-- menyebut liturgi-files).
do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and (coalesce(qual, '') like '%liturgi-files%' or coalesce(with_check, '') like '%liturgi-files%')
  loop
    execute format('drop policy if exists %I on storage.objects', p.policyname);
  end loop;
end
$$;

-- Tabel (termasuk riwayat migrasi Prisma, karena migrasinya dibuat ulang).
drop table if exists
  public.warta,
  public.liturgi,
  public.admin_users,
  public.pendeta,
  public.jemaat,
  public._prisma_migrations
cascade;

-- Tipe enum (cascade ikut menghapus fungsi yang memakainya).
drop type if exists
  public."Sesi",
  public."LiturgiStatus",
  public."PublishStatus",
  public."FileType"
cascade;

-- Fungsi sisa.
drop function if exists public.get_public_jemaat(text);
drop function if exists public.get_public_dates(text);
drop function if exists public.get_public_warta(text, date);
drop function if exists public.current_admin_role();
drop function if exists public.current_admin_jemaat_id();
drop function if exists public.set_updated_at();

-- Cek: harus kosong untuk app ini.
-- select tablename from pg_tables where schemaname = 'public';
