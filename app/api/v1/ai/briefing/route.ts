import { NextResponse } from "next/server";
import { buildGroundingContext, NEXORUS_SYSTEM } from "@/lib/ai/context";
import { hasLiveAI, liveAnswer } from "@/lib/ai/engine";
import { scriptedBriefing } from "@/lib/ai/scripted";

export const dynamic = "force-dynamic";

const BRIEFING_PROMPT =
  "Susun SITREP (situation report) eksekutif dari DATA INTELIJEN dalam Markdown, dengan bagian: " +
  "## Ringkasan Eksekutif, ## Insiden Utama, ## Aktor & Narasi, ## Sentimen Kepemimpinan, ## Prediksi, ## Rekomendasi. " +
  "Ringkas, kutip angka dari data, dan beri 2-3 rekomendasi tindakan konkret.";

export async function POST(req: Request) {
  const ctx = buildGroundingContext();
  // A12 v2.0 (AC9) — `?ai=0` is the client's cost kill switch: skip the model entirely.
  const aiOff = new URL(req.url).searchParams.get("ai") === "0";

  let content: string;
  try {
    content =
      hasLiveAI() && !aiOff
        ? await liveAnswer(`${NEXORUS_SYSTEM}\n\nDATA INTELIJEN:\n${ctx.text}`, BRIEFING_PROMPT, 1600)
        : scriptedBriefing(ctx);
  } catch {
    content = scriptedBriefing(ctx);
  }
  return NextResponse.json({ content, updated_at: ctx.data.updated_at });
}
