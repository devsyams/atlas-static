import type { Leader, MarketTickerItem, Prediction } from "@/lib/mbg/types";
import type {
  CapitalMove,
  CrisisSignal,
  DividendContributor,
  HoaxItem,
  Holding,
  MarketQuote,
  MediaActor,
  MediaIntel,
  NarrativeIssue,
  OpsInsight,
  ProjQuarter,
  ReputationFactor,
  ReputationIndex,
  SectorAgg,
  SectorKey,
  SentimentDay,
  SovereignSnapshot,
  StrengthFactor,
  StrengthIndex,
  VoiceShare,
} from "./types";
import { DANANTARA_ACTORS } from "./actors";
import { reputationBand, SECTOR_LABEL, strengthBand } from "./ui";

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const jit = (base: number, spread: number) => base + (Math.random() - 0.5) * 2 * spread;
const r1 = (n: number) => +n.toFixed(1);
const r2 = (n: number) => +n.toFixed(2);

/** Severe-shock magnitude (% market drawdown) applied to a beta-1 asset at stress = 1. */
const SHOCK_MAX = 18;
/** Rupiah depreciation (%) at stress = 1. */
const FX_SHOCK_MAX = 9;

/**
 * The fund's portfolio universe — Indonesia's crown-jewel SOEs. Valuations are
 * plausible public-scale figures (Rp Triliun); listed names map to real IDX
 * tickers. `change_pct` here is a neutral baseline that `buildSnapshot` jitters
 * per read. No internal financials — everything is sourced from public markets.
 */
const UNIVERSE: Omit<Holding, "change_pct" | "ytd_pct">[] = [
  // Perbankan (Himbara)
  { id: "bbri", ticker: "BBRI", name: "Bank Rakyat Indonesia", short: "BBRI", sector: "perbankan", value_t: 1700, listed: true, beta: 1.15, roe: 19, dividend_t: 48, blurb: "Bank mikro terbesar; mesin dividen utama portofolio." },
  { id: "bmri", ticker: "BMRI", name: "Bank Mandiri", short: "BMRI", sector: "perbankan", value_t: 1620, listed: true, beta: 1.1, roe: 21, dividend_t: 45, blurb: "Bank dengan ROE tertinggi di kelompok Himbara." },
  { id: "bbni", ticker: "BBNI", name: "Bank Negara Indonesia", short: "BBNI", sector: "perbankan", value_t: 580, listed: true, beta: 1.2, roe: 15, dividend_t: 16, blurb: "Bank korporasi & wholesale, ekspansi digital (wondr)." },
  { id: "bbtn", ticker: "BBTN", name: "Bank Tabungan Negara", short: "BBTN", sector: "perbankan", value_t: 120, listed: true, beta: 1.3, roe: 11, dividend_t: 4, blurb: "Pembiayaan perumahan rakyat (KPR subsidi)." },
  // Energi
  { id: "ptm", ticker: null, name: "Pertamina (Persero)", short: "Pertamina", sector: "energi", value_t: 3400, listed: false, beta: 0.8, roe: 14, dividend_t: 52, blurb: "Energi & migas terintegrasi; aset terbesar di portofolio." },
  { id: "pln", ticker: null, name: "PLN (Persero)", short: "PLN", sector: "energi", value_t: 2950, listed: false, beta: 0.7, roe: 8, dividend_t: 22, blurb: "Ketenagalistrikan nasional; tulang punggung transisi energi." },
  { id: "pgas", ticker: "PGAS", name: "Perusahaan Gas Negara", short: "PGAS", sector: "energi", value_t: 150, listed: true, beta: 1.0, roe: 12, dividend_t: 7, blurb: "Distribusi & niaga gas bumi (Subholding Gas)." },
  { id: "pgeo", ticker: "PGEO", name: "Pertamina Geothermal", short: "PGEO", sector: "energi", value_t: 110, listed: true, beta: 0.9, roe: 10, dividend_t: 3, blurb: "Panas bumi — kapasitas hijau untuk target NZE." },
  // Telko & Digital
  { id: "tlkm", ticker: "TLKM", name: "Telkom Indonesia", short: "TLKM", sector: "telko", value_t: 450, listed: true, beta: 0.95, roe: 18, dividend_t: 19, blurb: "Konektivitas & data center; eksposur ekonomi digital." },
  // Mineral & Tambang (MIND ID)
  { id: "fcx", ticker: null, name: "Freeport Indonesia (MIND ID)", short: "PT-FI", sector: "mineral", value_t: 1400, listed: false, beta: 1.3, roe: 22, dividend_t: 26, blurb: "Tambang tembaga & emas Grasberg; hilirisasi smelter." },
  { id: "antm", ticker: "ANTM", name: "Aneka Tambang", short: "ANTM", sector: "mineral", value_t: 170, listed: true, beta: 1.4, roe: 13, dividend_t: 5, blurb: "Nikel & emas; ekosistem baterai EV." },
  { id: "ptba", ticker: "PTBA", name: "Bukit Asam", short: "PTBA", sector: "mineral", value_t: 110, listed: true, beta: 1.3, roe: 20, dividend_t: 8, blurb: "Batu bara berdividen tinggi; gasifikasi DME." },
  { id: "tins", ticker: "TINS", name: "Timah", short: "TINS", sector: "mineral", value_t: 45, listed: true, beta: 1.5, roe: 6, dividend_t: 1, blurb: "Produsen timah terintegrasi global." },
  // Infrastruktur & Konstruksi
  { id: "jsmr", ticker: "JSMR", name: "Jasa Marga", short: "JSMR", sector: "infrastruktur", value_t: 140, listed: true, beta: 1.1, roe: 12, dividend_t: 3, blurb: "Operator jalan tol terbesar (Trans-Jawa)." },
  { id: "wika", ticker: "WIKA", name: "Wijaya Karya", short: "WIKA", sector: "infrastruktur", value_t: 28, listed: true, beta: 1.6, roe: 3, dividend_t: 0.2, blurb: "Konstruksi & EPC; tengah restrukturisasi." },
  { id: "ptpp", ticker: "PTPP", name: "PP (Persero)", short: "PTPP", sector: "infrastruktur", value_t: 25, listed: true, beta: 1.5, roe: 4, dividend_t: 0.3, blurb: "Konstruksi gedung & infrastruktur." },
  { id: "adhi", ticker: "ADHI", name: "Adhi Karya", short: "ADHI", sector: "infrastruktur", value_t: 18, listed: true, beta: 1.6, roe: 3, dividend_t: 0.1, blurb: "Konstruksi & LRT; proyek strategis nasional." },
  // Pangan & Konsumer
  { id: "bulog", ticker: null, name: "Perum BULOG", short: "BULOG", sector: "pangan", value_t: 95, listed: false, beta: 0.6, roe: 6, dividend_t: 1, blurb: "Ketahanan pangan & stabilisasi harga beras." },
  { id: "ptpn", ticker: null, name: "PTPN III (Holding Perkebunan)", short: "PTPN", sector: "pangan", value_t: 185, listed: false, beta: 0.7, roe: 9, dividend_t: 4, blurb: "Sawit, karet, tebu; hilirisasi agro." },
  { id: "idfood", ticker: null, name: "ID FOOD (RNI)", short: "ID FOOD", sector: "pangan", value_t: 55, listed: false, beta: 0.7, roe: 5, dividend_t: 0.5, blurb: "Holding pangan: gula, garam, perikanan." },
  // Industri & Logistik
  { id: "smgr", ticker: "SMGR", name: "Semen Indonesia", short: "SMGR", sector: "industri", value_t: 95, listed: true, beta: 1.2, roe: 7, dividend_t: 2, blurb: "Produsen semen terbesar Asia Tenggara." },
  { id: "pelindo", ticker: null, name: "Pelindo (Persero)", short: "Pelindo", sector: "industri", value_t: 340, listed: false, beta: 0.8, roe: 11, dividend_t: 7, blurb: "Operator pelabuhan terintegrasi nasional." },
  { id: "kai", ticker: null, name: "Kereta Api Indonesia", short: "KAI", sector: "industri", value_t: 170, listed: false, beta: 0.8, roe: 9, dividend_t: 2, blurb: "Angkutan rel penumpang & logistik; Whoosh." },
  { id: "injourney", ticker: null, name: "InJourney (Aviata)", short: "InJourney", sector: "industri", value_t: 200, listed: false, beta: 0.9, roe: 7, dividend_t: 1.5, blurb: "Holding bandara & pariwisata (Angkasa Pura)." },
  { id: "giaa", ticker: "GIAA", name: "Garuda Indonesia", short: "GIAA", sector: "industri", value_t: 40, listed: true, beta: 1.7, roe: 2, dividend_t: 0, blurb: "Maskapai nasional; pemulihan pasca-restrukturisasi." },
  { id: "biofarma", ticker: null, name: "Bio Farma (Holding Farmasi)", short: "Bio Farma", sector: "industri", value_t: 140, listed: false, beta: 0.8, roe: 10, dividend_t: 2, blurb: "Vaksin & farmasi; kemandirian kesehatan." },
];

