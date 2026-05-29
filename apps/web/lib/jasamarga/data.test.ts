import { describe, expect, it } from "vitest";
import { buildSnapshot } from "./data";

describe("buildSnapshot — safety + map coordinates", () => {
  it("includes a complete SafetyIndex", () => {
    const snap = buildSnapshot();
    expect(snap.safety).toBeDefined();
    expect(snap.safety.score).toBeGreaterThanOrEqual(0);
    expect(snap.safety.score).toBeLessThanOrEqual(100);
    expect(snap.safety.factors).toHaveLength(4);
    expect(["Aman", "Waspada", "Rawan", "Bahaya"]).toContain(snap.safety.level);
    expect(typeof snap.safety.narrative).toBe("string");
  });

  it("gives every incident a map coordinate", () => {
    const snap = buildSnapshot();
    for (const inc of snap.incidents) {
      expect(typeof inc.lat).toBe("number");
      expect(typeof inc.lng).toBe("number");
    }
  });
});
