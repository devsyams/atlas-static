import { NextResponse } from "next/server";

import { fetchTopicsForCode } from "@/lib/danantara/topics-feed";
import { fetchCorridorWeather } from "@/lib/jasamarga/bmkg";
import { buildSnapshot } from "@/lib/jasamarga/data";
import { defaultSource } from "@/lib/jasamarga/connector";
import { getCorridor } from "@/lib/jasamarga/corridors";
import { mapTopicsToSocial } from "@/lib/jasamarga/social-feed";
import type { SocialPulse } from "@/lib/jasamarga/types";

export const dynamic = "force-dynamic";

/** JasaMarga's own topic set in the client's media-intelligence feed (A12 v2.0). */
const JASAMARGA_TOPIC_CODE = "danantara_jasamarga";

/** Real public sentiment, or null → the snapshot keeps its synthetic pulse (AC10). */
async function liveSocial(): Promise<SocialPulse | null> {
  try {
    return mapTopicsToSocial(await fetchTopicsForCode(JASAMARGA_TOPIC_CODE));
  } catch {
    return null;
  }
}

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
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("corridor");
  const c = getCorridor(id);
  const [live, social, weather] = await Promise.all([
    defaultSource().fetchTraffic(c),
    liveSocial(),
    // A12 v5.0 — real BMKG conditions; null → the corridor's static fallback.
    fetchCorridorWeather(c.bmkg).catch(() => null),
  ]);
  return NextResponse.json(buildSnapshot(c.id, live?.segments, live?.incidents, social, weather));
}
