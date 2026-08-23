-- CreateEnum
CREATE TYPE "Sesi" AS ENUM ('PAGI', 'SIANG', 'SORE');

-- CreateEnum
CREATE TYPE "LiturgiStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "FileType" AS ENUM ('PDF', 'DOCX');

-- CreateTable
CREATE TABLE "jemaat" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jemaat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pendeta" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "titles" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "pendeta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "liturgi" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "jemaatId" TEXT NOT NULL,
    "pendetaNama" TEXT,
    "tanggal" DATE NOT NULL,
    "sesi" "Sesi" NOT NULL,
    "jamMulai" TEXT,
    "mingguKe" TEXT,
    "tema" TEXT,
    "warnaLiturgi" TEXT,
    "pendetaId" TEXT,
    "status" "LiturgiStatus" NOT NULL DEFAULT 'DRAFT',
    "fileUrl" TEXT NOT NULL,
    "fileType" "FileType" NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "liturgi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "jemaat_slug_key" ON "jemaat"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "pendeta_code_key" ON "pendeta"("code");

-- CreateIndex
CREATE INDEX "liturgi_jemaatId_tanggal_idx" ON "liturgi"("jemaatId", "tanggal");

-- CreateIndex
CREATE UNIQUE INDEX "liturgi_jemaatId_tanggal_sesi_active_key"
  ON "liturgi" ("jemaatId", "tanggal", "sesi")
  WHERE "deletedAt" IS NULL;
 
-- AddForeignKey
ALTER TABLE "liturgi" ADD CONSTRAINT "liturgi_jemaatId_fkey" FOREIGN KEY ("jemaatId") REFERENCES "jemaat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liturgi" ADD CONSTRAINT "liturgi_pendetaId_fkey" FOREIGN KEY ("pendetaId") REFERENCES "pendeta"("id") ON DELETE SET NULL ON UPDATE CASCADE;
