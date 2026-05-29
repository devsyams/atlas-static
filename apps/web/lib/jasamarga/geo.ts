import { BASE_SEGMENTS } from "./data";

export type LatLng = [number, number];

/**
 * One on-toll [lat,lng] per BASE_SEGMENTS entry (same order). Sampled from the
 * TomTom routing polyline for Halim→Cikampek at each segment midpoint and
 * verified to snap to the motorway. This is the single source of corridor
 * geometry — `tomtom.ts` imports these for flow sampling too.
 */
export const ANCHORS: LatLng[] = [
  [-6.2555, 106.935],
  [-6.24922, 106.98167],
  [-6.27482, 107.04962],
  [-6.29894, 107.11235],
  [-6.33, 107.16787],
  [-6.35472, 107.2384],
  [-6.35106, 107.31013],
  [-6.37793, 107.37669],
  [-6.42409, 107.42822],
  [-6.40123, 107.44586],
];

const HALIM: LatLng = [-6.2516, 106.9094]; // ≈ KM0, GT Halim Utama
const CIKAMPEK: LatLng = [-6.4015, 107.4528]; // ≈ KM72, GT Cikampek Utama

const mid = (a: LatLng, b: LatLng): LatLng => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

/** Segment boundary points: bound[i] = start of segment i, bound[i+1] = its end. */
function boundaries(): LatLng[] {
  const b: LatLng[] = [HALIM];
  for (let i = 0; i < ANCHORS.length - 1; i++) b.push(mid(ANCHORS[i], ANCHORS[i + 1]));
  b.push(CIKAMPEK);
  return b; // length ANCHORS.length + 1
}

/** Vertices for one segment: [start, anchor, end]. */
export function segmentPath(i: number): LatLng[] {
  const b = boundaries();
  return [b[i], ANCHORS[i], b[i + 1]];
}

/** The whole corridor as one ordered polyline (start → anchors → end). */
export function corridorPath(): LatLng[] {
  const b = boundaries();
  const path: LatLng[] = [];
  for (let i = 0; i < ANCHORS.length; i++) path.push(b[i], ANCHORS[i]);
  path.push(b[ANCHORS.length]);
  return path;
}

/** Interpolate a [lat,lng] for a KM marker along the corridor (for incidents). */
export function kmToLatLng(km: number): LatLng {
  const clamped = Math.max(0, Math.min(72, km));
  let i = BASE_SEGMENTS.findIndex((s) => clamped >= s.km_from && clamped <= s.km_to);
  if (i < 0) i = BASE_SEGMENTS.length - 1;
  const s = BASE_SEGMENTS[i];
  const b = boundaries();
  const span = s.km_to - s.km_from || 1;
  const frac = (clamped - s.km_from) / span;
  const a = b[i];
  const c = b[i + 1];
  return [a[0] + (c[0] - a[0]) * frac, a[1] + (c[1] - a[1]) * frac];
}
