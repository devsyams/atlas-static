import { describe, expect, it } from "vitest";
import { trendDirection, trendPoints } from "./trend";

const day = (date: string, positive: number, negative: number, neutral: number) => ({ date, positive, negative, neutral });

describe("trendPoints (A11 v2.0 — net sentiment per day + partial-tail flag)", () => {
  it("computes net = (pos − neg) / total per day", () => {
    const pts = trendPoints([day("d1", 300, 100, 0)]); // (300−100)/400 = 50
    expect(pts[0].net).toBeCloseTo(50, 5);
    expect(pts[0].total).toBe(400);
  });

  it("flags a low-volume trailing day as partial (today, still accumulating)", () => {
    const pts = trendPoints([day("d1", 100, 100, 100), day("d2", 100, 100, 100), day("today", 0, 1, 2)]);
    expect(pts[2].partial).toBe(true);
    expect(pts[0].partial).toBe(false);
  });
});

describe("trendDirection (the CEO's 'better or worse?')", () => {
  const rising = [day("1", 100, 300, 0), day("2", 150, 250, 0), day("3", 200, 200, 0), day("4", 250, 150, 0), day("5", 300, 100, 0), day("today", 0, 1, 2)];

  it("reads a rising net-sentiment series as Improving (up), ignoring the partial day", () => {
    const dir = trendDirection(trendPoints(rising));
    expect(dir.direction).toBe("up");
    expect(dir.deltaPts).toBeGreaterThan(0);
  });

  it("reads a falling series as Deteriorating (down)", () => {
    const falling = [...rising].slice(0, 5).reverse().concat(day("today", 0, 1, 2));
    const dir = trendDirection(trendPoints(falling));
    expect(dir.direction).toBe("down");
    expect(dir.deltaPts).toBeLessThan(0);
  });

  it("reads a flat series as Stable", () => {
    const flat = [day("1", 200, 100, 100), day("2", 200, 100, 100), day("3", 200, 100, 100), day("4", 200, 100, 100)];
    expect(trendDirection(trendPoints(flat)).direction).toBe("flat");
  });

  it("is Stable with fewer than two complete days", () => {
    expect(trendDirection(trendPoints([day("1", 1, 0, 0)])).direction).toBe("flat");
  });
});
