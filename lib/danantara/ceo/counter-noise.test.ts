import { describe, expect, it } from "vitest";
import { negativeBaselineFromIssue, responseCalculator } from "./counter-noise";

describe("responseCalculator (A9 v2.0 — boss's counter-action model)", () => {
  it("matches the boss's worked example: 1498 baseline @ professional → 4494 / 2247 / 899 / 1348", () => {
    const p = responseCalculator(1498, "professional");
    expect(p.counterActions).toBe(4494);
    expect(p.clipper).toBe(2247); // 50%
    expect(p.homeless).toBe(899); // 20%
    expect(p.kol).toBe(1348); // 30%
  });

  it("applies the tier noise multiplier (basic ×1, professional ×3, enterprise ×5)", () => {
    expect(responseCalculator(1000, "basic").counterActions).toBe(1000);
    expect(responseCalculator(1000, "professional").counterActions).toBe(3000);
    expect(responseCalculator(1000, "enterprise").counterActions).toBe(5000);
  });

  it("defaults to the professional tier", () => {
    expect(responseCalculator(1000).noiseMultiplier).toBe(3);
  });

  it("splits the total clipper 50% / homeless 20% / kol 30%", () => {
    const p = responseCalculator(2000, "professional"); // total 6000
    expect(p.clipper).toBe(3000);
    expect(p.homeless).toBe(1200);
    expect(p.kol).toBe(1800);
    expect(p.clipper + p.homeless + p.kol).toBe(p.counterActions);
  });

  it("keeps the split summing exactly to counter-actions across every baseline (largest remainder)", () => {
    // Naive per-channel rounding drifts ±1 (e.g. 603 → 302+121+181 = 604); the three
    // tiles now sit under one visible total, so they must add up.
    for (let baseline = 0; baseline <= 400; baseline++) {
      for (const tier of ["basic", "professional", "enterprise"] as const) {
        const p = responseCalculator(baseline, tier);
        expect(p.clipper + p.homeless + p.kol).toBe(p.counterActions);
      }
    }
  });

  it("scales the response up with a larger baseline", () => {
    const small = responseCalculator(500, "professional");
    const big = responseCalculator(5000, "professional");
    expect(big.counterActions).toBeGreaterThan(small.counterActions);
  });

  it("is deterministic — same input yields the same plan", () => {
    expect(responseCalculator(1498, "enterprise")).toEqual(responseCalculator(1498, "enterprise"));
  });

  it("estimates the negative-post baseline from negative impressions", () => {
    // ~11M negative impressions ÷ 7500 ≈ ~1467 posts (the demo's realistic range).
    const baseline = negativeBaselineFromIssue({ negMentions: 11_000_000 });
    expect(baseline).toBeGreaterThan(1000);
    expect(baseline).toBeLessThan(2000);
  });

  it("floors the baseline at 1 — a negative topic always has at least one post to counter", () => {
    // Zero-volume rows (news/facebook-only clusters — upstream has no view metrics)
    // report negMentions=0 while sentiment says Negative: posts exist, views are unmeasured.
    expect(negativeBaselineFromIssue({ negMentions: 0 })).toBe(1);
    // Low-volume: < 3750 negative impressions used to round down to a 0-post baseline.
    expect(negativeBaselineFromIssue({ negMentions: 2_000 })).toBe(1);
  });
});
