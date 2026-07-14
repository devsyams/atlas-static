import type { BmkgZone } from "./bmkg";
import type { Landmark, RouteSegment, WeatherZone } from "./types";

/** [latitude, longitude]. */
export type LatLng = [number, number];

/** Baseline (free-flow) geometry of one corridor segment — speed/delay are seeds the engine jitters. */
export type BaseSegment = Omit<RouteSegment, "status">;

/**
 * A JasaMarga toll corridor. Geometry (anchors/start/end) is approximate-real so
 * the map line follows the actual road; traffic/incident content is synthesised
 * by the snapshot engine from public-style signals. `anchors.length` MUST equal
 * `segments.length` (one on-toll sample point per segment).
 */
export interface Corridor {
  id: string;
  name: string; // full title shown in the header
  short: string; // chip label / hashtag stem
  hashtag: string; // dominant social tag
  bbox: string; // TomTom incident bbox: "minLon,minLat,maxLon,maxLat"
  roadMatch: RegExp; // matches roadNumbers/text to filter live incidents to this corridor
  start: LatLng; // KM0 terminus
  end: LatLng; // final terminus
  altRoute: string; // arterial alternative (for interventions / travel board)
  elevatedName?: string; // elevated option, if any (e.g. "Layang MBZ")
  anchors: LatLng[];
  segments: BaseSegment[];
  landmarks: Landmark[];
  /**
   * Static fallback only (A12 v5.0). Real conditions come from BMKG via `bmkg`
   * below; these values are what we show if BMKG is unreachable.
   */
  weather: WeatherZone[];
  /**
   * BMKG lookup for each weather zone — same order as `weather`. `adm4` is the
   * Kemendagri village code of a point on that stretch of road; every one was
   * verified against api.bmkg.go.id (it echoes back kabupaten/kecamatan).
   */
  bmkg: BmkgZone[];
}

const JAPEK: Corridor = {
  id: "japek",
  name: "Jakarta–Cikampek (Japek)",
  short: "Japek",
  hashtag: "#MacetJapek",
  bbox: "106.88,-6.46,107.47,-6.24",
  roadMatch: /AH2|cikampek|japek/i,
  start: [-6.2516, 106.9094],
  end: [-6.4015, 107.4528],
  altRoute: "Arteri Pantura",
  elevatedName: "Layang MBZ",
  anchors: [
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
  ],
  segments: [
    { km_from: 0, km_to: 9, label: "Halim – Cikunir", speed: 68, delay_min: 2 },
    { km_from: 9, km_to: 17, label: "Cikunir – Bekasi Barat", speed: 74, delay_min: 1, elevated: true },
    { km_from: 17, km_to: 24, label: "Bekasi Timur – Cibitung", speed: 61, delay_min: 2, elevated: true },
    { km_from: 24, km_to: 31, label: "Cikarang Barat – Cikarang Utama", speed: 47, delay_min: 4, elevated: true },
    { km_from: 31, km_to: 37, label: "Cikarang Pusat – Karawang Barat", speed: 39, delay_min: 5, elevated: true },
    { km_from: 37, km_to: 47, label: "Karawang Barat – Karawang Timur", speed: 32, delay_min: 8, elevated: true },
    { km_from: 47, km_to: 52, label: "Karawang Timur – KM 52", speed: 17, delay_min: 12 },
    { km_from: 52, km_to: 62, label: "KM 52 – Dawuan", speed: 11, delay_min: 22 },
    { km_from: 62, km_to: 67, label: "Dawuan – Kalihurip", speed: 34, delay_min: 5 },
    { km_from: 67, km_to: 72, label: "Kalihurip – Cikampek Utama", speed: 53, delay_min: 2 },
  ],
  landmarks: [
    { km: 2, name: "GT Halim Utama", kind: "gerbang" },
    { km: 11, name: "GT Bekasi Barat", kind: "gerbang" },
    { km: 19, name: "Rest Area KM 19", kind: "rest" },
    { km: 29, name: "GT Cikarang Utama", kind: "gerbang" },
    { km: 39, name: "Rest Area KM 39", kind: "rest" },
    { km: 50, name: "Rest Area KM 50", kind: "rest" },
    { km: 67, name: "Kalihurip JC", kind: "gerbang" },
    { km: 72, name: "GT Cikampek Utama", kind: "gerbang" },
  ],
  weather: [
    { zone: "Jakarta – Bekasi", condition: "Cerah berawan", temp: 31, impact: "rendah" },
    { zone: "Cikarang – Karawang", condition: "Hujan ringan", temp: 27, impact: "sedang" },
    { zone: "Cikampek", condition: "Berawan", temp: 29, impact: "rendah" },
  ],
  bmkg: [
    { zone: "Jakarta – Bekasi", adm4: "32.75.02.1001" },      // Kota Bekasi / Bekasi Barat
    { zone: "Cikarang – Karawang", adm4: "32.16.20.2001" },   // Kab. Bekasi / Cikarang Pusat
    { zone: "Cikampek", adm4: "32.15.13.2001" },              // Karawang / Cikampek
  ],
};

