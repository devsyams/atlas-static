import { NextResponse } from "next/server";

import { buildSnapshot } from "@/lib/jasamarga/data";
import { fetchLiveSegments } from "@/lib/jasamarga/tomtom";

export const dynamic = "force-dynamic";

/**
 * JasaMarga Ops Command demo feed (Jakarta–Cikampek). Mostly synthetic, but the
 * Route Ribbon goes LIVE when TOMTOM_API_KEY is set: we pull real per-segment
 * speeds from TomTom Traffic Flow and recompute the index off them. Any failure
 * falls back to the synthetic snapshot (graceful degradation).
 *
 * Intentionally public (no requireRole): standalone sales-lead demo, no DB
 * dependency, runs with zero setup. Gate it like /api/v1/mbg-crisis if productized.
 */
export async function GET() {
  const key = process.env.TOMTOM_API_KEY;
  const liveSegments = key ? (await fetchLiveSegments(key)) ?? undefined : undefined;
  return NextResponse.json(buildSnapshot(liveSegments));
}
