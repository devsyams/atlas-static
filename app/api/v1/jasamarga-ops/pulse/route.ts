import { NextResponse } from "next/server";
import { buildCorridorPulse } from "@/lib/jasamarga/data";
import { CORRIDORS } from "@/lib/jasamarga/corridors";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(CORRIDORS.map((c) => buildCorridorPulse(c.id)));
}
