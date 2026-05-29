import { describe, expect, it } from "vitest";
import { flowDuration, sweepDuration } from "./ui";

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

describe("sweepDuration", () => {
  it("is slower (calmer) when the corridor is safer", () => {
    expect(sweepDuration(95)).toBeGreaterThan(sweepDuration(30));
    expect(sweepDuration(100)).toBeGreaterThan(sweepDuration(0));
  });

  it("clamps the score and stays in a sane, positive range", () => {
    expect(sweepDuration(0)).toBeGreaterThan(0);
    expect(sweepDuration(-50)).toBe(sweepDuration(0)); // clamps low
    expect(sweepDuration(500)).toBe(sweepDuration(100)); // clamps high
    expect(sweepDuration(100)).toBeLessThanOrEqual(8);
  });
});
