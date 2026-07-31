/**
 * Counter-Narrative War Room — reach model (A14 v1.0). Pure, deterministic.
 *
 * A9's Response Calculator (`counter-noise.ts`) sizes a response off the *count*
 * of hostile posts (negative impressions ÷ an assumed impressions-per-post). A14
 * asks the other question the client actually posed — **"how many posts to win the
 * reach?"** — so it sizes off **reach**:
 *
 *   hostileReach   = reach × negative impression share
 *   targetReach    = hostileReach × tier multiplier
 *   totalPosts     = ceil(targetReach / blended reach-per-post)
 *   projectedReach = Σ posts_c × REACH_PER_POST[c]
 *   shareOfVoice   = projected / (hostile + projected)
 *
 * The tier reads as a **share-of-voice target**: ×1 → parity (50%), ×3 → 75%,
 * ×5 → ~83%. The ladder and the channel mix are imported from A9 rather than
 * redeclared, so the two panels can never drift.
 *
 * Caveat the UI must repeat: the feed carries no per-topic negative *reach*, only
 * negative *impressions*, so `hostileReach` is an **estimate**.
 */

import { CHANNEL_SHARE, TIER_MULTIPLIER, type ResponseTier } from "./counter-noise";
import { groupIssuesBySentiment } from "./engine";
import type { CeoIssue } from "./types";

export type { ResponseTier };

/** A9's channel keys. `homeless` is the client's term for grassroots flooding. */
export type CounterChannel = "kol" | "clipper" | "homeless";

/** Display order — loudest-per-post first, so the board reads top-down by leverage. */
export const CHANNEL_ORDER: readonly CounterChannel[] = ["kol", "clipper", "homeless"];

/** UI vocabulary. The key stays `homeless` (A9 owns it); only the label is ours. */
export const CHANNEL_LABEL: Record<CounterChannel, string> = {
  kol: "KOL",
  clipper: "Clipper",
  homeless: "Grassroots",
};

export const CHANNEL_PLATFORM: Record<CounterChannel, string> = {
  kol: "X / Instagram",
  clipper: "TikTok / Reels",
  homeless: "Facebook / WhatsApp",
};

/**
 * Estimated reach delivered by **one** post on each channel. A disclosed paid KOL
 * lands on a large owned audience; a clipper cut rides the algorithm; a community
 * advocate reaches a personal network. Heuristics — tune in this one place when the
 * client supplies real per-channel media data.
 */
export const REACH_PER_POST: Record<CounterChannel, number> = {
  kol: 45_000,
  clipper: 12_000,
  homeless: 1_200,
};

/** The fields the reach model needs — any topic-shaped object satisfies it. */
export type TopicReachInput = Pick<CeoIssue, "reach" | "mentions" | "posMentions" | "negMentions">;

export interface ChannelPlan {
  channel: CounterChannel;
  posts: number;
  reachPerPost: number;
  reach: number;
  sharePct: number;
}

export interface CounterNarrativePlan {
  tier: ResponseTier;
  multiplier: number;
  negSharePct: number;
  hostileReach: number;
  targetReach: number;
  blendedReachPerPost: number;
  totalPosts: number;
  channels: ChannelPlan[];
  projectedReach: number;
  shareOfVoicePct: number;
  hostileSharePct: number;
}

export interface WarRoomTotals {
  hostileReach: number;
  projectedReach: number;
  totalPosts: number;
  posts: Record<CounterChannel, number>;
  shareOfVoicePct: number;
  hostileSharePct: number;
}

/** Negative share of a topic's impressions, 0..1. Clamped — a feed can over-report. */
export function negativeShare(t: TopicReachInput): number {
  if (!(t.mentions > 0)) return 0;
  return Math.min(1, Math.max(0, t.negMentions / t.mentions));
}

/** Estimated hostile reach: total reach weighted by the negative impression share. */
export function hostileReachOf(t: TopicReachInput): number {
  return Math.round(Math.max(0, t.reach) * negativeShare(t));
}

