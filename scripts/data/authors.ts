// scripts/data/authors.ts
//
// Entries marked `verified: true` were cross-checked against a real
// source (balichurchsynod.org — the official GKPB sinode site — or the
// jemaat's own Tata Ibadah documents/news coverage) and their `titles`
// reflect what that source actually states.
//
// Entries marked `verified: false` are as originally recycled from the
// puji-janji project with no confirmed source — treat name spelling and
// especially `titles` as unverified until checked. Some may well be
// correct, but none of the round "2010–Sekarang"-style service-history
// dates from the original data could be confirmed anywhere, so that
// field was dropped entirely rather than kept as unverifiable filler.

export interface AuthorEntry {
  name: string
  titles: string[]
  verified: boolean
}

export const AUTHORS: Record<string, AuthorEntry> = {
  // ── Verified against balichurchsynod.org/departemen-gkpb (sinode-level) ──
  IWM:   { name: "I Wayan Mariasa",              titles: ["S.Si.Teol"],     verified: true },
  PJD:   { name: "Paulina Jasri Danggo",         titles: ["S.Si.Teol"],     verified: true },
  A3P:   { name: "A.A. Ayu Perani",              titles: ["M.Th.Kons"],     verified: true },
  DEAP:  { name: "I Dewa Gede Adi Pranata",      titles: ["S.Th"],          verified: true },
  NJL:   { name: "Nafthalia Julita Leander",     titles: ["M.Si"],          verified: true },
  IRHB:  { name: "Izak Rio Hernemus Bainuan",    titles: ["M.Th"],          verified: true },
  HW:    { name: "Hetty Widowaty",               titles: ["S.Si."],         verified: true }, // spelling per official site (was "Hety ... Soewondo" — surname unconfirmed, dropped)

  // ── Verified against the jemaat's own Tata Ibadah PDFs + independent
  //    news/alumni-directory coverage (GKPB Jemaat Hosana Kwanji) ─────────
  KS:    { name: "Ni Kadek Suriani",             titles: ["M.Th"],          verified: true }, // was "Kadek Suriani" (missing "Ni")

  // ── Not yet independently verified — kept as-is from the recycled
  //    source, titles left empty rather than guessed ─────────────────────
  KDPA:   { name: "Kadek Dwi Prayoga Aditya",                  titles: [], verified: false },
  ISUN:   { name: "Dewi Sundari",                              titles: [], verified: false },
  VMYB:   { name: "Viyata Margareta Yuliana Bolla",            titles: [], verified: false },
  MFGA:   { name: "Made Fennoni Gressia Asrining",             titles: [], verified: false },
  IMAAP:  { name: "I Made Andika Adi Putra",                   titles: [], verified: false },
  VIJE:   { name: "Julius Jefry Lumansik",                     titles: [], verified: false },
  ATAANO: { name: "Martha Yunita Ano",                         titles: [], verified: false },
  KAJ:    { name: "Komang Agus Juliawan",                      titles: [], verified: false },
  KY:     { name: "Karenda Yucha",                             titles: [], verified: false },
  WAW:    { name: "Wayan Agus Wiratama",                       titles: [], verified: false },
  JoJo:   { name: "Jonnie Josua",                              titles: [], verified: false },
  PAP:    { name: "Penta Astari Prasetya",                     titles: [], verified: false },
  PSA:    { name: "Putu Surya Adinata",                        titles: [], verified: false },
  CWP:    { name: "Christiana Welda Putranti",                 titles: [], verified: false },
  IPEUS:  { name: "I Putu Elika Uria Setiawan",                titles: [], verified: false },
  KBWU:   { name: "Kadek Bagus Wisesa Uryana",                 titles: [], verified: false },
  TW:     { name: "Trifena Wati",                              titles: [], verified: false },
  PR:     { name: "Putu Recita",                               titles: [], verified: false },
  DS:     { name: "Debora Seilatu",                            titles: [], verified: false },
  SH:     { name: "Somenifati Hia",                            titles: [], verified: false },
  FPP:    { name: "Fajar Pratama Putra",                       titles: [], verified: false },
  MHS:    { name: "Merry Handayani Sayuna",                    titles: [], verified: false },
  FAO:    { name: "Finsensius Apola Oematan",                  titles: [], verified: false },
  YDS:    { name: "Yosef Destian Setiawan",                    titles: [], verified: false },
  JVS:    { name: "Gd Jesico Valerius Sasmita",                titles: [], verified: false },
  AS:     { name: "Nyoman Ayu Suryantininghati",               titles: [], verified: false }, // official site lists "Ni Nyoman Ayu Suryantininghati" — close but not exact, left unverified
  GAKLIE: { name: "Gusti Ayu Ketut Lintang Indah Esterlita",   titles: [], verified: false },
  AEPTB:  { name: "Anggrayni Eka Putri Tresna Bunga",          titles: [], verified: false },
}
