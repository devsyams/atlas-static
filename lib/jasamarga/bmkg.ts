import type { WeatherZone } from "./types";

/**
 * A12 v5.0 — real corridor weather from BMKG.
 *
 * `Cuaca Koridor (BMKG)` used to be a hardcoded literal in `corridors.ts`: Japek
 * claimed "Cerah berawan, 31°" at midnight, in the dark, forever. Worse, that
 * fixed `impact` fed the Safe Meter's weather penalty, the header KPI and the LLM
 * grounding — the model was recommending rain warnings off a string constant.
 *
 * BMKG's public forecast API is free and needs no key. It is keyed by `adm4`
 * (Kemendagri village code), so each corridor weather zone carries the code of a
 * verified village on that stretch of road (see `corridors.ts`).
 *
 * The pure helpers here are the whole contract; the fetch is a thin wrapper.
 * Any failure returns null and the caller keeps the static zone (AC18).
 */

const BMKG_URL = "https://api.bmkg.go.id/publik/prakiraan-cuaca";

/** BMKG publishes 3-hourly; re-reading more often than that buys nothing. */
const CACHE_TTL_S = 3 * 60 * 60;

const TIMEOUT_MS = 6000;

/** One 3-hourly forecast slot, as BMKG returns it (fields we use). */
export interface BmkgForecast {
  datetime: string; // UTC ISO, e.g. "2026-07-15T00:00:00Z"
  t: number; // temperature °C
  weather: number; // BMKG weather code
  weather_desc: string; // Indonesian description, e.g. "Hujan Ringan"
}

/** A corridor weather zone bound to the village whose forecast represents it. */
export interface BmkgZone {
  zone: string; // the label the dashboard shows
  adm4: string; // Kemendagri village code, e.g. "32.15.13.2001"
}

/**
 * BMKG weather codes → operational impact on a toll corridor.
 * 0–4 clear/cloudy · 5 haze · 10 smoke · 45 fog · 60/61 light+moderate rain ·
 * 63 heavy rain · 80 local rain · 95/97 thunderstorm.
 */
const HIGH = new Set([63, 95, 97]);
const MEDIUM = new Set([5, 10, 45, 60, 61, 80]);

export function weatherImpact(code: number, desc: string): WeatherZone["impact"] {
  if (HIGH.has(code)) return "tinggi";
  if (MEDIUM.has(code)) return "sedang";

  // Unknown code (BMKG has added them before) → read the description instead.
  const d = desc.toLowerCase();
  if (d.includes("petir") || d.includes("lebat")) return "tinggi";
  if (d.includes("hujan") || d.includes("kabut") || d.includes("asap")) return "sedang";
  return "rendah";
}

/**
 * The slot covering `now`: the latest forecast at or before it. BMKG returns a
 * rolling 3-day window, so the head of the series can already be in the past.
 * Falls back to the first slot when the whole series is still ahead of us.
 */
export function pickCurrent(series: BmkgForecast[], nowMs: number): BmkgForecast | null {
  if (!series.length) return null;

  const sorted = [...series].sort((a, b) => Date.parse(a.datetime) - Date.parse(b.datetime));
  let current: BmkgForecast | null = null;
  for (const f of sorted) {
    if (Date.parse(f.datetime) <= nowMs) current = f;
    else break;
  }
  return current ?? sorted[0];
}

/** How many forward slots the forecast projection (A12 v6.0) is grounded on. */
const OUTLOOK_SLOTS = 3;

/**
 * The next `n` 3-hourly slots STRICTLY AFTER `nowMs`, sorted ascending, capped
 * at however many the series actually has. Empty for an empty or all-past
 * series. Mirrors `pickCurrent`, but looking forward instead of at now — this
 * is the real signal the LLM forecast projection (A12 v6.0) grounds on,
 * replacing the fabricated `PROYEKSI BEBAN 6 JAM` echo.
 */
export function pickForward(series: BmkgForecast[], nowMs: number, n: number): BmkgForecast[] {
  if (!series.length || n <= 0) return [];

  return [...series]
    .sort((a, b) => Date.parse(a.datetime) - Date.parse(b.datetime))
    .filter((f) => Date.parse(f.datetime) > nowMs)
    .slice(0, n);
}

/** BMKG datetime (UTC ISO) -> the WIB (UTC+7) hour label the dashboard shows. */
function wibHourLabel(datetime: string): string {
  const h = new Date(Date.parse(datetime) + 7 * 3600e3).getUTCHours();
  return `${String(h).padStart(2, "0")}:00`;
}

/** Validate + map one BMKG payload onto a dashboard `WeatherZone`. Null if unusable. */
export function mapBmkgZone(raw: unknown, zone: string, nowMs: number): WeatherZone | null {
  if (!raw || typeof raw !== "object") return null;

  const data = (raw as { data?: { cuaca?: BmkgForecast[][] }[] }).data;
  if (!Array.isArray(data) || data.length === 0) return null;

  // `cuaca` is grouped per day — flatten before picking.
  const series = (data[0]?.cuaca ?? []).flat().filter((f) => f && typeof f.datetime === "string");
  const now = pickCurrent(series, nowMs);
  if (!now || typeof now.t !== "number" || !now.weather_desc) return null;

  const outlook = pickForward(series, nowMs, OUTLOOK_SLOTS)
    .filter((f) => typeof f.weather_desc === "string" && f.weather_desc)
    .map((f) => ({
      hour: wibHourLabel(f.datetime),
      condition: f.weather_desc,
      impact: weatherImpact(f.weather, f.weather_desc),
    }));

  return {
    zone,
    condition: now.weather_desc,
    temp: Math.round(now.t),
    impact: weatherImpact(now.weather, now.weather_desc),
    ...(outlook.length ? { outlook } : {}),
  };
}

async function fetchZone(z: BmkgZone, nowMs: number): Promise<WeatherZone | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BMKG_URL}?adm4=${encodeURIComponent(z.adm4)}`, {
      signal: ctrl.signal,
      next: { revalidate: CACHE_TTL_S },
    });
    if (!res.ok) return null;
    return mapBmkgZone(await res.json(), z.zone, nowMs);
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Live weather for a corridor's zones, or null → the caller keeps the static set.
 *
 * All-or-nothing on purpose: a half-real weather strip (two live zones, one from
 * 2026's hardcoded literal) is worse than an honestly static one, because nothing
 * on screen would tell you which was which.
 */
export async function fetchCorridorWeather(
  zones: BmkgZone[],
  nowMs: number = Date.now(),
): Promise<WeatherZone[] | null> {
  if (!zones.length) return null;

  const results = await Promise.all(zones.map((z) => fetchZone(z, nowMs)));
  if (results.some((r) => r == null)) return null;
  return results as WeatherZone[];
}
