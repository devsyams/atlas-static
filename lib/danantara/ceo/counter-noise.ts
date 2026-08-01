/**
 * Counter-Noise — Response Calculator (A9 v2.0). Pure, deterministic.
 *
 * The boss's model: a **counter-action deployment** sized off the count of
 * negative / anti-client **posts** (the baseline — NOT reach/impressions),
 * scaled by a service-tier "noise multiplier", then split across channels:
 *
 *   counter_actions = negative_baseline × noise_multiplier
 *   clipper = 50%   homeless = 20%   kol = 30%
 *
 * Our live feed reports negative **impressions**, not a post count, so the UI
 * estimates the baseline via `negativeBaselineFromIssue` (negative impressions ÷
 * an assumed avg impressions-per-post). Everything here is a pure heuristic.
 */

export type ResponseTier = "basic" | "professional" | "enterprise";

export const TIER_MULTIPLIER: Record<ResponseTier, number> = { basic: 1, professional: 3, enterprise: 5 };
export const TIER_LABEL: Record<ResponseTier, string> = { basic: "Basic", professional: "Professional", enterprise: "Enterprise" };

/** One-line strategy tagline per tier — the headline read on each comparison card (A14 v2.0). */
export const TIER_STRATEGY: Record<ResponseTier, string> = {
  enterprise: "Total narrative takeover — overwhelm and erase the opposition",
  professional: "Aggressive suppression — flood every channel with counter-narrative",
  basic: "Defensive hold — match and neutralize negative volume 1-for-1",
};

/** Channel split of the total counter-actions (boss's model). */
export const CHANNEL_SHARE = { clipper: 0.5, homeless: 0.2, kol: 0.3 } as const;

/** Avg impressions per post — turns the feed's negative impressions into an
 *  estimated negative-post count. Tune in one place if the demo wants a different scale. */
export const IMPRESSIONS_PER_POST = 7500;

export interface CounterNoisePlan {
  tier: ResponseTier;
  noiseMultiplier: number;
  negativeBaseline: number;
  counterActions: number;
  clipper: number;
  homeless: number;
  kol: number;
}

/**
 * Boss's response calculator: `counter_actions = negative_baseline × multiplier`,
 * split clipper 50% / homeless 20% / kol 30%. Baseline = negative **post** count.
 */
export function responseCalculator(negativeBaseline: number, tier: ResponseTier = "professional"): CounterNoisePlan {
  const noiseMultiplier = TIER_MULTIPLIER[tier];
  const baseline = Math.max(0, Math.round(negativeBaseline));
  const counterActions = baseline * noiseMultiplier;
  return {
    tier,
    noiseMultiplier,
    negativeBaseline: baseline,
    counterActions,
    clipper: Math.round(counterActions * CHANNEL_SHARE.clipper),
    homeless: Math.round(counterActions * CHANNEL_SHARE.homeless),
    kol: Math.round(counterActions * CHANNEL_SHARE.kol),
  };
}

/** Estimate a topic's negative-post baseline from its negative impressions. */
export function negativeBaselineFromIssue(issue: { negMentions: number }): number {
  return Math.round(Math.max(0, issue.negMentions) / IMPRESSIONS_PER_POST);
}
