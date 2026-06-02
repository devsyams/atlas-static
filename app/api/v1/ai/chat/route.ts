import { type NextRequest } from "next/server";
import { buildGroundingContext, NEXORUS_SYSTEM } from "@/lib/ai/context";
import { buildDanantaraGrounding, DANANTARA_SYSTEM, scriptedDanantaraChat } from "@/lib/ai/danantara";
import { hasLiveAI, liveStream } from "@/lib/ai/engine";
import { scriptedChat } from "@/lib/ai/scripted";

export const dynamic = "force-dynamic";

/** Grounding + persona + scripted fallback, keyed by which dashboard the copilot is on. */
function resolveDashboard(context: unknown): { system: string; scripted: (q: string) => string } {
  if (context === "danantara") {
    const ctx = buildDanantaraGrounding();
    return {
      system: `${DANANTARA_SYSTEM}\n\nDATA INTELIJEN:\n${ctx.text}`,
      scripted: (q) => scriptedDanantaraChat(q, ctx),
    };
  }
  const ctx = buildGroundingContext();
  return {
    system: `${NEXORUS_SYSTEM}\n\nDATA INTELIJEN:\n${ctx.text}`,
    scripted: (q) => scriptedChat(q, ctx),
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const messages: { role: string; content: string }[] = body.messages ?? [];
  const last = messages.length ? messages[messages.length - 1].content : "";

  const { system, scripted } = resolveDashboard(body.context);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (hasLiveAI()) {
          for await (const chunk of liveStream(system, String(last))) {
            controller.enqueue(encoder.encode(chunk));
          }
        } else {
          const text = scripted(String(last));
          for (const part of text.split(/(\s+)/)) {
            controller.enqueue(encoder.encode(part));
            await new Promise((r) => setTimeout(r, 12));
          }
        }
      } catch {
        controller.enqueue(encoder.encode("\n\n[Nexorus AI tidak tersedia saat ini.]"));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
