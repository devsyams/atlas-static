/**
 * Server-side fetch for the Danantara **threats** feed (A10 v5.0) — a sibling of
 * `topics-feed.ts` / `sentiment-trend-feed.ts`. Holds the env key + cache so the
 * secret lives once and never reaches the browser. The upstream returns the
 * platform's AI-detected threats for a topic code (not date-range based). Server-only
 * (reads `process.env`, calls `fetch`).
 */

import { mapThreatsResponse, type MappedThreats, type ThreatsApiResponse } from "./ceo/threats-source";
import { resolveFeedEndpoint, type FeedProduct } from "./feed-config";

const REVALIDATE_S = 21_600; // 6 h — matches the topics feed (the upstream refreshes ~daily)

export type ThreatsResult = MappedThreats & { meta: ThreatsApiResponse["meta"] };

/** Thrown when the feed has no base URL or API key configured (callers map this to 503).
 * A10 v6.0: no hardcoded default base — the GARUDA host is dead (TrawlDeck cutover). */
export class ThreatsNotConfiguredError extends Error {}

/** One fetch + map. `fresh` bypasses the data cache. */
async function fetchOnce(base: string, code: string, apiKey: string, fresh: boolean): Promise<ThreatsResult> {
  const url = `${base}?${new URLSearchParams({ topic: code, api_key: apiKey }).toString()}`;
  const res = await fetch(url, fresh ? { cache: "no-store" } : { next: { revalidate: REVALIDATE_S } });
  if (!res.ok) throw new Error(`upstream ${res.status}`);

  const json = (await res.json()) as ThreatsApiResponse;
  if (!json?.success || !Array.isArray(json?.data?.threats)) throw new Error("malformed upstream payload");
  return { ...mapThreatsResponse(json), meta: json.meta };
}

/**
 * Fetch + map the detected threats for a topic code. `fresh` bypasses the data cache.
 * Reuses the topics feed's `DANANTARA_TOPICS_API_KEY` (both OpenGate routes share one
 * key). Throws `ThreatsNotConfiguredError` if no key, or a generic error on upstream
 * failure / malformed payload.
 *
 * Stale-empty self-heal (A10 v5.2): the `/threats` upstream intermittently serves a
 * **hollow** window — an empty `threats` list, sometimes with non-zero `stats.*_severity`
 * — typically when it is slow/recomputing. Because a cacheable response is held for 6 h,
 * that blip would otherwise blank the gate's threat + actor panels until the cache
 * expires. So when the cacheable path comes back with zero threats, confirm **once**
 * against the live (no-store) upstream and prefer any live threats — a transient hollow
 * self-heals on the next load instead of sticking. A genuinely calm feed stays empty.
 */
export async function fetchThreatsForCode(
  code: string,
  opts: { fresh?: boolean; product?: FeedProduct } = {},
): Promise<ThreatsResult> {
  // Per-product base+key (A10 v10.0): Danantara by default, BGN on `?bgn=1`.
  const endpoint = resolveFeedEndpoint(opts.product ?? "danantara", "threats");
  if (!endpoint) throw new ThreatsNotConfiguredError("Threats feed not configured.");
  const { base, apiKey } = endpoint;

  const fresh = opts.fresh ?? false;
  const result = await fetchOnce(base, code, apiKey, fresh);

  // Cacheable + empty → re-check the live upstream once, so a recovered feed isn't
  // hidden behind a stale cached hollow. `fresh` is already live, so it needs no confirm.
  if (!fresh && result.threats.length === 0) {
    try {
      const live = await fetchOnce(base, code, apiKey, true);
      if (live.threats.length > 0) return live;
    } catch {
      /* keep the cached empty rather than failing the request */
    }
  }
  return result;
}
