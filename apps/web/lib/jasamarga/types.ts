import type { MarketTickerItem, Prediction } from "@/lib/mbg/types";

/** Flow state of a road segment, ascending in severity. */
export type FlowStatus = "lancar" | "padat" | "macet" | "lumpuh";

/** Where a signal was scraped/ingested from — all publicly available online. */
export type SourceType = "traffic" | "waze" | "medsos" | "berita" | "cuaca" | "resmi";

/**
 * One landmark-to-landmark stretch of the corridor for the Route Ribbon.
 * Speed + delay come from public traffic APIs (Google/Waze/TomTom) — no
 * internal volume/capacity figures.
 */
export interface RouteSegment {
  km_from: number;
  km_to: number;
  label: string;
  speed: number; // km/h (public traffic data)
  delay_min: number; // extra minutes vs free-flow over this stretch
  status: FlowStatus;
  elevated?: boolean; // Layang MBZ available
  incident?: boolean;
}

/** Public location marker on the ribbon (no internal metrics). */
export interface Landmark {
  km: number;
  name: string;
  kind: "gerbang" | "rest";
}

export interface IncidentItem {
  id: string;
  km: string; // e.g. "KM 52+400"
  direction: string;
  type: string; // Kecelakaan, Kendaraan mogok, Banjir, Penutupan…
  severity: number; // 0–10 (AI-scored from the report)
  status: string; // Dilaporkan, Berlangsung, Terkonfirmasi, Selesai
  source: string; // @TMCPoldaMetro, Waze, detik.com, @PTJASAMARGA…
  source_type: SourceType;
  reported: string; // relative time
  lanes_blocked?: number; // only when the public report states it
  detail: string;
}

export interface RuasLoad {
  name: string;
  km_range: string;
  load: number; // 0–10
  speed: number; // km/h
  delay_min: number;
  dominant: string;
}

export interface TrendKeyword {
  keyword: string;
  count: number;
  sentiment?: "negative" | "neutral" | "positive";
}

export interface SocialPost {
  handle: string;
  platform: string;
  text: string;
  sentiment: "negative" | "neutral" | "positive";
  engagement: number;
  time: string;
}

/** Public-sentiment pulse from social monitoring (the MBG-style core). */
export interface SocialPulse {
  mentions_24h: number;
  negativity: number; // 0–10 (high = more negative chatter)
  trend: TrendKeyword[];
  top_posts: SocialPost[];
}

/** Scraped official announcement (@PTJASAMARGA / Travoy / press release). */
export interface OfficialPost {
  time: string;
  category: string; // Rekayasa, Tarif, Pemeliharaan, Imbauan
  title: string;
  body: string;
}

export interface NewsArticle {
  title: string;
  source: string;
  time: string;
  sentiment: number; // 0–10 (high = negative)
  summary: string;
}

/** One hour of the congestion projection (from typical-traffic + weather + calendar). */
export interface ForecastHour {
  hour: string; // "15:00"
  load: number; // 0–10 predicted congestion
  label?: string; // "Sekarang", "Puncak"
}

/** Live travel time for an origin→destination pair (from routing/traffic APIs). */
export interface TravelTime {
  route: string; // "Halim → Cikampek Utama"
  via: string; // "Tol Japek", "Layang MBZ", "Arteri Pantura"
  minutes: number;
  normal_minutes: number; // free-flow / typical
  trend: "up" | "down" | "flat";
  best?: boolean; // fastest option right now
}

export interface WeatherZone {
  zone: string;
  condition: string; // Cerah, Hujan ringan, Hujan lebat…
  temp: number;
  impact: "rendah" | "sedang" | "tinggi";
}

/** A connected online feed, surfaced in the "Sumber Data" status strip.
 * "demo" = sourceable from public APIs but not wired in this build (fabricated). */
export interface SourceFeed {
  name: string;
  type: SourceType;
  status: "live" | "delay" | "down" | "demo";
  items_24h: number;
  last_sync: string;
}

/** A traffic-engineering option the AI recommends (decision-support, not control). */
export interface Intervention {
  id: string;
  title: string;
  segment: string;
  rationale: string;
  impact_time_pct: number; // projected travel-time change (negative = faster)
  impact_clear_min: number;
  risk: "rendah" | "sedang" | "tinggi";
  recommended: boolean;
  officially_announced: boolean; // already announced by JasaMarga?
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
  /** Whether the ribbon/segments came from a live traffic API or the synthetic demo. */
  traffic_source: "synthetic" | "tomtom";
  load_index: number; // 0–10 congestion index (high = bad)
  level: string; // Lancar / Padat / Macet / Lumpuh
  emoji: string;
  avg_speed: number; // km/h (public traffic)
  avg_delay_min: number; // extra minutes end-to-end vs free-flow
  active_incidents: number;
  insight: OpsInsight;
  conditions: ConditionChip[];
  predictions: Prediction[];
  ticker: MarketTickerItem[];
  segments: RouteSegment[];
  landmarks: Landmark[];
  incidents: IncidentItem[];
  top_ruas: RuasLoad[];
  interventions: Intervention[];
  social: SocialPulse;
  official: OfficialPost[];
  news: NewsArticle[];
  forecast: ForecastHour[];
  travel_times: TravelTime[];
  weather: WeatherZone[];
  sources: SourceFeed[];
}
