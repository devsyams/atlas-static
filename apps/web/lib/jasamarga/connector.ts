import type { IncidentItem, RouteSegment } from "./types";
import { getLiveTraffic } from "./tomtom";

export interface CorridorTraffic {
  segments: RouteSegment[];
  incidents: IncidentItem[];
}

/**
 * A pluggable source for live corridor traffic. Today the demo uses public
 * traffic (TomTom). When JasaMarga grants a credentialed feed, implement this
 * interface and swap `defaultSource()` — no UI or contract changes required.
 */
export interface JasaMargaSource {
  id: string;
  label: string;
  fetchTraffic(): Promise<CorridorTraffic | null>;
}

/** Public traffic via TomTom — live when TOMTOM_API_KEY is set, else null. */
export class TomTomSource implements JasaMargaSource {
  id = "tomtom";
  label = "TomTom Traffic (publik)";
  constructor(private readonly key?: string) {}
  fetchTraffic(): Promise<CorridorTraffic | null> {
    return this.key ? getLiveTraffic(this.key) : Promise.resolve(null);
  }
}

/**
 * SEAM: a real JasaMarga / JMTC feed plugs in here. Returns null until wired,
 * so the route falls back to the synthetic snapshot (graceful degradation).
 */
export class JasaMargaFeedSource implements JasaMargaSource {
  id = "jasamarga";
  label = "JasaMarga Feed (belum tersedia)";
  fetchTraffic(): Promise<CorridorTraffic | null> {
    return Promise.resolve(null);
  }
}

/** The source the API route uses. Swap this when a real feed is available. */
export function defaultSource(): JasaMargaSource {
  return new TomTomSource(process.env.TOMTOM_API_KEY);
}
