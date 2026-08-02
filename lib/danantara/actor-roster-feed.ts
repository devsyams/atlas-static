/**
 * Server-side fetch for the Danantara **actor roster** (A10 v5.2) — the Crisis Gate's
 * right-column fallback when `/threats` has no detected incident. A sibling of
 * `threats-feed.ts`: holds the env key + cache so the secret lives once and never
 * reaches the browser. The upstream (`/actor-intelligence`) returns the key accounts
 * in the conversation for a topic code. Server-only (reads `process.env`, calls fetch).
 */

import { mapActorRoster, type ActorRosterApiResponse } from "./ceo/actor-roster-source";
import type { ThreatDriver } from "./ceo/threats-source";
import { resolveFeedEndpoint, type FeedProduct } from "./feed-config";
import { purgeFeedTag } from "./topics-feed";

const REVALIDATE_S = 21_600; // 6 h — matches the topics/threats feeds
const CACHE_TAG = "danantara-actors"; // A10 v11.1 — lets ?fresh=1 evict the cache, not just bypass it

/** Thrown when the feed has no base URL or API key configured (callers map this to 503).
 * A10 v9.0: no hardcoded default base — the GARUDA host is dead (TrawlDeck cutover). */
export class ActorRosterNotConfiguredError extends Error {}

/**
 * Fetch + map the actor roster for a topic code → ranked `ThreatDriver[]`. `fresh`
 * bypasses the data cache. Resolves the per-product base+key via `feed-config` (A10
 * v11.0): the Danantara product by default, or the BGN product on `product: "bgn"` (the
 * Danantara product keeps the `DANANTARA_TOPICS_API_KEY` name). Throws
 * `ActorRosterNotConfiguredError` if the resolved base/key is unset, or a generic error
 * on upstream failure / malformed payload.
 */
export async function fetchActorRosterForCode(
  code: string,
  opts: { fresh?: boolean; product?: FeedProduct } = {},
): Promise<ThreatDriver[]> {
  // Per-product base+key (A10 v11.0): Danantara by default, BGN on `?bgn=1`.
  const endpoint = resolveFeedEndpoint(opts.product ?? "danantara", "actor-intelligence");
  if (!endpoint) throw new ActorRosterNotConfiguredError("Actor roster feed not configured.");
  const { base, apiKey } = endpoint;

  // A10 v11.1: a fresh read also EVICTS the 6 h cache (tag invalidation).
  if (opts.fresh) purgeFeedTag(CACHE_TAG);
  const url = `${base}?${new URLSearchParams({ topic: code, api_key: apiKey }).toString()}`;
  const res = await fetch(url, opts.fresh ? { cache: "no-store" } : { next: { revalidate: REVALIDATE_S, tags: [CACHE_TAG] } });
  if (!res.ok) throw new Error(`upstream ${res.status}`);

  const json = (await res.json()) as ActorRosterApiResponse;
  if (!json?.success || !Array.isArray(json?.data)) throw new Error("malformed upstream payload");
  return mapActorRoster(json);
}
