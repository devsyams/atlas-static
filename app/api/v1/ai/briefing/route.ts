import { NextResponse } from "next/server";
import { buildGroundingContext, NEXORUS_SYSTEM } from "@/lib/ai/context";
import { hasLiveAI, liveAnswer } from "@/lib/ai/engine";
import { scriptedBriefing } from "@/lib/ai/scripted";

export const dynamic = "force-dynamic";

const BRIEFING_PROMPT =
  "Susun SITREP (situation report) eksekutif dari DATA INTELIJEN dalam Markdown, dengan bagian: " +
  "## Ringkasan Eksekutif, ## Insiden Utama, ## Aktor & Narasi, ## Sentimen Kepemimpinan, ## Prediksi, ## Rekomendasi. " +
  "Ringkas, kutip angka dari data, dan beri 2-3 rekomendasi tindakan konkret.";

export async function POST() {
  const ctx = buildGroundingContext();
  let content: string;
  try {
    content = hasLiveAI()
      ? await liveAnswer(`${NEXORUS_SYSTEM}\n\nDATA INTELIJEN:\n${ctx.text}`, BRIEFING_PROMPT, 1600)
      : scriptedBriefing(ctx);
  } catch {
    content = scriptedBriefing(ctx);
  }
  return NextResponse.json({ content, updated_at: ctx.data.updated_at });
}
