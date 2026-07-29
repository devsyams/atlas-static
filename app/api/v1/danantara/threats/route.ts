import { NextResponse } from "next/server";

import { DANANTARA_MAIN_CODE, isAllowedTopicCode } from "@/lib/bumn/registry";
import { fetchActorRosterForCode } from "@/lib/danantara/actor-roster-feed";
import { fetchThreatsForCode, ThreatsNotConfiguredError } from "@/lib/danantara/threats-feed";
import type { ThreatDriver } from "@/lib/danantara/ceo/threats-source";

/**
 * BFF for the Danantara threat-detection feed (A10 v5.0, v5.2) — powers the Crisis
 * Gate's middle ("Ancaman Utama") + right ("Aktor Penggerak") columns. Returns the
 * **#1 detected threat** (`threats[0]`, sorted by severity) with its severity stats,
 * plus a populated `drivers` list:
 *   - when a threat is detected → its real driving accounts (`driversSource: "threat"`);
 *   - when there is **none** (calm period / hollow window) → the always-populated
 *     `/actor-intelligence` roster as a fallback (`driversSource: "roster"`), so the
 *     right column never goes blank (A10 v5.2). The middle column's `/topics` fallback
 *     is computed client-side from the gauge's issues.
 *
 * The `?code=` param is allowlisted against the BUMN registry (+ danantara_main) so the
 * route can't be an open proxy. `?fresh=1` bypasses the cache. `api_key` stays
 * server-side only. Intentionally public (no requireRole): standalone sales-lead demo.
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
    const threat = threats[0] ?? null;

    let drivers: ThreatDriver[] = threat?.drivers ?? [];
    let driversSource: "threat" | "roster" = "threat";

    // No detected incident → fall back to the always-populated actor roster so the
    // right column stays alive. A roster failure degrades to an empty list (not a 502).
    if (!threat) {
      driversSource = "roster";
      try {
        drivers = await fetchActorRosterForCode(code, { fresh });
      } catch {
        drivers = [];
      }
    }

    return NextResponse.json({ threat, stats, drivers, driversSource });
  } catch (e) {
    if (e instanceof ThreatsNotConfiguredError) {
      return NextResponse.json({ error: "Threats feed not configured." }, { status: 503 });
    }
    return NextResponse.json({ error: "Threats feed unavailable." }, { status: 502 });
  }
}
