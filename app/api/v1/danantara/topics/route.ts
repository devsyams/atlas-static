import { NextResponse } from "next/server";

import { DANANTARA_MAIN_CODE, isAllowedTopicCode } from "@/lib/bumn/registry";
import {
  buildTopicsUrl,
  mapTopicsResponse,
  rollingWindow,
  type TopicsApiResponse,
} from "@/lib/danantara/ceo/topics-source";

/**
 * BFF for the Danantara live topics feed — shared by the CEO Command wall (A7,
 * `danantara_main`) and the per-BUMN dashboards (A8, `?code=danantara_<bumn>`).
 * Proxies the external media-intelligence feed server-side so the `api_key` never
 * reaches the browser (API-first + secrets-server-side), and maps the payload to
 * the board model.
 *
 * The `?code=` param is **allowlisted** against the BUMN registry (+ danantara_main)
 * so the route can't be turned into an open proxy. Window strategy (A8): request a
 * rolling **7-day** window and **auto-widen to 28 days** when the 7-day window has
 * no topics (some BUMN are sparse). Cached via the Next data cache (~1 h); a manual
 * refresh passes `?fresh=1` to bypass the cache (`no-store`) and re-hit upstream.
 * On any upstream error we return a non-OK status; the client degrades gracefully.
 *
 * Intentionally public (no requireRole): standalone sales-lead demo. Gate it like
 * /api/v1/mbg-crisis if productized.
 */

const DEFAULT_BASE = "https://api.garudaperkasa.io/api-nexorus/topics";
const PRIMARY_DAYS = 7;
const FALLBACK_DAYS = 28;
const REVALIDATE_S = 3_600; // 1 hour

export async function GET(req: Request) {
  const base = process.env.DANANTARA_TOPICS_API_BASE || DEFAULT_BASE;
  const apiKey = process.env.DANANTARA_TOPICS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Topics feed not configured." }, { status: 503 });
  }

  const params = new URL(req.url).searchParams;
  const fresh = params.get("fresh") === "1";

  // Only an allowlisted code is ever proxied; anything else falls back to the
  // Danantara-wide code (or the env override). Never proxy an arbitrary topic.
  const requested = params.get("code");
  const topicCode =
    requested && isAllowedTopicCode(requested)
      ? requested
      : process.env.DANANTARA_TOPIC_CODE || DANANTARA_MAIN_CODE;

  const fetchWindow = async (days: number) => {
    const url = buildTopicsUrl(base, topicCode, apiKey, rollingWindow(new Date(), days));
    const res = await fetch(url, fresh ? { cache: "no-store" } : { next: { revalidate: REVALIDATE_S } });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const json = (await res.json()) as TopicsApiResponse;
    if (!json?.success || !Array.isArray(json?.data?.topics)) {
      throw new Error("malformed upstream payload");
    }
    return { ...mapTopicsResponse(json), meta: json.meta };
  };

  try {
    let result = await fetchWindow(PRIMARY_DAYS);
    // Sparse BUMN: widen the window when the fresh 7-day view has no topics.
    if (result.issues.length === 0) {
      try {
        result = await fetchWindow(FALLBACK_DAYS);
      } catch {
        /* keep the (empty) 7-day result rather than failing the request */
      }
    }
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Topics feed unavailable." }, { status: 502 });
  }
}
