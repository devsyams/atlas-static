/**
 * Executive Briefing helpers (A11) — pure, deterministic, no I/O. They turn the
 * `danantara_main` topics feed into the briefing's headline read: the dominant
 * public tone and the single loudest **positive** topic (the "biggest win"), the
 * mirror of `biggestThreat` (the "biggest concern") in `crisis.ts`.
 */

import type { CeoIssue } from "./types";
import type { TopicsSummary } from "./topics-source";

export type Tone = "positive" | "negative" | "neutral";

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** A topic's positive fraction (0..1) from its tone breakdown. */
function posFraction(i: CeoIssue): number {
  return i.mentions > 0 ? clamp(i.posMentions / i.mentions, 0, 1) : 0;
}

/** Net-positive: more positive than negative mentions (mirror of crisis.ts isNegative). */
function isPositive(i: CeoIssue): boolean {
  return i.posMentions > i.negMentions;
}

/**
 * The "biggest win": among net-positive topics, the one maximizing
 * `reach × positive fraction` (most audience seeing the most positive story).
 * Ties keep the first. Returns `null` when no topic is positive.
 */
export function topWin(issues: CeoIssue[]): CeoIssue | null {
  let best: CeoIssue | null = null;
  let bestScore = 0;
  for (const i of issues) {
    if (!isPositive(i)) continue;
    const s = i.reach * posFraction(i);
    if (s > bestScore) {
      bestScore = s;
      best = i;
    }
  }
  return best;
}

/**
 * The dominant public tone for the verdict headline — the largest of the
 * positive / negative / neutral shares (negative wins ties, matching the
 * conservative `readSentiment` convention). Safe on a null/empty summary.
 */
export function dominantTone(summary?: TopicsSummary | null): { tone: Tone; pct: number } {
  const p = summary?.percentage;
  if (!p) return { tone: "neutral", pct: 0 };
  const { positive, negative, neutral } = p;
  if (negative >= positive && negative >= neutral) return { tone: "negative", pct: negative };
  if (positive >= neutral) return { tone: "positive", pct: positive };
  return { tone: "neutral", pct: neutral };
}
