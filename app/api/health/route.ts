import { NextResponse } from "next/server";

// No data dependencies — a cheap, always-available target for k8s
// readiness/liveness probes (avoids probing the heavy dashboard route).
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ status: "ok" });
}
