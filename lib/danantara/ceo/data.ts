import { rankBumn, rankIssues, sentimentBreakdown } from "./engine";
import type { BumnSentiment, CeoIssue, CeoState, EscalationArc, IssueCategory, IssueHeadline } from "./types";

/** Wall-clock between simulation ticks (ms). */
export const TICK_MS = 4_000;
/** Spotlight rotation interval (ms). */
export const SPOTLIGHT_MS = 10_000;
/** Breaking takeover display duration (ms). */
export const TAKEOVER_MS = 5_000;

/* ----------------------------- 20 BUMN ----------------------------- */

type BumnSeed = Omit<BumnSentiment, "trend" | "rankHistory" | "rankDelta" | "posMentions" | "negMentions">;

const BUMN_SEEDS: BumnSeed[] = [
  { id: "garuda", name: "Garuda Indonesia", short: "GIAA", sector: "infrastruktur", sentiment: -52, mentions: 8400, topIssueId: "isu-garuda" },
  { id: "waskita", name: "Waskita Karya", short: "WSKT", sector: "infrastruktur", sentiment: -45, mentions: 5200, topIssueId: "isu-karya" },
  { id: "wika", name: "Wijaya Karya", short: "WIKA", sector: "infrastruktur", sentiment: -38, mentions: 4100, topIssueId: "isu-karya" },
  { id: "pln", name: "PLN", short: "PLN", sector: "energi", sentiment: -24, mentions: 11200, topIssueId: "isu-tarif-listrik" },
  { id: "bulog", name: "Perum Bulog", short: "Bulog", sector: "pangan", sentiment: -18, mentions: 6800, topIssueId: "isu-pangan" },
  { id: "krakatau", name: "Krakatau Steel", short: "KRAS", sector: "industri", sentiment: -16, mentions: 2100, topIssueId: "isu-phk" },
  { id: "pertamina", name: "Pertamina", short: "Pertamina", sector: "energi", sentiment: -12, mentions: 14600, topIssueId: "isu-bbm" },
  { id: "kai", name: "Kereta Api Indonesia", short: "KAI", sector: "infrastruktur", sentiment: -4, mentions: 5400, topIssueId: "isu-transportasi" },
  { id: "pelindo", name: "Pelindo", short: "Pelindo", sector: "infrastruktur", sentiment: 2, mentions: 2900, topIssueId: "isu-logistik" },
  { id: "ptba", name: "Bukit Asam", short: "PTBA", sector: "mineral", sentiment: 4, mentions: 1900, topIssueId: "isu-transisi-energi" },
  { id: "pupuk", name: "Pupuk Indonesia", short: "Pupuk", sector: "pangan", sentiment: 8, mentions: 3100, topIssueId: "isu-pangan" },
  { id: "injourney", name: "InJourney", short: "InJourney", sector: "infrastruktur", sentiment: 12, mentions: 2400, topIssueId: "isu-pariwisata" },
  { id: "biofarma", name: "Bio Farma", short: "Bio Farma", sector: "industri", sentiment: 14, mentions: 1600, topIssueId: "isu-kesehatan" },
  { id: "jasamarga", name: "Jasa Marga", short: "JSMR", sector: "infrastruktur", sentiment: 16, mentions: 2800, topIssueId: "isu-transportasi" },
  { id: "semen", name: "Semen Indonesia", short: "SMGR", sector: "industri", sentiment: 18, mentions: 1700, topIssueId: "isu-merger-karya" },
  { id: "antam", name: "Aneka Tambang", short: "ANTM", sector: "mineral", sentiment: 22, mentions: 4800, topIssueId: "isu-hilirisasi" },
  { id: "mindid", name: "MIND ID", short: "MIND ID", sector: "mineral", sentiment: 26, mentions: 5600, topIssueId: "isu-hilirisasi" },
  { id: "telkom", name: "Telkom Indonesia", short: "TLKM", sector: "telko", sentiment: 31, mentions: 7200, topIssueId: "isu-digital" },
  { id: "mandiri", name: "Bank Mandiri", short: "BMRI", sector: "perbankan", sentiment: 38, mentions: 6300, topIssueId: "isu-dividen" },
  { id: "bri", name: "Bank Rakyat Indonesia", short: "BBRI", sector: "perbankan", sentiment: 42, mentions: 9100, topIssueId: "isu-dividen" },
];

