import { NextResponse } from "next/server";

import { hasLiveAI, liveJson } from "@/lib/ai/engine";
import { seedFromString } from "@/lib/danantara/ceo/crisis-sim";
import { CONSOLE_SCHEMA, SEED_MAX, buildConsoleGrounding, consoleSystem, parseConsoleWorld } from "@/lib/danantara/sim/console-ai";
import type { ConsoleWorld } from "@/lib/danantara/sim/console-types";
import { modeByKey } from "@/lib/danantara/sim/modes";

export const dynamic = "force-dynamic";

/**
 * A15 v3.0 — the LLM behind the five-step simulation console.
 *
 * The presenter pastes a document; **one** structured call turns it into everything
 * the console renders — the ontology's type system and knowledge graph, agent
 * profiles, six rounds across two platforms, and a long-form report with its
 * supporting evidence — and the UI replays that step by step. One call rather than
 * one per step is deliberate: sequential calls would put minutes on stage and could
 * stall mid-pitch, whereas this is cached by seed hash and replays instantly.
 *
 * Never fails: no key, a model error, a refusal, or a payload that misses the schema
 * all land on `source: "scripted"` and the client completes all five steps from its
 * own deterministic world, built out of the same pasted text.
 */

/** 6 h, matching the rest of the Danantara caches. One call per document per window. */
const TTL_MIN = Number(process.env.DANANTARA_WORLD_TTL_MIN) || 360;
const CACHE_TTL_MS = TTL_MIN * 60_000;
const CACHE_MAX = 30;

/** Below this there is nothing to model; the client hints instead of burning a call. */
const SEED_MIN = 40;

/**
 * **Off by default — the live path costs real money and is opt-in (A15 v5.0).**
 *
 * A world is ~16k output tokens, and a demo re-runs the same document all day, so the
 * spend was real while the deterministic world (`console-fallback.ts`) now carries the
 * whole console on its own. The model code is kept, not deleted, so a high-stakes
 * meeting can still have a bespoke world: set `DANANTARA_SIM_LIVE=1`.
 *
 * Deliberately an env var rather than the in-app AI toggle — nobody can turn spending
 * back on by clicking around in Settings.
 */
const LIVE_ENABLED = process.env.DANANTARA_SIM_LIVE === "1";

interface CacheEntry {
  at: number;
  data: ConsoleWorld;
}
const cache = new Map<string, CacheEntry>();

export async function POST(req: Request) {
  // Checked before the body is even read: with the live path off there is no input that
  // can reach `liveJson`, so no request can cost anything.
  if (!LIVE_ENABLED) return scripted();

  let seedText: string;
  let modeKey: string | undefined;
  try {
    const body = (await req.json()) as { seed?: unknown; mode?: unknown };
    if (typeof body?.seed !== "string") return scripted();
    seedText = body.seed.trim().slice(0, SEED_MAX);
    modeKey = typeof body.mode === "string" ? body.mode : undefined;
  } catch {
    return scripted();
  }

  if (seedText.length < SEED_MIN) return scripted();
  if (!hasLiveAI()) return scripted();

  const mode = modeByKey(modeKey);
  // The mode is part of the cache key: the same document asked as a policy forecast and
  // as a crisis simulation are two different questions and two different worlds.
  const key = `${mode.key}:${seedFromString(seedText)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json({ ...hit.data, source: "llm" as const });
  }

  try {
    const raw = await liveJson<unknown>(
      consoleSystem(mode),
      buildConsoleGrounding(seedText),
      CONSOLE_SCHEMA,
      16000, // a whole world — graph, agents, two platforms of posts, and a long report
    );
    const parsed = parseConsoleWorld(raw);
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
