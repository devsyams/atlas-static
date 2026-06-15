/**
 * Build the CEO-wall BUMN board (A7 v37) from per-BUMN live feeds. Pure — the
 * aggregation route fetches; this maps each feed into a `BumnSentiment` row +
 * its topics (re-tagged to that BUMN, with ids made unique across BUMN so the
 * board's `topicsForBumn` selector resolves the right rows).
 */

import type { Bumn } from "@/lib/bumn/registry";
import type { FeedResult } from "../topics-feed";
import type { BumnSentiment, CeoIssue } from "./types";

const FLAT = 8;

export interface BumnRowResult {
  row: BumnSentiment;
  issues: CeoIssue[];
}

/** One BUMN row + its issues from a feed result (or `null` when that BUMN's feed failed). */
export function buildBumnRow(b: Bumn, feed: FeedResult | null): BumnRowResult {
  const pct = feed?.summary?.percentage;
  const ti = feed?.summary?.total_impressions ?? 0;
  const tr = feed?.summary?.total_reach ?? 0;
  const sentiment = pct ? Math.round(pct.positive - pct.negative) : 0;
  const posMentions = pct ? Math.round((ti * pct.positive) / 100) : 0;
  const negMentions = pct ? Math.round((ti * pct.negative) / 100) : 0;
  // Reach-weighted tone — the BUMN board ranks on negReach (loudest negative
  // audience first), so use total_reach, not impressions (A7 v45.0).
  const posReach = pct ? Math.round((tr * pct.positive) / 100) : 0;
  const negReach = pct ? Math.round((tr * pct.negative) / 100) : 0;

  // Re-tag each topic to this BUMN; prefix ids so they're unique across BUMN.
  const issues: CeoIssue[] = (feed?.issues ?? []).map((i) => ({
    ...i,
    id: `${b.slug}-${i.id}`,
    relatedBumn: [b.slug],
  }));

  const row: BumnSentiment = {
    id: b.slug,
    name: b.name,
    short: b.short,
    sector: b.sector,
    sentiment,
    mentions: ti,
    trend: Array.from({ length: FLAT }, () => sentiment),
    topIssueId: issues[0]?.id, // highest-reach topic (issues are reach-ranked)
    rankHistory: Array.from({ length: FLAT }, () => 0),
    rankDelta: 0,
    posMentions,
    negMentions,
    reach: tr,
    posReach,
    negReach,
  };

  return { row, issues };
}
