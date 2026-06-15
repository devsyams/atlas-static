/** Shared test fixtures for the CEO wall (vitest only — not bundled in the app). */

import type { BumnSentiment, CeoIssue } from "./types";

/** Minimal valid CeoIssue for tests. */
export function makeIssue(over: Partial<CeoIssue> & { id: string }): CeoIssue {
  return {
    title: over.id,
    category: "tata-kelola",
    relatedBumn: [],
    mentions: 1000,
    reach: 1_000_000,
    sentiment: 0,
    history: [1000, 1000, 1000, 1000, 1000, 1000],
    headlines: [],
    aiLine: "",
    velocity: 0,
    status: "normal",
    rankHistory: [1, 1, 1, 1, 1, 1],
    rankDelta: 0,
    posMentions: 350,
    negMentions: 350,
    ...over,
  };
}

/** Minimal valid BumnSentiment for tests. */
export function makeBumn(over: Partial<BumnSentiment> & { id: string }): BumnSentiment {
  return {
    name: over.id,
    short: over.id,
    sector: "energi",
    sentiment: 0,
    mentions: 100,
    trend: [0, 0, 0],
    rankHistory: [1, 1, 1, 1, 1, 1],
    rankDelta: 0,
    posMentions: 350,
    negMentions: 350,
    reach: 1000,
    posReach: 350,
    negReach: 350,
    ...over,
  };
}