const JAGORAWI: Corridor = {
  id: "jagorawi",
  name: "Jakarta–Bogor–Ciawi (Jagorawi)",
  short: "Jagorawi",
  hashtag: "#Jagorawi",
  bbox: "106.80,-6.66,106.92,-6.24",
  roadMatch: /jagorawi|bogor|ciawi/i,
  start: [-6.2424, 106.8706],
  end: [-6.655, 106.844],
  altRoute: "Jl. Raya Bogor",
  anchors: [
    [-6.2424, 106.8706],
    [-6.3037, 106.8836],
    [-6.368, 106.887],
    [-6.445, 106.865],
    [-6.54, 106.84],
    [-6.63, 106.843],
  ],
  segments: [
    { km_from: 0, km_to: 8, label: "Cawang – TMII", speed: 66, delay_min: 2 },
    { km_from: 8, km_to: 16, label: "TMII – Cibubur", speed: 58, delay_min: 3 },
    { km_from: 16, km_to: 25, label: "Cibubur – Cimanggis", speed: 52, delay_min: 4 },
    { km_from: 25, km_to: 34, label: "Cimanggis – Sentul", speed: 61, delay_min: 2 },
    { km_from: 34, km_to: 42, label: "Sentul – Bogor", speed: 48, delay_min: 4 },
    { km_from: 42, km_to: 46, label: "Bogor – Ciawi", speed: 40, delay_min: 5 },
  ],
  landmarks: [
    { km: 1, name: "GT Cawang", kind: "gerbang" },
    { km: 10, name: "GT Cibubur Utama", kind: "gerbang" },
    { km: 21, name: "Rest Area KM 21", kind: "rest" },
    { km: 35, name: "GT Sentul Selatan", kind: "gerbang" },
    { km: 46, name: "GT Ciawi", kind: "gerbang" },
  ],
  weather: [
    { zone: "Jakarta – Cibubur", condition: "Berawan", temp: 30, impact: "rendah" },
    { zone: "Cimanggis – Sentul", condition: "Hujan ringan", temp: 26, impact: "sedang" },
    { zone: "Bogor – Ciawi", condition: "Hujan lebat", temp: 24, impact: "tinggi" },
  ],
  bmkg: [
    { zone: "Jakarta – Cibubur", adm4: "31.75.09.1001" },     // Jakarta Timur / Ciracas
    { zone: "Cimanggis – Sentul", adm4: "32.76.02.1007" },    // Kota Depok / Cimanggis
    { zone: "Bogor – Ciawi", adm4: "32.01.24.2001" },         // Kab. Bogor / Ciawi
  ],
};

