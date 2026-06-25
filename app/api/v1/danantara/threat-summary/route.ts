import { NextResponse } from "next/server";

import { DANANTARA_MAIN_CODE, isAllowedTopicCode } from "@/lib/bumn/registry";
import { biggestThreat } from "@/lib/danantara/ceo/crisis";
import { summarizeThreat } from "@/lib/danantara/ceo/threat-summary-feed";
import { fetchTopicsForCode, FeedNotConfiguredError } from "@/lib/danantara/topics-feed";

/**
 * BFF for the Crisis Gate executive summary — picks the single biggest threat from
 * the live topics feed (same `biggestThreat` logic the gate renders) and returns
 * short AI-condensed points for it, with a deterministic fallback baked in. Kept
 * separate from `/topics` so the generic feed never pays for an LLM call; only the
 * one threat the gate spotlights is summarised.
 *
 * Intentionally public (no requireRole): standalone sales-lead demo, no DB.
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
    const { issues } = await fetchTopicsForCode(code, { fresh });
    const threat = biggestThreat(issues);
    if (!threat) return NextResponse.json({ threatId: null, points: [] });

    const points = await summarizeThreat(threat.title, threat.aiLine);
    return NextResponse.json({ threatId: threat.id, points });
  } catch (e) {
    // The gate degrades to its client-side fallback on any non-200 — never crash it.
    const status = e instanceof FeedNotConfiguredError ? 503 : 502;
    return NextResponse.json({ threatId: null, points: [] }, { status });
  }
}
