"use client";

import { useEffect, useRef, useState } from "react";
import { ClipboardList, Globe, Lightbulb, Search, Send, Users } from "lucide-react";
import { isAiEnabled } from "@/lib/ai-settings";
import type { ChatTurn } from "@/lib/danantara/sim/chat-ai";
import type { ConsoleWorld, Stance } from "@/lib/danantara/sim/console-types";
import type { SimMode } from "@/lib/danantara/sim/modes";

const TOOLS = [
  { Icon: Lightbulb, name: "InsightForge Deep Attribution", d: "Aligns seed data with simulated environment states using global/local memory for cross-temporal attribution" },
  { Icon: Globe, name: "PanoramaSearch Full Tracking", d: "Graph-based traversal that reconstructs event propagation paths and captures the full information-flow topology" },
  { Icon: Search, name: "QuickSearch Fast Retrieval", d: "GraphRAG-backed instant query interface for extracting specific node attributes and discrete facts" },
  { Icon: Users, name: "InterviewSubAgent Virtual Interview", d: "Autonomous multi-turn interviews with simulated agents to collect unstructured opinion data" },
];

/** Openers that differ per use case — a policy team and a PR team probe differently. */
const PROMPTS: Record<string, string[]> = {
  policy: [
    "Kelompok mana yang paling menolak, dan kenapa?",
    "Bagian kebijakan mana yang paling memicu penolakan?",
    "Apa yang berubah kalau pengumumannya ditunda dua minggu?",
  ],
  crisis: [
    "Di ronde berapa isu ini melompat ke linimasa luas?",
    "Siapa yang paling mengamplifikasi, dan apa pemicunya?",
    "Respons seperti apa yang paling efektif menahan eskalasi?",
  ],
};

/**
 * Step 5 — deep interaction (A15 v4.0).
 *
 * Talk to the **ReportAgent** about the world, or interview any **simulated agent** in
 * character. Both run on the live model, grounded in the world currently on screen, so
 * an answer can never describe a different simulation than the one being presented.
 */
