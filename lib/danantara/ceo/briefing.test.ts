import { describe, expect, it } from "vitest";
import { dominantTone, topWin } from "./briefing";
import type { CeoIssue } from "./types";
import type { TopicsSummary } from "./topics-source";

function issue(over: Partial<CeoIssue>): CeoIssue {
  return {
    id: "x",
    title: "t",
    category: "kebijakan",
    relatedBumn: [],
    mentions: 1000,
    reach: 1000,
    sentiment: 0,
    history: [],
    headlines: [],
    aiLine: "",
    velocity: 0,
    status: "normal",
    rankHistory: [],
    rankDelta: 0,
    posMentions: 0,
    negMentions: 0,
    ...over,
  };
}

function summary(positive: number, negative: number, neutral: number): TopicsSummary {
  return { total_impressions: 0, total_reach: 0, percentage: { positive, negative, neutral } };
}

describe("topWin (A11 — the loudest genuinely-positive topic)", () => {
  it("picks the net-positive topic maximizing reach × positive fraction", () => {
    const loud = issue({ id: "loud", reach: 5000, mentions: 1000, posMentions: 800, negMentions: 100 });
    const quiet = issue({ id: "quiet", reach: 500, mentions: 1000, posMentions: 800, negMentions: 100 });
    expect(topWin([quiet, loud])?.id).toBe("loud");
  });

  it("ignores net-negative topics and returns null when nothing is positive", () => {
    const neg = issue({ id: "neg", reach: 9_000_000, mentions: 1000, posMentions: 100, negMentions: 800 });
    const pos = issue({ id: "pos", reach: 1000, mentions: 1000, posMentions: 800, negMentions: 100 });
    expect(topWin([neg, pos])?.id).toBe("pos");
    expect(topWin([neg])).toBeNull();
    expect(topWin([])).toBeNull();
  });
});

describe("dominantTone (A11 — the verdict's headline tone)", () => {
  it("returns the tone with the largest share + its %", () => {
    expect(dominantTone(summary(60, 25, 15))).toEqual({ tone: "positive", pct: 60 });
    expect(dominantTone(summary(20, 70, 10))).toEqual({ tone: "negative", pct: 70 });
    expect(dominantTone(summary(20, 20, 60))).toEqual({ tone: "neutral", pct: 60 });
  });

  it("is safe on a null/empty summary", () => {
    expect(dominantTone(null)).toEqual({ tone: "neutral", pct: 0 });
  });
});