/* ----------------------------- 20 issues ----------------------------- */

interface IssueSeed {
  id: string;
  title: string;
  category: IssueCategory;
  relatedBumn: string[];
  mentions: number;
  reach: number;
  sentiment: number;
  headlines: IssueHeadline[];
  aiLine: string;
}

const ISSUE_SEEDS: IssueSeed[] = [
  {
    id: "isu-tata-kelola",
    title: "Transparansi & tata kelola dana kelolaan",
    category: "tata-kelola",
    relatedBumn: ["pertamina", "pln", "bri"],
    mentions: 12400,
    reach: 52_000_000,
    sentiment: -42,
    headlines: [
      { source: "Tempo", title: "DPR minta kerangka audit Danantara diperjelas", time: "1 jam lalu" },
      { source: "Kompas", title: "Ekonom soroti keterbukaan laporan kinerja portofolio", time: "3 jam lalu" },
      { source: "X", title: "Thread viral: kemana laporan keuangan Danantara?", time: "5 jam lalu" },
    ],
    aiLine: "Isu dengan jangkauan terbesar — didorong pernyataan anggota DPR dan thread viral; perlu respons keterbukaan data.",
  },
  {
    id: "isu-independensi",
    title: "Independensi dari intervensi politik",
    category: "tata-kelola",
    relatedBumn: ["pertamina", "mandiri", "bri"],
    mentions: 9800,
    reach: 44_000_000,
    sentiment: -48,
    headlines: [
      { source: "Kompas", title: "Pengamat: keputusan investasi harus bebas kepentingan politik", time: "2 jam lalu" },
      { source: "CNBC Indonesia", title: "Pasar menunggu sinyal independensi pengelolaan dana", time: "4 jam lalu" },
    ],
    aiLine: "Narasi politisasi menyebar di akun-akun ekonomi; sentimen sangat negatif namun velocity masih normal.",
  },
  {
    id: "isu-dividen",
    title: "Konsolidasi dividen BUMN ke Danantara",
    category: "kebijakan",
    relatedBumn: ["bri", "mandiri", "telkom"],
    mentions: 8900,
    reach: 38_000_000,
    sentiment: -8,
    headlines: [
      { source: "Bisnis Indonesia", title: "Skema setoran dividen BUMN ke dana kelolaan dipertanyakan DPR", time: "2 jam lalu" },
      { source: "Kontan", title: "Dividen jumbo bank Himbara jadi tulang punggung Danantara", time: "6 jam lalu" },
    ],
    aiLine: "Perdebatan kebijakan fiskal — media bisnis netral, media politik kritis. Sentimen campuran.",
  },
  {
    id: "isu-hilirisasi",
    title: "Hilirisasi nikel & investasi smelter",
    category: "investasi",
    relatedBumn: ["mindid", "antam"],
    mentions: 7800,
    reach: 34_000_000,
    sentiment: 22,
    headlines: [
      { source: "CNBC Indonesia", title: "Danantara siapkan pendanaan smelter generasi kedua", time: "1 jam lalu" },
      { source: "Reuters", title: "Indonesia courts foreign partners for nickel downstream push", time: "4 jam lalu" },
    ],
    aiLine: "Isu positif terbesar — momentum hilirisasi bisa jadi narasi tandingan untuk isu tata kelola.",
  },
  {
    id: "isu-investasi-asing",
    title: "Kemitraan investor asing & sovereign fund",
    category: "investasi",
    relatedBumn: ["mindid", "pertamina", "pelindo"],
    mentions: 6900,
    reach: 31_000_000,
    sentiment: 18,
    headlines: [
      { source: "Bloomberg", title: "Gulf funds eye co-investment with Danantara", time: "3 jam lalu" },
      { source: "Detik", title: "Danantara jajaki kemitraan dana Timur Tengah", time: "5 jam lalu" },
    ],
    aiLine: "Liputan internasional positif; di dalam negeri muncul kekhawatiran 'penjualan aset' yang perlu diluruskan.",
  },
  {
    id: "isu-garuda",
    title: "Restrukturisasi & layanan Garuda Indonesia",
    category: "pasar",
    relatedBumn: ["garuda", "injourney"],
    mentions: 8200,
    reach: 29_000_000,
    sentiment: -55,
    headlines: [
      { source: "TikTok", title: "Video keluhan delay Garuda tembus 2 juta views", time: "4 jam lalu" },
      { source: "Detik", title: "Garuda kembali rugi; suntikan modal dipertanyakan", time: "7 jam lalu" },
    ],
    aiLine: "Sentimen terburuk di portofolio — keluhan layanan viral menyeret diskusi suntikan modal.",
  },
  {
    id: "isu-bbm",
    title: "Subsidi & ketahanan stok BBM Pertamina",
    category: "kebijakan",
    relatedBumn: ["pertamina"],
    mentions: 10800,
    reach: 27_000_000,
    sentiment: -20,
    headlines: [
      { source: "Kompas", title: "Impor BBM dan beban subsidi kembali jadi sorotan", time: "2 jam lalu" },
      { source: "X", title: "Antrean SPBU di beberapa daerah ramai diperbincangkan", time: "5 jam lalu" },
    ],
    aiLine: "Volume sebutan tertinggi kedua; sensitif terhadap harga minyak dunia dan kurs rupiah.",
  },
  {
    id: "isu-karya",
    title: "Restrukturisasi utang BUMN Karya",
    category: "pasar",
    relatedBumn: ["waskita", "wika"],
    mentions: 5600,
    reach: 24_000_000,
    sentiment: -44,
    headlines: [
      { source: "Kontan", title: "Skema penyehatan Waskita-WIKA menunggu keputusan Danantara", time: "3 jam lalu" },
      { source: "Bisnis Indonesia", title: "Kreditur menanti kejelasan restrukturisasi BUMN karya", time: "8 jam lalu" },
    ],
    aiLine: "Isu warisan dengan risiko kredit; pasar menunggu sinyal keputusan dari Danantara.",
  },
  {
    id: "isu-tarif-listrik",
    title: "Tarif listrik & beban subsidi PLN",
    category: "kebijakan",
    relatedBumn: ["pln"],
    mentions: 7400,
    reach: 23_000_000,
    sentiment: -26,
    headlines: [
      { source: "Detik", title: "Wacana penyesuaian tarif listrik non-subsidi mencuat", time: "4 jam lalu" },
      { source: "Kompas", title: "PLN tanggung beban oversupply listrik Jawa-Bali", time: "9 jam lalu" },
    ],
    aiLine: "Isu yang langsung menyentuh publik luas; berpotensi viral cepat bila ada kenaikan tarif.",
  },
  {
    id: "isu-phk",
    title: "Efisiensi & isu PHK karyawan BUMN",
    category: "sosial",
    relatedBumn: ["garuda", "waskita", "krakatau"],
    mentions: 4800,
    reach: 21_000_000,
    sentiment: -50,
    headlines: [
      { source: "CNN Indonesia", title: "Serikat pekerja tolak rencana efisiensi pasca-konsolidasi", time: "5 jam lalu" },
      { source: "X", title: "Tagar #SaveKaryawanBUMN sempat trending", time: "8 jam lalu" },
    ],
    aiLine: "Isu sosial paling sensitif — keterlibatan serikat pekerja membuat velocity bisa melonjak mendadak.",
  },
  {
    id: "isu-apbn",
    title: "Kontribusi Danantara terhadap APBN",
    category: "kebijakan",
    relatedBumn: ["bri", "mandiri", "pertamina", "telkom"],
    mentions: 5200,
    reach: 19_000_000,
    sentiment: -6,
    headlines: [
      { source: "Kontan", title: "Kemenkeu hitung ulang setoran BUMN pasca-Danantara", time: "6 jam lalu" },
      { source: "Bisnis Indonesia", title: "Target dividen negara vs reinvestasi dana kelolaan", time: "10 jam lalu" },
    ],
    aiLine: "Perdebatan teknis fiskal; audiens terbatas pada media ekonomi namun penting bagi kredibilitas.",
  },
  {
    id: "isu-pangan",
    title: "Ketahanan pangan & peran Bulog-Pupuk",
    category: "kebijakan",
    relatedBumn: ["bulog", "pupuk"],
    mentions: 6100,
    reach: 18_000_000,
    sentiment: -14,
    headlines: [
      { source: "Kompas", title: "Stok beras nasional dan peran Bulog dalam stabilisasi harga", time: "3 jam lalu" },
      { source: "Detik", title: "Distribusi pupuk subsidi masih timpang di beberapa provinsi", time: "7 jam lalu" },
    ],
    aiLine: "Isu musiman yang menguat menjelang masa tanam; sensitif secara politik.",
  },
  {
    id: "isu-digital",
    title: "Transformasi digital & kinerja Telkom",
    category: "pasar",
    relatedBumn: ["telkom"],
    mentions: 4200,
    reach: 16_000_000,
    sentiment: 28,
    headlines: [
      { source: "CNBC Indonesia", title: "Telkom genjot bisnis data center untuk topang valuasi", time: "4 jam lalu" },
      { source: "Kontan", title: "Mitratel jadi penopang pertumbuhan grup Telkom", time: "9 jam lalu" },
    ],
    aiLine: "Narasi pertumbuhan digital yang positif dan stabil; aset komunikasi yang baik untuk Danantara.",
  },
  {
    id: "isu-transisi-energi",
    title: "Transisi energi & pensiun dini PLTU",
    category: "investasi",
    relatedBumn: ["pln", "ptba", "pertamina"],
    mentions: 3900,
    reach: 15_000_000,
    sentiment: 12,
    headlines: [
      { source: "Reuters", title: "Indonesia explores early coal retirement funding via JETP", time: "5 jam lalu" },
      { source: "Kompas", title: "Danantara diminta pimpin pendanaan transisi energi", time: "11 jam lalu" },
    ],
    aiLine: "Isu strategis jangka panjang; LSM lingkungan mulai menyorot kecepatan eksekusi.",
  },
  {
    id: "isu-merger-karya",
    title: "Wacana merger & konsolidasi BUMN konstruksi",
    category: "tata-kelola",
    relatedBumn: ["waskita", "wika", "semen"],
    mentions: 3600,
    reach: 14_000_000,
    sentiment: -10,
    headlines: [
      { source: "Bisnis Indonesia", title: "Peta jalan konsolidasi BUMN karya disiapkan", time: "6 jam lalu" },
      { source: "Kontan", title: "Analis: merger karya butuh keputusan cepat Danantara", time: "12 jam lalu" },
    ],
    aiLine: "Pasar menunggu kepastian; ketidakjelasan berkepanjangan akan menekan sentimen sektor infrastruktur.",
  },
  {
    id: "isu-direksi",
    title: "Penunjukan direksi & komisaris BUMN",
    category: "tata-kelola",
    relatedBumn: ["pertamina", "pln", "bri", "garuda"],
    mentions: 4500,
    reach: 13_000_000,
    sentiment: -32,
    headlines: [
      { source: "Tempo", title: "Sorotan rangkap jabatan komisaris di BUMN besar", time: "4 jam lalu" },
      { source: "X", title: "Daftar komisaris baru jadi perdebatan warganet", time: "7 jam lalu" },
    ],
    aiLine: "Isu klasik yang selalu kambuh tiap pergantian pejabat; mudah dipolitisasi.",
  },
  {
    id: "isu-transportasi",
    title: "Integrasi transportasi publik KAI-Jasa Marga",
    category: "investasi",
    relatedBumn: ["kai", "jasamarga"],
    mentions: 3200,
    reach: 12_000_000,
    sentiment: 24,
    headlines: [
      { source: "Detik", title: "Penumpang KAI tembus rekor; okupansi Whoosh stabil", time: "5 jam lalu" },
      { source: "Kompas", title: "Skema pendanaan perpanjangan tol trans-Jawa disiapkan", time: "10 jam lalu" },
    ],
    aiLine: "Kinerja operasional positif; aset cerita keberhasilan yang layak diangkat lebih sering.",
  },
  {
    id: "isu-logistik",
    title: "Efisiensi logistik & kinerja Pelindo",
    category: "pasar",
    relatedBumn: ["pelindo"],
    mentions: 2400,
    reach: 9_000_000,
    sentiment: 8,
    headlines: [
      { source: "Bisnis Indonesia", title: "Dwelling time pelabuhan utama membaik pasca-merger Pelindo", time: "8 jam lalu" },
      { source: "Kontan", title: "Pelindo siapkan ekspansi pelabuhan hub internasional", time: "13 jam lalu" },
    ],
    aiLine: "Isu teknis dengan audiens terbatas; tren membaik secara konsisten.",
  },
  {
    id: "isu-pariwisata",
    title: "Pemulihan pariwisata & aset InJourney",
    category: "pasar",
    relatedBumn: ["injourney", "garuda"],
    mentions: 2100,
    reach: 8_000_000,
    sentiment: 30,
    headlines: [
      { source: "Detik", title: "Kunjungan wisman naik; okupansi hotel BUMN membaik", time: "6 jam lalu" },
      { source: "Kompas", title: "InJourney benahi tata kelola destinasi prioritas", time: "14 jam lalu" },
    ],
    aiLine: "Sentimen paling positif di portofolio; cerita pemulihan yang kuat.",
  },
  {
    id: "isu-kesehatan",
    title: "Kemandirian farmasi & vaksin Bio Farma",
    category: "investasi",
    relatedBumn: ["biofarma"],
    mentions: 1800,
    reach: 7_000_000,
    sentiment: 20,
    headlines: [
      { source: "Kompas", title: "Bio Farma perluas ekspor vaksin ke pasar OKI", time: "9 jam lalu" },
      { source: "CNBC Indonesia", title: "Kemandirian bahan baku obat masih jadi PR besar", time: "15 jam lalu" },
    ],
    aiLine: "Isu positif bervolume kecil; potensi narasi kemandirian kesehatan nasional.",
  },
];

