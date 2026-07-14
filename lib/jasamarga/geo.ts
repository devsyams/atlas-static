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

const dist = (a: LatLng, b: LatLng): number => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Nearest point to `p` on the finite segment a→b (clamped to the endpoints). */
function projectOnEdge(a: LatLng, b: LatLng, p: LatLng): LatLng {
  const dy = b[0] - a[0];
  const dx = b[1] - a[1];
  const len2 = dy * dy + dx * dx;
  if (len2 === 0) return a;
  let t = ((p[0] - a[0]) * dy + (p[1] - a[1]) * dx) / len2;
  t = Math.max(0, Math.min(1, t));
  return [a[0] + dy * t, a[1] + dx * t];
}

/**
 * Snap a point onto the nearest point of a polyline.
 *
 * The corridor line the map draws is an approximation built from a handful of
 * hand-placed anchors, while live TomTom incidents carry their *real* road
 * coordinates — so plotting an incident at its raw position leaves the dot
 * floating beside the line. Snapping puts every marker on the road the operator
 * can actually see; the popup still reports the incident's true KM.
 *
 * Treats lat/lng as planar. Over a single corridor (< 1°) the distortion is far
 * below the error already baked into the anchor geometry.
 */
export function snapToPath(path: LatLng[], p: LatLng): LatLng {
  if (path.length === 0) return p;
  if (path.length === 1) return path[0];

  let best = path[0];
  let bestD = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const q = projectOnEdge(path[i], path[i + 1], p);
    const d = dist(q, p);
    if (d < bestD) {
      bestD = d;
      best = q;
    }
  }
  return best;
}

/**
 * Interpolate a [lat,lng] for a KM marker along the corridor (for incidents).
 *
 * Walks the segment's *drawn* path (start → anchor → end) by arc length, not the
 * straight chord between its endpoints — the map bends the line through the
 * anchor, so a chord interpolation would place the marker off the road.
 */
export function kmToLatLng(c: Corridor, km: number): LatLng {
  const maxKm = c.segments[c.segments.length - 1].km_to;
  const clamped = Math.max(0, Math.min(maxKm, km));
  let i = c.segments.findIndex((s) => clamped >= s.km_from && clamped <= s.km_to);
  if (i < 0) i = c.segments.length - 1;

  const s = c.segments[i];
  const span = s.km_to - s.km_from || 1;
  const frac = (clamped - s.km_from) / span;

  const path = segmentPath(c, i);
  const legs = [dist(path[0], path[1]), dist(path[1], path[2])];
  const total = legs[0] + legs[1];
  if (total === 0) return path[0];

  // Distance along the bent path, then find which leg it lands on.
  let travel = frac * total;
  for (let k = 0; k < legs.length; k++) {
    if (travel <= legs[k] || k === legs.length - 1) {
      const t = legs[k] === 0 ? 0 : Math.min(1, travel / legs[k]);
      const a = path[k];
      const b = path[k + 1];
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
    travel -= legs[k];
  }
  return path[path.length - 1];
}
