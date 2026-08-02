import { NextResponse } from "next/server";

import { MOCK_ACTORS } from "@/lib/bgn/mock/fixtures";
import { readDevMockJson } from "@/lib/danantara/dev-mocks";
import { feedProductFromParams, resolveTopicCode } from "@/lib/danantara/feed-config";
import { ActorRosterNotConfiguredError, fetchActorRosterForCode } from "@/lib/danantara/actor-roster-feed";

/**
 * BFF for the Danantara actor roster (A10 v5.3) — powers the Crisis Gate's right
 * column ("Aktor Penggerak"). Panel 3 reads this **always** (not just as a fallback):
 * the OpenGate `/actor-intelligence` endpoint carries real profile pictures, so the
 * actors column stays consistent whether or not a threat is currently detected.
 * Returns the mapped, deduped, negative-first `{ actors }` roster.
 *
 * The `?code=` param is allowlisted against the BUMN registry (+ danantara_main) so the
 * route can't be an open proxy. `?fresh=1` bypasses the cache. `api_key` stays
 * server-side only. Intentionally public (no requireRole): standalone sales-lead demo.
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const fresh = params.get("fresh") === "1";

  // Scoped BGN demo mock (A13 v4.0): only /bgn/command sends ?mock=1. Production-safe;
  // returns the bundled BGN roster before the (dead) upstream call.
  if (params.get("mock") === "1") {
    return NextResponse.json(MOCK_ACTORS);
  }

  const mockJson = readDevMockJson("actor-intelligence.json") ?? process.env.DANANTARA_ACTOR_INTELLIGENCE_MOCK_JSON;
  if (process.env.NODE_ENV !== "production" && mockJson) {
    try {
      const parsed = JSON.parse(mockJson) as unknown;
      const actors = Array.isArray(parsed) ? parsed : Array.isArray((parsed as { actors?: unknown }).actors) ? (parsed as { actors: unknown[] }).actors : [];
      return NextResponse.json({ actors });
    } catch {
      return NextResponse.json({ error: "Invalid actor roster mock JSON." }, { status: 500 });
    }
  }

  // Per-product resolution (A10 v10.0): `?bgn=1` → BGN product, else Danantara.
  const product = feedProductFromParams(params);
  const code = resolveTopicCode(params, product);

  try {
    const actors = await fetchActorRosterForCode(code, { fresh, product });
    return NextResponse.json({ actors });
  } catch (e) {
    if (e instanceof ActorRosterNotConfiguredError) {
      return NextResponse.json({ error: "Actor roster feed not configured." }, { status: 503 });
    }
    return NextResponse.json({ error: "Actor roster feed unavailable." }, { status: 502 });
  }
}
