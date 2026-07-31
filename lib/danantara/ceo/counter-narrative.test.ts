import { describe, expect, it } from "vitest";
import {
  CHANNEL_ORDER,
  REACH_PER_POST,
  aggregateWarRoom,
  blendedReachPerPost,
  counterNarrativePlan,
  hostileReachOf,
  negativeShare,
  splitPosts,
  topNegativeByReach,
} from "./counter-narrative";
import type { CeoIssue } from "./types";

function mkIssue(over: Partial<CeoIssue> & Pick<CeoIssue, "id" | "title">): CeoIssue {
  return {
    category: "kebijakan",
    relatedBumn: [],
    mentions: 1_000,
    reach: 10_000_000,
    sentiment: -40,
    history: Array.from({ length: 8 }, () => 1000),
    headlines: [],
    aiLine: "Konteks singkat.",
    velocity: 0,
    status: "normal",
    rankHistory: [1, 1, 1, 1, 1, 1, 1, 1],
    rankDelta: 0,
    posMentions: 200,
    negMentions: 600,
    ...over,
  };
}

/**
 * A **board-negative** topic with a given total reach and negative impression share.
 * Positive is kept well under negative so `groupIssuesBySentiment` always classes it
 * negative — the point under test is reach ranking, not the tone split.
 */
function mkTopic(id: string, reach: number, negPct: number): CeoIssue {
  const neg = Math.round(1_000 * negPct);
  return mkIssue({ id, title: `Topic ${id}`, reach, mentions: 1_000, negMentions: neg, posMentions: Math.round(neg * 0.3) });
}

describe("counter-narrative — topic selection (A14 AC1)", () => {
  it("ranks by NEGATIVE reach, not total reach (T1)", () => {
    // 50M × 30% = 15M hostile  vs  30M × 90% = 27M hostile → the smaller topic wins.
    const big = mkTopic("big", 50_000_000, 0.3);
    const savage = mkTopic("savage", 30_000_000, 0.9);
    const picked = topNegativeByReach([big, savage], 2);
    expect(picked.map((t) => t.id)).toEqual(["savage", "big"]);
  });

  it("only considers board-negative topics, counts ties as negative, and caps at n (T2)", () => {
    const positive = mkIssue({ id: "pos", title: "Positive", posMentions: 800, negMentions: 100, reach: 90_000_000 });
    const tie = mkIssue({ id: "tie", title: "Tie", posMentions: 400, negMentions: 400, reach: 20_000_000 });
    const negs = [
      mkTopic("n1", 40_000_000, 0.8),
      mkTopic("n2", 30_000_000, 0.8),
      mkTopic("n3", 20_000_000, 0.8),
      mkTopic("n4", 10_000_000, 0.8),
    ];

    const picked = topNegativeByReach([positive, tie, ...negs], 3);
    expect(picked).toHaveLength(3);
    expect(picked.map((t) => t.id)).not.toContain("pos");
    // `pos === neg` is negative (the watchdog tie rule) — eligible, just outranked here.
    expect(topNegativeByReach([tie], 3).map((t) => t.id)).toEqual(["tie"]);
    // Fewer negatives than n → fewer results, never padded.
    expect(topNegativeByReach([negs[0]], 3)).toHaveLength(1);
    expect(topNegativeByReach([positive], 3)).toHaveLength(0);
  });
});

