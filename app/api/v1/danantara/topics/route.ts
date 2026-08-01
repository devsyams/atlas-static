import { NextResponse } from "next/server";

import { DANANTARA_MAIN_CODE, isAllowedTopicCode } from "@/lib/bumn/registry";
import { readDevMockJson } from "@/lib/danantara/dev-mocks";
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

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const fresh = params.get("fresh") === "1";

  const mockJson = readDevMockJson("topics.json") ?? process.env.DANANTARA_TOPICS_MOCK_JSON;
  if (process.env.NODE_ENV !== "production" && mockJson) {
    try {
      return NextResponse.json(JSON.parse(mockJson) as unknown);
    } catch {
      return NextResponse.json({ error: "Invalid topics mock JSON." }, { status: 500 });
    }
  }

  // Only an allowlisted code is ever proxied; anything else falls back to the
  // Danantara-wide code (or the env override). Never proxy an arbitrary topic.
  const requested = params.get("code");
  const code =
    requested && isAllowedTopicCode(requested)
      ? requested
      : process.env.DANANTARA_TOPIC_CODE || DANANTARA_MAIN_CODE;

  try {
    const result = await fetchTopicsForCode(code, { fresh });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof FeedNotConfiguredError) {
      return NextResponse.json({ error: "Topics feed not configured." }, { status: 503 });
    }
    return NextResponse.json({ error: "Topics feed unavailable." }, { status: 502 });
  }
}
