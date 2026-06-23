import { describe, expect, it } from "vitest";
import { biggestThreat, crisisBand, crisisIndex } from "./crisis";
import type { CeoIssue } from "./types";
import type { TopicsSummary } from "./topics-source";
import { SOV_COLORS } from "../ui";

/** A full CeoIssue with sane defaults; override only what a case needs. */
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

/** A TopicsSummary with a given negative % (positive fills the rest). */
function summary(negative: number): TopicsSummary {
  return {
    total_impressions: 0,
    total_reach: 0,
    percentage: { positive: Math.max(0, 100 - negative), negative, neutral: 0 },
  };
}

describe("crisisIndex (A10 — fear score, 0..100, high = danger)", () => {
  it("is monotonic in the overall negative share, clamped 0..100", () => {
    const calm = crisisIndex([], summary(10));
    const grim = crisisIndex([], summary(80));
    expect(grim.score).toBeGreaterThan(calm.score);
    expect(crisisIndex([], summary(0)).score).toBeGreaterThanOrEqual(0);
    expect(crisisIndex([], summary(100)).score).toBeLessThanOrEqual(100);
  });

  it("weights negativity by reach — a loud negative topic scores higher than a quiet one", () => {
    const neg = (reach: number) => issue({ id: "n", reach, mentions: 1000, negMentions: 800 });
    const pos = (reach: number) => issue({ id: "p", reach, mentions: 1000, negMentions: 50 });
    const loud = crisisIndex([neg(5000), pos(500)], summary(50));
    const quiet = crisisIndex([neg(500), pos(5000)], summary(50));
    expect(loud.score).toBeGreaterThan(quiet.score);
  });

  it("empty issues / null summary → score 0, level Low (no throw)", () => {
    const r = crisisIndex([], null);
    expect(r.score).toBe(0);
    expect(r.level).toBe("Low");
  });
});

describe("crisisBand (English threat ladder, inverted: high score = worse)", () => {
  it("bands at 25 / 45 / 65 — LOW / GUARDED / ELEVATED / SEVERE", () => {
    expect(crisisBand(24).level).toBe("Low");
    expect(crisisBand(25).level).toBe("Guarded");
    expect(crisisBand(45).level).toBe("Elevated");
    expect(crisisBand(65).level).toBe("Severe");
  });

  it("colours each band from the sovereign palette (green → red)", () => {
    expect(crisisBand(10).color).toBe(SOV_COLORS.strong);
    expect(crisisBand(30).color).toBe(SOV_COLORS.ok);
    expect(crisisBand(50).color).toBe(SOV_COLORS.watch);
    expect(crisisBand(70).color).toBe(SOV_COLORS.weak);
  });

  it("sirens only at Severe (score ≥ 65)", () => {
    expect(crisisBand(64).siren).toBe(false);
    expect(crisisBand(65).siren).toBe(true);
  });
});

describe("biggestThreat (the one topic that should scare him)", () => {
  it("picks the issue maximizing reach × negative share", () => {
    const a = issue({ id: "a", reach: 1000, mentions: 1000, negMentions: 900 }); // 1000 × 0.90 = 900
    const b = issue({ id: "b", reach: 5000, mentions: 1000, negMentions: 100 }); // 5000 × 0.10 = 500
    expect(biggestThreat([a, b])?.id).toBe("a");
  });

  it("resolves ties to the first issue, and returns null when nothing is negative", () => {
    const a = issue({ id: "a", reach: 1000, mentions: 1000, negMentions: 500 });
    const b = issue({ id: "b", reach: 1000, mentions: 1000, negMentions: 500 });
    expect(biggestThreat([a, b])?.id).toBe("a");
    expect(biggestThreat([])).toBeNull();
    expect(biggestThreat([issue({ negMentions: 0 })])).toBeNull();
  });

  it("ignores net-positive topics — stays consistent with the wall's NEGATIVE column", () => {
    // Wide reach + a big negative minority, but net-positive (pos > neg) → the
    // wall files it under POSITIVE, so it must NOT be named the biggest threat.
    const netPositive = issue({ id: "pos", reach: 10_000_000, mentions: 1000, posMentions: 600, negMentions: 300 });
    // A smaller but genuinely negative topic (neg ≥ pos) is the real threat.
    const netNegative = issue({ id: "neg", reach: 1000, mentions: 1000, posMentions: 100, negMentions: 700 });
    expect(biggestThreat([netPositive, netNegative])?.id).toBe("neg");
    expect(biggestThreat([netPositive])).toBeNull();
  });
});
