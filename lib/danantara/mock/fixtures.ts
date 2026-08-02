/**
 * `/danantara` demo fixtures (A7 v50.1) — a production-safe stand-in for the live
 * Danantara topics feed while the garudaperkasa (opengate) key is being renewed.
 *
 * Served via the `/api/v1/danantara/topics` `?mock=1` branch for the **Danantara**
 * product (i.e. NOT `?bgn=1` — `/bgn/command` keeps its own `lib/bgn/mock` fixtures).
 * `/danantara` opts in only when `DANANTARA_DEMO_MOCK=1`, so with the flag unset the
 * page is byte-identical to the live path. Remove the flag (and, later, this module +
 * the route branch) when the feed is live again.
 *
 * Built the same way as the BGN fixtures: the client-supplied topics are shaped as a
 * raw upstream `TopicsApiResponse` and run through the real `mapTopicsResponse`, so the
 * exported object matches a live route response exactly (issues ranked/ided by reach,
 * `category` inferred from the title, pos/neg counts derived from the sentiment split).
 * The source data lives in `./danantara-topics.json` — edit that to refresh the demo.
 */

import { getBumn } from "@/lib/bumn/registry";
import { buildBumnRow } from "@/lib/danantara/ceo/bumn-board";
import { mapTopicsResponse, type TopicsApiResponse } from "@/lib/danantara/ceo/topics-source";
import type { BumnSentiment, CeoIssue } from "@/lib/danantara/ceo/types";
import type { FeedResult } from "@/lib/danantara/topics-feed";
import raw from "./danantara-topics.json";

/** Net sentiment (−100..100) → the upstream's categorical label. Cosmetic: the mapper
 * derives the actual numbers from `stats_sentiment`, not from this string. */
function toneOf(net: number): string {
  if (net > 10) return "positive";
  if (net < -10) return "negative";
  return "neutral";
}

/** The client's mapped topics, reshaped back into a raw upstream payload so the real
 * mapper produces the exported fixture — no hand-authored `CeoIssue` fields to drift. */
const RAW_DANANTARA_TOPICS: TopicsApiResponse = {
  success: true,
  status_code: 200,
  meta: raw.meta,
  data: {
    topics: raw.issues.map((i) => ({
      topik: i.title,
      impressions: i.mentions,
      reach: i.reach,
      sentiment: toneOf(i.sentiment),
      stats_sentiment: i.sentimentBreakdown,
      penjelasan: i.aiLine,
    })),
    summary: raw.summary,
    intent: raw.intent,
  },
};

export type MockDanantaraTopics = FeedResult;

export const MOCK_DANANTARA_TOPICS: MockDanantaraTopics = {
  ...mapTopicsResponse(RAW_DANANTARA_TOPICS),
  meta: RAW_DANANTARA_TOPICS.meta,
};

/* ------------------------------ bumn board ----------------------------- */

/**
 * The BUMN sentiment board (`/api/v1/danantara/bumn-board`) demo fixture — the **top 8
 * BUMN** by public profile. Each BUMN's leading negative + positive topic is drawn from
 * REAL, most-recent (late-Jul/early-Aug 2026) discourse (X/social + Indonesian news,
 * researched per BUMN): the titles and AI lines reflect genuine recent events, and the
 * per-topic + overall sentiment splits reflect the real tone. Each row is built through
 * the live `buildBumnRow`, so it matches a real board response; the CEO wall then ranks
 * the rows by negative reach.
 *
 * `id` is the BUMN slug, so `/public/bumn/{id}.png` supplies the logo. `reach` is set per
 * real-world prominence, so the loudest crises (the Pertamina fuel shortage, PLN's
 * Kalimantan blackouts) float to the top of the board. To refresh the demo, edit below.
 */
type Sent = { positive: number; negative: number; neutral: number };
type ResearchTopic = Sent & { title: string; aiLine: string };
interface BumnResearch {
  slug: string;
  reach: number;
  overall: Sent;
  neg: ResearchTopic;
  pos: ResearchTopic;
}

