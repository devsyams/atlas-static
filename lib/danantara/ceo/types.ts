import type { SectorKey } from "@/lib/danantara/types";

/** Issue taxonomy for the CEO board (Indonesian labels live in data/ui). */
export type IssueCategory = "tata-kelola" | "investasi" | "kebijakan" | "pasar" | "sosial";

/** Escalation ladder. Transitions computed by engine.statusOf(). */
export type IssueStatus = "normal" | "rising" | "escalating";

export interface IssueHeadline {
  source: string; // "Kompas", "CNBC Indonesia", "X"
  title: string;
  time: string; // "2 jam lalu"
}

/** One of the top-20 issues around Danantara. All figures from public signals. */
export interface CeoIssue {
  id: string;
  title: string;
  category: IssueCategory;
  relatedBumn: string[]; // BumnSentiment ids
  mentions: number; // cumulative mentions (running)
  reach: number; // estimated audience reached
  sentiment: number; // -100 (hostile) .. 100 (supportive)
  history: number[]; // mentions per tick, oldest → newest
  headlines: IssueHeadline[];
  aiLine: string; // one-line AI read for the spotlight
  velocity: number; // % mention growth over the rolling window (derived)
  status: IssueStatus; // derived
  rankHistory: number[]; // 1-based rank per tick, oldest → newest, capped at HISTORY_LIMIT (derived)
  rankDelta: number; // rank one window ago − current rank; positive = climbed (derived)
  posMentions: number; // positive-tone mention count (derived)
  negMentions: number; // negative-tone mention count (derived)
  idQuery?: string; // Nexorus dashboard deep-link id (P8 v2.0); absent for older feeds
}

/** One of the top-20 BUMN, scored by net public sentiment. */
export interface BumnSentiment {
  id: string;
  name: string;
  short: string; // tile label
  sector: SectorKey;
  sentiment: number; // -100..100 net sentiment
  mentions: number;
  trend: number[]; // sentiment history for the spark, oldest → newest
  topIssueId?: string; // dominant CeoIssue id
  rankHistory: number[]; // 1-based rank per tick, oldest → newest, capped at HISTORY_LIMIT (derived)
  rankDelta: number; // rank one window ago − current rank; positive = climbed (derived)
  posMentions: number; // positive-tone mention count (derived)
  negMentions: number; // negative-tone mention count (derived)
}

/** A scripted mention-spike so a live demo reliably triggers the takeover (AC5). */
export interface EscalationArc {
  issueId: string;
  atTick: number; // arc starts at this tick count
  rampTicks: number; // how many ticks the spike lasts
  growthPerTick: number; // e.g. 0.4 = +40% mentions per tick while ramping
}

/** The whole board state. Engine.tick() maps CeoState → CeoState. */
export interface CeoState {
  tickCount: number;
  issues: CeoIssue[]; // ALWAYS sorted by reach desc (rankIssues)
  bumn: BumnSentiment[]; // ALWAYS sorted most-negative first (rankBumn)
}
