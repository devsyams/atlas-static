import { describe, expect, it } from "vitest";
import { consoleSystem } from "./console-ai";
import { MODES, modeByKey } from "./modes";

describe("simulation modes (A15 v4.0)", () => {
  it("covers exactly the two use cases the console is sold on", () => {
    expect(MODES.map((m) => m.key)).toEqual(["policy", "crisis"]);

    const policy = modeByKey("policy");
    expect(policy.audience).toMatch(/Government/i);
    expect(policy.audience).toMatch(/Think Tank/i);
    expect(policy.label).toBe("Policy Opinion Forecasting");

    const crisis = modeByKey("crisis");
    expect(crisis.audience).toMatch(/Enterprise/i);
    expect(crisis.audience).toMatch(/PR/i);
    expect(crisis.label).toBe("Crisis PR Simulation");
  });

  it("gives every mode usable samples and a headline question", () => {
    for (const m of MODES) {
      expect(m.samples.length).toBeGreaterThanOrEqual(3);
      expect(m.question.trim()).not.toBe("");
      for (const s of m.samples) {
        // Below the route's 40-char floor the console refuses to build.
        expect(s.text.trim().length).toBeGreaterThan(200);
        expect(s.label.trim()).not.toBe("");
      }
      // Sample keys must be unique or the picker can't track selection.
      expect(new Set(m.samples.map((s) => s.key)).size).toBe(m.samples.length);
    }
  });

  it("falls back to policy for an unknown or missing key", () => {
    expect(modeByKey(undefined).key).toBe("policy");
    expect(modeByKey("nonsense").key).toBe("policy");
  });

  it("asks the model for genuinely different things per mode", () => {
    const policy = consoleSystem(modeByKey("policy"));
    const crisis = consoleSystem(modeByKey("crisis"));
    expect(policy).not.toBe(crisis);

    // Policy: opinion trends and risk points across interest groups.
    expect(policy).toMatch(/KELOMPOK KEPENTINGAN/);
    expect(policy).toMatch(/TREN OPINI PER KELOMPOK/);
    expect(policy).toMatch(/TITIK RISIKO/);

    // Crisis: spread, sentiment evolution, KOL reaction, optimal response.
    expect(crisis).toMatch(/MENYEBAR/);
    expect(crisis).toMatch(/KOL/);
    expect(crisis).toMatch(/EVOLUSI SENTIMEN/);
    expect(crisis).toMatch(/RESPONS OPTIMAL/);

    // Both keep the base contract — the identity guard must survive either framing.
    for (const s of [policy, crisis]) {
      expect(s).toMatch(/IDENTITAS WAJIB FIKTIF/);
      expect(s).toMatch(/DILARANG KERAS/);
      expect(s).toMatch(/plaza/);
      expect(s).toMatch(/community/);
    }
  });
});
