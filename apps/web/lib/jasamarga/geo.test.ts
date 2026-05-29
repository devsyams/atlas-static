import { describe, expect, it } from "vitest";
import { corridorPath, kmToLatLng, segmentPath } from "./geo";
import { CORRIDORS, getCorridor } from "./corridors";

const japek = getCorridor("japek");

describe("corridor geometry", () => {
  it("every corridor has one anchor per segment, within its bbox", () => {
    for (const c of CORRIDORS) {
      expect(c.anchors.length).toBe(c.segments.length);
      const [minLon, minLat, maxLon, maxLat] = c.bbox.split(",").map(Number);
      for (const [lat, lng] of c.anchors) {
        expect(lat).toBeGreaterThanOrEqual(minLat - 0.05);
        expect(lat).toBeLessThanOrEqual(maxLat + 0.05);
        expect(lng).toBeGreaterThanOrEqual(minLon - 0.05);
        expect(lng).toBeLessThanOrEqual(maxLon + 0.05);
      }
    }
  });

  it("kmToLatLng stays within the Japek bbox and clamps out-of-range km", () => {
    for (const km of [-50, 0, 36, 72, 999]) {
      const [lat, lng] = kmToLatLng(japek, km);
      expect(lat).toBeGreaterThan(-6.5);
      expect(lat).toBeLessThan(-6.2);
      expect(lng).toBeGreaterThan(106.8);
      expect(lng).toBeLessThan(107.5);
    }
  });

  it("longitude increases monotonically along Japek (km0 → km72)", () => {
    const samples = [0, 18, 36, 54, 72].map((km) => kmToLatLng(japek, km)[1]);
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeGreaterThan(samples[i - 1]);
    }
  });

  it("kmToLatLng clamps within bounds for every corridor", () => {
    for (const c of CORRIDORS) {
      const maxKm = c.segments[c.segments.length - 1].km_to;
      for (const km of [-10, 0, maxKm / 2, maxKm, maxKm + 100]) {
        const p = kmToLatLng(c, km);
        expect(p).toHaveLength(2);
        expect(Number.isFinite(p[0])).toBe(true);
        expect(Number.isFinite(p[1])).toBe(true);
      }
    }
  });

  it("segmentPath returns an ordered vertex list per segment, for every corridor", () => {
    for (const c of CORRIDORS) {
      for (let i = 0; i < c.segments.length; i++) {
        const path = segmentPath(c, i);
        expect(path.length).toBeGreaterThanOrEqual(2);
        for (const p of path) expect(p).toHaveLength(2);
      }
    }
  });

  it("corridorPath is one continuous ordered polyline per corridor", () => {
    for (const c of CORRIDORS) {
      const path = corridorPath(c);
      expect(path.length).toBeGreaterThan(c.segments.length);
    }
  });
});