const BUMN_RESEARCH: BumnResearch[] = [
  {
    slug: "pertamina",
    reach: 9_840_000,
    overall: { positive: 24, negative: 54, neutral: 22 },
    neg: { title: "Kelangkaan BBM subsidi picu antrean panjang di SPBU Sumatra", aiLine: "Antrean solar dan Pertalite mengular di Sumatra sejak pertengahan Juli 2026 akibat gangguan distribusi dan PHK sopir tangki; warganet marah dan seorang warga dilaporkan meninggal saat mengantre BBM.", positive: 5, negative: 85, neutral: 10 },
    pos: { title: "Harga Pertamax cs turun mulai 1 Agustus 2026", aiLine: "Pertamina Patra Niaga menurunkan harga Pertamax Series per 1 Agustus 2026; Pertamax RON 92 turun ke Rp15.950 dan Pertamax Turbo ke Rp18.300, disambut positif konsumen saat tren harga minyak dunia melandai.", positive: 66, negative: 14, neutral: 20 },
  },
  {
    slug: "mandiri",
    reach: 9_020_000,
    overall: { positive: 42, negative: 33, neutral: 25 },
    neg: { title: "Saham BMRI anjlok usai rilis kinerja, pasar cemas margin menyusut", aiLine: "Meski laba semester I-2026 rekor, saham BMRI justru anjlok ~5,7% sehari dan ~7,8% sepekan (24 Juli 2026), terdalam di antara bank besar. Pasar cemas margin bunga (NIM) menyusut dan pendapatan bunga bersih turun 7,8% yoy.", positive: 16, negative: 60, neutral: 24 },
    pos: { title: "Laba Bank Mandiri cetak rekor Rp30,4 T di semester I-2026", aiLine: "Bank Mandiri (BMRI) membukukan laba bersih Rp30,4 triliun pada semester I-2026, naik 24,4% yoy, ditopang kredit tumbuh 19,9% dan NPL membaik ke 0,98%. Analis mayoritas tetap merekomendasikan beli dengan target harga di atas Rp5.400.", positive: 80, negative: 7, neutral: 13 },
  },
  {
    slug: "bri",
    reach: 8_510_000,
    overall: { positive: 45, negative: 33, neutral: 22 },
    neg: { title: "Biaya admin naik & saldo diam-diam terpotong, nasabah BRI mengeluh", aiLine: "Warganet ramai mengeluh saldo BRImo tergerus potongan tak kasat mata, diperparah kenaikan biaya admin Simpedes jadi Rp6.500. Banyak merasa saldo berkurang tanpa notifikasi tiap potongan admin, transfer, dan auto debit.", positive: 7, negative: 76, neutral: 17 },
    pos: { title: "UMKM binaan BRI go global, tenun Troso Jepara tembus pasar dunia", aiLine: "Lewat pemberdayaan Rumah BUMN BRI, UMKM tenun Troso KAINRATU asal Jepara naik kelas dan menembus pasar global. Kisah UMKM go global ini ramai diapresiasi sebagai bukti nyata BRI menopang ekonomi rakyat dan ekspor produk lokal.", positive: 85, negative: 5, neutral: 10 },
  },
  {
    slug: "pln",
    reach: 8_120_000,
    overall: { positive: 30, negative: 48, neutral: 22 },
    neg: { title: "Pemadaman bergilir Kalsel-Kalteng bikin warga gerah hingga September", aiLine: "Kerusakan sejumlah pembangkit di Kalsel-Kalteng memicu pemadaman bergilir berlarut yang diperkirakan pulih baru 6 September. Warga marah: usaha terganggu dan ribuan ayam mati kepanasan; Ombudsman pun minta penjelasan PLN.", positive: 6, negative: 81, neutral: 13 },
    pos: { title: "Prabowo bakal resmikan listrik 1.400 desa jelang HUT RI", aiLine: "Menteri ESDM Bahlil memastikan Presiden Prabowo meresmikan program listrik desa di 1.400+ lokasi yang rampung sebelum 14 Agustus. Program ini dipuji memeratakan akses energi ke desa yang belum teraliri listrik.", positive: 83, negative: 6, neutral: 11 },
  },
  {
    slug: "telkom",
    reach: 7_180_000,
    overall: { positive: 36, negative: 40, neutral: 24 },
    neg: { title: "Keluhan layanan buruk IndiHome membanjiri Media Konsumen", aiLine: "Sepanjang paruh kedua Juli 2026, surat pembaca di Media Konsumen mengeluhkan internet IndiHome mati berhari-hari (LOS merah sejak 13 Juli), downgrade & pasang baru tak diproses, serta respons CS lambat tanpa kompensasi.", positive: 9, negative: 76, neutral: 15 },
    pos: { title: "Telkom raih Lestari Award 2026 untuk pengembangan talenta digital", aiLine: "Pada 28 Juli 2026, Telkom meraih Lestari Award 2026 kategori Talent Management lewat program People Development Plan; penghargaan diserahkan Menko AHY. Momentum positif diperkuat saham TLKM yang melonjak 4,3% pada 31 Juli.", positive: 80, negative: 5, neutral: 15 },
  },
  {
    slug: "garudaindonesia",
    reach: 5_270_000,
    overall: { positive: 36, negative: 46, neutral: 18 },
    neg: { title: "Merger Garuda-Pelita dikhawatirkan DPR gerus kinerja Pelita", aiLine: "Rencana konsolidasi Pelita Air ke dalam Garuda menuai kekhawatiran Komisi VI DPR dan warganet bahwa kinerja Pelita yang selama ini sehat justru tergerus beban Garuda; Danantara menegaskan merger tak akan mengganggu kinerja.", positive: 10, negative: 72, neutral: 18 },
    pos: { title: "Garuda Group ekspansi rute, 43 armada Citilink siap terbang lagi", aiLine: "Citilink membuka kembali rute Bandung-Denpasar mulai 17 Agustus 2026 dengan 43 armada siap operasi, disambut positif sebagai bukti nyata kemajuan transformasi dan penguatan Garuda Indonesia Group.", positive: 76, negative: 8, neutral: 16 },
  },
  {
    slug: "bni",
    reach: 4_940_000,
    overall: { positive: 40, negative: 35, neutral: 25 },
    neg: { title: "Dana nasabah dibekukan berbulan-bulan, layanan BNI dikeluhkan", aiLine: "Keluhan soal rekening diblokir dan dana ditahan berbulan-bulan tanpa kejelasan kembali ramai; seorang nasabah mengaku Rp31 juta dibekukan sejak Mei dan CS malah memblokir WhatsApp-nya.", positive: 7, negative: 75, neutral: 18 },
    pos: { title: "Laba BNI semester I-2026 diproyeksi Rp11,1 triliun, tumbuh 9,5%", aiLine: "Jelang rilis laporan akhir Agustus, analis Maybank Sekuritas memproyeksikan laba bersih BNI semester I-2026 naik 9,5% jadi Rp11,1 triliun dan pertahankan rekomendasi beli, target Rp4.800.", positive: 74, negative: 9, neutral: 17 },
  },
  {
    slug: "jasamarga",
    reach: 4_360_000,
    overall: { positive: 32, negative: 40, neutral: 28 },
    neg: { title: "Penutupan GT Tomang picu pengalihan arus dan kepadatan arteri", aiLine: "Penutupan sementara Gerbang Tol Tomang di Tol Dalam Kota tiap akhir pekan hingga 9 Agustus 2026 untuk rekonstruksi memaksa pengalihan arus ke jalan arteri, menambah jarak 2-3 km dan memicu keluhan kepadatan di jam sibuk.", positive: 10, negative: 68, neutral: 22 },
    pos: { title: "Tol Jogja-Solo tembus 92%, akses ke GT Kalasan ditarget Agustus 2026", aiLine: "Progres Tol Jogja-Solo (Prambanan-Purwomartani) mencapai sekitar 92% dan ditargetkan tersambung ke Tol Jogja-Bawen serta membuka akses hingga GT Kalasan pada Agustus 2026, disambut antusias warga DIY dan Jawa Tengah.", positive: 76, negative: 8, neutral: 16 },
  },
];

