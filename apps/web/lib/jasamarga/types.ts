import type { MarketTickerItem, Prediction } from "@/lib/mbg/types";

/** Flow state of a road segment / facility, ascending in severity. */
export type FlowStatus = "lancar" | "padat" | "macet" | "lumpuh";

/** One landmark-to-landmark stretch of the corridor, for the Route Ribbon. */
export interface RouteSegment {
  km_from: number;
  km_to: number;
  label: string;
  speed: number; // km/h
  vcr: number; // volume / capacity (≥1 = over capacity)
  status: FlowStatus;
  /** Sheikh Mohamed bin Zayed elevated (Layang MBZ) available over this stretch. */
  elevated?: boolean;
  incident?: boolean;
}

/** A toll plaza (gerbang/gardu) and its live transaction load. */
export interface Gate {
  name: string;
  km: number;
  txn_per_min: number;
  avg_txn_sec: number;
  queue_m: number;
  open_lanes: number;
  total_lanes: number;
}

export interface IncidentItem {
  id: string;
  km: string; // e.g. "KM 52+400"
  direction: string; // arah Cikampek / arah Jakarta
  type: string; // Kecelakaan, Kendaraan Mogok, ODOL, Genangan, Perbaikan
  severity: number; // 0–10
  status: string; // Ditangani, Dalam perjalanan, Antre, Selesai
  unit: string; // responding unit(s)
  eta_min: number; // ETA to clear / arrive
  lanes_blocked: number;
  lanes_total: number;
  reported: string; // relative time
  detail: string;
}

export interface RestArea {
  km: number;
  name: string;
  type: "A" | "B" | "C";
  capacity: number;
  occupancy: number; // current vehicles (can exceed capacity → overflow)
  status: FlowStatus;
}

export interface FleetUnit {
  id: string;
  type: string; // Derek, Ambulans, PJR, Rescue
  call: string; // call sign
  status: "Standby" | "Bergerak" | "Di lokasi" | "Kembali";
  location_km: number;
  assigned?: string; // incident id
  response_min?: number;
}

export interface SpmMetric {
  category: string;
  value: string; // current measured value
  standard: string; // BPJT minimum-service standard
  compliance: number; // 0–100 %
  ok: boolean;
}

export interface RuasLoad {
  name: string;
  km_range: string;
  load: number; // 0–10
  speed: number; // km/h
  volume: number; // vehicles/hour
  dominant: string; // dominant condition driver
}

/** A traffic-engineering option the AI can simulate and "apply". */
export interface Intervention {
  id: string;
  title: string;
  segment: string;
  rationale: string;
  impact_time_pct: number; // travel-time change (negative = faster)
  impact_clear_min: number; // projected minutes to clear the queue
  risk: "rendah" | "sedang" | "tinggi";
  recommended: boolean;
}

export interface OpsInsight {
  title: string;
  text: string;
  action?: string;
}

export interface ConditionChip {
  label: string;
  tone: "good" | "warn" | "bad";
}

export interface OpsSnapshot {
  corridor: string;
  updated_at: string;
  load_index: number; // 0–10 network strain (high = bad)
  level: string; // Lancar / Padat / Macet / Lumpuh
  emoji: string;
  avg_speed: number; // km/h
  active_incidents: number;
  vehicles_now: number; // vehicles currently on corridor
  lhr_today: number; // running average daily traffic
  revenue_today: number; // rupiah
  revenue_target: number; // rupiah
  spm_compliance: number; // overall %
  insight: OpsInsight;
  conditions: ConditionChip[];
  predictions: Prediction[];
  ticker: MarketTickerItem[];
  segments: RouteSegment[];
  gates: Gate[];
  incidents: IncidentItem[];
  rest_areas: RestArea[];
  fleet: FleetUnit[];
  spm: SpmMetric[];
  top_ruas: RuasLoad[];
  interventions: Intervention[];
}
