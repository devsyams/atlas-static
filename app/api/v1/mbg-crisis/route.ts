import { NextResponse } from "next/server";
import { buildDashboard } from "@/lib/mbg/data";

export const dynamic = "force-dynamic";

export async function GET() {
  // Small delay so the client's "memuat…" → "Live" badge transition is visible.
  await new Promise((r) => setTimeout(r, 300));
  return NextResponse.json(buildDashboard());
}
