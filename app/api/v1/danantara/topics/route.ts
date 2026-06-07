import { NextResponse } from "next/server";

import {
  buildTopicsUrl,
  mapTopicsResponse,
  rollingWindow,
  type TopicsApiResponse,
} from "@/lib/danantara/ceo/topics-source";

/**
 * BFF for the Danantara CEO Command Issues board (A7 v31.0). Proxies the external
 * media-intelligence feed server-side so the `api_key` never reaches the browser
 * (API-first + secrets-server-side guardrails), requests a rolling 28-day window,
 * and maps the payload to the board's `CeoIssue[]`.
 *
 * Cached via the Next data cache (revalidate ~1 h) — the upstream refreshes ~daily
 * and the rolling window rotates the cache key once per day. A manual refresh from
 * the dashboard passes `?fresh=1`, which bypasses the cache (`no-store`) and re-hits
 * the upstream so the user always pulls the newest data on demand. On any upstream
 * error we return a non-OK status; the client then degrades to its seeded topics.
 *
 * Intentionally public (no requireRole): standalone sales-lead demo. Gate it like
 * /api/v1/mbg-crisis if productized.
 */

const DEFAULT_BASE = "https://api.garudaperkasa.io/api-nexorus/topics";
const DEFAULT_TOPIC = "danantara_main";
const WINDOW_DAYS = 28;
const REVALIDATE_S = 3_600; // 1 hour

export async function GET(req: Request) {
  const base = process.env.DANANTARA_TOPICS_API_BASE || DEFAULT_BASE;
  const topicCode = process.env.DANANTARA_TOPIC_CODE || DEFAULT_TOPIC;
  const apiKey = process.env.DANANTARA_TOPICS_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "Topics feed not configured." }, { status: 503 });
  }

  const fresh = new URL(req.url).searchParams.get("fresh") === "1";
  const window = rollingWindow(new Date(), WINDOW_DAYS);
  const url = buildTopicsUrl(base, topicCode, apiKey, window);

  try {
    const res = await fetch(url, fresh ? { cache: "no-store" } : { next: { revalidate: REVALIDATE_S } });
    if (!res.ok) throw new Error(`upstream ${res.status}`);

    const json = (await res.json()) as TopicsApiResponse;
    if (!json?.success || !Array.isArray(json?.data?.topics)) {
      throw new Error("malformed upstream payload");
    }

    const mapped = mapTopicsResponse(json);
    return NextResponse.json({ ...mapped, meta: json.meta });
  } catch {
    return NextResponse.json({ error: "Topics feed unavailable." }, { status: 502 });
  }
}
