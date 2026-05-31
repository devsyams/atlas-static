import type { LeadershipSentiment, MarketTickerItem, Prediction } from "@/lib/mbg/types";
import type { ConditionChip, OpsInsight } from "@/lib/jasamarga/types";

export type { ConditionChip, OpsInsight };

/** Portfolio sector clusters of the sovereign fund (Indonesian BUMN universe). */
export type SectorKey =
  | "perbankan"
  | "energi"
  | "telko"
  | "mineral"
  | "infrastruktur"
  | "pangan"
  | "industri";

/** Where a financial signal was sourced — all publicly available / online. */
export type FinSourceType = "bursa" | "valas" | "komoditas" | "medsos" | "berita" | "resmi" | "makro";

/**
 * One portfolio company held by the fund. Valuations + daily change come from
 * public market data (IDX tickers) for listed names; unlisted SOEs carry a
 * book/appraisal valuation and a derived NAV move. No internal financials.
 */
export interface Holding {
  id: string;
  ticker: string | null; // IDX code (null = unlisted SOE)
  name: string;
  short: string; // compact label for bubbles/treemap
  sector: SectorKey;
  value_t: number; // valuation / market cap, Rp Triliun
  change_pct: number; // today's move (listed = market; unlisted = NAV est.)
  listed: boolean;
  beta: number; // sensitivity to a broad market shock (stress test)
  roe: number; // return on equity, %
  dividend_t: number; // annual dividend contribution to the fund, Rp T
  ytd_pct: number; // year-to-date performance, %
  blurb: string; // one-line public description
}

export interface SectorAgg {
  key: SectorKey;
  label: string;
  value_t: number;
  change_pct: number; // value-weighted
  weight_pct: number; // share of total AUM
  count: number;
}

/** One contributing factor to the Sovereign Strength Index (points off 100). */
export interface StrengthFactor {
  key: "profitabilitas" | "leverage" | "likuiditas" | "sentimen" | "konsentrasi";
  label: string;
  penalty: number;
}

/** Composite portfolio-health headline ("Indeks Ketahanan Sovereign"). Higher = stronger. */
export interface StrengthIndex {
  score: number; // 0–100
  level: "Tangguh" | "Sehat" | "Waspada" | "Rentan";
  emoji: string;
  trend: "up" | "down" | "flat";
  delta: number;
  factors: StrengthFactor[];
  narrative: string;
}

/** A live macro/market quote for the markets board (with a sparkline path). */
export interface MarketQuote {
  key: string;
  label: string;
  value: string; // formatted
  unit?: string;
  delta: number; // % daily change
  spark: number[]; // ~14 recent points for the sparkline
  live: boolean; // wired to a real feed vs synthetic
}

/** A capital-deployment option the AI recommends (decision-support, not execution). */
export interface CapitalMove {
  id: string;
  title: string;
  thesis: string;
  sector: SectorKey;
  capital_t: number; // proposed deployment, Rp Triliun
  return_pct: number; // projected IRR / return
  horizon: string; // "3 thn", "18 bln"
  risk: "rendah" | "sedang" | "tinggi";
  recommended: boolean;
}

/** One quarter of the AUM growth projection (area chart). */
export interface ProjQuarter {
  label: string; // "Q3'25"
  base: number; // Rp T (baseline scenario)
  bull: number; // Rp T (optimistic scenario)
  marker?: string; // "Kini", "Target"
}

export interface DividendContributor {
  name: string;
  sector: SectorKey;
  amount_t: number; // Rp T contributed
  yield_pct: number;
}

export interface SocialTrend {
  keyword: string;
  count: number;
  sentiment?: "negative" | "neutral" | "positive";
}

export interface SocialPost {
  handle: string;
  platform: string;
  text: string;
  sentiment: "negative" | "neutral" | "positive";
  engagement: number;
  time: string;
}

export interface SocialPulse {
  mentions_24h: number;
  positivity: number; // 0–10 (high = more positive chatter)
  trend: SocialTrend[];
  top_posts: SocialPost[];
}

export interface OfficialPost {
  time: string;
  category: string; // Investasi, Dividen, Tata Kelola, Imbauan
  title: string;
  body: string;
}

export interface NewsArticle {
  title: string;
  source: string;
  time: string;
  sentiment: number; // 0–10 (high = negative)
  summary: string;
}

