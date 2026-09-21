// lib/warta/dummy.ts
// Sample warta content for the sandbox (views/admin/WartaSandboxView.vue).
// Entirely fictional — no real names, numbers or accounts. Replace with real
// data once the builder saves to the database.

import type { FinanceTableData, RichDoc, TableData, WartaSection } from './types'
import { newId } from './id'

const t = (text: string, ...marks: ('bold' | 'italic' | 'underline')[]) => ({
  type: 'text',
  text,
  ...(marks.length ? { marks: marks.map((type) => ({ type })) } : {}),
})
const p = (...content: ReturnType<typeof t>[]) => ({ type: 'paragraph', content })
const doc = (...content: object[]) => ({ type: 'doc', content }) as RichDoc
const list = (...items: ReturnType<typeof p>[]) => ({
  type: 'orderedList',
  attrs: { start: 1 },
  content: items.map((item) => ({ type: 'listItem', content: [item] })),
})

const tbl = (headers: string[], rows: string[][], opts: Partial<TableData> = {}): TableData => ({
  columns: headers.map((header) => ({ header, align: 'left' as const })),
  rows,
  showHeader: true,
  bordered: true,
  numbered: false,
  ...opts,
})

const fin = (columns: FinanceTableData['columns'], rows: string[][], totalLabel: string): FinanceTableData => ({ columns, rows, totalLabel })

export function createDummySections(): WartaSection[] {
  return [
    {
      id: newId(),
      title: 'Sapaan',
      numbering: 'none',
      blocks: [
        {
          id: newId(),
          type: 'text',
          title: 'Selamat Datang',
          data: {
            content: doc(
              p(
                t('Selamat datang dan selamat beribadah kami sampaikan kepada seluruh warga jemaat, khususnya Bapak, Ibu, Saudara yang baru pertama kali beribadah di jemaat ini. Jika membutuhkan pelayanan, silakan menghubungi majelis jemaat atau '),
                t('Pdt. Contoh Satu (Hp. 0800-0000-0000)', 'bold'),
                t('. Tuhan Yesus memberkati.'),
              ),
            ),
          },
        },
      ],
    },
    {
      id: newId(),
      title: 'Kegiatan Ibadah',
      numbering: 'roman',
      blocks: [
        {
          id: newId(),
          type: 'text',
          data: {
            content: doc(
              list(
                p(t('Ibadah Doa Tutup Pekan, ', 'bold'), t('setiap hari Sabtu', 'bold', 'italic'), t(' secara online melalui zoom pada '), t('pukul 05.30 Wita', 'bold', 'italic')),
                p(t('Ibadah Rumah Tangga (Kelompok Kamis) Gabungan', 'bold'), t(' dilaksanakan '), t('on site di gereja', 'italic'), t(' pada pukul 19.30 Wita.')),
                p(t('Ibadah Minggu', 'bold'), t(' pagi pukul 07.30 Wita dan sore pukul 18.00 Wita, dilayani oleh Pdt. Contoh Satu.')),
              ),
            ),
          },
        },
      ],
    },
    {
      id: newId(),
      title: 'Informasi',
      numbering: 'roman',
      blocks: [
        {
          id: newId(),
          type: 'text',
          title: 'Acara Kebersamaan Majelis',
          data: {
            content: doc(
              p(t('Pendeta bersama Majelis dan keluarga akan melaksanakan acara kebersamaan pada hari '), t('Senin–Selasa', 'bold', 'italic'), t('. Mohon dukungan doa warga jemaat. Terima kasih.')),
            ),
          },
        },
        {
          id: newId(),
          type: 'text',
          title: 'Bantuan Sosial',
          data: {
            content: doc(
              p(t('Bagi warga jemaat yang membutuhkan bantuan sembako maupun ingin menyumbangkan sembako dapat menghubungi Majelis Jemaat di kelompok masing-masing secara pribadi.')),
              p(),
              p(t('Terima kasih.', 'italic')),
            ),
          },
        },
        {
          id: newId(),
          type: 'table',
          title: 'Warga Jemaat Berulang Tahun',
          data: tbl(['Nama Jemaat', 'Tanggal Lahir'], [
            ['Sdr. Contoh Satu', '24-Agu-1994'],
            ['Bpk. Contoh Dua', '25-Agu-1971'],
            ['Ibu. Contoh Tiga', '27-Agu-1974'],
          ], { numbered: true }),
        },
        {
          id: newId(),
          type: 'table',
          title: 'Kegiatan Kategorial',
          data: tbl(['Kategorial', 'Waktu', 'Kegiatan'], [
            ['PP. Contoh', '**Sabtu**, 29 Agustus 2026', 'Ibadah Pemuda\n- Liturgos : Sdri. Contoh\n- Jam : 19.30 Wita'],
            ['PWDK', '*Minggu*, seusai ibadah pagi', 'Penggalian dana berupa warung mini. Mohon partisipasi seluruh warga jemaat.'],
          ], { numbered: true }),
        },
      ],
    },
    {
      id: newId(),
      title: 'Laporan Keuangan',
      numbering: 'roman',
      blocks: [
        {
          id: newId(),
          type: 'financeTable',
          title: 'Penerimaan',
          data: fin(
            [{ header: 'Keterangan', kind: 'text' }, { header: 'Jumlah', kind: 'amount' }, { header: 'Kolekta', kind: 'amount' }, { header: 'Syukur', kind: 'amount' }],
            [
              ['Persembahan kantong merah', '1.500.000', '1.500.000', ''],
              ['Persembahan kantong hijau', '1.200.000', '1.200.000', ''],
              ['NN', '100.000', '', '100.000'],
            ],
            'JUMLAH PENERIMAAN',
          ),
        },
        {
          id: newId(),
          type: 'financeTable',
          title: 'Pengeluaran',
          data: fin(
            [{ header: 'Keterangan', kind: 'text' }, { header: 'Total', kind: 'amount' }],
            [['Kegiatan jemaat', '140.000'], ['Snack minggu', '177.500'], ['Perawatan gedung', '2.000.000']],
            'TOTAL PENGELUARAN',
          ),
        },
      ],
    },
    {
      id: newId(),
      title: 'Petugas dalam Ibadah',
      numbering: 'roman',
      blocks: [
        {
          id: newId(),
          type: 'table',
          data: tbl(['Tugas dalam Ibadah', 'Minggu Pagi', 'Minggu Sore'], [
            ['PF', 'Pdt. Contoh Satu', 'Pdt. Contoh Satu'],
            ['PA', 'Pnt. Contoh Empat', 'Pnt. Contoh Lima'],
            ['PK', 'Pnt. Contoh Enam\nPnj. Contoh Tujuh', 'Pnt. Contoh Delapan\nPnj. Contoh Sembilan'],
          ]),
        },
      ],
    },
  ]
}
