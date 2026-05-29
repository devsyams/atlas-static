import { describe, expect, it } from "vitest";
import { computeSafety, safetyBand, safetyColor } from "./safety";
import type { IncidentItem, RouteSegment, WeatherZone } from "./types";

const seg = (speed: number): RouteSegment => ({
  km_from: 0, km_to: 9, label: "x", speed, delay_min: 0, status: "lancar",
});
const incident = (severity: number, lanes = 0): IncidentItem => ({
  id: "i", km: "KM 10", direction: "x", type: "Kecelakaan", severity,
  status: "Berlangsung", source: "x", source_type: "traffic", reported: "now",
  lanes_blocked: lanes, detail: "x",
});
const clearWeather: WeatherZone[] = [{ zone: "z", condition: "Cerah", temp: 30, impact: "rendah" }];
const uniformSegments = [seg(70), seg(70), seg(70), seg(70)];

describe("safetyBand", () => {
  it("maps score to band at the boundaries", () => {
    expect(safetyBand(100).level).toBe("Aman");
    expect(safetyBand(80).level).toBe("Aman");
    expect(safetyBand(79).level).toBe("Waspada");
    expect(safetyBand(60).level).toBe("Waspada");
    expect(safetyBand(59).level).toBe("Rawan");
    expect(safetyBand(40).level).toBe("Rawan");
    expect(safetyBand(39).level).toBe("Bahaya");
    expect(safetyBand(0).level).toBe("Bahaya");
  });
});

describe("computeSafety", () => {
  it("returns a high, safe score for a clean corridor", () => {
    const r = computeSafety(uniformSegments, [], clearWeather, 1);
    expect(r.score).toBeGreaterThanOrEqual(80);
    expect(r.level).toBe("Aman");
    expect(r.factors).toHaveLength(4);
    expect(r.factors.map((f) => f.key)).toEqual(["insiden", "cuaca", "volatilitas", "sentimen"]);
  });

  it("drops the score when a severe incident is present (monotonic in incidents)", () => {
    const base = computeSafety(uniformSegments, [], clearWeather, 1).score;
    const withIncident = computeSafety(uniformSegments, [incident(9, 2)], clearWeather, 1).score;
    expect(withIncident).toBeLessThan(base);
  });

  it("drops the score for worse weather and worse sentiment", () => {
    const base = computeSafety(uniformSegments, [], clearWeather, 1).score;
    const badWeather = computeSafety(uniformSegments, [], [{ zone: "z", condition: "Hujan lebat", temp: 25, impact: "tinggi" }], 1).score;
    const badMood = computeSafety(uniformSegments, [], clearWeather, 9).score;
    expect(badWeather).toBeLessThan(base);
    expect(badMood).toBeLessThan(base);
  });

  it("penalizes speed volatility (sharp localized slowdowns)", () => {
    const calm = computeSafety(uniformSegments, [], clearWeather, 1).score;
    const volatile = computeSafety([seg(80), seg(8), seg(75), seg(10)], [], clearWeather, 1).score;
    expect(volatile).toBeLessThan(calm);
  });

  it("clamps to [0,100] under extreme conditions", () => {
    const incidents = Array.from({ length: 12 }, () => incident(10, 3));
    const r = computeSafety([seg(90), seg(4)], incidents, [{ zone: "z", condition: "Banjir", temp: 24, impact: "tinggi" }], 10);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.level).toBe("Bahaya");
  });

  it("derives trend from the previous score", () => {
    expect(computeSafety(uniformSegments, [], clearWeather, 1, 50).trend).toBe("up");
    expect(computeSafety(uniformSegments, [], clearWeather, 1, 99).trend).toBe("down");
    const r = computeSafety(uniformSegments, [], clearWeather, 1);
    expect(computeSafety(uniformSegments, [], clearWeather, 1, r.score).trend).toBe("flat");
  });

  it("safetyColor returns a non-empty oklch string", () => {
    expect(safetyColor(90)).toContain("oklch");
    expect(safetyColor(20)).toContain("oklch");
  });
});
