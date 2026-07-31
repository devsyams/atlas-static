import { NextResponse } from "next/server";

import { hasLiveAI, liveAnswer } from "@/lib/ai/engine";
import { MAX_QUESTION, buildChatUser, chatSystem, fallbackReply, type ChatTurn } from "@/lib/danantara/sim/chat-ai";
import type { ConsoleWorld } from "@/lib/danantara/sim/console-types";
import { modeByKey } from "@/lib/danantara/sim/modes";

export const dynamic = "force-dynamic";

/**
 * A15 v4.0 — step 5, deep interaction.
 *
 * The client POSTs the world it is *currently showing* plus the transcript, so a reply
 * can never be grounded in a different world than the one on screen. Answers either as
 * the ReportAgent or in character as one of the simulated agents.
 *
 * Never fails: no key, a model error or a bad body all return 200 with an honest
 * scripted reply, so the chat degrades instead of erroring mid-demo.
 *
 * Deliberately uncached — a conversation is not idempotent — but every reply is short
 * (`maxTokens` 400), so an interview costs a fraction of a world build.
 *
 * **Off by default since v5.0**, behind the same `DANANTARA_SIM_LIVE=1` switch as the
 * world route so the two can never disagree about whether the demo is spending money.
 * Uncached and per-question, this is the one path a curious presenter could run up a
 * bill on, so it is gated even though a single reply is cheap.
 */
const LIVE_ENABLED = process.env.DANANTARA_SIM_LIVE === "1";

export async function POST(req: Request) {
  let body: { world?: ConsoleWorld; agentId?: string; mode?: string; turns?: ChatTurn[] };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ reply: "Permintaan tidak terbaca.", source: "scripted" as const });
  }

  const world = body?.world;
  const turns = Array.isArray(body?.turns) ? body.turns : [];
  if (!world?.report || !Array.isArray(world.agents) || turns.length === 0) {
    return NextResponse.json({ reply: "Tidak ada pertanyaan untuk dijawab.", source: "scripted" as const });
  }

  const last = turns[turns.length - 1];
  if (last?.role !== "user" || typeof last.content !== "string" || last.content.trim().length === 0) {
    return NextResponse.json({ reply: "Tidak ada pertanyaan untuk dijawab.", source: "scripted" as const });
  }

  // `agentId` absent → the ReportAgent. An unknown id must not silently become the
  // ReportAgent, or the presenter would think they were interviewing someone.
  const agent = body.agentId ? (world.agents.find((a) => a.id === body.agentId) ?? null) : null;
  if (body.agentId && !agent) {
    return NextResponse.json({ reply: "Agen itu tidak ada di dunia simulasi ini.", source: "scripted" as const });
  }

  if (!LIVE_ENABLED || !hasLiveAI()) {
    return NextResponse.json({ reply: fallbackReply(world, agent), source: "scripted" as const });
  }

  try {
    const reply = await liveAnswer(chatSystem(world, modeByKey(body.mode), agent), buildChatUser(turns), 400);
    const clean = reply.trim();
    if (!clean) return NextResponse.json({ reply: fallbackReply(world, agent), source: "scripted" as const });
    return NextResponse.json({ reply: clean.slice(0, MAX_QUESTION * 2), source: "llm" as const });
  } catch {
    return NextResponse.json({ reply: fallbackReply(world, agent), source: "scripted" as const });
  }
}
