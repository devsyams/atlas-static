import { NextResponse } from "next/server";

import { buildSnapshot } from "@/lib/jasamarga/data";
import { defaultSource } from "@/lib/jasamarga/connector";

export const dynamic = "force-dynamic";

/**
 * JasaMarga Ops Command demo feed (Jakarta–Cikampek). Mostly synthetic, but the
 * Route Ribbon AND incident feed go LIVE when TOMTOM_API_KEY is set: we pull
 * per-segment speeds (Traffic Flow) + corridor incidents (Incident Details) from
 * TomTom — cached ~2 min in-process to stay inside the free tier — and derive the
 * index/insight/top-ruas off them. Any failure falls back to synthetic.
 *
 * Intentionally public (no requireRole): standalone sales-lead demo, no DB
 * dependency, runs with zero setup. Gate it like /api/v1/mbg-crisis if productized.
 */
export async function GET() {
  const live = await defaultSource().fetchTraffic();
  return NextResponse.json(buildSnapshot(live?.segments, live?.incidents));
}
