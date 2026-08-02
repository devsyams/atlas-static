import { NextResponse } from "next/server";

import { BUMN_REGISTRY } from "@/lib/bumn/registry";
import { MOCK_DANANTARA_BUMN } from "@/lib/danantara/mock/fixtures";
import { buildBumnRow } from "@/lib/danantara/ceo/bumn-board";
import { fetchTopicsForCode, FeedNotConfiguredError } from "@/lib/danantara/topics-feed";

/**
 * BFF for the CEO-wall BUMN board (A7 v37). Fans out **server-side** to the
 * registered BUMN topic codes — each cached in the shared data cache (the same one
 * the `/bumn/<slug>` dashboards use), so the upstream is hit at most once per BUMN
 * per 6 h and the browser makes a single request. Returns the board rows + their
 * topics. A single BUMN's failure degrades only its row; if every BUMN fails the
 * route returns a non-OK status so the client shows an offline state. `api_key`
 * stays server-side only. `?fresh=1` bypasses the cache.
 *
 * The fan-out is **concurrency-capped** (A8 v7.0): with 36 BUMN, an unbounded
 * `Promise.all` would fire 36 upstream requests at once on a cold cache and risk
 * rate-limiting. A small worker pool keeps at most `FANOUT_CONCURRENCY` in flight
 * while still hitting each code exactly once (order preserved).
 */

const FANOUT_CONCURRENCY = 8;

/** Map `items` through `fn` with at most `limit` running at once (order preserved). */
async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const fresh = params.get("fresh") === "1";

  // Scoped demo mock (?mock=1): the bundled Danantara BUMN board (A7 v50.2). The board is
  // Danantara-only (/bgn/command doesn't render it), so no product branch is needed.
  // Production-safe — bundled demo data, no secret, no upstream fan-out.
  if (params.get("mock") === "1") {
    return NextResponse.json(MOCK_DANANTARA_BUMN);
  }

  let configured = true;
  const results = await mapPool(BUMN_REGISTRY, FANOUT_CONCURRENCY, async (b) => {
    try {
      const feed = await fetchTopicsForCode(b.topicCode, { fresh });
      return { ...buildBumnRow(b, feed), ok: true };
    } catch (e) {
      if (e instanceof FeedNotConfiguredError) configured = false;
      return { ...buildBumnRow(b, null), ok: false };
    }
  });

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