export interface SourceFeed {
  name: string;
  type: FinSourceType;
  status: "live" | "delay" | "down" | "demo";
  items_24h: number;
  last_sync: string;
}

/* ============================ Media Intelligence ============================ */

export interface ReputationFactor {
  key: "media" | "sosial" | "share_negatif" | "krisis" | "kepercayaan";
  label: string;
  penalty: number;
}

/** Composite public-reputation headline ("Indeks Reputasi & Kepercayaan"). */
export interface ReputationIndex {
  score: number; // 0–100 (high = better reputation)
  level: "Sangat Positif" | "Positif" | "Terjaga" | "Tertekan" | "Krisis";
  emoji: string;
  trend: "up" | "down" | "flat";
  delta: number;
  factors: ReputationFactor[];
  narrative: string;
}

/** One dominant narrative/issue in coverage (for the radar + issue list). */
export interface NarrativeIssue {
  key: string;
  label: string;
  salience: number; // 0–100 share of the conversation
  share_pct: number; // % of total mentions
  sentiment: number; // 0–10 (high = more negative)
  trend: "up" | "down" | "flat";
  delta: number; // change in salience vs prior window
}

/** Share-of-voice for one portfolio entity / the fund itself. */
export interface VoiceShare {
  name: string;
  short: string;
  mentions: number;
  share_pct: number;
  sentiment: number; // 0–10 (high = negative)
  spark: number[]; // recent mention volume
}

export interface SentimentDay {
  date: string; // "21 Mei"
  pos: number;
  neu: number;
  neg: number;
  net: number; // pos% − neg%, −100..100
  marker?: string;
}

/** A media outlet / influencer / analyst driving the narrative. */
export interface MediaActor {
  handle: string;
  name: string;
  platform: string;
  type: "media" | "influencer" | "analis" | "resmi";
  reach: number;
  influence: number; // 0–10
  credibility: number; // 0–10
  stance: "positive" | "neutral" | "negative";
  posts_7d: number;
  mentions: number; // mentions of Danantara/BUMN
  note: string;
}

/** An emerging reputational signal for the crisis early-warning radar. */
export interface CrisisSignal {
  id: string;
  entity: string; // which BUMN / topic
  title: string;
  severity: number; // 0–10
  velocity: number; // % spike in 24h
  status: "Muncul" | "Naik" | "Memuncak" | "Mereda";
  source: string;
  time: string;
  detail: string;
  /** Links the signal to a scenario in the Impact Lab catalogue (impact.ts). */
  event_id?: string;
}

/** A flagged misleading claim for the disinformation watch. */
export interface HoaxItem {
  claim: string;
  status: "Terbantahkan" | "Dalam Verifikasi" | "Menyesatkan";
  reach: number;
  platforms: string[];
  counter: string;
  time: string;
}

export interface MediaIntel {
  totals: {
    mentions_24h: number;
    reach: number;
    outlets: number;
    positivity: number; // 0–10
    net_sentiment: number; // −100..100
    share_negative: number; // %
  };
  reputation: ReputationIndex;
  issues: NarrativeIssue[];
  voice: VoiceShare[];
  timeline: SentimentDay[];
  stakeholders: LeadershipSentiment;
  actors: MediaActor[];
  crisis: CrisisSignal[];
  hoaxes: HoaxItem[];
}

export interface SovereignSnapshot {
  fund: string;
  updated_at: string;
  market_source: "synthetic" | "live";
  aum_t: number; // total assets under management, Rp Triliun
  aum_usd_b: number; // ≈ USD billions
  day_change_pct: number; // value-weighted portfolio move today
  ytd_return_pct: number;
  dividend_ytd_t: number;
  holdings_count: number;
  listed_count: number;
  strength: StrengthIndex;
  insight: OpsInsight;
  conditions: ConditionChip[];
  predictions: Prediction[];
  ticker: MarketTickerItem[];
  holdings: Holding[];
  sectors: SectorAgg[];
  allocations: CapitalMove[];
  markets: MarketQuote[];
  projection: ProjQuarter[];
  dividends: DividendContributor[];
  social: SocialPulse;
  news: NewsArticle[];
  official: OfficialPost[];
  sources: SourceFeed[];
  media: MediaIntel;
}
