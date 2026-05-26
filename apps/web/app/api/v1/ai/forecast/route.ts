import { NextResponse } from "next/server";
import { buildGroundingContext } from "@/lib/ai/context";
import { scriptedForecast } from "@/lib/ai/scripted";

export const dynamic = "force-dynamic";

// Forecast + early-warning is a deterministic projection from severity + volume
// signals (reliable, zero-cost). Branded as a Nexorus AI projection.
export async function GET() {
  const ctx = buildGroundingContext();
  return NextResponse.json(scriptedForecast(ctx));
}
