import { NextResponse } from "next/server";

import { DANANTARA_ACTORS } from "@/lib/danantara/actors";

/**
 * BFF for the Danantara media/social actor roster — the static, public-source set
 * the Crisis Gate uses to name *who* is driving the top threat. Kept separate from
 * the full `/api/v1/danantara` snapshot so the fear-first landing can pull just the
 * actors without triggering the live-markets fetch.
 *
 * Intentionally public (no requireRole): standalone sales-lead demo, no DB.
 */
export async function GET() {
  return NextResponse.json({ actors: DANANTARA_ACTORS });
}
