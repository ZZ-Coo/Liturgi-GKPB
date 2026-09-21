# Liturgi GKPB (v3)

Aplikasi web untuk menampilkan **Tata Ibadah** (PDF/Word) per jemaat + tanggal + sesi
kepada warga jemaat. Admin upload file, jemaat buka link jemaatnya sendiri.
Warta Jemaat dibangun dengan block builder di admin dan tampil di halaman jemaat,
langsung di bawah liturgi (lihat "Warta: status"). Tampilan mengikuti lambang GKPB:
merah dan putih, dengan lambangnya sebagai ikon aplikasi (`public/logo.png`,
favicon, apple-touch-icon).

## Stack

- Vue 3 + Vite + Pinia + Tailwind
- Supabase (Postgres + Auth + Storage)
- Prisma untuk tabel/kolom/enum + seed; SQL tulisan tangan (`db/setup.sql`) untuk
  sisanya (trigger, index parsial, RLS, fungsi publik, bucket)

## Akses

| URL | Siapa | Isi |
| --- | --- | --- |
| `/j/<slug>` (mis. `/j/hosana-kwanji/`) | Warga jemaat | Liturgi terbit jemaat itu |
| `/admin` | Super admin | Panel: upload, terbit/draf, sampah |
| `/` | — | **Terkunci** (halaman netral). Super admin yang sedang login melihat daftar semua jemaat untuk perawatan |

Admin yang sedang login melihat **tombol pintas** untuk berpindah antar halaman
(Panel admin / Semua jemaat / Halaman jemaat). Pengunjung biasa tidak melihat
apa-apa. Sesi login disimpan per-origin, jadi tombol ini bekerja selama semua
halaman satu origin (mode path, mis. `*.vercel.app`); di mode subdomain sesi tidak
dibagi antar subdomain.

Mode subdomain (`<slug>.liturgigkpb.com`, `admin.liturgigkpb.com`) juga didukung
begitu domain custom + wildcard DNS siap — lihat "Mode akses" di bawah.

## Model keamanan

- **`anon` tidak punya akses tabel sama sekali.** Halaman publik membaca lewat
  fungsi Postgres per-slug (`get_public_jemaat`, `get_public_liturgi`,
  `get_public_warta`, `get_public_dates`), yang hanya mengembalikan data
  PUBLISHED milik slug yang diminta. Tidak ada cara mengambil daftar semua jemaat
  lewat API tanpa login.
- Kunci di halaman root (`RootGate`) hanya lapisan UI; perlindungan sebenarnya
  ada di DB.
- Tulis/baca lewat tabel hanya untuk `super_admin` (RLS). Kolom
  `admin_users.jemaat_id` dan role `jemaat_admin` sudah disiapkan; untuk
  mengaktifkan admin per-jemaat cukup menambah klausa di policy (lihat komentar
  "PER-JEMAAT NANTI" di `db/setup.sql`).
- Slug jemaat bisa ditebak: siapa pun yang tahu `/j/<slug>` bisa membuka liturgi
  yang terbit di sana. Cukup untuk sekarang; opsi berikutnya: kode acak di link.

## Setup dari nol

```bash
npm install
cp .env.example .env          # isi Supabase URL/anon key + DATABASE_URL
npx prisma generate
npx prisma migrate dev --name init
```

Lalu di **Supabase SQL Editor**, jalankan `db/setup.sql` sekali utuh (aman
di-run ulang). File ini juga membuat bucket `liturgi-files` (public).

Buat akun di Dashboard → Authentication → Users, lalu jadikan super admin
(blok nomor 7 di `db/setup.sql`, isi emailnya):

```sql
insert into public.admin_users (user_id, role)
  select id, 'super_admin' from auth.users where email = 'EMAILMU'
  on conflict (user_id) do update set role = 'super_admin';
```

```bash
npm run seed:jemaat           # 85 jemaat/BPI
npm run seed:pendeta
npm run dev
```

Cek di SQL Editor (query verify ada di bagian bawah `db/setup.sql`): tidak ada
tabel `public` tanpa RLS, `anon` tidak punya privilege tabel, dan
`select * from public.get_public_jemaat('hosana-kwanji')` mengembalikan 1 baris.

## Reset database

`db/reset-public.sql` menghapus semua objek app ini di skema `public` (tabel,
enum, fungsi, policy bucket). Akun Auth tidak tersentuh. Sebelum menjalankannya:

1. Kosongkan bucket `liturgi-files` lewat Dashboard → Storage (jangan lewat SQL —
   filenya tertinggal di storage).
2. Hapus folder `prisma/migrations/<timestamp>_init` di lokal.

Lalu ulangi langkah "Setup dari nol" mulai `prisma migrate dev`.

## Alur pakai

**Admin** (`/admin`): login → "+ Upload Liturgi" → pilih jemaat, tanggal, sesi,
upload file (PDF/Word). Field header (tanggal, jam, pendeta, tema, warna liturgi,
minggu ke) terisi otomatis dari halaman 1–2 file dan tetap bisa diedit.
Liturgi masuk sebagai DRAFT → toggle "Terbit" saat siap. Upload ulang di
tanggal+sesi yang sama menggantikan file lama.

