import { BASE_SEGMENTS } from "./data";
import type { IncidentItem, RouteSegment, SourceType } from "./types";
import { speedStatus } from "./ui";

/**
 * Live TomTom connector for the Japek ribbon + incident feed.
 *
 * - Flow Segment Data → per-segment current speed (only trusted when the point
 *   snaps to a motorway/trunk/major road; otherwise we keep the baseline so a
 *   bad snap never shows a misleading surface-road speed).
 * - Incident Details → live incidents on the corridor (filtered to AH2 / Japek).
 *
 * Results are cached in-process (TTL below) so polls and tabs share one fetch
 * and we stay well inside the free tier. Any failure returns null → the route
 * falls back to the synthetic snapshot (graceful degradation).
 */

const FLOW_URL = "https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json";
const INCIDENTS_URL = "https://api.tomtom.com/traffic/services/5/incidentDetails";
const INCIDENT_FIELDS =
  "{incidents{type,geometry{type,coordinates},properties{iconCategory,magnitudeOfDelay,startTime,from,to,delay,roadNumbers,events{description,code}}}}";
const BBOX = "106.88,-6.46,107.47,-6.24"; // Japek corridor + approaches
const TIMEOUT_MS = 4500;
const CACHE_TTL_MS = 120_000; // 2 min — keeps us inside TomTom's free tier

// KM ↔ longitude mapping for the corridor (Halim ≈ KM0 … Cikampek Utama ≈ KM72).
const LON0 = 106.9;
const LON1 = 107.455;
const KM_MAX = 72;
const kmFromLon = (lon: number) => Math.max(0, Math.min(KM_MAX, ((lon - LON0) / (LON1 - LON0)) * KM_MAX));

/** One verified lat/lon per BASE_SEGMENTS entry (same order). Most snap to FRC0–2. */
const ANCHORS: [number, number][] = [
  [-6.254, 106.9], // KM 0–9   FRC0
  [-6.2685, 106.976], // KM 9–17  Bekasi — snaps off-toll, handled by FRC fallback
  [-6.281, 107.048], // KM 17–24 FRC0
  [-6.307, 107.125], // KM 24–31 FRC2
  [-6.3223, 107.185], // KM 31–37 FRC0
  [-6.345, 107.26], // KM 37–47 FRC0
  [-6.38, 107.335], // KM 47–52 FRC0
  [-6.4, 107.38], // KM 52–62 FRC0
  [-6.415, 107.425], // KM 62–67 FRC0
  [-6.418, 107.455], // KM 67–72 FRC1
];

/** Road classes we trust as "on the toll mainline". */
const MOTORWAY_FRC = new Set(["FRC0", "FRC1", "FRC2"]);

const ICON_TYPE: Record<number, string> = {
  1: "Kecelakaan",
  2: "Kabut",
  3: "Kondisi berbahaya",
  4: "Hujan",
  5: "Jalan licin",
  6: "Kemacetan",
  7: "Lajur ditutup",
  8: "Jalan ditutup",
  9: "Perbaikan jalan",
  10: "Angin kencang",
  11: "Banjir",
  14: "Kendaraan mogok",
};

interface CacheEntry {
  at: number;
  data: LiveTraffic;
}
let cache: CacheEntry | null = null;

export interface LiveTraffic {
  segments: RouteSegment[];
  incidents: IncidentItem[];
}

async function getJson(url: string): Promise<unknown | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function fetchSegments(key: string): Promise<RouteSegment[] | null> {
  const flows = await Promise.all(
    ANCHORS.map(([lat, lon]) =>
      getJson(`${FLOW_URL}?key=${encodeURIComponent(key)}&point=${lat},${lon}&unit=KMPH`),
    ),
  );
  if (flows.every((f) => f == null)) return null;

  return BASE_SEGMENTS.map((geom, i) => {
    const fsd = (flows[i] as { flowSegmentData?: Record<string, unknown> } | null)?.flowSegmentData;
    const frc = String(fsd?.frc ?? "");
    const onToll = MOTORWAY_FRC.has(frc) && !!fsd;
    const len = geom.km_to - geom.km_from;

    // Trust live speed only when the point snapped to the toll; else baseline.
    const speed = onToll
      ? Math.max(5, Math.round((fsd!.roadClosure ? 5 : (fsd!.currentSpeed as number)) ?? geom.speed))
      : geom.speed;
    const freeFlow = onToll ? Math.max(20, Math.round((fsd!.freeFlowSpeed as number) ?? geom.speed)) : Math.max(speed, 60);
    const delay_min = Math.max(0, Math.round((len / speed - len / freeFlow) * 60));
    return { ...geom, speed, delay_min, status: speedStatus(speed) };
  });
}

