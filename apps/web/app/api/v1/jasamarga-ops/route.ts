import { NextResponse } from "next/server";

import { buildSnapshot } from "@/lib/jasamarga/data";

export const dynamic = "force-dynamic";

/**
 * JasaMarga Ops Command demo feed (Jakarta–Cikampek). Synthetic snapshot — not
 * a real telemetry source — regenerated per request so polls feel live.
 *
 * Intentionally public (no requireRole): this is a standalone sales-lead demo
 * with 100% fabricated data and no DB dependency, so it runs with zero setup.
 * If this lead is productized, gate it like /api/v1/mbg-crisis.
 */
export async function GET() {
  return NextResponse.json(buildSnapshot());
}