/** Value-weighted average of `pick` across holdings. */
function weighted(holdings: Holding[], pick: (h: Holding) => number): number {
  const tot = holdings.reduce((a, h) => a + h.value_t, 0) || 1;
  return holdings.reduce((a, h) => a + h.value_t * pick(h), 0) / tot;
}

/**
 * Apply a market-shock scenario to the portfolio. Each holding's daily move is
 * pushed by `-SHOCK_MAX * stress * beta` — high-beta cyclicals (mining,
 * construction) fall hardest, defensive utilities least. Pure: drives the hero
 * stress-test scrubber and the recomputed Strength Index. `stress` is 0…1.
 */
export function projectHoldings(holdings: Holding[], stress: number): Holding[] {
  if (stress <= 0) return holdings;
  return holdings.map((h) => ({
    ...h,
    change_pct: r2(h.change_pct - SHOCK_MAX * stress * h.beta),
  }));
}

/** Scenario headline deltas for the stress readout (broad market + FX). */
export function scenarioDeltas(stress: number): { ihsg: number; usdidr: number } {
  return { ihsg: r1(-SHOCK_MAX * stress), usdidr: r1(FX_SHOCK_MAX * stress) };
}

const lastStrengthScore = new Map<string, number>();

/**
 * Composite portfolio-health index from public signals. Starts at 100 and
 * subtracts weighted penalties for profitability headroom, leverage, liquidity,
 * market sentiment, and concentration. Pure given inputs (+ optional prior score
 * for the trend arrow). `stress` 0…1 compresses earnings and is also reflected
 * via the (already shock-adjusted) holdings' market sentiment.
 */
