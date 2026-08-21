// scripts/data/ministries.ts
//
// Directory of GKPB (Gereja Kristen Protestan di Bali) congregations and
// organisational bodies, transcribed from the official Sinode GKPB site:
// https://balichurchsynod.org/jemaat-gkpb (accessed 2026-08-21).
//
// GKPB groups its congregations into 8 "wilayah" (regional districts) —
// these are used as `category` below and match the site's own navigation
// (Kota Denpasar, Badung Utara, Badung Selatan, Tabanan, Bali Timur,
// Bali Timur Laut, Buleleng, Jembrana).
//
// `type` tells seed-jemaat.ts which rows should become a tenant (their own
// liturgi subdomain):
//   - "jemaat"        full congregation ("GKPB Jemaat ...")
//   - "bpi"            Bakal Persekutuan Ibadah — an embryonic congregation
//                       that isn't full "Jemaat" status yet, but still holds
//                       its own services and can use its own liturgi page
//   - "international"  GKPB's English-language international congregations
//   - "org"            synod-level bodies, departments, foundations — not a
//                       congregation, so never seeded as a tenant
//   - "kategorial"      synod-wide fellowship groups (youth, women, etc.) —
//                       cut across every jemaat rather than belonging to one,
//                       so also not seeded as a tenant

export interface MinistryEntry {
  id: string
  name: string
  category: string
  type: 'jemaat' | 'bpi' | 'international' | 'org' | 'kategorial'
}

