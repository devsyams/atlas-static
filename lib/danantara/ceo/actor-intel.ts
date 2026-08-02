/**
 * Captured actor-intelligence roster (A10 v10.0) — pure mapping, no I/O.
 *
 * TrawlDeck's `/actor-intelligence` enrichment is off (bare, unclassified actors),
 * so `/bgn/command` opts panel 3 onto a bundled capture of a real OpenGate MBG
 * actor-intelligence run (`lib/bgn/mock/actor-intelligence.json`). This module maps
 * that capture to the `ThreatDriver` card shape and attaches the full per-actor
 * analysis as `intel` — the payload behind the card's detail popup
 * (`ActorDetailModal`). Reversible: drop the `?static=1` flag when enrichment lands.
 */

import type { ThreatDriver } from "./threats-source";

/** The fourteen analysis sections captured per actor (all optional — render what exists). */
export interface ActorIntel {
  classification?: string;
  tier?: string; // "urgent" | "high" | "medium" | "low"
  influence?: number; // 0..10
  activity30d?: { posts?: string; mentions?: string; avgEngagement?: string; totalEngagement?: string };
  bio?: string;
  brandMentions?: string;
  sentimentPatterns?: string;
  influenceAnalysis?: string;
  contentThemes?: string;
  engagementTactics?: string;
  sentimentAnalysis?: string;
  collaborationOpportunities?: string;
  collaborationPotential?: string; // "2/10"
  collaborationRecommendation?: string;
  riskAssessment?: string;
  recommendedActions?: string;
  recentActivitySummary?: string;
  topPerformingPost?: string;
  analyzed?: string; // "17 hours ago"
}

/** One actor as captured from the OpenGate Actor Intelligence tab. */
export interface CapturedActor {
  platform: string;
  tier: string;
  handle: string;
  displayName: string;
  classification: string;
  avatarUrl: string | null;
  followers: string | null; // "73.4K"
  influence: string | null; // "8/10"
  credibility: string | null; // "6/10"
  sentiment: number | null; // −10..10
  riskBadge: string | null; // "CRITICAL" | "HIGH RISK" | "MODERATE" | "LOW RISK"
  impactBadge: string | null;
  analyzed: string | null;
  reach: string | null; // "62.0/100"
  detail: Omit<ActorIntel, "classification" | "tier" | "influence" | "analyzed">;
}

export interface CapturedRoster {
  actors: CapturedActor[];
}

/** "73.4K" → 73400 · "1.2M" → 1200000 · "126" → 126 (0 on junk). */
export function parseAbbrevCount(v: string | null | undefined): number {
  if (!v) return 0;
  const m = String(v).trim().match(/^([\d.,]+)\s*([KMB])?$/i);
  if (!m) return 0;
  const n = parseFloat(m[1].replace(/,/g, ""));
  if (!Number.isFinite(n)) return 0;
  const mult = { K: 1e3, M: 1e6, B: 1e9 }[m[2]?.toUpperCase() as "K" | "M" | "B"] ?? 1;
  return Math.round(n * mult);
}

/** "6/10" → 6 (0 on junk). */
function parseScore(v: string | null | undefined): number {
  const n = parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
}

/** Capture badge → the card's risk level. */
const BADGE_LEVEL: Record<string, string> = {
  CRITICAL: "high",
  "HIGH RISK": "high",
  MODERATE: "medium",
  "LOW RISK": "low",
};

/**
 * Captured roster → `ThreatDriver[]` for the Aktor Penggerak cards: **Twitter/X
 * actors only** (the pane's story is the X conversation), source priority order
 * (urgent → high → medium) preserved, each driver carrying its full `intel`.
 */
export function mapCapturedRoster(captured: CapturedRoster): ThreatDriver[] {
  return (captured.actors ?? [])
    .filter((a) => a.platform === "twitter")
    .map((a) => ({
      handle: a.handle.replace(/^@/, ""),
      platform: "X",
      followers: parseAbbrevCount(a.followers),
      credibility: parseScore(a.credibility),
      riskLevel: BADGE_LEVEL[a.riskBadge ?? ""] ?? "low",
      accountType: a.classification,
      bot: false, // the capture carries only human classifications
      engagement: 0,
      note: "",
      avatarUrl: a.avatarUrl ?? undefined,
      displayName: a.displayName,
      sentiment: a.sentiment ?? undefined,
      reach: a.reach ?? undefined,
      intel: {
        ...a.detail,
        classification: a.classification,
        tier: a.tier,
        influence: parseScore(a.influence),
        analyzed: a.analyzed ?? undefined,
      },
    }));
}
