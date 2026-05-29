import type { Corridor, LatLng } from "./corridors";

export type { LatLng };

const mid = (a: LatLng, b: LatLng): LatLng => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

/** Segment boundary points: bound[i] = start of segment i, bound[i+1] = its end. */
function boundaries(c: Corridor): LatLng[] {
  const b: LatLng[] = [c.start];
  for (let i = 0; i < c.anchors.length - 1; i++) b.push(mid(c.anchors[i], c.anchors[i + 1]));
  b.push(c.end);
  return b; // length anchors.length + 1
}

/** Vertices for one segment of a corridor: [start, anchor, end]. */
export function segmentPath(c: Corridor, i: number): LatLng[] {
  const b = boundaries(c);
  return [b[i], c.anchors[i], b[i + 1]];
}

/** The whole corridor as one ordered polyline (start → anchors → end). */
export function corridorPath(c: Corridor): LatLng[] {
  const b = boundaries(c);
  const path: LatLng[] = [];
  for (let i = 0; i < c.anchors.length; i++) path.push(b[i], c.anchors[i]);
  path.push(b[c.anchors.length]);
  return path;
}

/** Interpolate a [lat,lng] for a KM marker along the corridor (for incidents). */
export function kmToLatLng(c: Corridor, km: number): LatLng {
  const maxKm = c.segments[c.segments.length - 1].km_to;
  const clamped = Math.max(0, Math.min(maxKm, km));
  let i = c.segments.findIndex((s) => clamped >= s.km_from && clamped <= s.km_to);
  if (i < 0) i = c.segments.length - 1;
  const s = c.segments[i];
  const b = boundaries(c);
  const span = s.km_to - s.km_from || 1;
  const frac = (clamped - s.km_from) / span;
  const a = b[i];
  const e = b[i + 1];
  return [a[0] + (e[0] - a[0]) * frac, a[1] + (e[1] - a[1]) * frac];
}
