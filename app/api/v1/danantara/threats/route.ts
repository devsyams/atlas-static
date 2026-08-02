import { NextResponse } from "next/server";

import { MOCK_THREATS } from "@/lib/bgn/mock/fixtures";
import { readDevMockJson } from "@/lib/danantara/dev-mocks";
import { feedProductFromParams, resolveTopicCode } from "@/lib/danantara/feed-config";
import { fetchThreatsForCode, ThreatsNotConfiguredError } from "@/lib/danantara/threats-feed";

/**
 * BFF for the Danantara threat-detection feed (A10 v5.0) — powers the Crisis Gate's
 * **middle** column ("Ancaman Utama"). Returns the **#1 detected threat** (`threats[0]`,
 * sorted by severity) with the severity stats; `null` when the feed detects none (in
 * which case the middle column falls back client-side to the `/topics` biggest topic).
 * The right "Aktor Penggerak" column reads its own `/api/v1/danantara/actor-intelligence`
 * BFF (A10 v5.3), so this route no longer carries actor data.
 *
 * The `?code=` param is allowlisted against the BUMN registry (+ danantara_main) so the
 * route can't be an open proxy. `?fresh=1` bypasses the cache; the feed also self-heals
 * a transient hollow window (v5.2). `api_key` stays server-side only. Intentionally
 * public (no requireRole): standalone sales-lead demo.
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const fresh = params.get("fresh") === "1";

  // Scoped BGN demo mock (A13 v4.0): only /bgn/command sends ?mock=1. Production-safe;
  // returns bundled demo data before the (dead) upstream call.
  if (params.get("mock") === "1") {
    return NextResponse.json(MOCK_THREATS);
  }

  const mockJson = readDevMockJson("threats.json") ?? process.env.DANANTARA_THREATS_MOCK_JSON;
  if (process.env.NODE_ENV !== "production" && mockJson) {
    try {
      return NextResponse.json(JSON.parse(mockJson) as unknown);
    } catch {
      return NextResponse.json({ error: "Invalid threats mock JSON." }, { status: 500 });
    }
  }

  // Per-product resolution (A10 v10.0): `?bgn=1` → BGN product, else Danantara.
  const product = feedProductFromParams(params);
  const code = resolveTopicCode(params, product);

  try {
    const { threats, stats } = await fetchThreatsForCode(code, { fresh, product });
    return NextResponse.json({ threat: threats[0] ?? null, stats });
  } catch (e) {
    if (e instanceof ThreatsNotConfiguredError) {
      return NextResponse.json({ error: "Threats feed not configured." }, { status: 503 });
    }
    return NextResponse.json({ error: "Threats feed unavailable." }, { status: 502 });
  }
}
