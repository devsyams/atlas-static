/**
 * BGN Command Center demo fixtures (A13 v4.0).
 *
 * The garudaperkasa.io upstream that fed `/api/v1/danantara/{topics,threats,
 * actor-intelligence}` is dead (key expired, unrenewable), so `/bgn/command` is
 * served entirely from these fixtures via the routes' `?mock=1` branch — a signal
 * only `/bgn/command` sends, so every other page is untouched.
 *
 * The data is themed to **Badan Gizi Nasional** and its *Makan Bergizi Gratis* (MBG)
 * programme, and it is authored as ONE coherent situation: the loudest negative
 * topic (mass food-poisoning at schools) is also the gate's detected threat, and the
 * accounts driving that threat are the same accounts in the actor roster — so the
 * Crisis Gate, the Issues board, and the War Room all agree. `fixtures.test.ts`
 * guards that cross-consistency.
 *
 * These are built by running BGN-themed **raw upstream payloads** through the very
 * same mappers the live routes use (`mapTopicsResponse` / `mapThreatsResponse` /
 * `mapActorRoster`), so the exported objects match the real route responses exactly
 * and cannot drift from what the panes parse.
 *
 * Reversible: when the new data source lands, drop the `mock` prop on
 * `app/bgn/command/page.tsx` and this module (plus the route branches) can be removed.
 */

import { mapActorRoster, type ActorRosterApiResponse } from "@/lib/danantara/ceo/actor-roster-source";
import {
  mapThreatsResponse,
  type DetectedThreat,
  type ThreatsApiResponse,
  type ThreatDriver,
  type ThreatsStats,
} from "@/lib/danantara/ceo/threats-source";
import { mapTopicsResponse, type TopicsApiResponse } from "@/lib/danantara/ceo/topics-source";
import type { FeedResult } from "@/lib/danantara/topics-feed";

export type MockTopics = FeedResult;
export type MockThreats = { threat: DetectedThreat | null; stats: ThreatsStats };
export type MockActors = { actors: ThreatDriver[] };

/* ------------------------------- topics -------------------------------- */

const RAW_TOPICS: TopicsApiResponse = {
  success: true,
  status_code: 200,
  meta: { topic: "danantara_main", idquery: "mbg-monitoring-01", startdate: "2026-07-25", enddate: "2026-08-01" },
  data: {
    topics: [
      {
        topik: "Keracunan Massal MBG di Sekolah",
        impressions: 2_400_000,
        reach: 1_850_000,
        sentiment: "negative",
        stats_sentiment: { positive: 4, negative: 88, neutral: 8 },
        penjelasan:
          "Ratusan siswa di beberapa daerah dilaporkan keracunan setelah menyantap menu MBG; tagar #MBGRacun viral dan publik menuntut audit keamanan pangan menyeluruh.",
      },
      {
        topik: "Dugaan Penyimpangan Anggaran Program MBG",
        impressions: 1_300_000,
        reach: 980_000,
        sentiment: "negative",
        stats_sentiment: { positive: 6, negative: 74, neutral: 20 },
        penjelasan:
          "Tudingan markup harga dan kejanggalan penunjukan vendor katering memicu sorotan oposisi dan desakan pemeriksaan oleh BPK.",
      },
      {
        topik: "Cakupan MBG Tembus Jutaan Anak",
        impressions: 900_000,
        reach: 720_000,
        sentiment: "positive",
        stats_sentiment: { positive: 74, negative: 8, neutral: 18 },
        penjelasan:
          "Program MBG dilaporkan menjangkau jutaan siswa di puluhan provinsi; capaian ini diapresiasi sebagai perluasan gizi anak terbesar.",
      },
      {
        topik: "Higienitas Dapur SPPG Dipertanyakan",
        impressions: 720_000,
        reach: 540_000,
        sentiment: "negative",
        stats_sentiment: { positive: 9, negative: 69, neutral: 22 },
        penjelasan:
          "Video kondisi dapur Satuan Pelayanan Pemenuhan Gizi (SPPG) yang dinilai tidak higienis beredar luas dan memicu keraguan atas standar produksi makanan.",
      },
      {
        topik: "Keterlambatan & Distribusi MBG Tak Merata",
        impressions: 610_000,
        reach: 470_000,
        sentiment: "negative",
        stats_sentiment: { positive: 12, negative: 58, neutral: 30 },
        penjelasan:
          "Sejumlah sekolah melaporkan makanan datang terlambat atau tidak kebagian, dan porsi yang tidak seragam antar-daerah dikeluhkan orang tua siswa.",
      },
      {
        topik: "Serapan Pangan dari Petani & UMKM Lokal",
        impressions: 480_000,
        reach: 360_000,
        sentiment: "positive",
        stats_sentiment: { positive: 69, negative: 10, neutral: 21 },
        penjelasan:
          "Penyerapan bahan pangan MBG dari petani dan UMKM lokal dinilai menggerakkan ekonomi daerah dan mendapat sambutan positif.",
      },
    ],
    summary: {
      total_impressions: 6_410_000,
      total_reach: 4_920_000,
      percentage: { positive: 26.5, negative: 55.0, neutral: 18.5 },
    },
    intent: [
      { intent: "Tuntutan Audit", deskripsi: "Desakan audit keamanan pangan & anggaran", impressions: 2_100_000, share_of_voice: 33 },
      { intent: "Dukungan Program", deskripsi: "Apresiasi cakupan & serapan lokal", impressions: 1_260_000, share_of_voice: 20 },
    ],
  },
};