**Jemaat** (`/j/<slug>`): buka link, pilih Pagi/Siang/Sore; PDF tampil langsung,
Word dikonversi ke HTML di browser (unduhan file asli tetap ada). Panah ◀▶
melompat ke tanggal terbit terdekat.

## Kenapa ini ringan

PDF ditampilkan lewat `pdfjs-dist` (render ke canvas), Word lewat `mammoth`
(convert ke HTML) — keduanya jalan di browser jemaat, tanpa server konversi.
Masing-masing hanya di-load di halaman yang butuh (code-split per view); daftar
jemaat di root juga hanya diunduh oleh super admin.

## Warta: status

Admin (khusus super admin, tab **Warta** di panel — URL `/admin/warta` atau
`admin.<domain>/warta`):
- Daftar warta per jemaat + tanggal, filter jemaat, Sampah (pulihkan / hapus
  permanen). Buat baru: **salin dari warta terakhir** jemaat itu (default kalau
  ada), kerangka kosong, atau data contoh fiktif.
- Editor: bagian dan butir digeser lewat handle ⠿ (butir bisa pindah antar
  bagian), penomoran otomatis, pratinjau bergaya kertas warta di sebelahnya (tab
  di HP). Status Draf/Terbit, Simpan (atau Ctrl+S), peringatan sebelum
  meninggalkan halaman kalau ada perubahan belum disimpan.
- Jenis butir: **Teks** (tebal/miring/garis bawah/daftar bernomor), **Tabel**
  (kolom dan baris bebas, baris bisa digeser, rata kiri/tengah/kanan, garis dan
  nomor otomatis opsional) dan **Tabel keuangan** (kolom Nominal berformat
  Rupiah, baris total dihitung otomatis). Menu **Dari templat** menyediakan
  titik awal: warga berulang tahun, ulang tahun pernikahan, kegiatan kategorial,
  petugas ibadah, info rekening, laporan penerimaan, laporan pengeluaran.
- Isi sel tabel berupa teks biasa: `**tebal**`, `*miring*`, Enter = baris baru.
  (Satu editor TipTap per sel akan terlalu berat.)

Publik: warta yang **Terbit** untuk tanggal yang sedang dibuka tampil di bawah
liturgi, tanpa tab tersendiri (dibaca lewat `get_public_warta(slug, tanggal)`).
Satu warta untuk satu tanggal, berlaku untuk semua sesi.

Kode: `src/lib/warta/` (tipe, penomoran, parse data dari DB, `money.ts`,
`inline.ts`, renderer rich text tanpa TipTap, registry block + templat, akses
tabel `api.ts` / `publicApi.ts`) dan `src/components/warta/` (builder, grid tabel,
editor, tampilan kertas). TipTap dan editor tabel hanya dimuat di admin.

Belum: block Gambar (mis. QRIS), print CSS, admin per-jemaat untuk warta.

## Konfirmasi

Semua konfirmasi admin (hapus, timpa file, tinggalkan halaman dengan perubahan
belum disimpan) memakai dialog sendiri — `askConfirm()` / `confirmTrash()` /
`confirmDestroy()` di `src/composables/confirm.ts`, dirender oleh
`ConfirmDialog.vue` di `AdminShell`. Tidak ada lagi `window.confirm`.

## Struktur

```
db/                  setup.sql (final, idempotent), reset-public.sql
prisma/schema.prisma tabel, kolom, enum, FK
scripts/             seed jemaat & pendeta (+ data sumber)
src/lib/tenant.ts    resolve jemaat/admin/root dari URL, lookup publik
src/lib/warta/       tipe, penomoran, parse, money, api tabel warta, renderer, registry block
src/components/      BrandMark (lambang), AdminQuickNav (tombol pintas), admin/ConfirmDialog, warta/*
src/stores/          authStore (role admin), liturgiStore (baca publik via RPC)
src/views/           RootGate + LockedView, public/LiturgiView, admin/*
```

## Mode akses: subdomain vs path

`lib/tenant.ts` (`resolveTenant`) mendukung dua cara buka jemaat/admin:

- **Subdomain** (`sion-melaya.liturgigkpb.com`, `admin.liturgigkpb.com`) — cara
  utama, tapi baru jalan kalau domain custom-nya sudah dipasang dengan wildcard
  DNS (`*.liturgigkpb.com`) yang nameserver-nya diarahkan ke Vercel. Domain
  default `*.vercel.app` **tidak mendukung** wildcard subdomain (batasan Vercel).
- **Path** (`/admin`, `/j/sion-melaya`) — fallback yang selalu jalan di domain
  manapun, termasuk `*.vercel.app`. `router/index.ts` mount route-set yang sama
  di bawah prefix yang sesuai lewat `createWebHistory(base)`.

Begitu domain custom + wildcard DNS siap, mode subdomain otomatis aktif tanpa
ubah kode.
