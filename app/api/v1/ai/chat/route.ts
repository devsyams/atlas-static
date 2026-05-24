import { type NextRequest } from "next/server";
import { buildGroundingContext, SYNAPSE_SYSTEM } from "@/lib/ai/context";
import { hasLiveAI, liveStream } from "@/lib/ai/engine";
import { scriptedChat } from "@/lib/ai/scripted";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const messages: { role: string; content: string }[] = body.messages ?? [];
  const last = messages.length ? messages[messages.length - 1].content : "";

  const ctx = buildGroundingContext();
  const system = `${SYNAPSE_SYSTEM}\n\nDATA INTELIJEN:\n${ctx.text}`;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (hasLiveAI()) {
          for await (const chunk of liveStream(system, String(last))) {
            controller.enqueue(encoder.encode(chunk));
          }
        } else {
          const text = scriptedChat(String(last), ctx);
          for (const part of text.split(/(\s+)/)) {
            controller.enqueue(encoder.encode(part));
            await new Promise((r) => setTimeout(r, 12));
          }
        }
      } catch {
        controller.enqueue(encoder.encode("\n\n[Synapse tidak tersedia saat ini.]"));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