const mappedTopics = mapTopicsResponse(RAW_TOPICS);
export const MOCK_TOPICS: MockTopics = { ...mappedTopics, meta: RAW_TOPICS.meta };

/* ------------------------------- threats ------------------------------- */

const RAW_THREATS: ThreatsApiResponse = {
  success: true,
  status_code: 200,
  meta: { topic: "danantara_main" },
  data: {
    stats: { total_threats: 3, high_severity: 1, medium_severity: 2, low_severity: 0 },
    threats: [
      {
        id: "thr-mbg-keracunan",
        severity_class: "high",
        severity: 9,
        // Matches the loudest negative topic above — the gate names the same incident the board shows.
        title: "Keracunan Massal MBG di Sekolah",
        intelligence:
          "Lonjakan laporan keracunan pasca-santap MBG di beberapa daerah memicu tagar #MBGRacun dan tuntutan audit menyeluruh dalam 24 jam terakhir.",
        impact:
          "Kepercayaan publik terhadap keamanan pangan program tergerus; muncul desakan penghentian sementara di sejumlah SPPG.",
        threat_type: "food_safety",
        posts_count: 4200,
        growth_rate: "+38%",
        total_engagement: 512_000,
        platforms: ["X", "TikTok"],
        trending_keywords: ["#MBGRacun", "keracunan", "SPPG", "audit"],
        time_to_viral: 6,
        recommended_actions: [
          "Rilis pernyataan resmi + kanal aduan keracunan dalam 3 jam",
          "Umumkan investigasi SPPG terkait dan penarikan menu terdampak",
          "Aktifkan juru bicara medis untuk meluruskan info yang salah",
        ],
        top_impact_posts: [
          {
            username: "warga_peduli_gizi",
            text: "Anak saya dan puluhan temannya masuk UGD setelah makan MBG hari ini. Ini harus diusut! #MBGRacun",
            engagement: 148_000,
            followers: "82,400",
            actor_intelligence: {
              username: "warga_peduli_gizi",
              account_type: "real_person",
              credibility_score: 7,
              risk_level: "medium",
              follower_count: "82,400",
              analysis: "Orang tua siswa; keluhan otentik berbasis pengalaman langsung, jangkauan menengah.",
            },
          },
          {
            username: "kanal_investigasi",
            text: "Kami telusuri rantai pasok SPPG yang diduga jadi sumber keracunan MBG. Utas panjang.",
            engagement: 132_000,
            followers: "410,000",
            actor_intelligence: {
              username: "kanal_investigasi",
              account_type: "investigative_journalist",
              credibility_score: 8,
              risk_level: "medium",
              follower_count: "410,000",
              analysis: "Akun jurnalisme investigatif; kredibilitas tinggi, mendorong framing akuntabilitas.",
            },
          },
          {
            username: "suara_rakyat_id",
            text: "PROGRAM GAGAL! Rakyat jadi korban. Bubarkan sekarang!!! #MBGRacun #TurunkanHargaBukanRacun",
            engagement: 96_000,
            followers: "51,000",
            actor_intelligence: {
              username: "suara_rakyat_id",
              account_type: "propaganda_provocator",
              credibility_score: 2,
              risk_level: "high",
              follower_count: "51,000",
              analysis: "Pola amplifikasi terkoordinasi; membingkai insiden sebagai kegagalan total program.",
            },
          },
          {
            username: "emak2_bersuara",
            text: "Serem banget lihat beritanya. Semoga anak-anak cepat sembuh dan dapurnya diperiksa 😢",
            engagement: 61_000,
            followers: "128,000",
            actor_intelligence: {
              username: "emak2_bersuara",
              account_type: "real_person",
              credibility_score: 6,
              risk_level: "low",
              follower_count: "128,000",
              analysis: "Komunitas orang tua; nada khawatir, bukan provokasi — audiens yang perlu ditenangkan.",
            },
          },
        ],
      },
    ],
  },
};