export function InteractionPanel({ world, mode }: { world: ConsoleWorld; mode: SimMode }) {
  const [target, setTarget] = useState<string | null>(null); // null = ReportAgent
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [source, setSource] = useState<"llm" | "scripted" | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, pending]);

  const agent = target ? world.agents.find((a) => a.id === target) : null;

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || pending) return;
    const next: ChatTurn[] = [...turns, { role: "user", content: q }];
    setTurns(next);
    setDraft("");
    setPending(true);

    if (!isAiEnabled()) {
      setTurns([...next, { role: "assistant", content: "Nexorus AI dimatikan di Settings — aktifkan untuk tanya jawab." }]);
      setSource("scripted");
      setPending(false);
      return;
    }

    try {
      const res = await fetch("/api/v1/danantara/world-chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ world, agentId: target ?? undefined, mode: mode.key, turns: next }),
      });
      const j = (await res.json()) as { reply: string; source: "llm" | "scripted" };
      if (!mountedRef.current) return;
      setTurns([...next, { role: "assistant", content: j.reply }]);
      setSource(j.source);
    } catch {
      if (!mountedRef.current) return;
      setTurns([...next, { role: "assistant", content: "Sambungan ke model gagal. Coba lagi." }]);
      setSource("scripted");
    } finally {
      if (mountedRef.current) setPending(false);
    }
  };

  /**
   * Poll the whole roster instead of interviewing one agent.
   *
   * Deliberately computed, not generated: a stance tally over every agent is a fact about
   * the world that is already on screen, so it needs no model, costs nothing, and can
   * never contradict the simulation it is summarising.
   */
  const survey = () => {
    if (pending) return;
    const total = world.agents.length || 1;
    const order: Stance[] = ["hostile", "skeptical", "neutral", "supportive"];
    const label: Record<Stance, string> = {
      hostile: "Menolak keras",
      skeptical: "Meragukan",
      neutral: "Netral",
      supportive: "Mendukung",
    };
    const lines = order.map((s) => {
      const n = world.agents.filter((a) => a.stance === s).length;
      const pct = Math.round((n / total) * 100);
      const bar = "█".repeat(Math.round(pct / 5)) || "·";
      return `${label[s].padEnd(14)} ${String(n).padStart(2)} (${String(pct).padStart(2)}%)  ${bar}`;
    });
    const reach = world.agents.reduce((n, a) => n + a.followers, 0);

    setTurns([
      ...turns,
      { role: "user", content: "Survei seluruh agen: bagaimana posisi mereka terhadap isu ini?" },
      {
        role: "assistant",
        content: `Survei ${total} agen · jangkauan gabungan ${reach.toLocaleString("id-ID")}\n\n${lines.join("\n")}`,
      },
    ]);
    setSource("scripted");
  };

  const switchTarget = (id: string | null) => {
    setTarget(id);
    setTurns([]); // a new interviewee starts a new conversation
    setSource(null);
  };

  return (
    <div className="p-5">
      <div className="flex flex-wrap items-start gap-3">
        <Users className="mt-1 h-5 w-5 text-black/40" />
        <div>
          <div className="text-[15px] font-semibold text-black">Interactive Tools</div>
          <div className="font-mono text-[12px] text-black/45">{world.agents.length} agents available</div>
        </div>
        {source && (
          <span
            data-testid="chat-source"
            className={`ml-auto rounded px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-wider ${
              source === "llm" ? "bg-black text-white" : "bg-black/[0.06] text-black/50"
            }`}
          >
            {source === "llm" ? "Live" : "Scripted"}
          </span>
        )}
      </div>

      {/* Who you are talking to, and what it can reach. The reference console leads with
          this card before the tool grid — without it the four tools read as features of
          the page rather than capabilities of the agent answering you. */}
      <div className="mt-5 flex items-start gap-3 rounded-lg border border-black/10 bg-[#fafafa] p-4">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black text-[13px] font-bold text-white"
          aria-hidden
        >
          {agent ? agent.displayName.slice(0, 1) : "R"}
        </span>
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-black">
            {agent ? `${agent.displayName} — Interview` : "Report Agent — Chat"}
          </div>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-black/55">
            {agent
              ? `${agent.role}. Answers in character, grounded only in this simulated world.`
              : `A conversational version of the report agent, with access to ${TOOLS.length} professional tools and the full simulated memory.`}
          </p>
        </div>
      </div>

      <div data-testid="interaction-tools" className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
        {TOOLS.map((t) => (
          <div key={t.name} className="rounded-lg border border-black/10 bg-white p-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded bg-[#f0eefb]" aria-hidden>
                <t.Icon className="h-4 w-4 text-[#6b4bb5]" />
              </span>
              <span className="text-[14px] font-semibold text-black">{t.name}</span>
            </div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-black/60">{t.d}</p>
          </div>
        ))}
      </div>

      {/* Who you're talking to. A pill per agent worked at eight; at thirty-six it was a
          wall of buttons taller than the chat itself, so the roster moved into a select —
          which is what the reference console does too. */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-testid="chat-target-report"
          onClick={() => switchTarget(null)}
          className={`rounded-full px-4 py-2 text-[13px] font-medium transition-colors ${
            target === null ? "bg-black text-white" : "border border-black/10 text-black/60 hover:text-black"
          }`}
        >
          Chat with Report Agent
        </button>

        <label className="flex items-center gap-2 rounded-full border border-black/10 px-3 py-1.5">
          <Users className="h-3.5 w-3.5 text-black/40" aria-hidden />
          <select
            data-testid="chat-target-select"
            aria-label="Interview an agent"
            value={target ?? ""}
            onChange={(e) => switchTarget(e.target.value || null)}
            className="max-w-[13rem] bg-transparent text-[12.5px] text-black/70 outline-none"
          >
            <option value="">Chat with any agent…</option>
            {world.agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.displayName} · {a.stance}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          data-testid="send-survey"
          onClick={survey}
          disabled={pending}
          className="flex items-center gap-1.5 rounded-full border border-[#1f7a4d]/30 px-3 py-2 text-[12.5px] text-[#1f7a4d] transition-colors hover:bg-[#e6f4ec] disabled:opacity-40"
        >
          <ClipboardList className="h-3.5 w-3.5" /> Send Survey
        </button>
      </div>

      {agent && (
        <p className="mt-2.5 font-mono text-[11.5px] leading-relaxed text-black/45">
          Interviewing <span className="text-black/70">@{agent.id}</span> · {agent.role} · {agent.stance}
        </p>
      )}

      <div className="mt-4 rounded-lg border border-black/10 bg-white">
        <div ref={feedRef} data-testid="chat-feed" className="max-h-72 min-h-[9rem] overflow-y-auto p-4">
          {turns.length === 0 ? (
            <div className="flex h-28 flex-col items-center justify-center gap-3 text-center">
              <p className="text-[13px] text-black/40">
                {agent ? `Ask ${agent.displayName} why they think that.` : "Ask the Report Agent for deeper insight."}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {(PROMPTS[mode.key] ?? []).map((p) => (
                  <button
                    key={p}
                    type="button"
                    data-testid="chat-suggestion"
                    onClick={() => send(p)}
                    className="rounded-full border border-black/10 px-3 py-1.5 text-[12px] text-black/60 hover:border-black/30 hover:text-black"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {turns.map((t, i) => (
                <div key={i} className={t.role === "user" ? "text-right" : ""}>
                  <div
                    className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-lg px-3.5 py-2.5 text-left text-[13.5px] leading-relaxed ${
                      t.role === "user" ? "bg-black text-white" : "bg-black/[0.04] text-black/85"
                    }`}
                  >
                    {t.content}
                  </div>
                </div>
              ))}
              {pending && (
                <div className="flex items-center gap-2 text-[12.5px] text-black/40">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-black/15 border-t-black/50" aria-hidden />
                  {agent ? `${agent.displayName} sedang mengetik…` : "Report Agent sedang menyusun jawaban…"}
                </div>
              )}
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(draft);
          }}
          className="flex items-center gap-2 border-t border-black/10 px-4 py-3"
        >
          <input
            data-testid="chat-input"
            name="question"
            id="world-chat-question"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={pending}
            placeholder={agent ? `Tanya ${agent.displayName}…` : "Type your question…"}
            aria-label="Message"
            className="flex-1 bg-transparent text-[13.5px] text-black outline-none placeholder:text-black/35"
          />
          <button
            type="submit"
            data-testid="chat-send"
            disabled={pending || draft.trim().length === 0}
            aria-label="Send"
            className="rounded p-1.5 text-black/50 transition-colors hover:text-black disabled:opacity-30"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>

      <p className="mt-2 font-mono text-[11px] leading-relaxed text-black/40">
        Replies come from a live model in character as a <strong>fictional</strong> simulated agent, grounded only in
        this generated world. Not a real person and not a real quote.
      </p>
    </div>
  );
}