describe("counter-narrative — reach math (A14 AC2)", () => {
  it("derives hostile reach safely: zero impressions, and a share over 100% (T3)", () => {
    expect(negativeShare(mkIssue({ id: "z", title: "Z", mentions: 0, negMentions: 0, posMentions: 0 }))).toBe(0);
    expect(hostileReachOf(mkIssue({ id: "z", title: "Z", mentions: 0, negMentions: 0, posMentions: 0 }))).toBe(0);

    // A feed that reports more negative than total must clamp, never exceed the reach.
    const bogus = mkIssue({ id: "b", title: "B", reach: 10_000_000, mentions: 100, negMentions: 250 });
    expect(negativeShare(bogus)).toBe(1);
    expect(hostileReachOf(bogus)).toBe(10_000_000);
  });

  it("sizes the volume off the blended reach-per-post (T4)", () => {
    // .3×45_000 + .5×12_000 + .2×1_200 = 13_500 + 6_000 + 240
    expect(blendedReachPerPost()).toBe(19_740);

    const topic = mkTopic("t", 20_000_000, 0.5); // hostile = 10M
    const plan = counterNarrativePlan(topic, "professional");
    expect(plan.hostileReach).toBe(10_000_000);
    expect(plan.targetReach).toBe(30_000_000);
    expect(plan.totalPosts).toBe(Math.ceil(30_000_000 / 19_740));

    // Nothing hostile → nothing to buy.
    const calm = mkIssue({ id: "c", title: "C", reach: 5_000_000, mentions: 1_000, negMentions: 0, posMentions: 900 });
    expect(counterNarrativePlan(calm).totalPosts).toBe(0);
    expect(counterNarrativePlan(calm).shareOfVoicePct).toBe(0);
  });

  it("splits posts with no drift — the channel counts always sum to the total (T5)", () => {
    for (let total = 0; total < 200; total++) {
      const split = splitPosts(total);
      const sum = CHANNEL_ORDER.reduce((a, c) => a + split[c], 0);
      expect(sum).toBe(total);
      for (const c of CHANNEL_ORDER) expect(Number.isInteger(split[c])).toBe(true);
    }
    // Largest-remainder respects the mix at scale: 1000 → 500 clipper / 300 kol / 200 grassroots.
    expect(splitPosts(1000)).toEqual({ kol: 300, clipper: 500, homeless: 200 });
  });

  it("share of voice is complementary and tracks the tier ladder (T6)", () => {
    const topic = mkTopic("t", 20_000_000, 0.5);
    for (const tier of ["basic", "professional", "enterprise"] as const) {
      const p = counterNarrativePlan(topic, tier);
      expect(p.shareOfVoicePct + p.hostileSharePct).toBe(100);
    }
    expect(counterNarrativePlan(topic, "basic").shareOfVoicePct).toBeCloseTo(50, -0.5);
    expect(counterNarrativePlan(topic, "professional").shareOfVoicePct).toBeCloseTo(75, -0.5);
    expect(counterNarrativePlan(topic, "enterprise").shareOfVoicePct).toBeCloseTo(83, -0.5);
  });

  it("tier scales volume only — never the hostile reading (T7)", () => {
    const topic = mkTopic("t", 24_000_000, 0.75);
    const basic = counterNarrativePlan(topic, "basic");
    const pro = counterNarrativePlan(topic, "professional");
    const ent = counterNarrativePlan(topic, "enterprise");

    expect(pro.hostileReach).toBe(basic.hostileReach);
    expect(ent.hostileReach).toBe(basic.hostileReach);
    expect(basic.negSharePct).toBe(75);

    expect(pro.totalPosts).toBeGreaterThan(basic.totalPosts);
    expect(ent.totalPosts).toBeGreaterThan(pro.totalPosts);
    expect(ent.projectedReach).toBeGreaterThan(pro.projectedReach);
    expect(ent.shareOfVoicePct).toBeGreaterThan(pro.shareOfVoicePct);

    // Each channel carries its own reach-per-post through to its own reach line.
    for (const ch of pro.channels) {
      expect(ch.reachPerPost).toBe(REACH_PER_POST[ch.channel]);
      expect(ch.reach).toBe(ch.posts * REACH_PER_POST[ch.channel]);
    }
    expect(pro.channels.reduce((a, c) => a + c.posts, 0)).toBe(pro.totalPosts);
  });

  it("aggregates the board by summing totals, not averaging percentages (T8)", () => {
    const plans = [
      counterNarrativePlan(mkTopic("a", 40_000_000, 0.9), "professional"),
      counterNarrativePlan(mkTopic("b", 20_000_000, 0.5), "professional"),
      counterNarrativePlan(mkTopic("c", 8_000_000, 0.25), "professional"),
    ];
    const totals = aggregateWarRoom(plans);

    expect(totals.hostileReach).toBe(plans.reduce((a, p) => a + p.hostileReach, 0));
    expect(totals.totalPosts).toBe(plans.reduce((a, p) => a + p.totalPosts, 0));
    expect(totals.projectedReach).toBe(plans.reduce((a, p) => a + p.projectedReach, 0));
    for (const c of CHANNEL_ORDER) {
      expect(totals.posts[c]).toBe(plans.reduce((a, p) => a + (p.channels.find((x) => x.channel === c)?.posts ?? 0), 0));
    }

    // Recomputed from the summed reach — NOT the mean of the three SOV readings.
    const expected = Math.round((totals.projectedReach / (totals.hostileReach + totals.projectedReach)) * 100);
    expect(totals.shareOfVoicePct).toBe(expected);
    expect(totals.shareOfVoicePct + totals.hostileSharePct).toBe(100);

    expect(aggregateWarRoom([]).totalPosts).toBe(0);
    expect(aggregateWarRoom([]).shareOfVoicePct).toBe(0);
  });
});
