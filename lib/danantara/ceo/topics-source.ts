/**
 * Live Danantara topics feed — pure mapping/URL helpers (no I/O, fully testable).
 *
 * The upstream (api.garudaperkasa.io/api-nexorus/topics) returns Danantara's real
 * media-intelligence topics with impressions, reach, a categorical sentiment + a
 * positive/negative/neutral breakdown and an AI `penjelasan`. These helpers turn
 * that payload into the CEO board's `CeoIssue[]` and build the request URL. All
 * network/secret handling lives in the BFF route that imports this — keep this
 * file side-effect free.
 */

import { rankIssues } from "./engine";
import type { CeoIssue, IssueCategory } from "./types";

/* ----------------------------- upstream DTOs ----------------------------- */

export interface UpstreamTopic {
  topik: string;
  impressions: number;
  reach: number;
  sentiment: string; // "positive" | "negative" | "neutral" (categorical)
  stats_sentiment: { positive: number; negative: number; neutral: number }; // percentages
  penjelasan: string;
}

export interface TopicsSummary {
  total_impressions: number;
  total_reach: number;
  percentage: { positive: number; negative: number; neutral: number };
}

export interface TopicIntent {
  intent: string;
  deskripsi: string;
  impressions: number;
  share_of_voice: number;
}

export interface TopicsApiResponse {
  success: boolean;
  status_code: number;
  // `idquery` (P8 v2.0) is the Nexorus monitoring-board id for this whole topic code —
  // one per response, used to deep-link into that board's Nexorus dashboard view.
  meta: { topic: string; idquery?: string; startdate: string; enddate: string };
  data: { topics: UpstreamTopic[]; summary: TopicsSummary; intent: TopicIntent[] };
}

export interface MappedTopics {
  issues: CeoIssue[];
  summary: TopicsSummary;
  intent: TopicIntent[];
}

/* ------------------------------- helpers -------------------------------- */

/** ISO date (UTC, YYYY-MM-DD) for a Date. */
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** A rolling window ending today: { startdate: today − days, enddate: today }. */
export function rollingWindow(today: Date, days: number): { startdate: string; enddate: string } {
  const start = new Date(today.getTime() - days * 86_400_000);
  return { startdate: isoDate(start), enddate: isoDate(today) };
}

/**
 * Build the upstream request URL. By default only `topic` + `api_key` are sent
 * — the upstream applies its own default 7-day window (v42.0). Pass `window`
 * only for the 28-day widening fallback (v43.0), which needs explicit dates.
 */
export function buildTopicsUrl(
  base: string,
  topicCode: string,
  apiKey: string,
  window?: { startdate: string; enddate: string },
): string {
  const qs = new URLSearchParams({ topic: topicCode, api_key: apiKey });
  if (window) {
    qs.set("startdate", window.startdate);
    qs.set("enddate", window.enddate);
  }
  return `${base}?${qs.toString()}`;
}

/** Keyword → category. First match wins; falls back to "kebijakan". */
const CATEGORY_KEYWORDS: Array<[IssueCategory, RegExp]> = [
  ["tata-kelola", /transparan|laporan|audit|tata kelola|direktur|direksi|pengawasan|regulasi|penunjukan/i],
  ["sosial", /phk|buruh|pekerja|petani|serikat|sosial/i],
  ["investasi", /investasi|obligasi|surat utang|\bbond\b|smelter|hilirisasi|ekspor|komoditas|merah putih/i],
  ["pasar", /ihsg|rupiah|saham|bursa|kredit|rating|moody|pasar|valas/i],
  ["kebijakan", /kebijakan|subsidi|tarif|pajak|apbn|dividen|bunga/i],
];

function inferCategory(title: string): IssueCategory {
  for (const [cat, re] of CATEGORY_KEYWORDS) {
    if (re.test(title)) return cat;
  }
  return "kebijakan";
}

/** One upstream topic → a flat CeoIssue snapshot (no simulated history/velocity). */
function toIssue(t: UpstreamTopic, idx: number): CeoIssue {
  const { positive, negative } = t.stats_sentiment;
  const mentions = Math.round(t.impressions);
  return {
    id: `topic-${idx}`,
    title: t.topik,
    category: inferCategory(t.topik),
    relatedBumn: [],
    mentions,
    reach: Math.round(t.reach),
    sentiment: Math.round(positive - negative), // net, −100..100
    history: Array.from({ length: 8 }, () => mentions), // flat → velocity 0
    headlines: [], // not provided by the feed
    aiLine: t.penjelasan,
    velocity: 0,
    status: "normal",
    rankHistory: [],
    rankDelta: 0,
    posMentions: Math.round((mentions * positive) / 100),
    negMentions: Math.round((mentions * negative) / 100),
  };
}

/**
 * Map the upstream payload to the board model: topics → `CeoIssue[]` ranked by
 * reach (matching `buildInitialState`), with summary/intent passed through.
 */
export function mapTopicsResponse(json: TopicsApiResponse): MappedTopics {
  const raw = json.data.topics.map(toIssue);
  const idQuery = json.meta?.idquery; // board-level Nexorus monitoring id (shared by every topic)
  const issues = rankIssues(raw).map((issue, idx) => ({
    ...issue,
    rankHistory: Array.from({ length: 8 }, () => idx + 1), // flat: zero movement on a snapshot
    rankDelta: 0,
    idQuery,
  }));
  return { issues, summary: json.data.summary, intent: json.data.intent };
}
