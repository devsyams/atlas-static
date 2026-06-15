import { describe, expect, it } from "vitest";
import { briefLines, groupBumnBySentiment, groupIssuesBySentiment, mulberry32, rankBumn, rankIssues, sentimentTotals, statusOf, tick, topicsForBumn, velocity, HISTORY_LIMIT, VELOCITY_WINDOW, RISING_THRESHOLD, ESCALATING_THRESHOLD, REACH_FLOOR, REACH_CAP, NEUTRAL_SHARE, rankMovement, sentimentBreakdown } from "./engine";
import { makeBumn, makeIssue } from "./test-fixtures";
import type { BumnSentiment, CeoIssue, CeoState, EscalationArc } from "./types";

describe("mulberry32 PRNG", () => {
  it("is deterministic for the same seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("returns values in [0, 1)", () => {
    const r = mulberry32(7);
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("velocity (T2)", () => {
  it("computes % growth over the rolling window", () => {
    // window of 6: first = 100, last = 340 → +240%
    const history = [100, 120, 150, 200, 260, 340];
    expect(velocity(history)).toBeCloseTo(240, 0);
  });

  it("only looks at the last VELOCITY_WINDOW entries", () => {
    const history = [9999, 9999, 100, 120, 150, 200, 260, 340];
    expect(velocity(history)).toBeCloseTo(240, 0);
    expect(VELOCITY_WINDOW).toBe(6);
  });

  it("returns 0 for flat history", () => {
    expect(velocity([500, 500, 500, 500, 500, 500])).toBe(0);
  });

  it("returns 0 when history is shorter than 2 entries", () => {
    expect(velocity([100])).toBe(0);
    expect(velocity([])).toBe(0);
  });
});

describe("statusOf ladder (board status badges, AC2)", () => {
  it("normal when velocity is low", () => {
    expect(statusOf(RISING_THRESHOLD - 1, REACH_FLOOR * 2, "normal")).toBe("normal");
  });

  it("rising above the rising threshold", () => {
    expect(statusOf(RISING_THRESHOLD + 1, REACH_FLOOR / 5, "normal")).toBe("rising");
  });

  it("escalating above the escalating threshold with reach over the floor", () => {
    expect(statusOf(ESCALATING_THRESHOLD + 1, REACH_FLOOR + 1, "rising")).toBe("escalating");
  });

  it("NOT escalating above the escalating threshold when reach is under the floor", () => {
    expect(statusOf(ESCALATING_THRESHOLD + 100, REACH_FLOOR - 1, "rising")).toBe("rising");
  });

  it("stays escalating while velocity is above the rising threshold (cooldown)", () => {
    expect(statusOf(RISING_THRESHOLD + 40, REACH_FLOOR + 1_000_000, "escalating")).toBe("escalating");
  });

  it("cools from escalating only below the rising threshold", () => {
    expect(statusOf(RISING_THRESHOLD - 1, REACH_FLOOR + 1_000_000, "escalating")).toBe("normal");
  });
});

describe("rankIssues (T2 / AC2)", () => {
  it("sorts by reach descending", () => {
    const ranked = rankIssues([
      makeIssue({ id: "low", reach: 100 }),
      makeIssue({ id: "high", reach: 9000 }),
      makeIssue({ id: "mid", reach: 5000 }),
    ]);
    expect(ranked.map((i) => i.id)).toEqual(["high", "mid", "low"]);
  });

  it("does not mutate the input array", () => {
    const input = [makeIssue({ id: "a", reach: 1 }), makeIssue({ id: "b", reach: 2 })];
    rankIssues(input);
    expect(input.map((i) => i.id)).toEqual(["a", "b"]);
  });
});

describe("rankBumn (T3 / AC3)", () => {
  it("sorts by highest negative reach first (negReach, not impressions)", () => {
    const ranked = rankBumn([
      makeBumn({ id: "quiet", negReach: 100, posReach: 50 }),
      makeBumn({ id: "loud", negReach: 9_000_000, posReach: 50 }),
      makeBumn({ id: "mid", negReach: 5_000_000, posReach: 50 }),
    ]);
    expect(ranked.map((b) => b.id)).toEqual(["loud", "mid", "quiet"]);
  });

  it("ranks by reach, NOT impression-based negMentions", () => {
    // `bigReach` has huge negative reach but tiny negMentions; `bigMentions` is
    // the reverse. The reach one must win — guards against the v44.0 regression.
    const ranked = rankBumn([
      makeBumn({ id: "bigMentions", negMentions: 9_000_000, negReach: 100 }),
      makeBumn({ id: "bigReach", negMentions: 1, negReach: 9_000_000 }),
    ]);
    expect(ranked.map((b) => b.id)).toEqual(["bigReach", "bigMentions"]);
  });

  it("tie-breaks equal negative reach by positive reach (desc)", () => {
    const ranked = rankBumn([
      makeBumn({ id: "lowpos", negReach: 1_000_000, posReach: 100 }),
      makeBumn({ id: "highpos", negReach: 1_000_000, posReach: 900 }),
    ]);
    expect(ranked.map((b) => b.id)).toEqual(["highpos", "lowpos"]);
  });

  it("ranks by negative reach regardless of net sentiment", () => {
    // `big` is net-positive but has far more negative reach than the net-negative `small`.
    const ranked = rankBumn([
      makeBumn({ id: "small", sentiment: -80, negReach: 90, posReach: 10 }),
      makeBumn({ id: "big", sentiment: 40, negReach: 9_000_000, posReach: 12_000_000 }),
    ]);
    expect(ranked.map((b) => b.id)).toEqual(["big", "small"]);
  });

  it("does not mutate the input array", () => {
    const input = [makeBumn({ id: "a", negReach: 10 }), makeBumn({ id: "b", negReach: 20 })];
    rankBumn(input);
    expect(input.map((b) => b.id)).toEqual(["a", "b"]);
  });
});

function makeState(issues: CeoIssue[], bumn: BumnSentiment[] = [], tickCount = 0): CeoState {
  return { tickCount, issues: rankIssues(issues), bumn: rankBumn(bumn) };
}

describe("tick (T2 / AC2)", () => {
  it("increments tickCount and keeps mentions/reach positive and bounded", () => {
    const state = makeState([makeIssue({ id: "a", mentions: 1000, reach: 1_000_000 })]);
    const next = tick(state, mulberry32(1), []);
    expect(next.tickCount).toBe(1);
    expect(next.issues[0].mentions).toBeGreaterThan(0);
    // organic change is at most ±2%
    expect(Math.abs(next.issues[0].mentions - 1000)).toBeLessThanOrEqual(20);
    expect(next.issues[0].reach).toBeGreaterThan(0);
    expect(next.issues[0].reach).toBeLessThanOrEqual(REACH_CAP);
  });

  it("appends to history and caps it at HISTORY_LIMIT", () => {
    const longHistory = Array.from({ length: 50 }, (_, i) => 100 + i);
    const state = makeState([makeIssue({ id: "a", history: longHistory })]);
    const next = tick(state, mulberry32(1), []);
    expect(next.issues[0].history.length).toBeLessThanOrEqual(HISTORY_LIMIT);
    expect(next.issues[0].history[next.issues[0].history.length - 1]).toBe(next.issues[0].mentions);
  });

  it("keeps issues ranked by reach and bumn by negative reach after ticking", () => {
    const state = makeState(
      [makeIssue({ id: "a", reach: 100 }), makeIssue({ id: "b", reach: 200 })],
      [makeBumn({ id: "x", reach: 1000 }), makeBumn({ id: "y", reach: 4000 })],
    );
    const next = tick(state, mulberry32(1), []);
    for (let i = 1; i < next.issues.length; i++) {
      expect(next.issues[i - 1].reach).toBeGreaterThanOrEqual(next.issues[i].reach);
    }
    for (let i = 1; i < next.bumn.length; i++) {
      expect(next.bumn[i - 1].negReach).toBeGreaterThanOrEqual(next.bumn[i].negReach);
    }
  });

  it("recomputes velocity and status each tick", () => {
    const state = makeState([makeIssue({ id: "a" })]);
    const next = tick(state, mulberry32(1), []);
    expect(typeof next.issues[0].velocity).toBe("number");
    expect(["normal", "rising", "escalating"]).toContain(next.issues[0].status);
  });

  it("is deterministic for the same PRNG seed", () => {
    const state = makeState([makeIssue({ id: "a" })]);
    const a = tick(state, mulberry32(99), []);
    const b = tick(state, mulberry32(99), []);
    expect(a.issues[0].mentions).toBe(b.issues[0].mentions);
  });

  it("does not mutate the previous state", () => {
    const state = makeState([makeIssue({ id: "a", mentions: 1000 })]);
    tick(state, mulberry32(1), []);
    expect(state.issues[0].mentions).toBe(1000);
    expect(state.tickCount).toBe(0);
  });

  it("keeps numbers believable over a long demo session (200 ticks ≈ 13 min)", () => {
    let state = makeState([
      makeIssue({ id: "big", mentions: 12_000, reach: 50_000_000 }),
      makeIssue({ id: "small", mentions: 1_500, reach: 6_000_000 }),
    ]);
    const rand = mulberry32(7);
    for (let i = 0; i < 200; i++) {
      state = tick(state, rand, []);
    }
    for (const issue of state.issues) {
      // No unbounded compounding: stays within a sane band of the initial values.
      expect(issue.reach).toBeLessThanOrEqual(REACH_CAP);
      expect(issue.mentions).toBeGreaterThan(100);
      expect(issue.mentions).toBeLessThan(120_000);
    }
  });
});

describe("concurrent escalation arcs", () => {
  it("escalates two issues at once when both arcs ramp together", () => {
    const arcs: EscalationArc[] = [
      { issueId: "fast", atTick: 0, rampTicks: 6, growthPerTick: 0.6 },
      { issueId: "slow", atTick: 0, rampTicks: 6, growthPerTick: 0.3 },
    ];
    let state = makeState([
      makeIssue({ id: "fast", mentions: 1000, reach: 6_000_000 }),
      makeIssue({ id: "slow", mentions: 1000, reach: 8_000_000 }),
      makeIssue({ id: "calm", mentions: 5000, reach: 60_000_000 }),
    ]);
    const rand = mulberry32(11);
    for (let i = 0; i < 6; i++) {
      state = tick(state, rand, arcs);
    }
    const fast = state.issues.find((i) => i.id === "fast")!;
    const slow = state.issues.find((i) => i.id === "slow")!;
    const calm = state.issues.find((i) => i.id === "calm")!;
    expect(fast.status).toBe("escalating");
    expect(slow.status).toBe("escalating");
    expect(calm.status).toBe("normal");
  });
});

describe("scripted escalation arcs (board badges, AC2)", () => {
  const arc: EscalationArc = { issueId: "target", atTick: 3, rampTicks: 5, growthPerTick: 0.45 };

  it("does not spike before atTick", () => {
    const state = makeState([makeIssue({ id: "target", mentions: 1000, reach: 6_000_000 })], [], 0);
    const next = tick(state, mulberry32(1), [arc]);
    // organic growth only: well under +10% in one tick
    expect(next.issues[0].mentions).toBeLessThan(1100);
  });

  it("spikes mentions by growthPerTick while the arc is active", () => {
    const state = makeState([makeIssue({ id: "target", mentions: 1000, reach: 6_000_000 })], [], 3);
    const next = tick(state, mulberry32(1), [arc]);
    // 45% growth ± organic noise
    expect(next.issues[0].mentions).toBeGreaterThanOrEqual(1400);
  });

  it("reliably reaches escalating status by the end of the ramp", () => {
    let state = makeState(
      [makeIssue({ id: "target", mentions: 1000, reach: 6_000_000, history: [1000, 1000, 1000, 1000, 1000, 1000] })],
      [],
      3,
    );
    const rand = mulberry32(1);
    for (let i = 0; i < arc.rampTicks; i++) {
      state = tick(state, rand, [arc]);
    }
    expect(state.issues[0].status).toBe("escalating");
  });
});

describe("briefLines", () => {
  it("includes total mentions and the top issue", () => {
    const state = makeState(
      [makeIssue({ id: "a", title: "Isu Utama", mentions: 5000, reach: 9000 })],
      [makeBumn({ id: "prt", name: "Pertamina", sentiment: -40 })],
    );
    const lines = briefLines(state);
    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(lines.join(" ")).toContain("Isu Utama");
    expect(lines.join(" ")).toContain("Pertamina");
  });

  it("leads with an escalation warning when an issue is escalating", () => {
    const state = makeState([
      makeIssue({ id: "a", title: "Isu Meledak", status: "escalating", velocity: 320, reach: 9_000_000 }),
    ]);
    const lines = briefLines(state);
    expect(lines[0]).toContain("Isu Meledak");
    expect(lines[0].toUpperCase()).toContain("ESCALATING");
  });
});

describe("sentimentBreakdown (T9 / AC9)", () => {
  it("counts sum exactly to mentions", () => {
    for (const s of [-100, -42, 0, 18, 100]) {
      const { pos, neg, neu } = sentimentBreakdown(s, 12_345);
      expect(pos + neg + neu).toBe(12_345);
    }
  });

  it("net sign follows sentiment sign", () => {
    expect(sentimentBreakdown(-42, 10_000).neg).toBeGreaterThan(sentimentBreakdown(-42, 10_000).pos);
    expect(sentimentBreakdown(42, 10_000).pos).toBeGreaterThan(sentimentBreakdown(42, 10_000).neg);
  });

  it("balanced when sentiment is 0", () => {
    const { pos, neg } = sentimentBreakdown(0, 10_000);
    expect(pos).toBe(neg);
  });

  it("extreme sentiment pushes one side to ~0", () => {
    expect(sentimentBreakdown(-100, 10_000).pos).toBe(0);
    expect(sentimentBreakdown(100, 10_000).neg).toBe(0);
  });

  it("neutral share stays fixed at NEUTRAL_SHARE", () => {
    const { neu } = sentimentBreakdown(0, 10_000);
    expect(neu).toBe(Math.round(10_000 * NEUTRAL_SHARE));
  });
});

describe("rankMovement (T8 / AC8)", () => {
  it("positive when the item climbed (rank number decreased)", () => {
    expect(rankMovement([5, 5, 4, 3, 2, 1])).toBe(4);
  });

  it("negative when the item dropped", () => {
    expect(rankMovement([1, 1, 2, 3, 3, 4])).toBe(-3);
  });

  it("zero when unchanged or too little history", () => {
    expect(rankMovement([2, 2, 2, 2, 2, 2])).toBe(0);
    expect(rankMovement([7])).toBe(0);
    expect(rankMovement([])).toBe(0);
  });

  it("only considers the rolling window", () => {
    expect(rankMovement([20, 20, 1, 1, 1, 1, 1, 1])).toBe(0);
  });
});

describe("groupIssuesBySentiment (T12 / AC12)", () => {
  it("puts issues with more positive than negative mentions in the positive group", () => {
    const { positive, negative } = groupIssuesBySentiment([
      makeIssue({ id: "good", posMentions: 600, negMentions: 100 }),
      makeIssue({ id: "bad", posMentions: 100, negMentions: 600 }),
    ]);
    expect(positive.map((i) => i.id)).toEqual(["good"]);
    expect(negative.map((i) => i.id)).toEqual(["bad"]);
  });

  it("ties go to the negative group (conservative for a watchdog product)", () => {
    const { positive, negative } = groupIssuesBySentiment([
      makeIssue({ id: "tied", posMentions: 300, negMentions: 300 }),
    ]);
    expect(positive).toEqual([]);
    expect(negative.map((i) => i.id)).toEqual(["tied"]);
  });

  it("orders each group by reach descending", () => {
    const { positive, negative } = groupIssuesBySentiment([
      makeIssue({ id: "good-small", posMentions: 9, negMentions: 1, reach: 100 }),
      makeIssue({ id: "bad-big", posMentions: 1, negMentions: 9, reach: 9000 }),
      makeIssue({ id: "good-big", posMentions: 9, negMentions: 1, reach: 9000 }),
      makeIssue({ id: "bad-small", posMentions: 1, negMentions: 9, reach: 100 }),
    ]);
    expect(positive.map((i) => i.id)).toEqual(["good-big", "good-small"]);
    expect(negative.map((i) => i.id)).toEqual(["bad-big", "bad-small"]);
  });

  it("does not mutate the input array", () => {
    const input = [
      makeIssue({ id: "a", posMentions: 9, negMentions: 1, reach: 1 }),
      makeIssue({ id: "b", posMentions: 9, negMentions: 1, reach: 2 }),
    ];
    groupIssuesBySentiment(input);
    expect(input.map((i) => i.id)).toEqual(["a", "b"]);
  });
});

describe("groupBumnBySentiment (T13 / AC13)", () => {
  it("splits by net sentiment sign: >= 0 positive, < 0 negative", () => {
    const { positive, negative } = groupBumnBySentiment([
      makeBumn({ id: "up", sentiment: 40 }),
      makeBumn({ id: "zero", sentiment: 0 }),
      makeBumn({ id: "down", sentiment: -40 }),
    ]);
    expect(positive.map((b) => b.id)).toEqual(expect.arrayContaining(["up", "zero"]));
    expect(negative.map((b) => b.id)).toEqual(["down"]);
  });

  it("orders the positive group most-positive first", () => {
    const { positive } = groupBumnBySentiment([
      makeBumn({ id: "ok", sentiment: 10 }),
      makeBumn({ id: "great", sentiment: 80 }),
    ]);
    expect(positive.map((b) => b.id)).toEqual(["great", "ok"]);
  });

  it("orders the negative group most-negative first", () => {
    const { negative } = groupBumnBySentiment([
      makeBumn({ id: "meh", sentiment: -10 }),
      makeBumn({ id: "awful", sentiment: -80 }),
    ]);
    expect(negative.map((b) => b.id)).toEqual(["awful", "meh"]);
  });

  it("does not mutate the input array", () => {
    const input = [makeBumn({ id: "a", sentiment: 10 }), makeBumn({ id: "b", sentiment: 50 })];
    groupBumnBySentiment(input);
    expect(input.map((b) => b.id)).toEqual(["a", "b"]);
  });
});

describe("topicsForBumn (T16 / AC16)", () => {
  const issues = [
    makeIssue({ id: "pos-big", relatedBumn: ["x"], posMentions: 900, negMentions: 100, reach: 9_000_000 }),
    makeIssue({ id: "pos-small", relatedBumn: ["x"], posMentions: 800, negMentions: 200, reach: 2_000_000 }),
    makeIssue({ id: "neg-big", relatedBumn: ["x"], posMentions: 100, negMentions: 900, reach: 8_000_000 }),
    makeIssue({ id: "neg-small", relatedBumn: ["x"], posMentions: 200, negMentions: 800, reach: 1_000_000 }),
    makeIssue({ id: "other", relatedBumn: ["y"], posMentions: 900, negMentions: 100, reach: 99_000_000 }),
  ];

  it("picks the highest-reach linked positive and negative topic", () => {
    const { positive, negative } = topicsForBumn("x", issues);
    expect(positive?.id).toBe("pos-big");
    expect(negative?.id).toBe("neg-big");
  });

  it("ignores topics not linked to the BUMN", () => {
    const { positive, negative } = topicsForBumn("y", issues);
    expect(positive?.id).toBe("other");
    expect(negative).toBeNull();
  });

  it("returns null for a tone with no linked topic", () => {
    const onlyPositive = [makeIssue({ id: "p", relatedBumn: ["z"], posMentions: 900, negMentions: 100 })];
    const { positive, negative } = topicsForBumn("z", onlyPositive);
    expect(positive?.id).toBe("p");
    expect(negative).toBeNull();
  });

  it("classifies a tie (pos == neg) as negative, like groupIssuesBySentiment", () => {
    const tie = [makeIssue({ id: "t", relatedBumn: ["w"], posMentions: 500, negMentions: 500 })];
    const { positive, negative } = topicsForBumn("w", tie);
    expect(positive).toBeNull();
    expect(negative?.id).toBe("t");
  });
});

describe("sentimentTotals (T14 / AC14)", () => {
  it("sums pos/neg/neutral mention counts across items", () => {
    const totals = sentimentTotals([
      makeIssue({ id: "a", mentions: 1000, posMentions: 400, negMentions: 300 }),
      makeIssue({ id: "b", mentions: 2000, posMentions: 100, negMentions: 1500 }),
    ]);
    expect(totals.pos).toBe(500);
    expect(totals.neg).toBe(1800);
    expect(totals.neu).toBe(3000 - 500 - 1800);
    expect(totals.total).toBe(3000);
  });

  it("works for BUMN rows too (same mention fields)", () => {
    const totals = sentimentTotals([
      makeBumn({ id: "x", mentions: 100, posMentions: 60, negMentions: 30 }),
    ]);
    expect(totals).toEqual({ pos: 60, neg: 30, neu: 10, total: 100 });
  });

  it("returns all zeros for an empty list", () => {
    expect(sentimentTotals([])).toEqual({ pos: 0, neg: 0, neu: 0, total: 0 });
  });

  it("never returns negative neutral (clamps when pos+neg exceed mentions due to rounding)", () => {
    const totals = sentimentTotals([
      makeIssue({ id: "a", mentions: 100, posMentions: 60, negMentions: 50 }),
    ]);
    expect(totals.neu).toBe(0);
  });
});

describe("tick rank tracking (T8 / AC8)", () => {
  it("appends current rank to rankHistory each tick", () => {
    const state = makeState([
      makeIssue({ id: "top", reach: 9_000_000 }),
      makeIssue({ id: "bottom", reach: 1_000_000 }),
    ]);
    const next = tick(state, mulberry32(1), []);
    const top = next.issues.find((i) => i.id === "top")!;
    const bottom = next.issues.find((i) => i.id === "bottom")!;
    expect(top.rankHistory[top.rankHistory.length - 1]).toBe(1);
    expect(bottom.rankHistory[bottom.rankHistory.length - 1]).toBe(2);
  });

  it("an issue spiked by an arc climbs the ranks with a positive rankDelta", () => {
    // "underdog" starts last on reach; the arc multiplies its mentions (and reach tracks mentions),
    // so within the window it should overtake and report a positive rankDelta.
    const issues = [
      makeIssue({ id: "leader", mentions: 5000, reach: 8_000_000, rankHistory: [1, 1, 1, 1, 1, 1] }),
      makeIssue({ id: "underdog", mentions: 1000, reach: 6_000_000, rankHistory: [2, 2, 2, 2, 2, 2] }),
    ];
    const arc: EscalationArc = { issueId: "underdog", atTick: 0, rampTicks: 6, growthPerTick: 0.5 };
    let state = makeState(issues);
    const rand = mulberry32(5);
    for (let i = 0; i < 5; i++) state = tick(state, rand, [arc]);
    const underdog = state.issues.find((i) => i.id === "underdog")!;
    expect(state.issues[0].id).toBe("underdog"); // overtook on reach
    expect(underdog.rankDelta).toBeGreaterThan(0); // climbed
    const leader = state.issues.find((i) => i.id === "leader")!;
    expect(leader.rankDelta).toBeLessThan(0); // dropped
  });

  it("computes pos/neg mention counts on every tick", () => {
    const state = makeState([makeIssue({ id: "a", sentiment: -42, mentions: 10_000 })]);
    const next = tick(state, mulberry32(1), []);
    const a = next.issues[0];
    expect(a.posMentions + a.negMentions).toBeLessThanOrEqual(a.mentions);
    expect(a.negMentions).toBeGreaterThan(a.posMentions); // negative sentiment
  });

  it("tracks BUMN ranks and breakdown too", () => {
    const state = makeState(
      [makeIssue({ id: "i" })],
      [makeBumn({ id: "worse", sentiment: -50, mentions: 1000 }), makeBumn({ id: "better", sentiment: 50, mentions: 1000 })],
    );
    const next = tick(state, mulberry32(1), []);
    const worse = next.bumn.find((b) => b.id === "worse")!;
    expect(worse.rankHistory[worse.rankHistory.length - 1]).toBe(1); // most negative = rank 1
    expect(worse.negMentions).toBeGreaterThan(worse.posMentions);
    expect(typeof worse.rankDelta).toBe("number");
  });
});
