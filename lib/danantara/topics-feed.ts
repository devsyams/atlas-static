/**
 * Server-side fetch for the Danantara live topics feed — shared by the topics
 * BFF (A7) and the BUMN-board aggregation BFF (A7 v37). Holds the env key, the
 * 7-day→28-day window strategy, and the Next data-cache options in one place so
 * the secret + caching live once. Server-only (reads `process.env`, calls fetch).
 */

import {
  buildTopicsUrl,
  mapTopicsResponse,
  rollingWindow,
  type MappedTopics,
  type TopicsApiResponse,
} from "./ceo/topics-source";

const DEFAULT_BASE = "https://api.garudaperkasa.io/api-nexorus/topics";
const PRIMARY_DAYS = 7;
const FALLBACK_DAYS = 28;
const REVALIDATE_S = 3_600; // 1 hour

export type FeedResult = MappedTopics & { meta: TopicsApiResponse["meta"] };

/** Thrown when the feed has no API key configured (callers map this to 503). */
export class FeedNotConfiguredError extends Error {}

async function fetchWindow(
  base: string,
  code: string,
  apiKey: string,
  days: number,
  fresh: boolean,
): Promise<FeedResult> {
  const url = buildTopicsUrl(base, code, apiKey, rollingWindow(new Date(), days));
  const res = await fetch(url, fresh ? { cache: "no-store" } : { next: { revalidate: REVALIDATE_S } });
  if (!res.ok) throw new Error(`upstream ${res.status}`);
  const json = (await res.json()) as TopicsApiResponse;
  if (!json?.success || !Array.isArray(json?.data?.topics)) {
    throw new Error("malformed upstream payload");
  }
  return { ...mapTopicsResponse(json), meta: json.meta };
}

/** A rolling 7-day window that auto-widens to 28 days when 7 days has no topics. */
async function fetchWidened(
  base: string,
  code: string,
  apiKey: string,
  fresh: boolean,
): Promise<FeedResult> {
  const result = await fetchWindow(base, code, apiKey, PRIMARY_DAYS, fresh);
  if (result.issues.length > 0) return result;
  try {
    return await fetchWindow(base, code, apiKey, FALLBACK_DAYS, fresh);
  } catch {
    return result; // keep the (empty) 7-day result rather than failing
  }
}

/**
 * Fetch + map one topic code: a rolling 7-day window that auto-widens to 28 days
 * when empty. `fresh` bypasses the data cache. Throws `FeedNotConfiguredError`
 * if no key, or a generic error on upstream failure.
 *
 * Stale-empty guard: the upstream intermittently serves a *hollow* window (no
 * `topics`, null `summary`) for a code that has data — typically when it is slow
 * or recomputing. Because a cacheable response is held for an hour, that blip
 * would otherwise mask real data until the cache expires (Postman, hitting the
 * upstream uncached, would meanwhile show the data). So when the cacheable path
 * comes back empty, we confirm **once** against the live (no-store) upstream and
 * prefer any live data — a transient/stale empty self-heals on the next load
 * instead of sticking. A genuinely sparse BUMN (Mandiri/BRI) stays empty.
 */
export async function fetchTopicsForCode(
  code: string,
  opts: { fresh?: boolean } = {},
): Promise<FeedResult> {
  const base = process.env.DANANTARA_TOPICS_API_BASE || DEFAULT_BASE;
  const apiKey = process.env.DANANTARA_TOPICS_API_KEY;
  if (!apiKey) throw new FeedNotConfiguredError("Topics feed not configured.");

  const fresh = opts.fresh ?? false;
  const result = await fetchWidened(base, code, apiKey, fresh);

  // Already empty *and* served from cache → re-check the live upstream once, so a
  // recovered feed isn't hidden behind a stale cached empty. `fresh` is already
  // live, so it needs no confirm.
  if (!fresh && result.issues.length === 0) {
    try {
      const live = await fetchWidened(base, code, apiKey, true);
      if (live.issues.length > 0) return live;
    } catch {
      /* keep the cached empty rather than failing the request */
    }
  }
  return result;
}
