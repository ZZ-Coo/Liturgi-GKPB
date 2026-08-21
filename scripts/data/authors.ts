// scripts/data/authors.ts
export interface AuthorServiceHistory {
  ministryId: string
  from: string
  until: string
}
export interface AuthorEntry {
  name: string
  titles: string[]
  serviceHistory: AuthorServiceHistory[]
}

export const AUTHORS: Record<string, AuthorEntry> = {
  IWM:    { name: "I Wayan Mariasa",                             titles: [], serviceHistory: [{ ministryId: "sinode-gkpb", from: "2010", until: "Sekarang" }] },
  KDPA:   { name: "Kadek Dwi Prayoga Aditya",                   titles: [], serviceHistory: [{ ministryId: "sinode-gkpb", from: "2015", until: "Sekarang" }] },
  ISUN:   { name: "Dewi Sundari",                               titles: [], serviceHistory: [{ ministryId: "sinode-gkpb", from: "2012", until: "Sekarang" }] },
  VMYB:   { name: "Viyata Margareta Yuliana Bolla, S.Si. Teol", titles: [], serviceHistory: [{ ministryId: "sinode-gkpb", from: "2014", until: "Sekarang" }] },
  MFGA:   { name: "Made Fennoni Gressia Asrining, S.Si. Teol",  titles: [], serviceHistory: [{ ministryId: "sinode-gkpb", from: "2016", until: "Sekarang" }] },
  IMAAP:  { name: "I Made Andika Adi Putra",                    titles: [], serviceHistory: [{ ministryId: "sinode-gkpb", from: "2013", until: "Sekarang" }] },
  VIJE:   { name: "Julius Jefry Lumansik",                      titles: [], serviceHistory: [{ ministryId: "sinode-gkpb", from: "2011", until: "Sekarang" }] },
  ATAANO: { name: "Martha Yunita Ano",                          titles: [], serviceHistory: [{ ministryId: "sinode-gkpb", from: "2018", until: "Sekarang" }] },
  KAJ:    { name: "Komang Agus Juliawan",                       titles: [], serviceHistory: [{ ministryId: "sinode-gkpb", from: "2017", until: "Sekarang" }] },
  KY:     { name: "Karenda Yucha, S.Si., Teol",                 titles: [], serviceHistory: [{ ministryId: "sinode-gkpb", from: "2019", until: "Sekarang" }] },
  HW:     { name: "Hety Widowaty Soewondo",                     titles: [], serviceHistory: [{ ministryId: "sinode-gkpb", from: "2009", until: "Sekarang" }] },
  PJD:    { name: "Paulina Jasri Danggo",                       titles: [], serviceHistory: [{ ministryId: "sinode-gkpb", from: "2020", until: "Sekarang" }] },
  WAW:    { name: "Wayan Agus Wiratama",                        titles: [], serviceHistory: [{ ministryId: "sinode-gkpb", from: "2016", until: "Sekarang" }] },
  KS:     { name: "Kadek Suriani",                              titles: [], serviceHistory: [{ ministryId: "sinode-gkpb", from: "2021", until: "Sekarang" }] },
  JoJo:   { name: "Jonnie Josua",                               titles: [], serviceHistory: [{ ministryId: "sinode-gkpb", from: "2022", until: "Sekarang" }] },
  PAP:    { name: "Penta Astari Prasetya",                      titles: [], serviceHistory: [{ ministryId: "sinode-gkpb", from: "2023", until: "Sekarang" }] },
  PSA:    { name: "Putu Surya Adinata",                         titles: [], serviceHistory: [{ ministryId: "sinode-gkpb", from: "2022", until: "Sekarang" }] },
  NJL:    { name: "Nafthalia Julita Leander",                   titles: [], serviceHistory: [{ ministryId: "sinode-gkpb", from: "2018", until: "Sekarang" }] },
  CWP:    { name: "Christiana Welda Putranti",                  titles: [], serviceHistory: [{ ministryId: "sinode-gkpb", from: "2015", until: "Sekarang" }] },
  IPEUS:  { name: "I Putu Elika Uria Setiawan",                 titles: [], serviceHistory: [{ ministryId: "sinode-gkpb", from: "2023", until: "Sekarang" }] },
  KBWU:   { name: "Kadek Bagus Wisesa Uryana",                  titles: [], serviceHistory: [{ ministryId: "sinode-gkpb", from: "2020", until: "Sekarang" }] },
  IRHB:   { name: "Izak Rio Hernemus Bainuan",                  titles: [], serviceHistory: [{ ministryId: "sinode-gkpb", from: "2017", until: "Sekarang" }] },
  TW:     { name: "Trifena Wati",                               titles: [], serviceHistory: [{ ministryId: "sinode-gkpb", from: "2019", until: "Sekarang" }] },
  PR:     { name: "Putu Recita",                                titles: [], serviceHistory: [{ ministryId: "sinode-gkpb", from: "2021", until: "Sekarang" }] },
  DS:     { name: "Debora Seilatu",                             titles: [], serviceHistory: [{ ministryId: "sinode-gkpb", from: "2018", until: "Sekarang" }] },
  SH:     { name: "Somenifati Hia",                             titles: [], serviceHistory: [{ ministryId: "sinode-gkpb", from: "2016", until: "Sekarang" }] },
  FPP:    { name: "Fajar Pratama Putra",                        titles: [], serviceHistory: [{ ministryId: "sinode-gkpb", from: "2020", until: "Sekarang" }] },
  A3P:    { name: "Anak Agung Ayu Perani",                      titles: [], serviceHistory: [{ ministryId: "sinode-gkpb", from: "2014", until: "Sekarang" }] },
  DEAP:   { name: "Dewa Gede Adi Pranata",                      titles: [], serviceHistory: [{ ministryId: "sinode-gkpb", from: "2022", until: "Sekarang" }] },
  MHS:    { name: "Merry Handayani Sayuna",                     titles: [], serviceHistory: [{ ministryId: "sinode-gkpb", from: "2019", until: "Sekarang" }] },
  FAO:    { name: "Finsensius Apola Oematan",                   titles: [], serviceHistory: [{ ministryId: "sinode-gkpb", from: "2021", until: "Sekarang" }] },
  YDS:    { name: "Yosef Destian Setiawan",                     titles: [], serviceHistory: [{ ministryId: "sinode-gkpb", from: "2023", until: "Sekarang" }] },
  JVS:    { name: "Gd Jesico Valerius Sasmita",                 titles: [], serviceHistory: [{ ministryId: "sinode-gkpb", from: "2022", until: "Sekarang" }] },
  AS:     { name: "Nyoman Ayu Suryantininghati",                titles: [], serviceHistory: [{ ministryId: "sinode-gkpb", from: "2018", until: "Sekarang" }] },
  GAKLIE: { name: "Gusti Ayu Ketut Lintang Indah Esterlita",    titles: [], serviceHistory: [{ ministryId: "sinode-gkpb", from: "2020", until: "Sekarang" }] },
  AEPTB:  { name: "Anggrayni Eka Putri Tresna Bunga",           titles: [], serviceHistory: [{ ministryId: "sinode-gkpb", from: "2021", until: "Sekarang" }] },
}
