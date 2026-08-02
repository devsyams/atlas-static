import { describe, expect, it } from "vitest";

import captured from "@/lib/bgn/mock/actor-intelligence.json";
import { mapCapturedRoster } from "./actor-intel";

// T26 (A10 v10.0 / AC12) — the captured OpenGate roster maps to ThreatDriver cards
// carrying the full `intel` detail for the popup.
describe("mapCapturedRoster", () => {
  const drivers = mapCapturedRoster(captured);

  it("keeps only Twitter/X actors, in source (priority) order", () => {
    expect(drivers.length).toBe(10);
    expect(drivers[0].handle).toBe("LambeSahamjja");
    // urgent block first, then the high-priority @txtdrimedia, then mediums
    expect(drivers.map((d) => d.handle)).toContain("txtdrimedia");
    expect(drivers.findIndex((d) => d.handle === "txtdrimedia")).toBeGreaterThan(
      drivers.findIndex((d) => d.handle === "penduduk_lokal_"),
    );
    expect(drivers.findIndex((d) => d.handle === "ardisatriawan")).toBeGreaterThan(
      drivers.findIndex((d) => d.handle === "txtdrimedia"),
    );
  });

  it("converts abbreviated follower counts to numbers", () => {
    const byHandle = Object.fromEntries(drivers.map((d) => [d.handle, d]));
    expect(byHandle.LambeSahamjja.followers).toBe(73_400);
    expect(byHandle.dennyindrayana.followers).toBe(557_800);
    expect(byHandle.penduduk_lokal_.followers).toBe(5_000);
  });

  it('converts "n/10" scores and maps risk badges to levels', () => {
    const byHandle = Object.fromEntries(drivers.map((d) => [d.handle, d]));
    expect(byHandle.LambeSahamjja.credibility).toBe(6);
    expect(byHandle.LambeSahamjja.riskLevel).toBe("high"); // CRITICAL
    expect(byHandle.penduduk_lokal_.riskLevel).toBe("high"); // HIGH RISK
    expect(byHandle.ardisatriawan.riskLevel).toBe("medium"); // MODERATE
    expect(byHandle.neVerAl0nely___.riskLevel).toBe("low"); // LOW RISK
  });

  it("carries presentation fields + the full intel detail on every driver", () => {
    for (const d of drivers) {
      expect(d.bot).toBe(false); // captured roster is all human classifications
      expect(d.intel).toBeTruthy();
      expect(d.intel?.riskAssessment).toBeTruthy();
      expect(d.intel?.recommendedActions).toBeTruthy();
    }
    const lambe = drivers[0];
    expect(lambe.displayName).toBe("Lambe Saham");
    expect(lambe.sentiment).toBe(-7.5);
    expect(lambe.intel?.brandMentions).toMatch(/MBG/);
    expect(lambe.intel?.activity30d?.posts).toBe("100 posts");
    expect(lambe.reach).toBe("62.0/100");
    expect(lambe.avatarUrl).toMatch(/^https:/);
  });
});