/** Reach one *average* post buys, given the fixed channel mix. */
export function blendedReachPerPost(): number {
  return CHANNEL_ORDER.reduce((sum, c) => sum + CHANNEL_SHARE[c] * REACH_PER_POST[c], 0);
}

/**
 * Split a post total across the channels by `CHANNEL_SHARE`, **largest remainder**.
 * Naive rounding would let the three tiles disagree with the headline total, and a
 * boardroom adds them up.
 */
export function splitPosts(total: number): Record<CounterChannel, number> {
  const safe = Math.max(0, Math.round(total));
  const exact = CHANNEL_ORDER.map((c) => ({ c, v: safe * CHANNEL_SHARE[c] }));
  const out = { kol: 0, clipper: 0, homeless: 0 } as Record<CounterChannel, number>;
  for (const { c, v } of exact) out[c] = Math.floor(v);

  let left = safe - CHANNEL_ORDER.reduce((a, c) => a + out[c], 0);
  const byRemainder = [...exact].sort(
    (a, b) => b.v - Math.floor(b.v) - (a.v - Math.floor(a.v)) || CHANNEL_ORDER.indexOf(a.c) - CHANNEL_ORDER.indexOf(b.c),
  );
  for (let i = 0; left > 0; i++, left--) out[byRemainder[i % byRemainder.length].c] += 1;
  return out;
}

/** The full response plan for one topic at one tier. */
export function counterNarrativePlan(t: TopicReachInput, tier: ResponseTier = "professional"): CounterNarrativePlan {
  const multiplier = TIER_MULTIPLIER[tier];
  const hostileReach = hostileReachOf(t);
  const targetReach = hostileReach * multiplier;
  const blended = blendedReachPerPost();
  const totalPosts = hostileReach === 0 ? 0 : Math.max(1, Math.ceil(targetReach / blended));

  const split = splitPosts(totalPosts);
  const channels: ChannelPlan[] = CHANNEL_ORDER.map((c) => ({
    channel: c,
    posts: split[c],
    reachPerPost: REACH_PER_POST[c],
    reach: split[c] * REACH_PER_POST[c],
    sharePct: Math.round(CHANNEL_SHARE[c] * 100),
  }));

  const projectedReach = channels.reduce((a, c) => a + c.reach, 0);
  const shareOfVoicePct = sovPct(hostileReach, projectedReach);

  return {
    tier,
    multiplier,
    negSharePct: Math.round(negativeShare(t) * 100),
    hostileReach,
    targetReach,
    blendedReachPerPost: blended,
    totalPosts,
    channels,
    projectedReach,
    shareOfVoicePct,
    hostileSharePct: 100 - shareOfVoicePct,
  };
}

/**
 * The war room's topics: the board's own negative set, re-ranked by **estimated
 * negative reach** so a huge-but-mildly-negative topic never outranks a smaller
 * savagely-negative one. Ties fall back to total reach.
 */
export function topNegativeByReach(issues: CeoIssue[], n = 3): CeoIssue[] {
  return [...groupIssuesBySentiment(issues).negative]
    .sort((a, b) => hostileReachOf(b) - hostileReachOf(a) || b.reach - a.reach)
    .slice(0, Math.max(0, n));
}

/** Board-level totals. Share of voice is recomputed from the sums, never averaged. */
export function aggregateWarRoom(plans: CounterNarrativePlan[]): WarRoomTotals {
  const posts = { kol: 0, clipper: 0, homeless: 0 } as Record<CounterChannel, number>;
  let hostileReach = 0;
  let projectedReach = 0;
  let totalPosts = 0;

  for (const p of plans) {
    hostileReach += p.hostileReach;
    projectedReach += p.projectedReach;
    totalPosts += p.totalPosts;
    for (const c of p.channels) posts[c.channel] += c.posts;
  }

  const shareOfVoicePct = sovPct(hostileReach, projectedReach);
  return { hostileReach, projectedReach, totalPosts, posts, shareOfVoicePct, hostileSharePct: 100 - shareOfVoicePct };
}

function sovPct(hostile: number, projected: number): number {
  const total = hostile + projected;
  return total > 0 ? Math.round((projected / total) * 100) : 0;
}
