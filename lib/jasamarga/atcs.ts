/**
 * Public Indonesian ATCS (Area Traffic Control System) city CCTV cameras used by
 * the live AI-detection demo. These are public traffic-monitoring feeds (HLS).
 * The host allowlist keeps the proxy from being turned into an open relay (SSRF).
 *
 * Override the allowed host(s) with CCTV_ATCS_HOSTS (comma-separated) if you want
 * to point the live detector at a different public ATCS source.
 */

export interface AtcsCamera {
  id: string;
  name: string;
  city: string;
  url: string; // upstream HLS (.m3u8)
}

const TASIK = "atcs.tasikmalayakota.go.id";
const YOGYA = "cctvjss.jogjakota.go.id"; // Pemkot Yogyakarta JSS (Wowza, master→chunklist HLS)

export const ATCS_CAMERAS: AtcsCamera[] = [
  // Yogyakarta — Malioboro corridor (busy: motor + pedestrian, great for detection)
  { id: "jogja-nolkm", name: "Titik Nol Km · Malioboro", city: "Yogyakarta", url: `https://${YOGYA}/malioboro/NolKm_Timur.stream/playlist.m3u8` },
  { id: "jogja-kepatihan", name: "Malioboro · Kepatihan", city: "Yogyakarta", url: `https://${YOGYA}/malioboro/Malioboro_10_Kepatihan.stream/playlist.m3u8` },
  { id: "jogja-beringharjo", name: "Pasar Beringharjo", city: "Yogyakarta", url: `https://${YOGYA}/malioboro/Malioboro_30_Pasar_Beringharjo.stream/playlist.m3u8` },
  // Tasikmalaya — ATCS intersections
  { id: "simpanglima", name: "Simpang Lima", city: "Tasikmalaya", url: `https://${TASIK}/camera/simpanglima.m3u8` },
  { id: "mitrabatik", name: "Simpang Mitra Batik", city: "Tasikmalaya", url: `https://${TASIK}/camera/mitrabatik.m3u8` },
  { id: "bantar", name: "Simpang Bantar", city: "Tasikmalaya", url: `https://${TASIK}/camera/bantar.m3u8` },
  { id: "jati", name: "Simpang Jati", city: "Tasikmalaya", url: `https://${TASIK}/camera/jati.m3u8` },
];

/** Hosts the proxy is allowed to fetch from (the registry hosts + any env extras). */
export function allowedHosts(): Set<string> {
  const base = new Set(ATCS_CAMERAS.map((c) => new URL(c.url).host));
  const extra = process.env.CCTV_ATCS_HOSTS;
  if (extra) extra.split(",").map((h) => h.trim()).filter(Boolean).forEach((h) => base.add(h));
  return base;
}

export function getAtcsCamera(id?: string | null): AtcsCamera {
  return ATCS_CAMERAS.find((c) => c.id === id) ?? ATCS_CAMERAS[0];
}

/** Only allow proxying URLs whose host is allowlisted (prevents open-proxy/SSRF abuse). */
export function isAllowedAtcsUrl(u: string): boolean {
  try {
    return allowedHosts().has(new URL(u).host);
  } catch {
    return false;
  }
}

/** Ordered HLS source candidates for a camera: the direct (CORS-enabled) upstream
 * first, the same-origin proxy as a fallback. The browser can reach the public
 * feeds even where the server can't egress; both hosts send `Access-Control-Allow-Origin: *`. */
export function cctvSources(cam: AtcsCamera): string[] {
  return [cam.url, `/api/v1/cctv/playlist?cam=${encodeURIComponent(cam.id)}`];
}

/** Vehicle classes we surface from the COCO-SSD detector (Indonesian labels). */
export type VehicleClass = "mobil" | "motor" | "bus" | "truk" | "orang" | "lainnya";

const COCO_MAP: Record<string, VehicleClass> = {
  car: "mobil",
  motorcycle: "motor",
  bicycle: "motor",
  bus: "bus",
  truck: "truk",
  person: "orang",
};

export function classifyCoco(cocoClass: string): VehicleClass {
  return COCO_MAP[cocoClass] ?? "lainnya";
}

export type DetectionTally = Record<VehicleClass, number> & { total: number };

/** Tally raw COCO-SSD predictions into per-vehicle-class counts. Pure. */
export function tallyDetections(preds: { class: string }[]): DetectionTally {
  const t: DetectionTally = { mobil: 0, motor: 0, bus: 0, truk: 0, orang: 0, lainnya: 0, total: 0 };
  for (const p of preds) {
    t[classifyCoco(p.class)] += 1;
    t.total += 1;
  }
  return t;
}