const mappedThreats = mapThreatsResponse(RAW_THREATS);
export const MOCK_THREATS: MockThreats = { threat: mappedThreats.threats[0] ?? null, stats: mappedThreats.stats };

/* ------------------------------- actors -------------------------------- */

/**
 * Realistic **placeholder-person** photos (randomuser.me) keyed by handle — synthetic,
 * anonymous faces, **not** real identifiable individuals: the accounts are fabricated
 * and two are bots, so a real person must never be shown as one (the same identity-
 * safety rule the sim features carry). The roster mapper only keeps a `data:image`
 * `profile_picture`, so these http URLs are attached to the mapped `avatarUrl` below
 * instead. `ThreatActors`' Avatar renders them as `<img>` and falls back to an initials
 * tile on load error — so if the deployed pod can't reach the CDN (egress is selective)
 * the column degrades gracefully rather than breaking.
 */
const AVATAR_URLS: Record<string, string> = {
  warga_peduli_gizi: "https://randomuser.me/api/portraits/women/68.jpg",
  kanal_investigasi: "https://randomuser.me/api/portraits/men/32.jpg",
  emak2_bersuara: "https://randomuser.me/api/portraits/women/44.jpg",
  suara_rakyat_id: "https://randomuser.me/api/portraits/men/75.jpg",
  buzzer_oposisi_01: "https://randomuser.me/api/portraits/men/12.jpg",
};

const RAW_ROSTER: ActorRosterApiResponse = {
  success: true,
  status_code: 200,
  meta: { topic: "danantara_main" },
  data: [
    {
      username: "warga_peduli_gizi",
      platform: "X",
      follower_count: "82,400",
      influence_score: 6,
      credibility_score: 7,
      sentiment_score: -8,
      risk_level: "medium",
      account_classification: "Complainer",
      content_themes: "Orang tua siswa; keluhan keracunan berbasis pengalaman langsung.",
    },
    {
      username: "kanal_investigasi",
      platform: "X",
      follower_count: "410,000",
      influence_score: 9,
      credibility_score: 8,
      sentiment_score: -6,
      risk_level: "medium",
      account_classification: "Investigative Journalist",
      content_themes: "Menelusuri rantai pasok SPPG; mendorong framing akuntabilitas.",
    },
    {
      username: "emak2_bersuara",
      platform: "Instagram",
      follower_count: "128,000",
      influence_score: 7,
      credibility_score: 6,
      sentiment_score: -5,
      risk_level: "low",
      account_classification: "Negative Critic",
      content_themes: "Komunitas orang tua; nada khawatir soal keamanan pangan anak.",
    },
    {
      username: "suara_rakyat_id",
      platform: "X",
      follower_count: "51,000",
      influence_score: 5,
      credibility_score: 2,
      sentiment_score: -9,
      risk_level: "high",
      account_classification: "Propaganda/Provocator",
      influence_analysis: "Amplifikasi terkoordinasi; membingkai insiden sebagai kegagalan total program.",
    },
    {
      username: "buzzer_oposisi_01",
      platform: "X",
      follower_count: "38,500",
      influence_score: 4,
      credibility_score: 2,
      sentiment_score: -8,
      risk_level: "high",
      account_classification: "Buzzer",
      influence_analysis: "Klaster buzzer; mengaitkan keracunan dengan dugaan penyimpangan anggaran.",
    },
  ],
};

// Attach the realistic photo per handle onto the mapped roster (the mapper drops
// non-`data:image` profile_picture values, so the URL can't ride through it).
export const MOCK_ACTORS: MockActors = {
  actors: mapActorRoster(RAW_ROSTER).map((a) => ({ ...a, avatarUrl: AVATAR_URLS[a.handle] ?? a.avatarUrl })),
};
