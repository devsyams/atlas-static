/**
 * Server-side summariser for the Crisis Gate's top threat (A10). Condenses the
 * threat's verbose AI `penjelasan` into 2–3 short executive-summary points via the
 * vendor-neutral AI engine, with an in-process cache (the threat text is stable
 * within a feed-cache window) and a deterministic fallback whenever AI is off or
 * fails — graceful degradation, never the raw paragraph. Server-only (reads the
 * AI key via `lib/ai/engine`).
 */

import { hasLiveAI, liveAnswer } from "@/lib/ai/engine";
import { fallbackPoints, parseSummaryPoints, summaryPrompt } from "./threat-summary";

const CACHE_MAX = 50;
const cache = new Map<string, string[]>();

/**
 * Summarise one threat into short points. Returns the deterministic fallback when
 * the text is empty, AI is not configured, the model yields nothing, or it throws.
 * Only genuine AI results are cached, so a transient failure retries next time.
 */
export async function summarizeThreat(title: string, aiLine: string): Promise<string[]> {
  const fallback = fallbackPoints(aiLine);
  if (!aiLine.trim() || !hasLiveAI()) return fallback;

  const key = `${title}\n${aiLine}`;
  const cached = cache.get(key);
  if (cached) return cached;

  try {
    const { system, user } = summaryPrompt(title, aiLine);
    const points = parseSummaryPoints(await liveAnswer(system, user, 256));
    if (points.length === 0) return fallback;
    if (cache.size >= CACHE_MAX) cache.clear();
    cache.set(key, points);
    return points;
  } catch {
    return fallback;
  }
}
