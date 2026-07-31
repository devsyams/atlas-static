import { NextResponse } from "next/server";

import { hasLiveAI, liveJson } from "@/lib/ai/engine";
import {
  COUNTER_NARRATIVE_SCHEMA,
  COUNTER_NARRATIVE_SYSTEM,
  buildCounterNarrativeGrounding,
  parseCounterNarrative,
} from "@/lib/danantara/ceo/counter-narrative-ai";
import type { CounterNarrativeAi } from "@/lib/danantara/ceo/counter-narrative-ai";
import { topNegativeByReach } from "@/lib/danantara/ceo/counter-narrative";
import type { CeoIssue } from "@/lib/danantara/ceo/types";

export const dynamic = "force-dynamic";

/**
 * A14 — the LLM behind the Counter-Narrative War Room.
 *
 * The client POSTs the issues it is *currently rendering* and we pick the top 3
 * negative topics from exactly that set. We deliberately don't re-fetch `/topics`
 * server-side: the feed revalidates and self-heals, so a second read can return a
 * different window — and a war room countering topics the board above it isn't
 * showing is the most visible way to break a demo.
 *
 * Never fails: no key, a model error, a refusal, or a payload that misses the schema
 * all land on `source: "scripted"` and the client keeps the deterministic Indonesian
 * fallback it computed at mount (AC6/AC7). The fallback is NOT shipped from here —
 * the client already has the issues, so the payload stays small and the fallback
 * renders with zero network dependency.
 *
 * Intentionally public, like the rest of /api/v1/danantara/* — demo route, no DB.
 */

/**
 * 6 hours by default, mirroring `topics-feed`'s own `revalidate: 21600`: at most one
 * LLM call per topics-cache window, so a demo left open all day costs ~4 calls for
 * the whole deployment rather than one per viewer.
 */
const TTL_MIN = Number(process.env.DANANTARA_CN_AI_TTL_MIN) || 360;
const CACHE_TTL_MS = TTL_MIN * 60_000;

/**
 * `?fresh=1` bypasses the cache — but not more than once a minute. Without this a
 * presenter clicking Refresh five times in the room bills five calls, and the drafts
 * would not meaningfully change anyway (the topic set hasn't moved).
 */
const FRESH_FLOOR_MS = 60_000;

/** How many topics the war room shows. */
const TOPIC_COUNT = 3;

const CACHE_MAX = 50;

interface CacheEntry {
  at: number;
  data: CounterNarrativeAi;
}
const cache = new Map<string, CacheEntry>();

const USER_PROMPT =
  "Baca RINGKASAN TOPIK NEGATIF di bawah, lalu untuk SETIAP topik hasilkan:\n" +
  "1) `attack_line` — satu kalimat inti framing pihak yang menyerang.\n" +
  "2) `counter_angle` — satu kalimat sudut balasan yang jujur dan berbasis konteks.\n" +
  "3) `drafts` — tepat 3 konten siap tempel: `kol`, `clipper`, `grassroots`.\n" +
  "Gunakan hanya angka yang ada di ringkasan. Jangan mengarang angka.\n\n";

export async function POST(req: Request) {
  let issues: CeoIssue[];
  try {
    const body = (await req.json()) as { issues?: unknown };
    if (!Array.isArray(body?.issues)) return scripted();
    issues = body.issues as CeoIssue[];
  } catch {
    return scripted();
  }

  // Nothing negative on the board → nothing to counter, and no call to bill.
  const topics = topNegativeByReach(issues, TOPIC_COUNT);
  if (topics.length === 0) return scripted();

  if (!hasLiveAI()) return scripted();

  // Keyed on the *content* of the selection, so a refresh that returns the same
  // topics is free and a genuinely changed board correctly earns a new call.
  const key = topics.map((t) => `${t.id}:${t.title}`).join("|");
  const hit = cache.get(key);
  const now = Date.now();
  const fresh = new URL(req.url).searchParams.get("fresh") === "1";

  if (hit) {
    const age = now - hit.at;
    const bypass = fresh && age >= FRESH_FLOOR_MS;
    if (!bypass && age < CACHE_TTL_MS) return NextResponse.json({ ...hit.data, source: "llm" as const });
  }

  try {
    const raw = await liveJson<unknown>(
      COUNTER_NARRATIVE_SYSTEM,
      `${USER_PROMPT}${buildCounterNarrativeGrounding(topics)}`,
      COUNTER_NARRATIVE_SCHEMA,
      3200, // 3 topics × (2 lines + 3 drafts + tags) needs headroom over the 1600 default.
    );
    const parsed = parseCounterNarrative(raw, topics);
    if (!parsed) return scripted();

    if (cache.size >= CACHE_MAX) cache.clear();
    cache.set(key, { at: Date.now(), data: parsed });
    return NextResponse.json({ ...parsed, source: "llm" as const });
  } catch {
    return scripted();
  }
}

function scripted() {
  return NextResponse.json({ source: "scripted" as const });
}