export function computeStrength(
  holdings: Holding[],
  positivity: number,
  prevScore?: number,
  stress = 0,
): StrengthIndex {
  const roeW = weighted(holdings, (h) => h.roe);
  const changeW = weighted(holdings, (h) => h.change_pct);

  const tot = holdings.reduce((a, h) => a + h.value_t, 0) || 1;
  const topWeightPct = (Math.max(...holdings.map((h) => h.value_t)) / tot) * 100;

  const profitabilitas = clamp(18 - roeW + stress * 9, 0, 22);
  const leverage = 8;
  const likuiditas = 4;
  const sentimen = clamp((10 - positivity) * 0.8 + Math.max(0, -changeW) * 2.0, 0, 24);
  const konsentrasi = clamp((topWeightPct - 15) * 0.5, 0, 12);

  const factors: StrengthFactor[] = [
    { key: "profitabilitas", label: "Profitabilitas", penalty: r1(profitabilitas) },
    { key: "leverage", label: "Leverage / Utang", penalty: r1(leverage) },
    { key: "likuiditas", label: "Likuiditas", penalty: r1(likuiditas) },
    { key: "sentimen", label: "Sentimen Pasar", penalty: r1(sentimen) },
    { key: "konsentrasi", label: "Konsentrasi", penalty: r1(konsentrasi) },
  ];

  const score = Math.round(clamp(100 - factors.reduce((a, f) => a + f.penalty, 0), 0, 100));
  const { level, emoji } = strengthBand(score);
  const delta = prevScore == null ? 0 : score - prevScore;
  const trend = delta > 1 ? "up" : delta < -1 ? "down" : "flat";

  const top = [...factors].sort((a, b) => b.penalty - a.penalty)[0];
  const narrative =
    score >= 78
      ? `Portofolio tangguh (${score}/100). Arus dividen kuat & diversifikasi sehat; tidak ada tekanan menonjol.`
      : `Indeks ketahanan ${score}/100 — ${level}. Faktor dominan: ${top.label.toLowerCase()}.`;

  return { score, level, emoji, trend, delta, factors, narrative };
}

function genSpark(end: number, vol: number): number[] {
  const n = 14;
  const out: number[] = [];
  let v = end - jit(0, vol * 4);
  for (let i = 0; i < n; i++) {
    v += jit(0, vol);
    out.push(r2(v));
  }
  out[n - 1] = r2(end);
  return out;
}

function deriveInsight(strength: StrengthIndex, dayChange: number, topMover: Holding, fxWeak: boolean): OpsInsight {
  const dir = dayChange >= 0 ? "menguat" : "melemah";
  const title =
    strength.score >= 78
      ? `Portofolio sovereign solid — NAV ${dir} ${Math.abs(dayChange).toFixed(2)}% hari ini`
      : `Tekanan pada ketahanan portofolio (${strength.level})`;
  const text =
    `Nilai aset kelolaan bergerak ${dayChange >= 0 ? "+" : ""}${dayChange.toFixed(2)}% tertimbang nilai, dipimpin ${topMover.short} (${topMover.change_pct >= 0 ? "+" : ""}${topMover.change_pct.toFixed(2)}%). ` +
    `Faktor risiko teratas: ${[...strength.factors].sort((a, b) => b.penalty - a.penalty)[0].label.toLowerCase()}. ` +
    (fxWeak ? "Pelemahan rupiah menambah tekanan pada emiten dengan utang valas." : "Nilai tukar relatif stabil; eksposur valas terkendali.");
  const action =
    strength.score >= 70
      ? "Pertahankan alokasi inti; percepat hilirisasi mineral & transisi energi selagi neraca kuat."
      : "Prioritaskan likuiditas & lindung nilai valas; tunda belanja modal non-inti hingga sentimen pulih.";
  return { title, text, action };
}

const lastReputationScore = new Map<string, number>();

/** Trailing day labels ("21 Mei") ending today, oldest first. */
function dayLabels(now: Date, n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    out.push(d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }));
  }
  return out;
}

function leader(
  id: string,
  name: string,
  position: string,
  score: number,
  trend: string,
  insight: string,
  pred: Leader["prediction"],
  articles: Leader["recent_articles"],
): Leader {
  return {
    id,
    name,
    position,
    organization: "Danantara Indonesia",
    photo: "",
    sentiment: { score: r1(score), trend, article_count: Math.round(jit(38, 12)) },
    insight,
    prediction: pred,
    recent_articles: articles,
  };
}

/**
 * Media-intelligence layer — narrative, sentiment, stakeholders, actors, crisis
 * & disinformation around Danantara and the BUMN portfolio. Modelled entirely on
 * PUBLIC signals (news, social, official channels). This is the team's core
 * strength and where ~100% of inputs are open-source.
 */
