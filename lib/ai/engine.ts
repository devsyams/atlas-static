import Anthropic from "@anthropic-ai/sdk";

// Vendor-neutral env so the UI/config never names the provider.
const MODEL = process.env.SYNAPSE_AI_MODEL || "claude-opus-4-7";

export function hasLiveAI(): boolean {
  return !!process.env.SYNAPSE_AI_KEY;
}

function client(): Anthropic {
  return new Anthropic({ apiKey: process.env.SYNAPSE_AI_KEY });
}

function systemBlocks(system: string) {
  // Grounding context is stable across requests → cache it.
  return [{ type: "text" as const, text: system, cache_control: { type: "ephemeral" as const } }];
}

/** Stream a grounded answer token-by-token (live path only). */
export async function* liveStream(system: string, user: string): AsyncGenerator<string> {
  const stream = client().messages.stream({
    model: MODEL,
    max_tokens: 1024,
    system: systemBlocks(system),
    messages: [{ role: "user", content: user }],
  });
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield event.delta.text;
    }
  }
}

/** One-shot grounded answer (live path only). */
export async function liveAnswer(system: string, user: string, maxTokens = 1024): Promise<string> {
  const msg = await client().messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: systemBlocks(system),
    messages: [{ role: "user", content: user }],
  });
  return msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
}