export const MINISTRIES: MinistryEntry[] = [
  // ── Badan Sinode & Departemen ────────────────────────────────────────
  { id: 'sinode-gkpb', name: 'Badan Sinode GKPB', category: 'Badan Sinode', type: 'org' },
  { id: 'deptubin-gkpb', name: 'Departemen Persekutuan dan Pembinaan (DEPTUBIN)', category: 'Badan Sinode', type: 'org' },
  { id: 'depsakbang-gkpb', name: 'Departemen Kesaksian dan Pengembangan (DEPSAKBANG)', category: 'Badan Sinode', type: 'org' },
  { id: 'deplapem-gkpb', name: 'Departemen Pelayanan dan Pembangunan Masyarakat (DEPLAPEM)', category: 'Badan Sinode', type: 'org' },
  { id: 'yayasan-dhyana-pura', name: 'Yayasan Dhyana Pura', category: 'Badan Sinode', type: 'org' },
  { id: 'yayasan-perguruan-kristen-harapan', name: 'Yayasan Perguruan Kristen Harapan', category: 'Badan Sinode', type: 'org' },
  { id: 'yayasan-widya-asih', name: 'Yayasan Widya Asih', category: 'Badan Sinode', type: 'org' },
  { id: 'yayasan-tabur-tuai-bali', name: 'Yayasan Tabur Tuai Bali', category: 'Badan Sinode', type: 'org' },
  { id: 'yayasan-divya-pradana-bakti', name: 'Yayasan Divya Pradana Bakti', category: 'Badan Sinode', type: 'org' },
  { id: 'yayasan-maha-bhoga-marga', name: 'Yayasan Maha Bhoga Marga', category: 'Badan Sinode', type: 'org' },

  // ── Kategorial (synod-wide fellowship groups, not tied to one jemaat) ──
  { id: 'kategorial-kristya-jati', name: 'Kristya Jati (Warga Senior)', category: 'Kategorial', type: 'kategorial' },
  { id: 'kategorial-kristya-winangun', name: 'Kristya Winangun (Kaum Bapak)', category: 'Kategorial', type: 'kategorial' },
  { id: 'kategorial-dian-kristawati', name: 'Dian Kristawati (Kaum Ibu)', category: 'Kategorial', type: 'kategorial' },
  { id: 'kategorial-kristiyasa', name: 'Kristiyasa (Pemuda)', category: 'Kategorial', type: 'kategorial' },
  { id: 'kategorial-duta-kristama', name: 'Duta Kristama (Sekolah Minggu)', category: 'Kategorial', type: 'kategorial' },

  // ── Wilayah Kota Denpasar ────────────────────────────────────────────
  { id: 'jemaat-kristus-kasih-denpasar', name: 'Jemaat "Kristus Kasih" – Denpasar', category: 'Kota Denpasar', type: 'jemaat' },
  { id: 'bpi-fajar-kasih-penatih', name: 'BPI "Fajar Kasih" – Penatih', category: 'Kota Denpasar', type: 'bpi' },
  { id: 'jemaat-widhi-satya-sesetan', name: 'Jemaat "Widhi Satya" – Sesetan', category: 'Kota Denpasar', type: 'jemaat' },
  { id: 'jemaat-getsemani-sidakarya', name: 'Jemaat "Getsemani" – Sidakarya', category: 'Kota Denpasar', type: 'jemaat' },
  { id: 'jemaat-dhyana-pura-seminyak', name: 'Jemaat "Dhyana Pura" – Seminyak', category: 'Kota Denpasar', type: 'jemaat' },
  { id: 'jemaat-philadelphia-legian', name: 'Jemaat "Philadelphia" – Legian', category: 'Kota Denpasar', type: 'jemaat' },
  { id: 'jemaat-bukit-doa-nusa-dua', name: 'Jemaat "Bukit Doa" – Nusa Dua', category: 'Kota Denpasar', type: 'jemaat' },
  { id: 'jemaat-bukit-sion-kutuh', name: 'Jemaat "Bukit Sion" – Kutuh', category: 'Kota Denpasar', type: 'jemaat' },
  { id: 'jemaat-surya-buana-denpasar-barat', name: 'Jemaat "Surya Buana" – Denpasar Barat', category: 'Kota Denpasar', type: 'jemaat' },
  { id: 'jemaat-kasih-kudus-denpasar-utara', name: 'Jemaat "Kasih Kudus" – Denpasar Utara', category: 'Kota Denpasar', type: 'jemaat' },
  { id: 'jemaat-tiberias-kepaon', name: 'Jemaat "Tiberias" – Kepaon', category: 'Kota Denpasar', type: 'jemaat' },
  { id: 'kicc-legian', name: 'Kuta International Christian Church (KICC) – Legian', category: 'Kota Denpasar', type: 'international' },
  { id: 'bdic-nusa-dua', name: 'Bukit Doa International Church (BDIC) – Nusa Dua', category: 'Kota Denpasar', type: 'international' },

  // ── Wilayah Badung Utara ─────────────────────────────────────────────
  { id: 'jemaat-galang-ning-hyang-abianbase', name: 'Jemaat "Galang Ning Hyang" – Abianbase', category: 'Badung Utara', type: 'jemaat' },
  { id: 'jemaat-uwit-galang-ulun-uma', name: 'Jemaat "Uwit Galang" – Ulun Uma', category: 'Badung Utara', type: 'jemaat' },
  { id: 'jemaat-sinar-urip-carangsari', name: 'Jemaat "Sinar Urip" – Carangsari', category: 'Badung Utara', type: 'jemaat' },
  { id: 'jemaat-gabriel-pegending', name: 'Jemaat "Gabriel" – Pegending', category: 'Badung Utara', type: 'jemaat' },
  { id: 'jemaat-galang-buana-dalung', name: 'Jemaat "Galang Buana" – Dalung', category: 'Badung Utara', type: 'jemaat' },
  { id: 'jemaat-betlehem-untal-untal', name: 'Jemaat "Betlehem" – Untal-Untal', category: 'Badung Utara', type: 'jemaat' },
  { id: 'jemaat-kudus-sading', name: 'Jemaat "Kudus" – Sading', category: 'Badung Utara', type: 'jemaat' },
  { id: 'jemaat-merta-urip-lukluk', name: 'Jemaat "Merta Urip" – Lukluk', category: 'Badung Utara', type: 'jemaat' },
  { id: 'jemaat-galang-ning-sabda-cica', name: 'Jemaat "Galang Ning Sabda" – Cica', category: 'Badung Utara', type: 'jemaat' },
  { id: 'bpi-bukit-kasih-tiyingan', name: 'BPI "Bukit Kasih" – Tiyingan', category: 'Badung Utara', type: 'bpi' },

  // ── Wilayah Badung Selatan ───────────────────────────────────────────
  { id: 'jemaat-efrata-buduk', name: 'Jemaat "Efrata" – Buduk', category: 'Badung Selatan', type: 'jemaat' },
  { id: 'jemaat-toya-urip-kaba-kaba', name: 'Jemaat "Toya Urip" – Kaba-Kaba', category: 'Badung Selatan', type: 'jemaat' },
  { id: 'jemaat-marga-pakerti-padang-tawang', name: 'Jemaat "Marga Pakerti" – Padang Tawang', category: 'Badung Selatan', type: 'jemaat' },
  { id: 'jemaat-canggu-permai', name: 'Jemaat "Canggu Permai" – Canggu Permai', category: 'Badung Selatan', type: 'jemaat' },
  { id: 'jemaat-tirta-amerta-plambingan', name: 'Jemaat "Tirta Amerta" – Plambingan', category: 'Badung Selatan', type: 'jemaat' },
  { id: 'jemaat-tirta-empul-kerobokan', name: 'Jemaat "Tirta Empul" – Kerobokan', category: 'Badung Selatan', type: 'jemaat' },
  { id: 'jemaat-hosana-kwanji', name: 'Jemaat "Hosana" – Kwanji', category: 'Badung Selatan', type: 'jemaat' },
  { id: 'jemaat-yudea-padang-luwih', name: 'Jemaat "Yudea" – Padang Luwih', category: 'Badung Selatan', type: 'jemaat' },

  // ── Wilayah Tabanan ──────────────────────────────────────────────────
  { id: 'jemaat-bait-lahai-roi-penataran', name: 'Jemaat "Bait Lahai Roi" – Penataran', category: 'Tabanan', type: 'jemaat' },
  { id: 'jemaat-sinar-kasih-pajahan', name: 'Jemaat "Sinar Kasih" – Pajahan', category: 'Tabanan', type: 'jemaat' },
  { id: 'jemaat-sabda-jati-selabih', name: 'Jemaat "Sabda Jati" – Selabih', category: 'Tabanan', type: 'jemaat' },
  { id: 'jemaat-marga-jati-belatungan', name: 'Jemaat "Marga Jati" – Belatungan', category: 'Tabanan', type: 'jemaat' },
  { id: 'jemaat-betesda-lalang-linggah', name: 'Jemaat "Betesda" – Lalang Linggah', category: 'Tabanan', type: 'jemaat' },
  { id: 'jemaat-immanuel-tabanan', name: 'Jemaat "Immanuel" – Tabanan', category: 'Tabanan', type: 'jemaat' },
  { id: 'jemaat-imanuel-piling', name: 'Jemaat "Imanuel" – Piling', category: 'Tabanan', type: 'jemaat' },
  { id: 'jemaat-bukit-palma-sanggulan', name: 'Jemaat "Bukit Palma" – Sanggulan', category: 'Tabanan', type: 'jemaat' },
  { id: 'jemaat-alif-dan-ya-bongan', name: 'Jemaat "Alif dan Ya" – Bongan', category: 'Tabanan', type: 'jemaat' },
  { id: 'jemaat-betesda-sudimara', name: 'Jemaat "Betesda" – Sudimara', category: 'Tabanan', type: 'jemaat' },
  { id: 'jemaat-suluh-kasih-tibubiu', name: 'Jemaat "Suluh Kasih" – Tibubiu', category: 'Tabanan', type: 'jemaat' },
  { id: 'jemaat-mawar-saron-baturiti', name: 'Jemaat "Mawar Saron" – Baturiti', category: 'Tabanan', type: 'jemaat' },
  { id: 'bpi-gloria-bajera', name: 'BPI "Gloria" – Bajera', category: 'Tabanan', type: 'bpi' },
  { id: 'bpi-siki-rahayu-wanagiri', name: 'BPI "Siki Rahayu" – Wanagiri', category: 'Tabanan', type: 'bpi' },
  { id: 'bpi-sumber-kasih-braban-klecung', name: 'BPI "Sumber Kasih" – Braban-Klecung', category: 'Tabanan', type: 'bpi' },
  { id: 'bpi-bukit-muria-mandung', name: 'BPI "Bukit Muria" – Mandung', category: 'Tabanan', type: 'bpi' },
  { id: 'bpi-hosiana-mayungan', name: 'BPI "Hosiana" – Mayungan', category: 'Tabanan', type: 'bpi' },
  { id: 'bpi-urip-anyar-penatahan', name: 'BPI "Urip Anyar" – Penatahan', category: 'Tabanan', type: 'bpi' },

  // ── Wilayah Bali Timur (Kab. Karangasem & Kab. Klungkung) ───────────
  { id: 'jemaat-philia-amlapura', name: 'Jemaat "Philia" – Amlapura, Karangasem', category: 'Bali Timur', type: 'jemaat' },
  { id: 'jemaat-sabda-urip-sega', name: 'Jemaat "Sabda Urip" – Sega, Karangasem', category: 'Bali Timur', type: 'jemaat' },
  { id: 'jemaat-tresna-asih-klungkung', name: 'Jemaat "Tresna Asih" – Klungkung', category: 'Bali Timur', type: 'jemaat' },
  { id: 'bpi-batu-karang-lembongan', name: 'BPI "Batu Karang" – Lembongan, Klungkung', category: 'Bali Timur', type: 'bpi' },

  // ── Wilayah Bali Timur Laut (Kab. Bangli & Kab. Gianyar) ────────────
  { id: 'jemaat-margi-rahayu-bangli', name: 'Jemaat "Margi Rahayu" – Bangli', category: 'Bali Timur Laut', type: 'jemaat' },
  { id: 'jemaat-mrikije-bukitsari', name: 'Jemaat "Mrikije" – Bukitsari, Bangli', category: 'Bali Timur Laut', type: 'jemaat' },
  { id: 'jemaat-giri-sweca-katung', name: 'Jemaat "Giri Sweca" – Katung, Bangli', category: 'Bali Timur Laut', type: 'jemaat' },
  { id: 'bpi-kintamani', name: 'BPI GKPB – Kintamani, Bangli', category: 'Bali Timur Laut', type: 'bpi' },
  { id: 'jemaat-margi-kahuripan-gianyar', name: 'Jemaat "Margi Kahuripan" – Gianyar', category: 'Bali Timur Laut', type: 'jemaat' },
  { id: 'bpi-batu-bulan-gianyar', name: 'BPI GKPB – Batu Bulan, Gianyar', category: 'Bali Timur Laut', type: 'bpi' },

  // ── Wilayah Buleleng (Bali Utara) ────────────────────────────────────
  { id: 'jemaat-sabda-bayu-singaraja', name: 'Jemaat "Sabda Bayu" – Singaraja', category: 'Buleleng', type: 'jemaat' },
  { id: 'jemaat-gunung-muria-gitgit', name: 'Jemaat "Gunung Muria" – Gitgit', category: 'Buleleng', type: 'jemaat' },
  { id: 'jemaat-immanuel-sangsit', name: 'Jemaat "Immanuel" – Sangsit', category: 'Buleleng', type: 'jemaat' },
  { id: 'jemaat-urip-langgeng-abasan', name: 'Jemaat "Urip Langgeng" – Abasan', category: 'Buleleng', type: 'jemaat' },
  { id: 'jemaat-galanging-jagat-galungan', name: 'Jemaat "Galanging Jagat" – Galungan', category: 'Buleleng', type: 'jemaat' },
  { id: 'jemaat-pancaran-kasih-bungkulan', name: 'Jemaat "Pancaran Kasih" – Bungkulan', category: 'Buleleng', type: 'jemaat' },
  { id: 'jemaat-pelangi-kasih-tangguwisia', name: 'Jemaat "Pelangi Kasih" – Tangguwisia, Seririt', category: 'Buleleng', type: 'jemaat' },
  { id: 'jemaat-margi-urip-tigawasa', name: 'Jemaat "Margi Urip" – Tigawasa', category: 'Buleleng', type: 'jemaat' },
  { id: 'jemaat-air-hidup-banyupoh', name: 'Jemaat "Air Hidup" – Banyupoh', category: 'Buleleng', type: 'jemaat' },
  { id: 'jemaat-lentera-kasih-patas', name: 'Jemaat "Lentera Kasih" – Patas Tinga-Tinga', category: 'Buleleng', type: 'jemaat' },
  { id: 'jemaat-mutiara-kasih-sumberkima', name: 'Jemaat "Mutiara Kasih" – Sumberkima', category: 'Buleleng', type: 'jemaat' },
  { id: 'jemaat-bukit-zaitun-kedis', name: 'Jemaat "Bukit Zaitun" – Kedis', category: 'Buleleng', type: 'jemaat' },
  { id: 'jemaat-kasih-karunia-sambangan', name: 'Jemaat "Kasih Karunia" – Sambangan', category: 'Buleleng', type: 'jemaat' },
  { id: 'bpi-bontihing', name: 'BPI GKPB – Bontihing', category: 'Buleleng', type: 'bpi' },
  { id: 'bpi-bulian', name: 'BPI GKPB – Bulian', category: 'Buleleng', type: 'bpi' },
  { id: 'bpi-pancasari', name: 'BPI GKPB – Pancasari', category: 'Buleleng', type: 'bpi' },

  // ── Wilayah Jembrana (Bali Barat) ────────────────────────────────────
  { id: 'jemaat-agape-gilimanuk', name: 'Jemaat "Agape" – Gilimanuk', category: 'Jembrana', type: 'jemaat' },
  { id: 'jemaat-sion-melaya', name: 'Jemaat "Sion" – Melaya', category: 'Jembrana', type: 'jemaat' },
  { id: 'jemaat-siloam-pangkungtanah', name: 'Jemaat "Siloam" – Pangkungtanah', category: 'Jembrana', type: 'jemaat' },
  { id: 'jemaat-imanuel-ambyarsari', name: 'Jemaat "Imanuel" – Ambyarsari', category: 'Jembrana', type: 'jemaat' },
  { id: 'jemaat-pniel-blimbingsari', name: 'Jemaat "Pniel" – Blimbingsari', category: 'Jembrana', type: 'jemaat' },
  { id: 'jemaat-mandira-santi-negara', name: 'Jemaat "Mandira Santi" – Negara', category: 'Jembrana', type: 'jemaat' },
  { id: 'jemaat-mandira-asih-tegalbadeng', name: 'Jemaat "Mandira Asih" – Tegalbadeng', category: 'Jembrana', type: 'jemaat' },
  { id: 'bpi-candikusuma', name: 'BPI GKPB – Candikusuma', category: 'Jembrana', type: 'bpi' },
  { id: 'bpi-mandira-saksi-sari-kuning', name: 'BPI "Mandira Saksi" – Sari Kuning', category: 'Jembrana', type: 'bpi' },
  { id: 'bpi-tegalcangkring', name: 'BPI GKPB – Tegalcangkring', category: 'Jembrana', type: 'bpi' },
]