function buildMedia(now: Date, positivity: number): MediaIntel {
  const mentions_24h = Math.round(jit(9100, 700));
  const reach = Math.round(jit(48_000_000, 4_000_000));
  const outlets = Math.round(jit(186, 14));
  const share_negative = r1(clamp(jit(34, 4), 12, 70));

  // 14-day net-sentiment timeline with a mid-window reputational dip + recovery.
  const labels = dayLabels(now, 14);
  const shape = [16, 18, 14, 10, 6, -2, -9, -12, -7, 1, 8, 12, 15, 14];
  const timeline: SentimentDay[] = labels.map((date, i) => {
    const net = Math.round(clamp(shape[i] + jit(0, 2.2), -40, 40));
    const neg = Math.round(clamp(34 - net * 0.55 + jit(0, 2), 8, 64));
    const pos = Math.round(clamp(neg + net, 8, 80));
    const neu = Math.max(0, 100 - pos - neg);
    const marker = i === 7 ? "Sorotan tata kelola" : i === labels.length - 1 ? "Kini" : undefined;
    return { date, pos, neu, neg, net, marker };
  });
  const net_sentiment = timeline[timeline.length - 1].net;

  const issuesRaw: { key: string; label: string; salience: number; sentiment: number; trend: NarrativeIssue["trend"] }[] = [
    { key: "tata-kelola", label: "Tata kelola & transparansi", salience: 88, sentiment: 6.6, trend: "up" },
    { key: "hilirisasi", label: "Hilirisasi & investasi strategis", salience: 74, sentiment: 3.1, trend: "up" },
    { key: "dividen", label: "Dividen & setoran ke negara", salience: 65, sentiment: 2.6, trend: "flat" },
    { key: "independensi", label: "Independensi & politisasi", salience: 58, sentiment: 7.2, trend: "up" },
    { key: "kinerja", label: "Kinerja & imbal hasil", salience: 52, sentiment: 4.0, trend: "flat" },
    { key: "akuntabilitas", label: "Akuntabilitas & pengawasan publik", salience: 44, sentiment: 5.8, trend: "down" },
  ];
  const issTot = issuesRaw.reduce((a, x) => a + x.salience, 0);
  const issues: NarrativeIssue[] = issuesRaw.map((x) => ({
    key: x.key,
    label: x.label,
    salience: Math.round(clamp(x.salience + jit(0, 4), 5, 100)),
    share_pct: r1((x.salience / issTot) * 100),
    sentiment: r1(clamp(x.sentiment + jit(0, 0.4), 0, 10)),
    trend: x.trend,
    delta: Math.round(jit(x.trend === "up" ? 9 : x.trend === "down" ? -7 : 1, 4)),
  }));

  const voiceRaw: { name: string; short: string; weight: number; sentiment: number }[] = [
    { name: "Danantara (korporat)", short: "Danantara", weight: 100, sentiment: 5.6 },
    { name: "Pertamina", short: "Pertamina", weight: 58, sentiment: 5.2 },
    { name: "PLN", short: "PLN", weight: 46, sentiment: 5.0 },
    { name: "MIND ID", short: "MIND ID", weight: 38, sentiment: 4.1 },
    { name: "Bank Rakyat Indonesia", short: "BBRI", weight: 34, sentiment: 3.4 },
    { name: "Garuda Indonesia", short: "GIAA", weight: 28, sentiment: 7.0 },
    { name: "Telkom Indonesia", short: "TLKM", weight: 22, sentiment: 3.6 },
  ];
  const vTot = voiceRaw.reduce((a, x) => a + x.weight, 0);
  const voice: VoiceShare[] = voiceRaw.map((x) => {
    const mentions = Math.round((x.weight / vTot) * mentions_24h * 2.6);
    return {
      name: x.name,
      short: x.short,
      mentions,
      share_pct: r1((x.weight / vTot) * 100),
      sentiment: r1(clamp(x.sentiment + jit(0, 0.4), 0, 10)),
      spark: genSpark(mentions, mentions * 0.06),
    };
  });

  const crisisRaw: Omit<CrisisSignal, "id">[] = [
    { entity: "Danantara", title: "Sorotan transparansi laporan keuangan dana", severity: 6.4, velocity: 184, status: "Naik", source: "Tempo · X", time: "1 jam lalu", detail: "Pertanyaan publik soal kerangka audit & keterbukaan kinerja portofolio meningkat setelah pernyataan anggota DPR.", event_id: "gov_issue" },
    { entity: "Danantara", title: "Isu independensi dari intervensi politik", severity: 5.6, velocity: 132, status: "Naik", source: "Kompas · X", time: "3 jam lalu", detail: "Narasi soal pengaruh politik atas keputusan investasi menyebar di kalangan akun ekonomi.", event_id: "politicization" },
    { entity: "Garuda Indonesia", title: "Keluhan layanan penerbangan viral", severity: 4.2, velocity: 96, status: "Memuncak", source: "TikTok · X", time: "5 jam lalu", detail: "Video keterlambatan & layanan jadi perbincangan; menyeret reputasi portofolio penerbangan.", event_id: "garuda_crisis" },
    { entity: "MIND ID", title: "Sorotan dampak lingkungan smelter", severity: 3.8, velocity: 54, status: "Muncul", source: "Mongabay · berita", time: "8 jam lalu", detail: "Liputan lingkungan atas proyek hilirisasi nikel mulai mendapat perhatian LSM.", event_id: "mindid_env" },
  ];
  const crisis: CrisisSignal[] = crisisRaw.map((c, i) => ({ ...c, id: `SIG-${20 + i}`, severity: r1(clamp(c.severity + jit(0, 0.3), 0, 10)) }));

  const hoaxes: HoaxItem[] = [
    { claim: "“Dana Danantara Rp 1.000 T raib / disalahgunakan”", status: "Terbantahkan", reach: Math.round(jit(2_400_000, 300_000)), platforms: ["X", "WhatsApp", "Facebook"], counter: "Tidak ada dasar; angka tidak sesuai laporan resmi. Klarifikasi telah diterbitkan kanal resmi & media arus utama.", time: "2 jam lalu" },
    { claim: "“Danantara menjual aset negara ke pihak asing”", status: "Menyesatkan", reach: Math.round(jit(1_500_000, 250_000)), platforms: ["X", "TikTok"], counter: "Mencampuradukkan kemitraan investasi dengan penjualan aset; struktur kepemilikan negara tetap mayoritas.", time: "6 jam lalu" },
    { claim: "“Dividen BUMN dialihkan ke proyek tertentu tanpa dasar”", status: "Dalam Verifikasi", reach: Math.round(jit(680_000, 120_000)), platforms: ["X", "Facebook"], counter: "Sedang ditelusuri; alokasi dividen mengacu mekanisme RUPS & APBN. Menunggu konfirmasi dokumen resmi.", time: "11 jam lalu" },
  ];

  const actors: MediaActor[] = DANANTARA_ACTORS;

  const stakeholders: MediaIntel["stakeholders"] = {
    ai_available: true,
    updated_at: now.toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
    leaders: [
      leader(
        "rosan",
        "Rosan Roeslani",
        "Chief Executive Officer",
        4.0,
        "membaik",
        "Sentimen condong positif; framing investor & diplomasi ekonomi mendominasi. Pernyataan soal transparansi diterima baik.",
        { question: "Sentimen tetap positif 30 hari ke depan?", probability: 68, answer_label: "Cenderung Ya", reasoning: "Momentum kunjungan investasi & narasi hilirisasi menutupi isu tata kelola." },
        [
          { title: "Danantara perkuat komitmen transparansi pengelolaan aset", source: "Kompas.com", date: "2026-05-31 09:10", sentiment: 4, crisis_score: 0 },
          { title: "CEO Danantara temui investor strategis bahas hilirisasi", source: "Bisnis.com", date: "2026-05-30 14:20", sentiment: 4, crisis_score: 0 },
        ],
      ),
      leader(
        "pandu",
        "Pandu Sjahrir",
        "Chief Investment Officer",
        3.7,
        "stabil",
        "Diasosiasikan dengan tesis investasi & ekonomi digital; kredibel di komunitas pasar, sesekali jadi sasaran skeptisisme.",
        { question: "Narasi strategi investasi diterima pasar?", probability: 61, answer_label: "Berimbang", reasoning: "Antusiasme hilirisasi diimbangi pertanyaan eksekusi & tata kelola." },
        [
          { title: "CIO Danantara paparkan peta jalan investasi hilirisasi", source: "Katadata", date: "2026-05-30 11:05", sentiment: 4, crisis_score: 0 },
          { title: "Analis cermati strategi alokasi aset Danantara", source: "Kontan", date: "2026-05-29 16:40", sentiment: 3, crisis_score: 1 },
        ],
      ),
      leader(
        "dony",
        "Dony Oskaria",
        "Chief Operating Officer",
        3.4,
        "stabil",
        "Sorotan operasional & konsolidasi BUMN; sentimen netral dengan tekanan saat isu spesifik portofolio (mis. penerbangan) mencuat.",
        { question: "Isu operasional portofolio mereda pekan ini?", probability: 54, answer_label: "Berimbang", reasoning: "Bergantung penanganan keluhan layanan yang sedang viral." },
        [
          { title: "Konsolidasi operasional BUMN dipercepat di bawah Danantara", source: "Antara", date: "2026-05-29 10:15", sentiment: 3, crisis_score: 1 },
        ],
      ),
      leader(
        "muliaman",
        "Muliaman D. Hadad",
        "Ketua Dewan Pengawas",
        3.6,
        "membaik",
        "Figur tata kelola; kehadirannya menenangkan narasi pengawasan. Dikutip dalam konteks manajemen risiko & kepatuhan.",
        { question: "Persepsi pengawasan menguat bulan ini?", probability: 63, answer_label: "Cenderung Ya", reasoning: "Penekanan pada audit & kepatuhan merespons langsung isu transparansi." },
        [
          { title: "Dewan Pengawas tekankan kepatuhan & manajemen risiko", source: "Tempo", date: "2026-05-30 08:30", sentiment: 4, crisis_score: 0 },
        ],
      ),
    ],
  };

  // Reputation Index — composite of the public signals above.
  const sumSeverity = crisis.reduce((a, c) => a + c.severity, 0);
  const crisisLoad = clamp(sumSeverity * 0.42, 0, 16);
  const factors: ReputationFactor[] = [
    { key: "media", label: "Sentimen Media", penalty: r1(clamp((10 - positivity) * 1.4, 0, 18)) },
    { key: "sosial", label: "Sentimen Sosial", penalty: r1(clamp((10 - positivity * 0.95) * 1.2, 0, 16)) },
    { key: "share_negatif", label: "Pangsa Suara Negatif", penalty: r1(clamp((share_negative - 20) * 0.35, 0, 14)) },
    { key: "krisis", label: "Sinyal Krisis", penalty: r1(crisisLoad) },
    { key: "kepercayaan", label: "Kepercayaan Stakeholder", penalty: r1(clamp(jit(5.5, 1), 0, 12)) },
  ];
  const score = Math.round(clamp(100 - factors.reduce((a, f) => a + f.penalty, 0), 0, 100));
  const { level, emoji } = reputationBand(score);
  const prev = lastReputationScore.get("danantara");
  lastReputationScore.set("danantara", score);
  const delta = prev == null ? 0 : score - prev;
  const repTrend = delta > 1 ? "up" : delta < -1 ? "down" : "flat";
  const topIssue = [...issues].sort((a, b) => b.sentiment * b.salience - a.sentiment * a.salience)[0];
  const reputation: ReputationIndex = {
    score,
    level,
    emoji,
    trend: repTrend,
    delta,
    factors,
    narrative:
      score >= 65
        ? `Reputasi terjaga positif (${score}/100). Narasi hilirisasi & dividen mengangkat persepsi; pantau isu "${topIssue.label.toLowerCase()}".`
        : `Indeks reputasi ${score}/100 — ${level}. Tekanan utama dari isu "${topIssue.label.toLowerCase()}" dan pangsa suara negatif ${share_negative}%.`,
  };

  return {
    totals: { mentions_24h, reach, outlets, positivity, net_sentiment, share_negative },
    reputation,
    issues,
    voice,
    timeline,
    stakeholders,
    actors,
    crisis,
    hoaxes,
  };
}

