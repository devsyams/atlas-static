/**
 * Pure simulation engine for the CEO command wall. Every function here is
 * deterministic given its inputs (PRNG is injected) so the whole board is
 * unit-testable. UI components never compute — they only display.
 */

import type { BumnSentiment, CeoIssue, CeoState, EscalationArc, IssueStatus } from "./types";

/** Velocity rolling window in ticks (UI labels it "2 jam terakhir"). */
export const VELOCITY_WINDOW = 6;
/** Velocity (%) at which an issue becomes "rising". */
export const RISING_THRESHOLD = 80;
/** Velocity (%) at which an issue can become "escalating". */
export const ESCALATING_THRESHOLD = 200;
/** Minimum reach for a full escalation (filter out small-but-fast issues). */
export const REACH_FLOOR = 5_000_000;
/** Hard ceiling on plausible reach (≈ Indonesia's online population). */
export const REACH_CAP = 250_000_000;

/** Small deterministic PRNG (mulberry32) so ticks are reproducible in tests. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** % growth of mentions across the last `window` entries of history. */
export function velocity(history: number[], window = VELOCITY_WINDOW): number {
  const slice = history.slice(-window);
  if (slice.length < 2) return 0;
  const first = slice[0];
  const last = slice[slice.length - 1];
  if (first <= 0) return 0;
  return ((last - first) / first) * 100;
}

/**
 * Escalation ladder with hysteresis: once escalating, an issue stays pinned
 * until its velocity cools below the RISING threshold (so the takeover/pin
 * doesn't flicker on noisy data).
 */
export function statusOf(vel: number, reach: number, prev: IssueStatus): IssueStatus {
  if (vel >= ESCALATING_THRESHOLD && reach >= REACH_FLOOR) return "escalating";
  if (prev === "escalating" && vel >= RISING_THRESHOLD) return "escalating";
  if (vel >= RISING_THRESHOLD) return "rising";
  return "normal";
}

/** Issues ranked by estimated audience reach, biggest first. */
export function rankIssues(issues: CeoIssue[]): CeoIssue[] {
  return [...issues].sort((a, b) => b.reach - a.reach);
}

/** BUMN ranked most-negative first — the CEO's job is spotting problems. */
export function rankBumn(rows: BumnSentiment[]): BumnSentiment[] {
  return [...rows].sort((a, b) => a.sentiment - b.sentiment);
}

/** Max history entries kept per issue (~24 ticks ≈ 96 s of wall time). */
export const HISTORY_LIMIT = 24;

/** Share of mentions that are neutral (neither positive nor negative). */
export const NEUTRAL_SHARE = 0.3;

/**
 * Split total mentions into positive/negative/neutral counts from net sentiment
 * (−100..100). pos − neg keeps the sign and proportion of the net score; counts
 * always sum exactly to mentions.
 */
export function sentimentBreakdown(
  sentiment: number,
  mentions: number,
): { pos: number; neg: number; neu: number } {
  const spread = 1 - NEUTRAL_SHARE;
  const posShare = spread / 2 + (sentiment / 100) * (spread / 2);
  const pos = Math.round(mentions * posShare);
  const neg = Math.round(mentions * (spread - posShare));
  const neu = mentions - pos - neg;
  return { pos, neg, neu };
}

/** Rank movement vs the rolling window: positive = climbed (rank number got smaller). */
export function rankMovement(rankHistory: number[], window = VELOCITY_WINDOW): number {
  const slice = rankHistory.slice(-window);
  if (slice.length < 2) return 0;
  return slice[0] - slice[slice.length - 1];
}

/** Organic per-tick mention change: symmetric random walk (no net drift). */
const ORGANIC_MIN = -0.02;
const ORGANIC_MAX = 0.02;
/** BUMN sentiment random drift per tick (± points). */
const SENTIMENT_DRIFT = 1.5;

