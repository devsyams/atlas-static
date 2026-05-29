import { describe, expect, it } from "vitest";
import { buildSnapshot, buildCorridorPulse, projectSegments } from "./data";
import { CORRIDORS } from "./corridors";

describe("buildSnapshot — corridor-aware safety + map coordinates", () => {
  for (const corridor of CORRIDORS) {
    describe(corridor.id, () => {
      it("includes a complete SafetyIndex", () => {
        const snap = buildSnapshot(corridor.id);
        expect(snap.safety).toBeDefined();
        expect(snap.safety.score).toBeGreaterThanOrEqual(0);
        expect(snap.safety.score).toBeLessThanOrEqual(100);
        expect(snap.safety.factors).toHaveLength(4);
        expect(["Aman", "Waspada", "Rawan", "Bahaya"]).toContain(snap.safety.level);
        expect(typeof snap.safety.narrative).toBe("string");
      });

      it("gives every incident a numeric map coordinate", () => {
        const snap = buildSnapshot(corridor.id);
        expect(snap.incidents.length).toBeGreaterThan(0);
        for (const inc of snap.incidents) {
          expect(typeof inc.lat).toBe("number");
          expect(typeof inc.lng).toBe("number");
        }
      });

      it("reports the corridor name and matching segment count", () => {
        const snap = buildSnapshot(corridor.id);
        expect(snap.corridor).toBe(corridor.name);
        expect(snap.segments).toHaveLength(corridor.segments.length);
      });

      it("produces AI-vision CCTV feeds with counts, flags and coordinates", () => {
        const snap = buildSnapshot(corridor.id);
        expect(snap.cctv.length).toBeGreaterThanOrEqual(1);
        for (const cam of snap.cctv) {
          expect(cam.vehicles.mobil).toBeGreaterThan(0);
          expect(cam.flags.length).toBeGreaterThan(0);
          expect(cam.confidence).toBeGreaterThanOrEqual(0.9);
          expect(cam.confidence).toBeLessThanOrEqual(0.99);
          expect(typeof cam.lat).toBe("number");
          expect(typeof cam.lng).toBe("number");
          expect(["lancar", "padat", "macet", "lumpuh"]).toContain(cam.status);
        }
      });
    });
  }
});

describe("projectSegments — time-machine forecast recolor", () => {
  const base = buildSnapshot("japek").segments;

  it("slows segments down when projecting to a worse (higher) load", () => {
    const worse = projectSegments(base, 4, 9);
    const avgBase = base.reduce((a, s) => a + s.speed, 0) / base.length;
    const avgWorse = worse.reduce((a, s) => a + s.speed, 0) / worse.length;
    expect(avgWorse).toBeLessThan(avgBase);
    expect(worse).toHaveLength(base.length);
  });

  it("speeds segments up when projecting to a better (lower) load", () => {
    const better = projectSegments(base, 8, 2);
    const avgBase = base.reduce((a, s) => a + s.speed, 0) / base.length;
    const avgBetter = better.reduce((a, s) => a + s.speed, 0) / better.length;
    expect(avgBetter).toBeGreaterThanOrEqual(avgBase);
    for (const s of better) expect(["lancar", "padat", "macet", "lumpuh"]).toContain(s.status);
  });
});

describe("buildCorridorPulse — per-corridor status dots", () => {
  for (const corridor of CORRIDORS) {
    it(`returns a valid pulse for ${corridor.id}`, () => {
      const pulse = buildCorridorPulse(corridor.id);
      expect(pulse.id).toBe(corridor.id);
      expect(pulse.short).toBe(corridor.short);
      expect(pulse.name).toBe(corridor.name);
      expect(pulse.score).toBeGreaterThanOrEqual(0);
      expect(pulse.score).toBeLessThanOrEqual(100);
      expect(["Aman", "Waspada", "Rawan", "Bahaya"]).toContain(pulse.level);
      expect(pulse.load_index).toBeGreaterThanOrEqual(0);
      expect(pulse.load_index).toBeLessThanOrEqual(10);
    });
  }
});
