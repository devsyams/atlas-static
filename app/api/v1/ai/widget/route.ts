import { NextResponse, type NextRequest } from "next/server";
import { buildGroundingContext, NEXORUS_SYSTEM } from "@/lib/ai/context";
import { hasLiveAI, liveAnswer } from "@/lib/ai/engine";
import { scriptedWidget } from "@/lib/ai/scripted";

export const dynamic = "force-dynamic";

const MODE_PROMPT: Record<string, string> = {
  explain: "Jelaskan secara ringkas apa yang ditunjukkan widget ini dan artinya.",
  drivers: "Apa pendorong utama di balik angka pada widget ini? Sebutkan 2-3 faktor dari data.",
  talking: "Buat 3 poin pembicaraan (talking points) singkat untuk pimpinan berdasarkan widget ini.",
};

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const widget: string = body.widget ?? "score";
  const mode: string = body.mode ?? "explain";
  const ctx = buildGroundingContext();

  let answer: string;
  try {
    answer = hasLiveAI()
      ? await liveAnswer(
          `${NEXORUS_SYSTEM}\n\nDATA INTELIJEN:\n${ctx.text}`,
          `Fokus pada widget "${widget}". ${MODE_PROMPT[mode] ?? MODE_PROMPT.explain}`,
          512,
        )
      : scriptedWidget(widget, mode, ctx);
  } catch {
    answer = scriptedWidget(widget, mode, ctx);
  }
  return NextResponse.json({ answer });
}
