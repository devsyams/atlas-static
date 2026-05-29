import { describe, expect, it } from "vitest";
import { buildSnapshot, buildCorridorPulse } from "./data";
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
    });
  }
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
