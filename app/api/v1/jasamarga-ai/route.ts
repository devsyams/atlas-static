import { NextResponse } from "next/server";

import { hasLiveAI, liveJson } from "@/lib/ai/engine";
import { JASAMARGA_AI_SYSTEM, OPS_AI_SCHEMA, buildOpsGrounding, parseOpsAi } from "@/lib/jasamarga/ai-insight";
import type { OpsAi } from "@/lib/jasamarga/ai-insight";
import type { OpsSnapshot } from "@/lib/jasamarga/types";

export const dynamic = "force-dynamic";

/**
 * A12 — the LLM behind the "AI Ops Insight" and "Prediksi Kemacetan" widgets.
 *
 * The client POSTs the snapshot it is *currently rendering* and we reason over
 * exactly that (AC3). We deliberately don't rebuild the snapshot server-side:
 * `buildSnapshot` jitters, so a second build would produce different numbers and
 * the analysis would cite figures the operator can't see on screen.
 *
 * Never fails: no key, model error, or a payload that misses the schema all land
 * on `source: "scripted"` and the UI keeps the deterministic values it already has
 * (AC4). Cached per corridor so the 60 s dashboard poll doesn't bill a call each
 * time (AC6).
 *
 * Intentionally public, like /api/v1/jasamarga-ops — standalone demo, no DB.
 */

/**
 * 1 hour by default (AC8): the dashboard polls the snapshot every 60 s, so a
 * short TTL would bill an LLM call every few minutes on a demo left open all
 * day. One call per corridor per hour, overridable for testing/tuning.
 */
const TTL_MIN = Number(process.env.JASAMARGA_AI_TTL_MIN) || 60;
const CACHE_TTL_MS = TTL_MIN * 60_000;

interface CacheEntry {
  at: number;
  data: OpsAi;
}
const cache = new Map<string, CacheEntry>();

const USER_PROMPT =
  "Baca SNAPSHOT KORIDOR di bawah, lalu hasilkan:\n" +
  "1) `insight` — analisis operasional koridor saat ini (judul, 2–3 kalimat, satu rekayasa yang disarankan).\n" +
  "2) `predictions` — tepat 3 skenario berbeda yang relevan bagi operator (kemacetan, sentimen publik, pemulihan).\n" +
  "3) `forecast` — tepat 6 titik proyeksi beban (load, skala 0.5–10) untuk 6 jam ke depan, diproyeksikan " +
  "dari kondisi saat ini + sinyal cuaca ke depan di snapshot (bukan kurva tetap).\n" +
  "Kutip angka konkret dari snapshot di setiap `reasoning`. Jangan mengarang angka.\n\n" +
  "SNAPSHOT KORIDOR:\n";

export async function POST(req: Request) {
  let snapshot: OpsSnapshot;
  try {
    snapshot = (await req.json()) as OpsSnapshot;
  } catch {
    return NextResponse.json({ source: "scripted" as const });
  }

  if (!snapshot?.corridor || !Array.isArray(snapshot.segments)) {
    return NextResponse.json({ source: "scripted" as const });
  }

  if (!hasLiveAI()) return NextResponse.json({ source: "scripted" as const });

  const hit = cache.get(snapshot.corridor);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json({ ...hit.data, source: "llm" as const });
  }

  try {
    const raw = await liveJson<unknown>(
      JASAMARGA_AI_SYSTEM,
      `${USER_PROMPT}${buildOpsGrounding(snapshot)}`,
      OPS_AI_SCHEMA,
      2200, // A12 v6.0 — bumped from 1600 to cover the 6 extra `forecast` points.
    );
    const parsed = parseOpsAi(raw);
    if (!parsed) return NextResponse.json({ source: "scripted" as const });

    cache.set(snapshot.corridor, { at: Date.now(), data: parsed });
    return NextResponse.json({ ...parsed, source: "llm" as const });
  } catch {
    return NextResponse.json({ source: "scripted" as const });
  }
}
