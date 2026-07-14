import Anthropic from "@anthropic-ai/sdk";

// Vendor-neutral env so the UI/config never names the provider.
const MODEL = process.env.NEXORUS_AI_MODEL || "claude-opus-4-8";

export function hasLiveAI(): boolean {
  return !!process.env.NEXORUS_AI_KEY;
}

function client(): Anthropic {
  return new Anthropic({ apiKey: process.env.NEXORUS_AI_KEY });
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

/**
 * One-shot grounded answer constrained to a JSON Schema (live path only).
 *
 * Structured outputs, so callers get an object instead of scraping JSON out of
 * prose. Still model-agnostic: the provider/model is resolved here, never at the
 * call site. Throws on transport/parse failure — callers are expected to catch
 * and fall back to their deterministic path.
 */
export async function liveJson<T>(
  system: string,
  user: string,
  schema: Record<string, unknown>,
  maxTokens = 1600,
): Promise<T> {
  const msg = await client().messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: systemBlocks(system),
    messages: [{ role: "user", content: user }],
    output_config: { format: { type: "json_schema", schema } },
  });
  // Cost/token visibility until the U1 ledger lands (spec guardrail: every call logged).
  const u = msg.usage;
  console.info(
    `[nexorus-ai] model=${MODEL} in=${u.input_tokens} out=${u.output_tokens} cache_read=${u.cache_read_input_tokens ?? 0}`,
  );
  const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  return JSON.parse(text) as T;
}
