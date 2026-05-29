import { describe, expect, it } from "vitest";
import { ANCHORS, corridorPath, kmToLatLng, segmentPath } from "./geo";

describe("corridor geometry", () => {
  it("has one anchor per base segment", () => {
    expect(ANCHORS).toHaveLength(10);
    for (const [lat, lng] of ANCHORS) {
      expect(lat).toBeLessThan(0); // southern hemisphere
      expect(lng).toBeGreaterThan(106);
      expect(lng).toBeLessThan(108);
    }
  });

  it("kmToLatLng stays within the corridor bbox and clamps out-of-range km", () => {
    for (const km of [-50, 0, 36, 72, 999]) {
      const [lat, lng] = kmToLatLng(km);
      expect(lat).toBeGreaterThan(-6.5);
      expect(lat).toBeLessThan(-6.2);
      expect(lng).toBeGreaterThan(106.8);
      expect(lng).toBeLessThan(107.5);
    }
  });

  it("longitude increases monotonically from Halim (km0) to Cikampek (km72)", () => {
    const samples = [0, 18, 36, 54, 72].map((km) => kmToLatLng(km)[1]);
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeGreaterThan(samples[i - 1]);
    }
  });

  it("segmentPath returns an ordered vertex list for each segment", () => {
    for (let i = 0; i < 10; i++) {
      const path = segmentPath(i);
      expect(path.length).toBeGreaterThanOrEqual(2);
      for (const p of path) expect(p).toHaveLength(2);
    }
  });

  it("corridorPath is one continuous ordered polyline", () => {
    const path = corridorPath();
    expect(path.length).toBeGreaterThan(10);
    const lngs = path.map((p) => p[1]);
    expect(lngs[lngs.length - 1]).toBeGreaterThan(lngs[0]);
  });
});