export function buildSnapshot(live?: { ihsg?: MarketTickerItem; usdidr?: MarketTickerItem }): SovereignSnapshot {
  const now = new Date();
  const updated_at = now.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Today's per-holding move: a small market drift + idiosyncratic jitter scaled
  // by beta, so cyclicals swing wider than defensives.
  const drift = jit(0.4, 0.6);
  const holdings: Holding[] = UNIVERSE.map((h) => {
    const change_pct = r2(clamp(drift * h.beta + jit(0, 1.6) * h.beta, -7, 7));
    const ytd_pct = r1(clamp(h.roe * 0.5 + jit(4, 10), -28, 46));
    return { ...h, change_pct, ytd_pct };
  });

  const aum_t = Math.round(holdings.reduce((a, h) => a + h.value_t, 0));
  const day_change_pct = r2(weighted(holdings, (h) => h.change_pct));
  const ytd_return_pct = r1(weighted(holdings, (h) => h.ytd_pct));
  const dividend_total = holdings.reduce((a, h) => a + h.dividend_t, 0);
  const dividend_ytd_t = Math.round(dividend_total * 0.62);
  const listed_count = holdings.filter((h) => h.listed).length;

  // USD/IDR — prefer the live feed for the AUM-in-USD conversion + ticker.
  const usdidrRate = (() => {
    const m = live?.usdidr?.value?.match(/[\d.]+/g);
    if (!m) return 15850;
    const num = parseFloat(m.join("").replace(/\./g, ""));
    return Number.isFinite(num) && num > 1000 ? num : 15850;
  })();
  const aum_usd_b = Math.round((aum_t * 1000) / usdidrRate);

  // Sector rollups.
  const sectorKeys: SectorKey[] = ["perbankan", "energi", "telko", "mineral", "infrastruktur", "pangan", "industri"];
  const sectors: SectorAgg[] = sectorKeys
    .map((key) => {
      const hs = holdings.filter((h) => h.sector === key);
      const value_t = hs.reduce((a, h) => a + h.value_t, 0);
      return {
        key,
        label: SECTOR_LABEL[key],
        value_t,
        change_pct: r2(weighted(hs, (h) => h.change_pct)),
        weight_pct: r1((value_t / aum_t) * 100),
        count: hs.length,
      };
    })
    .sort((a, b) => b.value_t - a.value_t);

  const positivity = r1(clamp(jit(7.2, 0.5), 0, 10));
  const prev = lastStrengthScore.get("danantara");
  const strength = computeStrength(holdings, positivity, prev);
  lastStrengthScore.set("danantara", strength.score);

  const topMover = [...holdings].sort((a, b) => Math.abs(b.change_pct) - Math.abs(a.change_pct))[0];
  const fxDelta = live?.usdidr?.delta ?? r1(jit(0.2, 0.6));
  const insight = deriveInsight(strength, day_change_pct, topMover, fxDelta > 0.5);

  // 6-quarter AUM projection (current + 5 forward).
  const qLabels = quarterLabels(now, 6);
  const projection: ProjQuarter[] = qLabels.map((label, i) => {
    const base = Math.round(aum_t * Math.pow(1.021, i));
    const bull = Math.round(aum_t * Math.pow(1.038, i));
    const marker = i === 0 ? "Kini" : i === qLabels.length - 1 ? "Target" : undefined;
    return { label, base, bull, marker };
  });

  const dividends: DividendContributor[] = [...holdings]
    .sort((a, b) => b.dividend_t - a.dividend_t)
    .slice(0, 6)
    .map((h) => ({
      name: h.name,
      sector: h.sector,
      amount_t: r1(h.dividend_t),
      yield_pct: r1((h.dividend_t / h.value_t) * 100),
    }));

  const ihsgVal = live?.ihsg?.value ?? `${Math.round(jit(7320, 60)).toLocaleString("id-ID")}`;
  const ihsgDelta = live?.ihsg?.delta ?? r1(jit(0.5, 1.1));

  const markets: MarketQuote[] = [
    { key: "ihsg", label: "IHSG", value: ihsgVal, delta: ihsgDelta, spark: genSpark(7320, 22), live: !!live?.ihsg },
    { key: "usdidr", label: "USD/IDR", value: live?.usdidr?.value ?? `Rp ${Math.round(usdidrRate).toLocaleString("id-ID")}`, delta: fxDelta, spark: genSpark(usdidrRate, 35), live: !!live?.usdidr },
    { key: "coal", label: "Batu Bara (Newcastle)", value: `$${Math.round(jit(135, 4))}`, unit: "/t", delta: r1(jit(-0.6, 1.4)), spark: genSpark(135, 2), live: false },
    { key: "nickel", label: "Nikel (LME)", value: `$${Math.round(jit(16800, 240)).toLocaleString("en-US")}`, unit: "/t", delta: r1(jit(0.3, 1.8)), spark: genSpark(16800, 180), live: false },
    { key: "cpo", label: "CPO (Bursa MY)", value: `RM ${Math.round(jit(4180, 60)).toLocaleString("en-US")}`, unit: "/t", delta: r1(jit(0.4, 1.3)), spark: genSpark(4180, 40), live: false },
    { key: "brent", label: "Brent", value: `$${r1(jit(82, 1.2))}`, unit: "/bbl", delta: r1(jit(-0.4, 1.5)), spark: genSpark(82, 1), live: false },
    { key: "gold", label: "Emas", value: `$${Math.round(jit(2650, 18)).toLocaleString("en-US")}`, unit: "/oz", delta: r1(jit(0.5, 0.9)), spark: genSpark(2650, 14), live: false },
    { key: "sun10", label: "SUN 10Y", value: `${r2(jit(6.85, 0.06))}`, unit: "%", delta: r1(jit(0.1, 0.6)), spark: genSpark(6.85, 0.05), live: false },
  ];

  const allocations: CapitalMove[] = [
    {
      id: "CAP-1",
      title: "Akselerasi hilirisasi nikel (MIND ID)",
      thesis: "Bangun rantai nilai baterai EV dari tambang hingga prekursor; tangkap margin hilir & substitusi impor.",
      sector: "mineral",
      capital_t: 85,
      return_pct: 17.5,
      horizon: "4 thn",
      risk: "sedang",
      recommended: true,
    },
    {
      id: "CAP-2",
      title: "Dana transisi energi (PLN & Pertamina NRE)",
      thesis: "Co-investasi geothermal & surya untuk pensiun dini PLTU; buka akses pendanaan hijau global.",
      sector: "energi",
      capital_t: 120,
      return_pct: 11.2,
      horizon: "7 thn",
      risk: "sedang",
      recommended: false,
    },
    {
      id: "CAP-3",
      title: "Optimalkan kas Himbara → buyback selektif",
      thesis: "Bank-bank inti undervalued vs ROE; buyback terukur mengangkat nilai per saham bagi negara.",
      sector: "perbankan",
      capital_t: 30,
      return_pct: 9.4,
      horizon: "18 bln",
      risk: "rendah",
      recommended: false,
    },
    {
      id: "CAP-4",
      title: "Divestasi parsial aset konstruksi non-inti",
      thesis: "Recycle modal dari emiten karya berleverage tinggi ke aset berimbal hasil & dividen lebih kuat.",
      sector: "infrastruktur",
      capital_t: 18,
      return_pct: 6.8,
      horizon: "12 bln",
      risk: "tinggi",
      recommended: false,
    },
  ];

  const predictions: Prediction[] = [
    {
      question: "IHSG ditutup di zona hijau pekan ini?",
      probability: Math.round(jit(63, 6)),
      answer_label: "Cenderung Ya",
      reasoning: "Aliran dana asing kembali masuk; sentimen suku bunga global melonggar mendukung emiten bank berbobot besar.",
      timeframe: "pekan ini",
      tone: "positive",
    },
    {
      question: "USD/IDR tembus 16.300 bulan ini?",
      probability: Math.round(jit(46, 7)),
      answer_label: "Berimbang",
      reasoning: "Tekanan dolar global vs surplus neraca dagang & intervensi BI; volatilitas tinggi menjelang rilis data inflasi AS.",
      timeframe: "bulan ini",
      tone: "neutral",
    },
    {
      question: "Setoran dividen BUMN > Rp 90 T tahun ini?",
      probability: Math.round(jit(71, 5)),
      answer_label: "Cenderung Ya",
      reasoning: "Laba bank Himbara & Pertamina kuat; payout ratio dipertahankan tinggi untuk mendanai program prioritas.",
      timeframe: "TA berjalan",
      tone: "positive",
    },
    {
      question: "AUM Danantara tumbuh > 8% YoY?",
      probability: Math.round(jit(58, 6)),
      answer_label: "Cenderung Ya",
      reasoning: "Reinvestasi dividen + revaluasi aset hilirisasi; bergantung pada realisasi belanja modal & harga komoditas.",
      timeframe: "12 bln",
      tone: "positive",
    },
  ];

  const fxWeak = fxDelta > 0.5;
  const conditions: SovereignSnapshot["conditions"] = [
    { label: "BI-Rate 6,00%", tone: "warn" },
    { label: fxWeak ? "Rupiah tertekan" : "Rupiah stabil", tone: fxWeak ? "bad" : "good" },
    { label: "Hilirisasi berjalan", tone: "good" },
    { label: positivity >= 6.5 ? "Sentimen pasar positif" : "Sentimen pasar hati-hati", tone: positivity >= 6.5 ? "good" : "warn" },
    { label: "Arus dana asing masuk", tone: "good" },
  ];

  const ticker: MarketTickerItem[] = [
    { label: "AUM Kelolaan", value: `Rp ${aum_t.toLocaleString("id-ID")} T` },
    { label: "≈ USD", value: `$${aum_usd_b} B` },
    { label: "NAV hari ini", value: `${day_change_pct >= 0 ? "+" : ""}${day_change_pct}%` },
    { label: "IHSG", value: ihsgVal },
    { label: "USD/IDR", value: markets[1].value, delta: fxDelta },
    { label: "Dividen YTD", value: `Rp ${dividend_ytd_t} T` },
    { label: "Imbal hasil YTD", value: `${ytd_return_pct >= 0 ? "+" : ""}${ytd_return_pct}%` },
    { label: "Ketahanan", value: `${strength.score}/100 ${strength.level}` },
    { label: "Penggerak", value: `${topMover.short} ${topMover.change_pct >= 0 ? "+" : ""}${topMover.change_pct}%` },
  ];

  const social: SovereignSnapshot["social"] = {
    mentions_24h: Math.round(jit(8400, 600)),
    positivity,
    trend: [
      { keyword: "#Danantara", count: 2140, sentiment: "neutral" },
      { keyword: "dividen BUMN", count: 1320, sentiment: "positive" },
      { keyword: "hilirisasi", count: 1180, sentiment: "positive" },
      { keyword: "tata kelola", count: 760, sentiment: "neutral" },
      { keyword: "transparansi", count: 540, sentiment: "negative" },
      { keyword: "IHSG", count: 510, sentiment: "positive" },
      { keyword: "investasi asing", count: 430, sentiment: "positive" },
      { keyword: "rupiah", count: 380, sentiment: "negative" },
    ],
    top_posts: [
      { handle: "@analis_pasar", platform: "X", text: "Setoran dividen bank Himbara ke Danantara tahun ini bisa cetak rekor. Mesin cash flow negara makin solid. #Danantara", sentiment: "positive", engagement: 3200, time: "22 mnt lalu" },
      { handle: "@warga_ekonomi", platform: "X", text: "Yang penting tata kelola & transparansi laporan Danantara dijaga. Aset segede ini harus akuntabel ke publik.", sentiment: "neutral", engagement: 1850, time: "38 mnt lalu" },
      { handle: "@invest_id", platform: "X", text: "Hilirisasi nikel via MIND ID kalau dieksekusi benar bisa jadi mesin pertumbuhan jangka panjang. Optimis. 🚀", sentiment: "positive", engagement: 2410, time: "1 jam lalu" },
    ],
  };

  const news: SovereignSnapshot["news"] = [
    { title: "Danantara bidik dividen BUMN cetak rekor untuk danai program prioritas", source: "Bisnis.com", time: "26 mnt lalu", sentiment: 3, summary: "Setoran dividen bank & energi diproyeksi naik; sebagian direinvestasi ke proyek hilirisasi." },
    { title: "Sovereign wealth fund RI kebut investasi hilirisasi mineral", source: "Kontan", time: "1 jam lalu", sentiment: 3, summary: "MIND ID jadi ujung tombak; menyasar rantai nilai baterai EV terintegrasi." },
    { title: "Rupiah tertekan dolar, emiten berutang valas jadi sorotan", source: "CNBC Indonesia", time: "2 jam lalu", sentiment: 7, summary: "Volatilitas nilai tukar menambah biaya bunga; analis soroti lindung nilai." },
    { title: "Pengamat: kunci Danantara ada di tata kelola & transparansi", source: "Tempo", time: "3 jam lalu", sentiment: 6, summary: "Skala aset besar menuntut audit independen & keterbukaan kinerja portofolio." },
  ];

  const official: SovereignSnapshot["official"] = [
    { time: "14:10", category: "Investasi", title: "Penandatanganan kemitraan hilirisasi mineral", body: "Danantara dan mitra strategis sepakati kerangka co-investasi pengolahan nikel terintegrasi untuk rantai pasok baterai." },
    { time: "11:30", category: "Dividen", title: "Optimalisasi setoran dividen portofolio", body: "Arus dividen dari emiten inti diarahkan mendanai proyek prioritas tanpa membebani APBN." },
    { time: "09:05", category: "Tata Kelola", title: "Penguatan tata kelola & manajemen risiko", body: "Penerapan kerangka manajemen risiko investasi dan pelaporan kinerja berkala kepada publik." },
  ];

  const sources: SovereignSnapshot["sources"] = [
    { name: "Bursa Efek Indonesia (IDX)", type: "bursa", status: live?.ihsg ? "live" : "demo", items_24h: 832, last_sync: live?.ihsg ? "baru saja" : "—" },
    { name: "Kurs Valas (Yahoo Finance)", type: "valas", status: live?.usdidr ? "live" : "demo", items_24h: 288, last_sync: live?.usdidr ? "baru saja" : "—" },
    { name: "Harga Komoditas (global)", type: "komoditas", status: "demo", items_24h: 120, last_sync: "—" },
    { name: "Media Sosial (X API)", type: "medsos", status: "demo", items_24h: social.mentions_24h, last_sync: "—" },
    { name: "Berita Ekonomi (RSS)", type: "berita", status: "demo", items_24h: 64, last_sync: "—" },
    { name: "Kanal Resmi (@danantara_id)", type: "resmi", status: "demo", items_24h: 7, last_sync: "—" },
    { name: "Indikator Makro (BI/BPS)", type: "makro", status: "demo", items_24h: 18, last_sync: "—" },
  ];

  return {
    fund: "Danantara Indonesia",
    updated_at,
    market_source: live?.ihsg || live?.usdidr ? "live" : "synthetic",
    aum_t,
    aum_usd_b,
    day_change_pct,
    ytd_return_pct,
    dividend_ytd_t,
    holdings_count: holdings.length,
    listed_count,
    strength,
    insight,
    conditions,
    predictions,
    ticker,
    holdings,
    sectors,
    allocations,
    markets,
    projection,
    dividends,
    social,
    news,
    official,
    sources,
    media: buildMedia(now, positivity),
  };
}

/** "Q3'25" labels starting at the quarter containing `from`, `n` quarters forward. */
function quarterLabels(from: Date, n: number): string[] {
  let q = Math.floor(from.getMonth() / 3) + 1;
  let y = from.getFullYear() % 100;
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.push(`Q${q}'${String(y).padStart(2, "0")}`);
    q += 1;
    if (q > 4) {
      q = 1;
      y = (y + 1) % 100;
    }
  }
  return out;
}
