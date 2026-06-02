import { describe, expect, it } from "vitest";
import { mulberry32, statusOf, velocity, VELOCITY_WINDOW } from "./engine";

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
    expect(statusOf(10, 10_000_000, "normal")).toBe("normal");
  });

  it("rising above +80%", () => {
    expect(statusOf(81, 1_000_000, "normal")).toBe("rising");
  });

  it("escalating above +200% with reach over the 5M floor", () => {
    expect(statusOf(201, 5_000_001, "rising")).toBe("escalating");
  });

  it("NOT escalating above +200% when reach is under the floor", () => {
    expect(statusOf(300, 4_999_999, "rising")).toBe("rising");
  });

  it("stays escalating while velocity is above the rising threshold (cooldown)", () => {
    expect(statusOf(120, 6_000_000, "escalating")).toBe("escalating");
  });

  it("cools from escalating to rising-equivalent only below +80%", () => {
    expect(statusOf(79, 6_000_000, "escalating")).toBe("normal");
  });
});
