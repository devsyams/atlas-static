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
  lat?: number; // map coordinate (TomTom-supplied or derived from km)
  lng?: number;
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
/**
 * One real conversation topic from the media-intelligence feed (A12 v2.0).
 * Replaces the fabricated `SocialPost` tweets when the live feed is available.
 */
export interface SocialTopic {
  title: string;
  aiLine: string; // the feed's own AI read of the topic
  impressions: number;
  reach: number;
  sentiment: number; // -100 (hostile) .. 100 (supportive)
}

export interface SocialPulse {
  mentions_24h: number;
  negativity: number; // 0–10 (high = more negative chatter)
  trend: TrendKeyword[];
  top_posts: SocialPost[];
  /**
   * (A12 v2.0) Provenance. "live" = the client's real `danantara_jasamarga`
   * media-intelligence feed — the same one behind /bumn-v2/jasamarga. "demo" =
   * the synthetic pulse. Everything below is only populated when live.
   */
  source?: "live" | "demo";
  impressions?: number;
  reach?: number;
  sentiment_pct?: { positive: number; negative: number; neutral: number };
  topics?: SocialTopic[];
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

/** One contributing factor to the corridor Safe Meter (points subtracted from 100). */
export interface SafetyFactor {
  key: "insiden" | "cuaca" | "volatilitas" | "sentimen";
  label: string;
  penalty: number; // points removed from a perfect 100
}

/** Composite corridor safety headline ("Skor Keselamatan"). Higher = safer. */
export interface SafetyIndex {
  score: number; // 0–100
  level: "Aman" | "Waspada" | "Rawan" | "Bahaya";
  emoji: string;
  trend: "up" | "down" | "flat"; // up = improving (safer) vs prior reading
  delta: number; // score change vs prior reading
  factors: SafetyFactor[];
  narrative: string; // one-line plain-language summary
}

export interface CorridorPulse {
  id: string;
  short: string;
  name: string;
  score: number; // 0–100 Safe Meter
  level: SafetyIndex["level"];
  emoji: string;
  load_index: number; // 0–10 congestion
}

/** One simulated AI-vision CCTV feed watching a corridor hotspot. */
export interface CctvFeed {
  id: string;
  km: string; // "KM 52"
  name: string; // segment label
  status: FlowStatus;
  vehicles: { mobil: number; truk: number; motor: number }; // detections in frame
  flags: string[]; // AI event flags (Antrean terdeteksi, Kecelakaan terdeteksi…)
  confidence: number; // 0–1 detector confidence
  lat?: number;
  lng?: number;
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
  safety: SafetyIndex;
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
  cctv: CctvFeed[];
}
