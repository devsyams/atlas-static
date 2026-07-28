import { NextResponse } from "next/server";

import { DANANTARA_MAIN_CODE, isAllowedTopicCode } from "@/lib/bumn/registry";
import { fetchThreatsForCode, ThreatsNotConfiguredError } from "@/lib/danantara/threats-feed";

/**
 * BFF for the Danantara threat-detection feed (A10 v5.0) — powers the Crisis Gate's
 * middle ("Ancaman Utama") + right ("Aktor Penggerak") columns. Returns the **#1
 * detected threat** (`threats[0]`, sorted by severity) with its ranked driving
 * accounts, plus the severity stats; `null` when the feed detects none. The `?code=`
 * param is allowlisted against the BUMN registry (+ danantara_main) so the route can't
 * be an open proxy. `?fresh=1` bypasses the cache. `api_key` stays server-side only.
 *
 * Intentionally public (no requireRole): standalone sales-lead demo, like the other
 * Danantara BFFs. Reuses the topics feed's `DANANTARA_TOPICS_API_KEY`.
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
    const { threats, stats } = await fetchThreatsForCode(code, { fresh });
    return NextResponse.json({ threat: threats[0] ?? null, stats });
  } catch (e) {
    if (e instanceof ThreatsNotConfiguredError) {
      return NextResponse.json({ error: "Threats feed not configured." }, { status: 503 });
    }
    return NextResponse.json({ error: "Threats feed unavailable." }, { status: 502 });
  }
}