/* ----------------------------- assembly ----------------------------- */

/** Build an issue's initial flat history so velocity starts ≈ 0 (status normal). */
function flatHistory(mentions: number, n = 8): number[] {
  return Array.from({ length: n }, () => mentions);
}

/** Initial board state: 20 issues + 20 BUMN, ranked, all calm. */
export function buildInitialState(): CeoState {
  const rawIssues: CeoIssue[] = ISSUE_SEEDS.map((seed) => ({
    ...seed,
    history: flatHistory(seed.mentions),
    velocity: 0,
    status: "normal" as const,
    rankHistory: [],
    rankDelta: 0,
    posMentions: 0,
    negMentions: 0,
  }));

  const issues = rankIssues(rawIssues).map((issue, idx) => {
    const { pos, neg } = sentimentBreakdown(issue.sentiment, issue.mentions);
    return {
      ...issue,
      rankHistory: Array.from({ length: 8 }, () => idx + 1), // flat: starts with zero movement
      rankDelta: 0,
      posMentions: pos,
      negMentions: neg,
    };
  });

  const rawBumn: BumnSentiment[] = BUMN_SEEDS.map((seed) => ({
    ...seed,
    trend: Array.from({ length: 8 }, () => seed.sentiment),
    rankHistory: [],
    rankDelta: 0,
    posMentions: 0,
    negMentions: 0,
  }));

  const bumn = rankBumn(rawBumn).map((row, idx) => {
    const { pos, neg } = sentimentBreakdown(row.sentiment, row.mentions);
    return {
      ...row,
      rankHistory: Array.from({ length: 8 }, () => idx + 1),
      rankDelta: 0,
      posMentions: pos,
      negMentions: neg,
    };
  });

  return { tickCount: 0, issues, bumn };
}

/**
 * Scripted escalation arcs (AC5): the first fires ~60 s after load (tick 15 ×
 * 4 s) on the workforce/PHK issue (reach 21M > 5M floor); a second fires ~4 min
 * in on the Garuda issue. A demo must never depend on luck.
 */
export const DEMO_ARCS: EscalationArc[] = [
  { issueId: "isu-phk", atTick: 15, rampTicks: 5, growthPerTick: 0.45 },
  { issueId: "isu-garuda", atTick: 60, rampTicks: 5, growthPerTick: 0.5 },
];
