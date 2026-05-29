import { BASE_SEGMENTS } from "./data";
import type { RouteSegment } from "./types";
import { speedStatus } from "./ui";

/**
 * Live TomTom Traffic Flow connector for the Japek ribbon. Fetches Flow Segment
 * Data (currentSpeed / freeFlowSpeed / roadClosure) for one representative point
 * per corridor segment and maps it onto our KM layout.
 *
 * Anchors are approximate Japek coordinates — refine to exact KM-post positions
 * for production. Returns null on any failure so the API route falls back to the
 * synthetic snapshot (graceful degradation).
 */

const FLOW_URL = "https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json";
const TIMEOUT_MS = 4000;

/** One lat/lon per BASE_SEGMENTS entry (same order/length). */
const ANCHORS: [number, number][] = [
  [-6.262, 106.92], // KM 0–9   Halim – Cikunir
  [-6.27, 106.97], // KM 9–17  Cikunir – Bekasi Barat
  [-6.285, 107.01], // KM 17–24 Bekasi Timur – Cibitung
  [-6.3, 107.08], // KM 24–31 Cikarang Barat – Utama
  [-6.33, 107.13], // KM 31–37 Cikarang Pusat – Karawang Barat
  [-6.355, 107.22], // KM 37–47 Karawang Barat – Timur
  [-6.38, 107.29], // KM 47–52 Karawang Timur – KM 52
  [-6.405, 107.36], // KM 52–62 KM 52 – Dawuan
  [-6.415, 107.42], // KM 62–67 Dawuan – Kalihurip
  [-6.42, 107.45], // KM 67–72 Kalihurip – Cikampek Utama
];

interface FlowSegmentData {
  flowSegmentData?: {
    currentSpeed?: number;
    freeFlowSpeed?: number;
    roadClosure?: boolean;
  };
}

async function fetchPoint(key: string, lat: number, lon: number): Promise<FlowSegmentData["flowSegmentData"] | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const url = `${FLOW_URL}?key=${encodeURIComponent(key)}&point=${lat},${lon}&unit=KMPH`;
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    const json = (await res.json()) as FlowSegmentData;
    return json.flowSegmentData ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function fetchLiveSegments(key: string): Promise<RouteSegment[] | null> {
  const results = await Promise.all(ANCHORS.map(([lat, lon]) => fetchPoint(key, lat, lon)));

  // If we couldn't read any point, signal failure so the caller falls back.
  if (results.every((r) => r == null)) return null;

  return BASE_SEGMENTS.map((geom, i) => {
    const flow = results[i];
    const len = geom.km_to - geom.km_from;
    const freeFlow = Math.max(20, Math.round(flow?.freeFlowSpeed ?? geom.speed));
    const speed = flow?.roadClosure ? 5 : Math.max(5, Math.round(flow?.currentSpeed ?? geom.speed));
    const delay_min = Math.max(0, Math.round((len / speed - len / freeFlow) * 60));
    return { ...geom, speed, delay_min, status: speedStatus(speed) };
  });
}