/** One BUMN's researched topics → a real-shaped feed → the same mapper the route uses. */
function feedFromResearch(r: BumnResearch): FeedResult {
  const ti = Math.round(r.reach * 1.6);
  const negShare = 0.58; // the negative topic carries a bit more of the audience than the positive one
  const split = (t: ResearchTopic) => ({ positive: t.positive, negative: t.negative, neutral: t.neutral });
  const rawFeed: TopicsApiResponse = {
    success: true,
    status_code: 200,
    meta: { topic: `danantara_${r.slug}`, startdate: raw.meta.startdate, enddate: raw.meta.enddate },
    data: {
      topics: [
        {
          topik: r.neg.title,
          impressions: Math.round(ti * negShare),
          reach: Math.round(r.reach * negShare),
          sentiment: "negative",
          stats_sentiment: split(r.neg),
          penjelasan: r.neg.aiLine,
        },
        {
          topik: r.pos.title,
          impressions: Math.round(ti * (1 - negShare)),
          reach: Math.round(r.reach * (1 - negShare)),
          sentiment: "positive",
          stats_sentiment: split(r.pos),
          penjelasan: r.pos.aiLine,
        },
      ],
      summary: { total_impressions: ti, total_reach: r.reach, percentage: r.overall },
      intent: [],
    },
  };
  return { ...mapTopicsResponse(rawFeed), meta: rawFeed.meta };
}

const BUMN_ROWS = BUMN_RESEARCH.map((r) => {
  const b = getBumn(r.slug);
  if (!b) throw new Error(`Unknown BUMN slug in demo fixture: ${r.slug}`);
  return buildBumnRow(b, feedFromResearch(r));
});

export type MockDanantaraBumn = { bumn: BumnSentiment[]; issues: CeoIssue[] };

export const MOCK_DANANTARA_BUMN: MockDanantaraBumn = {
  bumn: BUMN_ROWS.map((r) => r.row),
  issues: BUMN_ROWS.flatMap((r) => r.issues),
};
