/**
 * Per-product intelligence-feed config (A7 v50.0 / A10 v11.0).
 *
 * `/danantara` and `/bgn/command` are two products sharing the same three feed BFFs
 * (`/topics`, `/threats`, `/actor-intelligence`). Each product points at its **own**
 * upstream: Danantara → the old opengate/garudaperkasa host; BGN → the TrawlDeck facade.
 * Both are wire-compatible (`GET {base}/<endpoint>?topic=<code>&api_key=<key>`), so the
 * only per-product difference is the base URL + key + topic code — held here.
 *
 * A caller selects the product with `?bgn=1` (sent only by `/bgn/command`, threaded like
 * `?mock=1`); everything else is the Danantara product. Server-only reads of `process.env`.
 */

import { DANANTARA_MAIN_CODE, isAllowedTopicCode } from "../bumn/registry";

export type FeedProduct = "danantara" | "bgn";

/** The three feed endpoints; the suffix is appended to a product's base in code. */
export type FeedEndpoint = "topics" | "threats" | "actor-intelligence";

/** Env var names per product. The Danantara key keeps its original name so the
 * OpenGate autologin + Nexorus deeplink routes that read it are untouched. */
const PRODUCT_ENV: Record<FeedProduct, { base: string; key: string; code: string }> = {
  danantara: {
    base: "DANANTARA_INTELLIGENCE_BASE_URL",
    key: "DANANTARA_TOPICS_API_KEY",
    code: "DANANTARA_TOPIC_CODE",
  },
  bgn: {
    base: "BGN_INTELLIGENCE_BASE_URL",
    key: "BGN_INTELLIGENCE_API_KEY",
    code: "BGN_TOPIC_CODE",
  },
};

/** `?bgn=1` selects the BGN product; anything else is the Danantara product. */
export function feedProductFromParams(params: URLSearchParams): FeedProduct {
  return params.get("bgn") === "1" ? "bgn" : "danantara";
}

/**
 * Resolve `{ base, apiKey }` for a product's endpoint — the base already carries the
 * `/<endpoint>` suffix. Returns `null` when the product's base or key is unset, so the
 * feed can raise its own `*NotConfiguredError` (→ the BFF's honest 503).
 */
export function resolveFeedEndpoint(
  product: FeedProduct,
  endpoint: FeedEndpoint,
): { base: string; apiKey: string } | null {
  const env = PRODUCT_ENV[product];
  const base = process.env[env.base];
  const apiKey = process.env[env.key];
  if (!base || !apiKey) return null;
  return { base: `${base.replace(/\/+$/, "")}/${endpoint}`, apiKey };
}

/**
 * The topic code for a request: an allowlisted `?code=` override wins (the per-BUMN
 * dashboards), else the product's env code, else `danantara_main`. The allowlist keeps
 * the route from being an open proxy — an arbitrary `?code=` is never forwarded.
 */
export function resolveTopicCode(params: URLSearchParams, product: FeedProduct): string {
  const requested = params.get("code");
  if (requested && isAllowedTopicCode(requested)) return requested;
  return process.env[PRODUCT_ENV[product].code] || DANANTARA_MAIN_CODE;
}
