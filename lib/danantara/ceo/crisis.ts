/**
 * Crisis Gate — the single "fear" signal (A10). Pure, deterministic, no I/O.
 *
 * The CEO wants one number that tells him "how bad is it right now" at a glance.
 * `crisisIndex` distils the live Danantara topics feed into a **0–100 score where
 * HIGH = danger** (the inverse of the strength/reputation scores in `ui.ts`),
 * `crisisBand` maps it to a one-word threat level + colour + siren flag, and
 * `biggestThreat` names the single topic that should scare him.
 *
 * Only **real** feed fields are used — the feed is a flat snapshot, so
 * `velocity`/`status` are always 0/"normal" and are deliberately ignored; there
 * is no invented spike. The inputs are: the overall negative share
 * (`summary.percentage.negative`), each topic's negative fraction
 * (`negMentions / mentions`), and its `reach`.
 */

import type { CeoIssue } from "./types";
import type { TopicsSummary } from "./topics-source";
import { SOV_COLORS } from "../ui";

export type CrisisLevel = "Low" | "Guarded" | "Elevated" | "Severe";

export interface CrisisBand {
  level: CrisisLevel;
  color: string; // oklch from the sovereign palette
  siren: boolean; // true only at Krisis — drives the .ceo-siren pulse
}

export interface CrisisReading extends CrisisBand {
  score: number; // 0..100, HIGH = danger
}

/**
 * Indonesian display labels for the threat ladder (BNPB-style: Aman · Waspada ·
 * Siaga · Awas). The `CrisisLevel` enum stays English for logic/keys/tests; only
 * what the operator reads is localised.
 */
export const CRISIS_LEVEL_LABEL: Record<CrisisLevel, string> = {
  Low: "Aman",
  Guarded: "Waspada",
  Elevated: "Siaga",
  Severe: "Awas",
};

/** Weights of the three components (sum = 1). High = more alarming. */
const W_OVERALL = 0.55; // overall negative share of the conversation
const W_WEIGHTED = 0.3; // reach-weighted negativity across topics
const W_WORST = 0.15; // severity of the single loudest negative topic

/** Band thresholds on the 0–100 score (LOW < 25 ≤ GUARDED < 45 ≤ ELEVATED < 65 ≤ SEVERE). */
const T_GUARDED = 25;
const T_ELEVATED = 45;
const T_SEVERE = 65;

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** A topic's negative fraction (0..1) from its tone breakdown. */
function negFraction(i: CeoIssue): number {
  return i.mentions > 0 ? clamp(i.negMentions / i.mentions, 0, 1) : 0;
}

/**
 * A genuinely **negative** topic — the same test the /danantara wall uses to file
 * a topic under NEGATIVE (`groupIssuesBySentiment`: `negMentions >= posMentions`).
 * Keeping the threat in lock-step with the wall means the named "Ancaman Terbesar"
 * is always findable in the wall's NEGATIVE column (not a net-positive story that
 * merely has a wide negative minority).
 */
function isNegative(i: CeoIssue): boolean {
  return i.negMentions >= i.posMentions;
}

/**
 * The single most-damaging **negative** topic: among net-negative topics, the one
 * maximizing `reach × negative fraction` (most audience seeing the most negative
 * story). Ties keep the first. Returns `null` when no topic is negative — i.e.
 * there is genuinely nothing to fear right now.
 */
export function biggestThreat(issues: CeoIssue[]): CeoIssue | null {
  let best: CeoIssue | null = null;
  let bestScore = 0;
  for (const i of issues) {
    if (!isNegative(i)) continue;
    const s = i.reach * negFraction(i);
    if (s > bestScore) {
      bestScore = s;
      best = i;
    }
  }
  return best;
}

/** Map a 0–100 score to a threat band (higher = worse). */
export function crisisBand(score: number): CrisisBand {
  if (score >= T_SEVERE) return { level: "Severe", color: SOV_COLORS.weak, siren: true };
  if (score >= T_ELEVATED) return { level: "Elevated", color: SOV_COLORS.watch, siren: false };
  if (score >= T_GUARDED) return { level: "Guarded", color: SOV_COLORS.ok, siren: false };
  return { level: "Low", color: SOV_COLORS.strong, siren: false };
}

/**
 * The Crisis Index: a 0–100 fear score (HIGH = danger) blending the overall
 * negative share, reach-weighted topic negativity, and the worst single topic.
 */
export function crisisIndex(issues: CeoIssue[], summary?: TopicsSummary | null): CrisisReading {
  const overallNeg = clamp(summary?.percentage?.negative ?? 0, 0, 100);

  const totalReach = issues.reduce((s, i) => s + Math.max(0, i.reach), 0);
  const weightedNeg =
    totalReach > 0
      ? (issues.reduce((s, i) => s + Math.max(0, i.reach) * negFraction(i), 0) / totalReach) * 100
      : 0;

  const worst = biggestThreat(issues);
  const worstNeg = worst ? negFraction(worst) * 100 : 0;

  const score = Math.round(clamp(W_OVERALL * overallNeg + W_WEIGHTED * weightedNeg + W_WORST * worstNeg, 0, 100));
  return { score, ...crisisBand(score) };
}