const MERAK: Corridor = {
  id: "merak",
  name: "Tangerang–Merak (Tol Tangerang–Merak)",
  short: "Merak",
  hashtag: "#TolMerak",
  bbox: "106.00,-6.30,106.66,-5.90",
  roadMatch: /merak|cilegon|serang|tangerang/i,
  start: [-6.227, 106.64],
  end: [-5.93, 106.005],
  altRoute: "Jl. Raya Serang",
  anchors: [
    [-6.224, 106.63],
    [-6.21, 106.5],
    [-6.2, 106.43],
    [-6.15, 106.3],
    [-6.12, 106.15],
    [-6.01, 106.05],
  ],
  segments: [
    { km_from: 0, km_to: 12, label: "Tangerang – Cikupa", speed: 80, delay_min: 1 },
    { km_from: 12, km_to: 25, label: "Cikupa – Balaraja", speed: 78, delay_min: 1 },
    { km_from: 25, km_to: 40, label: "Balaraja – Cikande", speed: 75, delay_min: 1 },
    { km_from: 40, km_to: 55, label: "Cikande – Serang", speed: 70, delay_min: 2 },
    { km_from: 55, km_to: 66, label: "Serang – Cilegon", speed: 66, delay_min: 2 },
    { km_from: 66, km_to: 73, label: "Cilegon – Merak", speed: 58, delay_min: 3 },
  ],
  landmarks: [
    { km: 3, name: "GT Cikupa", kind: "gerbang" },
    { km: 24, name: "GT Balaraja Timur", kind: "gerbang" },
    { km: 43, name: "Rest Area KM 43", kind: "rest" },
    { km: 56, name: "GT Serang Timur", kind: "gerbang" },
    { km: 72, name: "GT Merak", kind: "gerbang" },
  ],
  weather: [
    { zone: "Tangerang – Balaraja", condition: "Cerah", temp: 32, impact: "rendah" },
    { zone: "Serang", condition: "Cerah berawan", temp: 31, impact: "rendah" },
    { zone: "Cilegon – Merak", condition: "Angin kencang", temp: 30, impact: "sedang" },
  ],
  bmkg: [
    { zone: "Tangerang – Balaraja", adm4: "36.03.01.1001" },  // Kab. Tangerang / Balaraja
    { zone: "Serang", adm4: "36.73.01.1001" },                // Kota Serang / Serang
    { zone: "Cilegon – Merak", adm4: "36.72.03.1001" },       // Kota Cilegon / Pulomerak
  ],
};

const PURBALEUNYI: Corridor = {
  id: "purbaleunyi",
  name: "Cikampek–Bandung (Purbaleunyi)",
  short: "Purbaleunyi",
  hashtag: "#Purbaleunyi",
  bbox: "107.38,-6.92,107.60,-6.38",
  roadMatch: /purbaleunyi|cipularang|padaleunyi|bandung|purwakarta/i,
  start: [-6.401, 107.453],
  end: [-6.895, 107.58],
  altRoute: "Jalur Nagreg",
  anchors: [
    [-6.401, 107.453],
    [-6.55, 107.45],
    [-6.72, 107.46],
    [-6.82, 107.49],
    [-6.87, 107.54],
    [-6.893, 107.576],
  ],
  segments: [
    { km_from: 0, km_to: 13, label: "Cikampek – Purwakarta", speed: 84, delay_min: 1 },
    { km_from: 13, km_to: 30, label: "Purwakarta – Sadang", speed: 80, delay_min: 1 },
    { km_from: 30, km_to: 45, label: "Sadang – Padalarang", speed: 70, delay_min: 2 },
    { km_from: 45, km_to: 58, label: "Padalarang – Cimahi", speed: 58, delay_min: 4 },
    { km_from: 58, km_to: 68, label: "Cimahi – Pasteur", speed: 44, delay_min: 5 },
    { km_from: 68, km_to: 73, label: "Pasteur – Bandung", speed: 36, delay_min: 6 },
  ],
  landmarks: [
    { km: 6, name: "GT Kalihurip Utama", kind: "gerbang" },
    { km: 28, name: "Rest Area KM 88 (Sadang)", kind: "rest" },
    { km: 41, name: "Jembatan Cisomang", kind: "gerbang" },
    { km: 50, name: "Rest Area KM 97", kind: "rest" },
    { km: 72, name: "GT Pasteur", kind: "gerbang" },
  ],
  weather: [
    { zone: "Cikampek – Purwakarta", condition: "Berawan", temp: 30, impact: "rendah" },
    { zone: "Sadang – Padalarang", condition: "Kabut tipis", temp: 25, impact: "sedang" },
    { zone: "Cimahi – Bandung", condition: "Hujan ringan", temp: 24, impact: "sedang" },
  ],
  bmkg: [
    { zone: "Cikampek – Purwakarta", adm4: "32.14.01.1001" }, // Purwakarta / Purwakarta
    { zone: "Sadang – Padalarang", adm4: "32.17.08.2001" },   // Bandung Barat / Padalarang
    { zone: "Cimahi – Bandung", adm4: "32.73.07.1001" },      // Kota Bandung / Sukajadi
  ],
};

/** All corridors, in selector order. Japek is the default. */
export const CORRIDORS: Corridor[] = [JAPEK, JAGORAWI, MERAK, PURBALEUNYI];

/** Lookup a corridor by id, falling back to the default (Japek). */
export function getCorridor(id?: string | null): Corridor {
  return CORRIDORS.find((c) => c.id === id) ?? CORRIDORS[0];
}