/** Advance the whole board one step. Pure: returns a new state. */
export function tick(state: CeoState, rand: () => number, arcs: EscalationArc[]): CeoState {
  const tickCount = state.tickCount + 1;

  const issues = state.issues.map((issue) => {
    const arc = arcs.find(
      (a) => a.issueId === issue.id && state.tickCount >= a.atTick && state.tickCount < a.atTick + a.rampTicks,
    );
    const organic = ORGANIC_MIN + rand() * (ORGANIC_MAX - ORGANIC_MIN);
    const growth = arc ? arc.growthPerTick + organic : organic;

    const mentions = Math.max(1, Math.round(issue.mentions * (1 + growth)));
    const ratio = issue.mentions > 0 ? issue.reach / issue.mentions : 0;
    const reach = Math.min(REACH_CAP, Math.round(mentions * ratio));
    const history = [...issue.history, mentions].slice(-HISTORY_LIMIT);
    const vel = velocity(history);
    const status = statusOf(vel, reach, issue.status);

    return { ...issue, mentions, reach, history, velocity: vel, status };
  });

  const bumn = state.bumn.map((row) => {
    const drift = (rand() * 2 - 1) * SENTIMENT_DRIFT;
    const sentiment = Math.max(-100, Math.min(100, row.sentiment + drift));
    const trend = [...row.trend, sentiment].slice(-HISTORY_LIMIT);
    return { ...row, sentiment, trend };
  });

  const rankedIssues = rankIssues(issues).map((issue, idx) => {
    const rankHistory = [...issue.rankHistory, idx + 1].slice(-HISTORY_LIMIT);
    const { pos, neg } = sentimentBreakdown(issue.sentiment, issue.mentions);
    return { ...issue, rankHistory, rankDelta: rankMovement(rankHistory), posMentions: pos, negMentions: neg };
  });

  const rankedBumn = rankBumn(bumn).map((row, idx) => {
    const rankHistory = [...row.rankHistory, idx + 1].slice(-HISTORY_LIMIT);
    const { pos, neg } = sentimentBreakdown(row.sentiment, row.mentions);
    return { ...row, rankHistory, rankDelta: rankMovement(rankHistory), posMentions: pos, negMentions: neg };
  });

  return { tickCount, issues: rankedIssues, bumn: rankedBumn };
}

/** Spotlight rotation order: escalating issues pin first (fastest spike first). */
export function spotlightQueue(rankedIssues: CeoIssue[]): string[] {
  const escalating = rankedIssues
    .filter((i) => i.status === "escalating")
    .sort((a, b) => b.velocity - a.velocity);
  const rest = rankedIssues.filter((i) => i.status !== "escalating");
  return [...escalating, ...rest].map((i) => i.id);
}

/** Deterministic Indonesian narration for the AI brief ticker (no LLM — scripted fallback pattern). */
export function briefLines(state: CeoState): string[] {
  const lines: string[] = [];
  const totalMentions = state.issues.reduce((a, i) => a + i.mentions, 0);
  const escalating = state.issues.filter((i) => i.status === "escalating");
  const rising = state.issues.filter((i) => i.status === "rising");
  const topIssue = state.issues[0];
  const worstBumn = state.bumn[0];

  for (const issue of escalating) {
    lines.push(
      `⚠ ESKALASI: "${issue.title}" naik ${Math.round(issue.velocity)}% dalam 2 jam — jangkauan ${(issue.reach / 1_000_000).toFixed(1)} jt akun.`,
    );
  }
  lines.push(
    `Nexorus AI memantau ${state.issues.length} isu utama · total ${totalMentions.toLocaleString("id-ID")} sebutan publik.`,
  );
  if (topIssue) {
    lines.push(`Isu terbesar hari ini: "${topIssue.title}" (jangkauan ${(topIssue.reach / 1_000_000).toFixed(1)} jt).`);
  }
  if (rising.length > 0) {
    lines.push(`${rising.length} isu berstatus NAIK: ${rising.map((i) => `"${i.title}"`).join(", ")}.`);
  }
  if (worstBumn) {
    lines.push(
      `Sentimen BUMN paling tertekan: ${worstBumn.name} (${Math.round(worstBumn.sentiment)}). Perlu perhatian komunikasi publik.`,
    );
  }
  return lines;
}
