import { NextResponse } from "next/server";

import { buildSnapshot } from "@/lib/danantara/data";
import { fetchLiveMarkets } from "@/lib/danantara/markets";

export const dynamic = "force-dynamic";

/**
 * Danantara Sovereign Wealth Command demo feed. Models Indonesia's sovereign
 * fund managing the BUMN portfolio entirely from PUBLIC sources: the IHSG index
 * and USD/IDR go LIVE via Yahoo Finance (cached ~10 min); the rest of the
 * portfolio/markets are synthetic but plausible, jittered per read.
 *
 * Intentionally public (no requireRole): standalone sales-lead demo, no DB
 * dependency, runs with zero setup. Gate it like /api/v1/mbg-crisis if productized.
 */
export async function GET() {
  const live = await fetchLiveMarkets();
  return NextResponse.json(buildSnapshot(live));
}
