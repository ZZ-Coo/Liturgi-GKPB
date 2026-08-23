-- Jalanin ini di Supabase SQL Editor SEBELUM deploy kode baru ini.
-- Ini nyamain skema live database kamu sama schema.prisma yang baru
-- (soft-delete + partial unique index untuk liturgi.jemaatId+tanggal+sesi).

-- 1. Kolom baru buat soft-delete
ALTER TABLE "liturgi" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- 2. Buang unique index LAMA (yang non-partial, dari migration awal)
DROP INDEX IF EXISTS "liturgi_jemaatId_tanggal_sesi_key";

-- 3. Bikin unique index BARU (cuma berlaku buat row yang belum dihapus)
CREATE UNIQUE INDEX IF NOT EXISTS "liturgi_jemaatId_tanggal_sesi_active_key"
  ON "liturgi" ("jemaatId", "tanggal", "sesi")
  WHERE "deletedAt" IS NULL;

-- Verifikasi (opsional) — pastikan index barunya kepasang bener:
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'liturgi';
