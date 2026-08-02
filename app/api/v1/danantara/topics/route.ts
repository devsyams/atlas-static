import { NextResponse } from "next/server";

import { MOCK_TOPICS } from "@/lib/bgn/mock/fixtures";
import { MOCK_DANANTARA_TOPICS } from "@/lib/danantara/mock/fixtures";
import { readDevMockJson } from "@/lib/danantara/dev-mocks";
import { feedProductFromParams, resolveTopicCode } from "@/lib/danantara/feed-config";
import { fetchTopicsForCode, FeedNotConfiguredError } from "@/lib/danantara/topics-feed";

/**
 * BFF for the Danantara live topics feed — shared by the CEO Command Issues board
 * (A7, `danantara_main`) and the per-BUMN dashboards (A8, `?code=danantara_<bumn>`).
 * The `?code=` param is **allowlisted** against the BUMN registry (+ danantara_main)
 * so the route can't be an open proxy. Fetch/window/cache live in `topics-feed`;
 * `?fresh=1` bypasses the cache. `api_key` stays server-side only.
 *
 * Intentionally public (no requireRole): standalone sales-lead demo.
 */

/** The only day-windows the UI offers (A7 v49.0) — anything else is ignored. */
const DAYS_ALLOWED = new Set([1, 7, 30]);

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const fresh = params.get("fresh") === "1";
  const daysParam = Number(params.get("days"));
  const days = DAYS_ALLOWED.has(daysParam) ? daysParam : undefined;
  const product = feedProductFromParams(params);

  // Scoped demo mock (?mock=1) — **product-aware**: BGN fixtures for /bgn/command
  // (which also sends ?bgn=1), Danantara fixtures for the /danantara demo
  // (DANANTARA_DEMO_MOCK, A7 v50.1). Every other caller falls through to the live path
  // untouched. Production-safe by design — bundled demo data, never a secret or an
  // upstream call — unlike the NODE_ENV-gated dev-mock seam below.
  if (params.get("mock") === "1") {
    return NextResponse.json(product === "bgn" ? MOCK_TOPICS : MOCK_DANANTARA_TOPICS);
  }

  const mockJson = readDevMockJson("topics.json") ?? process.env.DANANTARA_TOPICS_MOCK_JSON;
  if (process.env.NODE_ENV !== "production" && mockJson) {
    try {
      return NextResponse.json(JSON.parse(mockJson) as unknown);
    } catch {
      return NextResponse.json({ error: "Invalid topics mock JSON." }, { status: 500 });
    }
  }

  // Per-product resolution (A7 v50.0): `?bgn=1` (sent only by /bgn/command) → the BGN
  // product; otherwise the Danantara product. An allowlisted `?code=` still wins (the
  // per-BUMN dashboards); an arbitrary topic is never proxied.
  const code = resolveTopicCode(params, product);

  try {
    const result = await fetchTopicsForCode(code, { fresh, days, product });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof FeedNotConfiguredError) {
      return NextResponse.json({ error: "Topics feed not configured." }, { status: 503 });
    }
    return NextResponse.json({ error: "Topics feed unavailable." }, { status: 502 });
  }
}
