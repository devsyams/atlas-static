import { describe, expect, it } from "vitest";
import { flowDuration } from "./ui";

describe("flowDuration", () => {
  it("is faster (shorter) for higher speeds — monotonic", () => {
    expect(flowDuration(80)).toBeLessThan(flowDuration(20));
    expect(flowDuration(40)).toBeLessThan(flowDuration(10));
  });

  it("clamps to a sane animation range", () => {
    expect(flowDuration(1000)).toBeGreaterThanOrEqual(0.6);
    expect(flowDuration(1000)).toBe(0.6); // very fast → floor
    expect(flowDuration(1)).toBeLessThanOrEqual(8);
    expect(flowDuration(1)).toBe(8); // gridlock → ceiling (near-static)
  });

  it("always returns a positive number", () => {
    for (const s of [0, 5, 17, 47, 90]) {
      expect(flowDuration(s)).toBeGreaterThan(0);
      expect(Number.isFinite(flowDuration(s))).toBe(true);
    }
  });
});
