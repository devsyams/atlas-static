import { describe, expect, it } from "vitest";
import { estimateRunTime, simClock } from "./SimulationConsole";
import { HOURS_PER_ROUND } from "@/lib/danantara/sim/sim-config";

/**
 * Two small pieces of presentation logic that a client reads as facts about the run, so
 * they are worth pinning: the run-length estimate shown next to the rounds slider, and
 * the simulated clock stamped on every post in the feed.
 */

describe("estimateRunTime", () => {
  it("uses seconds under a minute — '~0 min' reads as broken", () => {
    expect(estimateRunTime(1)).toBe("~2s");
    expect(estimateRunTime(6)).toBe("~11s");
    expect(estimateRunTime(6)).not.toMatch(/min/);
  });

  it("switches to minutes once the run is long enough to warrant them", () => {
    expect(estimateRunTime(40)).toMatch(/min$/);
  });

  it("grows with the round count", () => {
    const secs = (r: number) => Number(estimateRunTime(r).replace(/[^\d.]/g, ""));
    expect(secs(6)).toBeGreaterThan(secs(3));
  });
});

describe("simClock", () => {
  it("starts the run at 06:00 and advances one round at a time", () => {
    expect(simClock(0)).toBe("06:00");
    expect(simClock(1)).toBe(`${String(6 + HOURS_PER_ROUND).padStart(2, "0")}:00`);
  });

  it("wraps around midnight rather than running past 24", () => {
    for (let r = 0; r < 20; r++) {
      const [h] = simClock(r).split(":").map(Number);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(24);
    }
    // Two rounds per day at 12h each, so the clock repeats every other round.
    expect(simClock(2)).toBe(simClock(0));
  });
});
