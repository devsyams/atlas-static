import { NextResponse } from "next/server";

import { DANANTARA_MAIN_CODE, isAllowedTopicCode } from "@/lib/bumn/registry";
import { fetchSentimentTrend, TrendNotConfiguredError } from "@/lib/danantara/sentiment-trend-feed";

/**
 * BFF for the Danantara sentiment-trend feed (A11 v2.0) — the 7-day daily
 * positive/negative/neutral series behind the Executive Briefing's momentum
 * element. The `?code=` param is allowlisted against the BUMN registry
 * (+ `danantara_main`) so the route can't be an open proxy; the `api_key` stays
 * server-side in `sentiment-trend-feed`. `?fresh=1` bypasses the cache.
 *
 * Intentionally public (no requireRole): standalone sales-lead demo.
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const fresh = params.get("fresh") === "1";

  const requested = params.get("code");
  const code =
    requested && isAllowedTopicCode(requested)
      ? requested
      : process.env.DANANTARA_TOPIC_CODE || DANANTARA_MAIN_CODE;

  try {
    const result = await fetchSentimentTrend(code, { fresh });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof TrendNotConfiguredError) {
      return NextResponse.json({ error: "Sentiment-trend feed not configured." }, { status: 503 });
    }
    return NextResponse.json({ error: "Sentiment-trend feed unavailable." }, { status: 502 });
  }
}
