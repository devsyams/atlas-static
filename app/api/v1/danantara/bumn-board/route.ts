import { NextResponse } from "next/server";

import { BUMN_REGISTRY } from "@/lib/bumn/registry";
import { buildBumnRow } from "@/lib/danantara/ceo/bumn-board";
import { fetchTopicsForCode, FeedNotConfiguredError } from "@/lib/danantara/topics-feed";

/**
 * BFF for the CEO-wall BUMN board (A7 v37). Fans out **server-side** to the
 * registered BUMN topic codes in parallel — each cached in the shared data cache
 * (the same one the `/bumn/<slug>` dashboards use), so the upstream is hit at most
 * once per BUMN per hour and the browser makes a single request. Returns the board
 * rows + their topics. A single BUMN's failure degrades only its row; if every
 * BUMN fails the route returns a non-OK status so the client shows an offline
 * state. `api_key` stays server-side only. `?fresh=1` bypasses the cache.
 */

export async function GET(req: Request) {
  const fresh = new URL(req.url).searchParams.get("fresh") === "1";

  let configured = true;
  const results = await Promise.all(
    BUMN_REGISTRY.map(async (b) => {
      try {
        const feed = await fetchTopicsForCode(b.topicCode, { fresh });
        return { ...buildBumnRow(b, feed), ok: true };
      } catch (e) {
        if (e instanceof FeedNotConfiguredError) configured = false;
        return { ...buildBumnRow(b, null), ok: false };
      }
    }),
  );

  if (!configured) {
    return NextResponse.json({ error: "Topics feed not configured." }, { status: 503 });
  }
  if (results.every((r) => !r.ok)) {
    return NextResponse.json({ error: "BUMN feed unavailable." }, { status: 502 });
  }

  return NextResponse.json({
    bumn: results.map((r) => r.row),
    issues: results.flatMap((r) => r.issues),
  });
}
