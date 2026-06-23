/**
 * Server-side fetch for the Danantara **sentiment-trend** feed (A11 v2.0) — a
 * sibling of `topics-feed.ts`. Holds the env key + cache so the secret lives once
 * and never reaches the browser. The upstream returns a daily
 * `{ date, positive, negative, neutral }` series for a topic code. Server-only
 * (reads `process.env`, calls `fetch`).
 */

const DEFAULT_BASE = "https://api.garudaperkasa.io/api-nexorus/sentiment-trend";
const REVALIDATE_S = 21_600; // 6 h — the upstream refreshes ~daily (matches topics-feed)

export interface TrendApiPoint {
  date: string;
  positive: number;
  negative: number;
  neutral: number;
}

export interface TrendApiResponse {
  success: boolean;
  status_code: number;
  meta: { topic: string; startdate: string; enddate: string };
  data: TrendApiPoint[];
}

export interface TrendResult {
  points: TrendApiPoint[];
  meta: TrendApiResponse["meta"];
}

/** Thrown when the feed has no API key configured (callers map this to 503). */
export class TrendNotConfiguredError extends Error {}

/**
 * Fetch the daily sentiment trend for a topic code. `fresh` bypasses the data
 * cache. Throws `TrendNotConfiguredError` if no key, or a generic error on
 * upstream failure / malformed payload.
 */
export async function fetchSentimentTrend(code: string, opts: { fresh?: boolean } = {}): Promise<TrendResult> {
  const base = process.env.DANANTARA_TREND_API_BASE || DEFAULT_BASE;
  const apiKey = process.env.DANANTARA_TOPICS_API_KEY;
  if (!apiKey) throw new TrendNotConfiguredError("Sentiment-trend feed not configured.");

  const url = `${base}?${new URLSearchParams({ topic: code, api_key: apiKey }).toString()}`;
  const res = await fetch(url, opts.fresh ? { cache: "no-store" } : { next: { revalidate: REVALIDATE_S } });
  if (!res.ok) throw new Error(`upstream ${res.status}`);

  const json = (await res.json()) as TrendApiResponse;
  if (!json?.success || !Array.isArray(json?.data)) throw new Error("malformed upstream payload");
  return { points: json.data, meta: json.meta };
}
