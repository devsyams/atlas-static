import { describe, expect, it } from "vitest";

import { getCorridor } from "./corridors";
import { corridorPath, kmToLatLng, segmentPath, snapToPath } from "./geo";
import type { LatLng } from "./geo";

const japek = getCorridor("japek");

/** Perpendicular-ish distance of p from the polyline, in degrees (small = on the line). */
function offLineBy(path: LatLng[], p: LatLng): number {
  const s = snapToPath(path, p);
  return Math.hypot(s[0] - p[0], s[1] - p[1]);
}

describe("snapToPath", () => {
  const path: LatLng[] = [
    [0, 0],
    [0, 10],
  ];

  it("projects a point onto the nearest point of the segment", () => {
    expect(snapToPath(path, [1, 5])).toEqual([0, 5]);
  });

  it("clamps to the endpoints rather than running off the end", () => {
    expect(snapToPath(path, [1, -5])).toEqual([0, 0]);
    expect(snapToPath(path, [1, 15])).toEqual([0, 10]);
  });

  it("leaves a point that is already on the line where it is", () => {
    expect(snapToPath(path, [0, 3])).toEqual([0, 3]);
  });

  it("picks the closest edge of a bent path", () => {
    const bent: LatLng[] = [
      [0, 0],
      [0, 10],
      [10, 10],
    ];
    expect(snapToPath(bent, [5, 11])).toEqual([5, 10]); // nearest the second (vertical) edge
  });

  it("returns the point unchanged for a degenerate path", () => {
    expect(snapToPath([], [1, 2])).toEqual([1, 2]);
    expect(snapToPath([[3, 4]], [1, 2])).toEqual([3, 4]);
  });
});

/**
 * The bug: markers sat beside the drawn corridor. Real TomTom incidents carry
 * true road coordinates, but the line is a coarse anchor approximation — so a
 * marker placed at its raw coordinate floats off it. Snapping fixes that.
 */
describe("incident markers land on the drawn corridor", () => {
  const path = corridorPath(japek);

  it("a real off-line coordinate snaps onto the polyline", () => {
    const realIncident: LatLng = [-6.2584545435, 106.9587237963]; // a live TomTom KM 7 report
    expect(offLineBy(path, realIncident)).toBeGreaterThan(0); // it really is off the line
    const snapped = snapToPath(path, realIncident);
    expect(offLineBy(path, snapped)).toBeLessThan(1e-9); // …and now it is on it
  });

  it("every km along the corridor maps to a point on the drawn line (kmToLatLng follows the bend)", () => {
    const maxKm = japek.segments[japek.segments.length - 1].km_to;
    for (let km = 0; km <= maxKm; km += 3) {
      expect(offLineBy(path, kmToLatLng(japek, km))).toBeLessThan(1e-9);
    }
  });

  it("kmToLatLng still runs start → end in order", () => {
    const a = kmToLatLng(japek, 0);
    const b = kmToLatLng(japek, 72);
    expect(a[1]).toBeLessThan(b[1]); // Japek runs west → east
    expect(a).toEqual(japek.start);
    expect(b).toEqual(japek.end);
  });

  it("a km inside a segment sits on that segment's own drawn path", () => {
    // KM 4 is inside segment 0 (KM 0–9).
    expect(offLineBy(segmentPath(japek, 0), kmToLatLng(japek, 4))).toBeLessThan(1e-9);
  });
});
