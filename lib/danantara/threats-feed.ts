/**
 * Server-side fetch for the Danantara **threats** feed (A10 v5.0) — a sibling of
 * `topics-feed.ts` / `sentiment-trend-feed.ts`. Holds the env key + cache so the
 * secret lives once and never reaches the browser. The upstream returns the
 * platform's AI-detected threats for a topic code (not date-range based). Server-only
 * (reads `process.env`, calls `fetch`).
 */

import { mapThreatsResponse, type MappedThreats, type ThreatsApiResponse } from "./ceo/threats-source";

const DEFAULT_BASE = "https://api.garudaperkasa.io/api-nexorus/threats";
const REVALIDATE_S = 21_600; // 6 h — matches the topics feed (the upstream refreshes ~daily)

export type ThreatsResult = MappedThreats & { meta: ThreatsApiResponse["meta"] };

/** Thrown when the feed has no API key configured (callers map this to 503). */
export class ThreatsNotConfiguredError extends Error {}

/**
 * Fetch + map the detected threats for a topic code. `fresh` bypasses the data cache.
 * Reuses the topics feed's `DANANTARA_TOPICS_API_KEY` (both OpenGate routes share one
 * key). Throws `ThreatsNotConfiguredError` if no key, or a generic error on upstream
 * failure / malformed payload.
 */
export async function fetchThreatsForCode(code: string, opts: { fresh?: boolean } = {}): Promise<ThreatsResult> {
  const base = process.env.DANANTARA_THREATS_API_BASE || DEFAULT_BASE;
  const apiKey = process.env.DANANTARA_TOPICS_API_KEY;
  if (!apiKey) throw new ThreatsNotConfiguredError("Threats feed not configured.");

  const url = `${base}?${new URLSearchParams({ topic: code, api_key: apiKey }).toString()}`;
  const res = await fetch(url, opts.fresh ? { cache: "no-store" } : { next: { revalidate: REVALIDATE_S } });
  if (!res.ok) throw new Error(`upstream ${res.status}`);

  const json = (await res.json()) as ThreatsApiResponse;
  if (!json?.success || !Array.isArray(json?.data?.threats)) throw new Error("malformed upstream payload");
  return { ...mapThreatsResponse(json), meta: json.meta };
}