async function fetchIncidents(key: string): Promise<IncidentItem[]> {
  const url = `${INCIDENTS_URL}?key=${encodeURIComponent(key)}&bbox=${BBOX}&fields=${encodeURIComponent(INCIDENT_FIELDS)}&language=id-ID&timeValidityFilter=present`;
  const json = (await getJson(url)) as { incidents?: RawIncident[] } | null;
  if (!json?.incidents) return [];

  const onCorridor = json.incidents.filter((inc) => {
    const roads = inc.properties?.roadNumbers ?? [];
    const text = `${inc.properties?.from ?? ""} ${inc.properties?.to ?? ""}`;
    return roads.includes("AH2") || /cikampek|japek/i.test(text);
  });

  return onCorridor
    .map((inc, i) => mapIncident(inc, i))
    .filter((x): x is IncidentItem => x != null)
    .sort((a, b) => b.severity - a.severity)
    .slice(0, 6);
}

interface RawIncident {
  geometry?: { type?: string; coordinates?: number[] | number[][] };
  properties?: {
    iconCategory?: number;
    magnitudeOfDelay?: number;
    startTime?: string;
    from?: string;
    to?: string;
    delay?: number;
    roadNumbers?: string[];
    events?: { description?: string }[];
  };
}

function firstCoord(geom: RawIncident["geometry"]): [number, number] | null {
  const c = geom?.coordinates;
  if (!c || !c.length) return null;
  const p = Array.isArray(c[0]) ? (c[0] as number[]) : (c as number[]);
  return [p[0], p[1]]; // [lon, lat]
}

function relTime(iso?: string): string {
  if (!iso) return "baru saja";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "baru saja";
  if (mins < 60) return `${mins} mnt lalu`;
  return `${Math.round(mins / 60)} jam lalu`;
}

function mapIncident(inc: RawIncident, i: number): IncidentItem | null {
  const p = inc.properties ?? {};
  const coord = firstCoord(inc.geometry);
  if (!coord) return null;
  const km = Math.round(kmFromLon(coord[0]));
  const mag = p.magnitudeOfDelay ?? 0;
  const base = mag === 3 ? 8 : mag === 2 ? 5.5 : mag === 1 ? 3.5 : 4;
  const severity = +Math.max(0, Math.min(10, base + Math.min(2, (p.delay ?? 0) / 300))).toFixed(1);
  const desc = p.events?.[0]?.description;
  const detailBits = [
    desc ? desc.charAt(0).toUpperCase() + desc.slice(1) + "." : null,
    p.from ? `Dari ${p.from}${p.to ? ` menuju ${p.to}` : ""}.` : null,
    p.delay ? `Estimasi tundaan ±${Math.round(p.delay / 60)} mnt.` : null,
  ].filter(Boolean);

  return {
    id: `TT-${i}`,
    km: `KM ${km}`,
    direction: p.roadNumbers?.includes("AH2") ? "Tol Japek (AH2)" : p.from ?? "Koridor Japek",
    type: ICON_TYPE[p.iconCategory ?? 0] ?? "Insiden lalu lintas",
    severity,
    status: "Berlangsung",
    source: "TomTom Traffic",
    source_type: "traffic" as SourceType,
    reported: relTime(p.startTime),
    detail: detailBits.join(" ") || "Insiden terdeteksi di koridor.",
  };
}

/** Cached fetch of live segments + incidents. Returns null if traffic flow can't be read. */
export async function getLiveTraffic(key: string): Promise<LiveTraffic | null> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.data;

  const [segments, incidents] = await Promise.all([fetchSegments(key), fetchIncidents(key)]);
  if (!segments) return null; // flow failed → fall back to synthetic entirely

  const data: LiveTraffic = { segments, incidents };
  cache = { at: Date.now(), data };
  return data;
}
