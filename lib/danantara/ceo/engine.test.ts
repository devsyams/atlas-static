import { describe, expect, it } from "vitest";
import { briefLines, mulberry32, rankBumn, rankIssues, spotlightQueue, statusOf, tick, velocity, HISTORY_LIMIT, VELOCITY_WINDOW, RISING_THRESHOLD, ESCALATING_THRESHOLD, REACH_FLOOR, REACH_CAP } from "./engine";
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

describe("statusOf ladder (T4 / AC4)", () => {
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
    ...over,
  };
}

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
  it("sorts most-negative sentiment first", () => {
    const ranked = rankBumn([
      makeBumn({ id: "good", sentiment: 60 }),
      makeBumn({ id: "bad", sentiment: -70 }),
      makeBumn({ id: "neutral", sentiment: 0 }),
    ]);
    expect(ranked.map((b) => b.id)).toEqual(["bad", "neutral", "good"]);
  });

  it("does not mutate the input array", () => {
    const input = [makeBumn({ id: "a", sentiment: 10 }), makeBumn({ id: "b", sentiment: -10 })];
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

  it("keeps issues ranked by reach and bumn by sentiment after ticking", () => {
    const state = makeState(
      [makeIssue({ id: "a", reach: 100 }), makeIssue({ id: "b", reach: 200 })],
      [makeBumn({ id: "x", sentiment: 50 }), makeBumn({ id: "y", sentiment: -50 })],
    );
    const next = tick(state, mulberry32(1), []);
    for (let i = 1; i < next.issues.length; i++) {
      expect(next.issues[i - 1].reach).toBeGreaterThanOrEqual(next.issues[i].reach);
    }
    for (let i = 1; i < next.bumn.length; i++) {
      expect(next.bumn[i - 1].sentiment).toBeLessThanOrEqual(next.bumn[i].sentiment);
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

describe("spotlightQueue concurrent escalation", () => {
  it("orders the spotlight queue by velocity when two arcs escalate concurrently", () => {
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
    expect(fast.status).toBe("escalating");
    expect(slow.status).toBe("escalating");
    const queue = spotlightQueue(state.issues);
    expect(queue[0]).toBe("fast");
    expect(queue[1]).toBe("slow");
    expect(queue[2]).toBe("calm");
  });
});

describe("scripted escalation arcs (T5 / AC5)", () => {
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

describe("spotlightQueue", () => {
  it("returns issue ids in reach order when nothing escalates", () => {
    const issues = rankIssues([
      makeIssue({ id: "big", reach: 9000 }),
      makeIssue({ id: "small", reach: 100 }),
    ]);
    expect(spotlightQueue(issues)).toEqual(["big", "small"]);
  });

  it("pins escalating issues to the front, ordered by velocity", () => {
    const issues = rankIssues([
      makeIssue({ id: "big", reach: 9000 }),
      makeIssue({ id: "esc-slow", reach: 100, status: "escalating", velocity: 210 }),
      makeIssue({ id: "esc-fast", reach: 50, status: "escalating", velocity: 400 }),
    ]);
    expect(spotlightQueue(issues)).toEqual(["esc-fast", "esc-slow", "big"]);
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
    expect(lines[0].toUpperCase()).toContain("ESKALASI");
  });
});
