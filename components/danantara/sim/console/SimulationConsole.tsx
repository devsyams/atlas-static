"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, FileText, Globe, Maximize2, MessageCircle, MessagesSquare, Minimize2, RotateCw } from "lucide-react";
import { isAiEnabled } from "@/lib/ai-settings";
import { seedFromString } from "@/lib/danantara/ceo/crisis-sim";
import { SEED_MAX } from "@/lib/danantara/sim/console-ai";
import { fallbackConsoleWorld } from "@/lib/danantara/sim/console-fallback";
import { PLATFORMS, type ConsoleWorld, type PlatformKey } from "@/lib/danantara/sim/console-types";
import { typeColor } from "@/lib/danantara/sim/graph-layout";
import { MODES, type SimMode } from "@/lib/danantara/sim/modes";
import { ACTIVITY_WINDOWS, HOURS_PER_ROUND, activationPlan, simConfig } from "@/lib/danantara/sim/sim-config";
import { GraphCanvas } from "./GraphCanvas";
import { InteractionPanel } from "./InteractionPanel";
import { NodeInspector } from "./NodeInspector";
import { ReportDocument } from "./ReportDocument";
import { CardCaption, Chips, LivePill, MonoLabel, StatRow, StepCard, Terminal, useSpotlightCard } from "./primitives";

type View = "console" | "process";
type Tab = "graph" | "split" | "workbench";

const STEPS = ["Graph Build", "Env Setup", "Simulation", "Report", "Interaction"] as const;
type StepIndex = 0 | 1 | 2 | 3 | 4;

const WORKFLOW = [
  { n: "01", t: "Graph Build", d: "Reality-seed extraction, memory injection and GraphRAG construction" },
  { n: "02", t: "Env Setup", d: "Entity-relationship extraction, persona generation and agent injection" },
  { n: "03", t: "Start Simulation", d: "Dual-platform parallel simulation with dynamic temporal memory updates" },
  { n: "04", t: "Report Generation", d: "ReportAgent interacts with the post-simulation environment" },
  { n: "05", t: "Deep Interaction", d: "Chat with any agent in the simulated world, or with the ReportAgent" },
];

const SEED_MIN = 40;
const TICK_MS = 900;

/** Ticks each step takes to complete. Also drives the terminal's progress lines. */
const GRAPH_TICKS = 8;
const AGENT_TICKS = 7;
const SECTION_TICKS = 3;

/**
 * Terminal timestamp in the **viewer's** local time.
 *
 * This was `toISOString()`, which is UTC — so on a Jakarta demo the system dashboard
 * printed times seven hours behind the wall clock and read as broken.
 */
const hhmmss = (t: number) => {
  const d = new Date(t);
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
};

/**
 * The terminal line for a given step + tick — or `null` once the step has nothing new
 * to report.
 *
 * Returning `null` is the whole point: the first cut recomputed a line every tick
 * forever, so once a step finished the terminal printed the same sentence hundreds of
 * times and looked broken. Now each step emits real progress, one completion line, and
 * then goes quiet.
 */
/** Ticks the simulation step spends on each round — also the run-length estimate's basis. */
const TICKS_PER_ROUND = 2;

/**
 * The simulated wall clock at a given round — `06:00`, `18:00`, …
 *
 * The run starts at 06:00 and each round advances it by `HOURS_PER_ROUND`, so a post's
 * timestamp is a fact about the simulated world rather than the viewer's clock. Using
 * real time here would be wrong: two posts a second apart on screen are twelve simulated
 * hours apart in the world.
 */
export function simClock(round: number): string {
  const h = (6 + round * HOURS_PER_ROUND) % 24;
  return `${String(h).padStart(2, "0")}:00`;
}

/** "~11s" / "~2 min" — seconds below a minute, because "~0 min" reads as broken. */
export function estimateRunTime(rounds: number): string {
  const ms = rounds * TICKS_PER_ROUND * TICK_MS;
  return ms < 60_000 ? `~${Math.max(1, Math.round(ms / 1000))}s` : `~${Math.round(ms / 60_000)} min`;
}

function logLine(w: ConsoleWorld, step: StepIndex, tick: number, runRounds: number): string | null {
  const t = hhmmss(Date.now());
  switch (step) {
    case 0: {
      const p = Math.min(1, tick / GRAPH_TICKS);
      const nodes = Math.round(w.ontology.nodes.length * p);
      const edges = Math.round(w.ontology.edges.length * p);
      if (tick < GRAPH_TICKS) return `${t}  Graph sync: ${nodes} nodes, ${edges} edges, progress: ${Math.round(p * 100)}%`;
      if (tick === GRAPH_TICKS) return `${t}  Graph build complete. ${nodes} nodes, ${edges} edges, ${w.ontology.entityTypes.length} schema types.`;
      return null;
    }
    case 1: {
      const n = Math.min(w.agents.length, Math.ceil((tick / AGENT_TICKS) * w.agents.length));
      if (tick <= AGENT_TICKS) {
        const a = w.agents[Math.max(0, n - 1)];
        return `${t}  Profile (${n}/${w.agents.length}) ${a ? `${a.id} — ${a.role}` : ""}`;
      }
      // Profile generation is only the first half of env setup. The reference console
      // then loads a simulation config and reports what the run will actually be, which
      // is the part that tells a viewer the environment is *ready* rather than just
      // populated — without it the step looks like it stops mid-way.
      const posts = w.rounds[0]?.posts.length ?? 0;
      const hours = w.rounds.length * 12;
      switch (tick) {
        case AGENT_TICKS + 1:
          return `${t}  All ${w.agents.length} agent profiles generated.`;
        case AGENT_TICKS + 2:
          return `${t}  [2/5] Generate Simulation Config: dual-platform config parameters`;
        case AGENT_TICKS + 3:
          return `${t}  [3/5] Prepare Simulation Script: orchestrating initial activation sequence`;
        case AGENT_TICKS + 4:
          return `${t}  Loading simulation config...`;
        case AGENT_TICKS + 5:
          return `${t}  ✓ Loaded ${w.agents.length} agent profiles across ${PLATFORMS.length} platforms`;
        case AGENT_TICKS + 6:
          return `${t}  Total agents: ${w.agents.length} · Duration: ${hours} hours · Initial posts: ${posts}`;
        case AGENT_TICKS + 7:
          return `${t}  Environment setup complete, ready to start simulation.`;
        default:
          return null;
      }
    }
    case 2: {
      const r = Math.floor(tick / TICKS_PER_ROUND);
      // The configured run length, not the world's full round list — a shortened run
      // must report the events it actually played, or the total contradicts the feed.
      const total = runRounds;
      if (r >= total) {
        const played = w.rounds.slice(0, total).reduce((n, x) => n + x.posts.length, 0);
        return tick === total * TICKS_PER_ROUND ? `${t}  Simulation complete. ${played} total events.` : null;
      }
      const round = w.rounds[r];
      if (tick % TICKS_PER_ROUND === 0) {
        const acts = round?.posts.length ?? 0;
        return `${t}  [R${r + 1}/${total}] T:${(r + 1) * HOURS_PER_ROUND}h · ${acts} acts · ${round?.headline ?? ""}`;
      }
      // The odd tick reports the graph growing, mirroring exactly what the canvas is
      // animating — event nodes land as the rounds that produce them play. Previously
      // this tick logged nothing, so the monitor went quiet every other beat.
      const events = w.ontology.nodes.filter((n) => n.type === "Event").length;
      const base = w.ontology.nodes.length - events;
      const p = Math.min(1, (r + 1) / total);
      const nodes = Math.round(base + events * p);
      const edges = Math.round(w.ontology.edges.length * (base + events * p) / Math.max(1, w.ontology.nodes.length));
      return `${t}  Graph sync updated, nodes: ${nodes}, edges: ${edges}, progress: ${Math.round(p * 100)}%`;
    }
    case 3: {
      const total = w.report.sections.length;
      const s = Math.floor(tick / SECTION_TICKS);
      if (s >= total) return tick === total * SECTION_TICKS ? `${t}  Report complete. ${total} sections, ${w.report.memories.length} memories cited.` : null;
      if (tick % SECTION_TICKS !== 0) return null;
      return `${t}  INFO: Composing section ${s + 1}/${total} — ${w.report.sections[s]?.heading ?? ""}`;
    }
    default:
      return tick === 1 ? `${t}  Ready. ${w.agents.length} agents available for interaction.` : null;
  }
}

/**
 * Simulation Console (A15 v3.0) — a five-step console that turns a pasted document
 * into a simulated world and walks the presenter through it: graph build → environment
 * setup → dual-platform simulation → report generation → deep interaction.
 *
 * Deliberately runs a **light theme**, unlike the rest of ATLAS: this screen mirrors the
 * visual language of the simulation-engine category the client asked us to match. The
 * theme is scoped to this wrapper so it cannot leak into the dark dashboards.
 *
 * All five steps replay a **single** cached LLM world, so a rehearsed demo is instant
 * and identical. Everything shown is synthetic and labelled as such.
 */
export function SimulationConsole() {
  const [view, setView] = useState<View>("console");
  const [tab, setTab] = useState<Tab>("split");
  const [step, setStep] = useState<StepIndex>(0);
  const [mode, setMode] = useState<SimMode>(MODES[0]);
  const [seedText, setSeedText] = useState("");
  const [sampleKey, setSampleKey] = useState<string | null>(null);
  const [world, setWorld] = useState<ConsoleWorld | null>(null);
  const [node, setNode] = useState<string | null>(null);
  const [source, setSource] = useState<"llm" | "scripted">("scripted");
  const [building, setBuilding] = useState(false);
  const [tick, setTick] = useState(0);
  const [showEdgeLabels, setShowEdgeLabels] = useState(true);
  /** `null` = auto (use every round the world produced). */
  const [customRounds, setCustomRounds] = useState<number | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const ids = useMemo(() => {
    const h = seedFromString(seedText || "seed").toString(16).padStart(8, "0");
    return { proj: `proj_${h}`, sim: `sim_${h}`, report: `report_${h}`, graph: `nexorus_graph_${h}`, task: `task_prepare_${h}` };
  }, [seedText]);

  // The world is read from a ref so a re-render can't restart the clock mid-step. The
  // *step* is taken from the effect closure instead — the effect already re-runs on a
  // step change, and routing it through the ref left the terminal logging the previous
  // step's lines for a beat.
  const latestWorld = useRef(world);
  useEffect(() => {
    latestWorld.current = world;
  }, [world]);

  // Configured run length. `null` = auto (every round the world produced); a custom
  // value shortens the run, and is clamped so it can never exceed the available rounds.
  const autoRounds = world?.rounds.length ?? 0;
  const runRounds = Math.max(1, Math.min(autoRounds, customRounds ?? autoRounds));
  const runRoundsRef = useRef(runRounds);
  useEffect(() => {
    runRoundsRef.current = runRounds;
  }, [runRounds]);

  /**
   * The step clock. Drives graph reveal, progress %, round advance and report writing —
   * one timer rather than four, so everything on screen stays in lockstep. The log line
   * is appended here rather than derived in an effect: the terminal is a record of what
   * happened on each tick, so it belongs to the tick, and deriving it would be a
   * setState-in-effect cascade.
   */
  const tickRef = useRef(0);
  useEffect(() => {
    if (view !== "process" || building) return;
    tickRef.current = 0;
    const id = setInterval(() => {
      // Both updates live in the interval callback. Appending the log *inside* a
      // `setTick` updater looked tidier but is impure — React double-invokes updaters,
      // which duplicated every terminal line.
      tickRef.current += 1;
      const n = tickRef.current;
      setTick(n);
      const w = latestWorld.current;
      if (!w) return;
      const line = logLine(w, step, n, runRoundsRef.current);
      // `null` means the step has nothing new to say — the terminal stays quiet rather
      // than reprinting its last sentence forever.
      if (line) setLog((l) => [...l.slice(-60), line]);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [view, building, step]);

  const build = useCallback(async () => {
    const text = seedText.trim();
    if (text.length < SEED_MIN) return;

    setBuilding(true);
    setView("process");
    setStep(0);
    setNode(null);
    setLog([
      `${hhmmss(Date.now())}  Mode: ${mode.label} (${mode.audience})`,
      `${hhmmss(Date.now())}  Starting graph build...`,
    ]);

    let next: ConsoleWorld = fallbackConsoleWorld(text);
    let src: "llm" | "scripted" = "scripted";

    if (isAiEnabled()) {
      try {
        const res = await fetch("/api/v1/danantara/world", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ seed: text.slice(0, SEED_MAX), mode: mode.key }),
        });
        const payload = (await res.json()) as ConsoleWorld & { source: "llm" | "scripted" };
        if (payload.source === "llm" && Array.isArray(payload.agents)) {
          next = payload;
          src = "llm";
        }
      } catch {
        /* deterministic world stands */
      }
    }

    if (!mountedRef.current) return;
    setWorld(next);
    setSource(src);
    setBuilding(false);
    setTick(0);
  }, [seedText, mode]);

  // Per-step derived progress — the same constants the terminal narrates.
  const graphProgress = Math.min(1, (tick + 1) / GRAPH_TICKS);
  const agentProgress = Math.min(1, (tick + 1) / AGENT_TICKS);
  const round = world ? Math.min(runRounds - 1, Math.floor(tick / TICKS_PER_ROUND)) : 0;

  /**
   * The graph grows across three steps rather than finishing in one.
   *
   * The generator emits nodes in run order — ontology, then agents, then events — so a
   * single "fraction revealed" number can stage the build against what each step is
   * actually doing: the ontology lands during the graph build, the personas appear as
   * they're profiled, and the events appear as the rounds that produce them play. It
   * keeps the picture alive for the whole run instead of freezing after step 1, and
   * every node shown is one the world genuinely contains.
   */
  const reveal = useMemo(() => {
    const nodes = world?.ontology.nodes ?? [];
    const total = nodes.length || 1;
    const events = nodes.filter((n) => n.type === "Event").length;
    const people = nodes.filter((n) => ["Citizen", "Analyst", "Journalist"].includes(n.type)).length;
    return { ontology: (total - events - people) / total, withAgents: (total - events) / total };
  }, [world]);

  const roundProgress = Math.min(1, (Math.floor(tick / TICKS_PER_ROUND) + 1) / Math.max(1, runRounds));

  /**
   * Whether the current step is still advancing.
   *
   * The header only reported "Processing" while the world was being built, so during the
   * eleven seconds a simulation actually runs it claimed to be idle — the one moment a
   * viewer most wants the status to say something is happening.
   */
  const stepRunning =
    step === 0
      ? tick < GRAPH_TICKS
      : step === 1
        ? tick < AGENT_TICKS + 7
        : step === 2
          ? tick < runRounds * TICKS_PER_ROUND
          : step === 3
            ? tick < (world?.report.sections.length ?? 0) * SECTION_TICKS
            : false;
  const graphRevealed =
    step === 0
      ? reveal.ontology * graphProgress
      : step === 1
        ? reveal.ontology + (reveal.withAgents - reveal.ontology) * agentProgress
        : step === 2
          ? reveal.withAgents + (1 - reveal.withAgents) * roundProgress
          : 1;
  const sectionsWritten = world ? Math.min(world.report.sections.length, Math.floor(tick / SECTION_TICKS)) : 0;

  const reset = () => {
    setView("console");
    setWorld(null);
    setStep(0);
    setLog([]);
    setCustomRounds(null); // a new document gets its own auto-calculated run length
  };

  // ── Console (landing) ────────────────────────────────────────────────────
  if (view === "console") {
    return (
      <Shell source={source} step={null} tab={tab} setTab={setTab} onBack={null}>
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-14 px-8 py-14 lg:grid-cols-2">
          <div>
            <MonoLabel>▪ System Status</MonoLabel>
            <h1 className="mt-4 text-[34px] font-medium leading-tight tracking-tight text-black">System Ready</h1>
            <p className="mt-3 text-[15px] text-black/55">System is ready to use</p>

            {/* Use case — the two questions this console answers. */}
            <div className="mt-10">
              <MonoLabel>◆ Use Case</MonoLabel>
              <div data-testid="mode-picker" className="mt-4 space-y-2.5">
                {MODES.map((m) => {
                  const on = m.key === mode.key;
                  return (
                    <button
                      key={m.key}
                      type="button"
                      data-testid={`mode-${m.key}`}
                      aria-pressed={on}
                      onClick={() => {
                        setMode(m);
                        setSampleKey(null);
                        setSeedText("");
                      }}
                      className={`w-full rounded-lg border p-4 text-left transition-colors ${
                        on ? "border-black bg-black/[0.03]" : "border-black/10 hover:border-black/25"
                      }`}
                    >
                      <div className="font-mono text-[11px] uppercase tracking-wider text-black/45">{m.audience}</div>
                      <div className="mt-1 text-[16px] font-semibold text-black">{m.label}</div>
                      <p className="mt-1 text-[13.5px] leading-relaxed text-black/55">{m.blurb}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-12">
              <MonoLabel>◇ Workflow Steps</MonoLabel>
              <ol className="mt-6 space-y-7">
                {WORKFLOW.map((w) => (
                  <li key={w.n} className="flex gap-5">
                    <span className="font-mono text-[13px] text-black/35">{w.n}</span>
                    <div>
                      <div className="text-[16px] font-semibold text-black">
                        {w.n.replace(/^0/, "")}. {w.t}
                      </div>
                      <p className="mt-1 text-[14px] leading-relaxed text-black/55">{w.d}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <div className="rounded-lg border border-black/10 bg-white p-6">
            <div className="flex items-center justify-between">
              <MonoLabel>01 / Reality Seeds</MonoLabel>
              <MonoLabel>TEXT</MonoLabel>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {mode.samples.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  data-testid={`console-sample-${s.key}`}
                  onClick={() => {
                    setSampleKey(s.key);
                    setSeedText(s.text);
                  }}
                  className={`flex items-center gap-2 rounded border px-3 py-2 text-left font-mono text-[12px] transition-colors ${
                    sampleKey === s.key
                      ? "border-black/30 bg-black/[0.04] text-black"
                      : "border-black/10 bg-black/[0.02] text-black/60 hover:text-black"
                  }`}
                >
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  {s.label}.txt
                </button>
              ))}
            </div>

            <div className="my-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-black/10" />
              <MonoLabel>Input Parameters</MonoLabel>
              <span className="h-px flex-1 bg-black/10" />
            </div>

            <MonoLabel>{">_ 02 / Simulation Requirement"}</MonoLabel>
            <p data-testid="mode-question" className="mt-2 text-[14px] font-medium text-black/70">
              {mode.question}
            </p>
            <div className="mt-3 rounded border border-black/10 bg-black/[0.02] p-4">
              <textarea
                data-testid="console-seed-input"
                value={seedText}
                onChange={(e) => setSeedText(e.target.value)}
                rows={9}
                maxLength={SEED_MAX}
                aria-label="Simulation requirement"
                placeholder="Tempel dokumen sumber — artikel, laporan, draf kebijakan…"
                className="w-full resize-y bg-transparent font-mono text-[13px] leading-relaxed text-black outline-none placeholder:text-black/30"
              />
              <div className="mt-2 text-right">
                <MonoLabel>Engine: Nexorus-Sim-V0.1</MonoLabel>
              </div>
            </div>

            <button
              type="button"
              data-testid="console-try-now"
              disabled={seedText.trim().length < SEED_MIN}
              onClick={build}
              className={`mt-6 flex w-full items-center justify-between border-t border-black/10 pt-5 font-mono text-[17px] font-semibold text-black transition-opacity disabled:opacity-30 ${
                // The reference console's CTA pulses continuously to draw the eye —
                // only while it's actually clickable, or a pulsing disabled button
                // would invite a click that does nothing.
                seedText.trim().length >= SEED_MIN ? "sim-cta-pulse" : ""
              }`}
            >
              Try Now
              <ArrowRight className="sim-cta-arrow h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-8 pb-14">
          <p
            data-testid="console-disclaimer"
            className="rounded border border-[#e8c65c]/50 bg-[#fdf8e6] px-4 py-3 font-mono text-[12px] leading-relaxed text-black/60"
          >
            ⚠ Every agent, handle, post and report on this console is <strong>synthetic</strong> — generated from the
            document you submit. This is a <strong>projection</strong> of how a conversation could develop, not a
            measurement of real accounts, and not a third-party simulation engine run. No real person, journalist or
            outlet is quoted or impersonated.
          </p>
        </div>
      </Shell>
    );
  }

  // ── Process (steps 1–5) ──────────────────────────────────────────────────
  const w = world;
  // Built once per render rather than once per legend row — the old inline version
  // rebuilt the whole map for every swatch, which is O(n²) in the type count.
  const typeIndex = new Map<string, number>((w?.ontology.entityTypes ?? []).map((t, i) => [t, i]));
  return (
    <Shell source={source} step={step} tab={tab} setTab={setTab} onBack={reset} busy={building || stepRunning}>
      {building || !w ? (
        <div data-testid="console-building" className="flex h-[60vh] items-center justify-center">
          <div className="flex items-center gap-3 font-mono text-[13px] text-black/50">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-black/15 border-t-black/50" aria-hidden />
            Building world from source document…
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          {/* Left — graph (hidden in workbench, which is the document view). */}
          {tab !== "workbench" && (
            <div className={`relative flex min-h-0 flex-col border-r border-black/10 ${tab === "graph" ? "flex-1" : "w-1/2"}`}>
              {/* Header row. The title and the toolbar were both `absolute` and collided
                  in split view — a half-width panel on a 1366px laptop is ~683px, and the
                  two together need ~610px before padding. In normal flow they push each
                  other apart and the toolbar wraps instead of overlapping. */}
              <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 px-6 pb-3 pt-5">
                <div className="text-[15px] font-semibold text-black">Graph Relationship Visualization</div>

                {/* Refresh replays the build reveal (deterministic — a rehearsed demo must
                    not rearrange); the expand button swaps between split and graph-only. */}
                <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  data-testid="graph-refresh"
                  title="Replay the graph build"
                  onClick={() => {
                    tickRef.current = 0;
                    setTick(0);
                  }}
                  className="flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-[13px] text-black/70 shadow-sm ring-1 ring-black/5 transition-colors hover:text-black"
                >
                  {/* Spins on its own while the graph is actively growing — not just on
                      manual click — mirroring the reference console's toolbar icon, which
                      spins for as long as its "GraphRAG Build" card is mid-sync.
                      `graphRevealed < 1` looked right but isn't: at the *end* of step 0 it
                      only reaches `reveal.ontology` (agents and events land in steps 1-2),
                      so it stays below 1 — and the icon would keep spinning — long after
                      step 0 itself has actually finished. `stepRunning` is the real signal
                      for "still advancing right now". */}
                  <RotateCw className={`h-3.5 w-3.5 ${stepRunning && step <= 2 ? "animate-spin" : ""}`} /> Refresh
                </button>

                <button
                  type="button"
                  data-testid="graph-expand"
                  title={tab === "graph" ? "Back to split view" : "Expand the graph"}
                  aria-label={tab === "graph" ? "Back to split view" : "Expand the graph"}
                  onClick={() => setTab(tab === "graph" ? "split" : "graph")}
                  className="rounded-full bg-white p-2.5 text-black/70 shadow-sm ring-1 ring-black/5 transition-colors hover:text-black"
                >
                  {tab === "graph" ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                </button>

                <button
                  type="button"
                  role="switch"
                  aria-checked={showEdgeLabels}
                  data-testid="toggle-edge-labels"
                  onClick={() => setShowEdgeLabels((v) => !v)}
                  className="flex items-center gap-2 rounded-full bg-white px-3 py-2 text-[13px] text-black/70 shadow-sm ring-1 ring-black/5 transition-colors hover:text-black"
                >
                  {/* A bare appearance-none checkbox rendered as a solid blob with no
                      knob, so it didn't read as a switch at all. */}
                  <span
                    aria-hidden
                    className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${
                      showEdgeLabels ? "bg-[#7b3fb5]" : "bg-black/20"
                    }`}
                  >
                    {/* `left-0` is load-bearing: without a horizontal anchor the knob
                        lays out from its static position at the track's *end*, so it
                        rendered 12px past the track and sat on top of the label text. */}
                    <span
                      className={`absolute left-0 top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${
                        showEdgeLabels ? "translate-x-3.5" : "translate-x-0.5"
                      }`}
                    />
                  </span>
                  Show Edge Labels
                </button>
                </div>
              </div>

              {/* Canvas box. Everything floating (inspector, legend, hints) is positioned
                  against *this*, below the header — so no overlay can reach the toolbar. */}
              <div className="relative min-h-0 flex-1">
                <GraphCanvas
                  ontology={w.ontology}
                  seedKey={seedText}
                  revealed={graphRevealed}
                  showEdgeLabels={showEdgeLabels}
                  selected={node}
                  onSelect={setNode}
                />

                {node && <NodeInspector ontology={w.ontology} nodeId={node} onClose={() => setNode(null)} />}

                {!node && (
                  <div className="pointer-events-none absolute bottom-5 right-6 text-right font-mono text-[11px] leading-5 text-black/30">
                    click a node to inspect
                    <br />
                    scroll to zoom · drag to move
                  </div>
                )}

                {step <= 2 && (
                  <LivePill>{step === 0 ? "Updating in real-time…" : "GraphRAG memory updating in real-time"}</LivePill>
                )}

                {/* Top-left, not bottom-left: at twelve types the legend is wide enough
                    that it sat underneath the "updating in real-time" pill. A force
                    layout settles into a rough disc, so the corners stay clear. */}
                <div className="absolute left-5 top-4 max-w-[60%] rounded-lg bg-white/95 p-3.5 shadow-sm ring-1 ring-black/5">
                  <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#c62b45]">
                    Entity Types
                  </div>
                  {/* Three columns since v5.0 — twelve types in two columns made the
                      legend tall enough to reach the graph's centre of mass. */}
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
                    {w.ontology.entityTypes.map((t) => (
                      <span key={t} className="flex items-center gap-1.5 text-[11.5px] text-black/70">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: typeColor(typeIndex, t) }}
                          aria-hidden
                        />
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Right — step content over the terminal. */}
          <div className={`flex min-h-0 flex-col ${tab === "graph" ? "hidden" : tab === "workbench" ? "flex-1" : "w-1/2"}`}>
            <div className="min-h-0 flex-1 overflow-y-auto bg-[#fafafa]">
              {step === 0 && <StepGraphBuild world={w} progress={graphProgress} />}
              {step === 1 && (
                <StepEnvSetup
                  world={w}
                  progress={agentProgress}
                  tick={tick}
                  ids={ids}
                  autoRounds={autoRounds}
                  runRounds={runRounds}
                  custom={customRounds !== null}
                  onRoundsChange={setCustomRounds}
                />
              )}
              {step === 2 && <StepSimulation world={w} round={round} total={runRounds} />}
              {step === 3 && <StepReport world={w} written={sectionsWritten} reportId={ids.report} tab={tab} />}
              {step === 4 && (
                <div className={tab === "workbench" ? "grid grid-cols-1 xl:grid-cols-2" : ""}>
                  <div className="border-b border-black/10 xl:border-b-0 xl:border-r">
                    <ReportDocument report={w.report} written={w.report.sections.length} reportId={ids.report} />
                  </div>
                  <InteractionPanel world={w} mode={mode} />
                </div>
              )}
            </div>

            {/* Was h-52 (208px) — on a laptop-height viewport that left barely two cards
                visible above it in the step-2 list (5 cards), so the terminal read as
                "blocking" content that was really just scrolled past. The card list above
                is independently scrollable, so shrinking this only trades terminal lines
                for card visibility — 160px is still ~5 lines. */}
            <div className="h-40 shrink-0">
              <Terminal
                title={step === 2 ? "Simulation Monitor" : step >= 3 ? "Console Output" : "System Dashboard"}
                id={step === 2 ? ids.sim : step >= 3 ? ids.report : ids.proj}
                lines={log}
              />
            </div>

            {step < 4 && (
              <button
                type="button"
                data-testid="console-next-step"
                disabled={stepRunning}
                onClick={() => {
                  // `tick` (the state, not `tickRef`) only resets once the clock effect's
                  // first interval fires — up to 900ms after `step` changes. For that
                  // window, the new step's card computations read the *previous* step's
                  // leftover tick value, which briefly reports it as already advanced
                  // (e.g. env setup opening on card 03, not 02) before self-correcting a
                  // moment later. Batching this into the same click as `setStep` — React
                  // commits both in one render — closes the gap: the new step's very
                  // first render already sees tick 0.
                  setTick(0);
                  setStep((s) => Math.min(4, s + 1) as StepIndex);
                }}
                className="flex shrink-0 items-center justify-center gap-2 border-t border-black/10 bg-white px-6 py-3.5 font-mono text-[13px] font-semibold uppercase tracking-wider text-black transition-opacity hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-white"
              >
                {/* Reuses `stepRunning` — already computed for the header's Processing
                    indicator — so this can never disagree with what the badge says.
                    Jumping ahead while a stage is still ticking let a viewer land on
                    step 2 mid-round with the round counter not yet at its final value. */}
                {stepRunning ? `${STEPS[step]} in progress…` : `Go to ${STEPS[step + 1]}`}
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </Shell>
  );
}

/* ── Shell ─────────────────────────────────────────────────────────────── */

function Shell({
  children,
  source,
  step,
  tab,
  setTab,
  onBack,
  busy,
}: {
  children: React.ReactNode;
  source: "llm" | "scripted";
  step: StepIndex | null;
  tab: Tab;
  setTab: (t: Tab) => void;
  onBack: (() => void) | null;
  busy?: boolean;
}) {
  return (
    // Scoped light theme — nothing here inherits the app's dark tokens. The height
    // subtracts AppShell's 3rem header + 1.75rem footer + its 3rem vertical padding,
    // so the console owns exactly one screen and its panes scroll internally.
    <div
      data-testid="simulation-console"
      className="sim-console flex h-[calc(100dvh-7.75rem)] flex-col overflow-hidden rounded-lg bg-white text-black ring-1 ring-black/10"
      style={{ colorScheme: "light" }}
    >
      <header className="flex shrink-0 items-center gap-4 border-b border-black/10 px-5 py-3">
        {onBack && (
          <button
            type="button"
            data-testid="console-back"
            onClick={onBack}
            aria-label="Back to console"
            className="rounded border border-black/10 px-2 py-1 text-black/50 hover:text-black"
          >
            ←
          </button>
        )}
        <span className="text-[19px] font-bold tracking-tight text-black">Nexorus Sim</span>

        {step !== null && (
          <div className="ml-6 flex rounded-lg bg-black/[0.05] p-1">
            {(["graph", "split", "workbench"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                data-testid={`console-tab-${t}`}
                onClick={() => setTab(t)}
                className={`rounded-md px-4 py-1.5 text-[14px] capitalize transition-colors ${
                  tab === t ? "bg-white text-black shadow-sm" : "text-black/50 hover:text-black"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        <div className="ml-auto flex items-center gap-3">
          {step !== null && (
            <span data-testid="console-step" className="font-mono text-[14px] text-black/45">
              Step <span className="font-semibold text-black">{step + 1}/5</span>{" "}
              <span className="ml-1 font-sans font-semibold text-black">{STEPS[step]}</span>
            </span>
          )}
          <span className="flex items-center gap-2 font-mono text-[12px] text-black/50">
            <span
              className={`h-2 w-2 rounded-full ${busy ? "animate-pulse bg-[#e8622a]" : "bg-black/25"}`}
              aria-hidden
            />
            {busy ? "Processing" : "Ready"}
          </span>
          <span
            data-testid="console-source"
            className={`rounded px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-wider ${
              source === "llm" ? "bg-black text-white" : "bg-black/[0.06] text-black/50"
            }`}
          >
            {source === "llm" ? "Nexorus AI · LLM" : "Simulated"}
          </span>
        </div>
      </header>

      {/* The landing scrolls as a page; the process view fills the frame and lets its
          own panes scroll, so the terminal stays pinned to the bottom. */}
      <div className={`flex min-h-0 flex-1 flex-col ${step === null ? "overflow-y-auto" : "overflow-hidden"}`}>
        {children}
      </div>
    </div>
  );
}

/* ── Steps ─────────────────────────────────────────────────────────────── */

function StepGraphBuild({ world, progress }: { world: ConsoleWorld; progress: number }) {
  const pct = Math.round(progress * 100);
  const done = pct >= 100;
  // Only card 02 ever carries "active" here — card 03 jumps straight from pending to
  // done alongside it, so there's nothing to spotlight once the build finishes.
  useSpotlightCard(done ? null : "02");
  return (
    <div className="space-y-4 p-5">
      <StepCard
        index="01"
        title="Ontology Generation"
        endpoint="/api/graph/ontology/generate"
        description="The model reads the source document and the simulation requirement, extracts real-world seeds, and generates an ontology structure for the world."
        state="done"
        badge="Build Complete"
      >
        <CardCaption>Generated entity types</CardCaption>
        <Chips items={world.ontology.entityTypes} testid="chips-entity-types" />
        <div className="mt-5">
          <CardCaption>Generated relation types</CardCaption>
          <Chips items={world.ontology.relationTypes} testid="chips-relation-types" />
        </div>
      </StepCard>

      <StepCard
        index="02"
        title="GraphRAG Build"
        endpoint="/api/graph/build"
        description="Chunks the document and builds a knowledge graph from the ontology, extracting entities and relations and forming temporal memory and community summaries."
        state={done ? "done" : "active"}
        badge={done ? "Build Complete" : `${pct}%`}
      >
        <StatRow
          stats={[
            { value: String(Math.round(world.ontology.nodes.length * progress)), label: "Entity Nodes" },
            { value: String(Math.round(world.ontology.edges.length * progress)), label: "Relation Edges" },
            { value: String(world.ontology.entityTypes.length), label: "Schema Types" },
          ]}
        />
      </StepCard>

      <StepCard index="03" title="Build Complete" state={done ? "done" : "pending"} badge={done ? "Ready" : undefined}>
        <p className="text-[14px] leading-relaxed text-black/70">{world.ontology.summary}</p>
      </StepCard>
    </div>
  );
}

/**
 * Step 2 — env setup (A15 v6.0).
 *
 * Five cards, not one. Profiling the agents is only the second of five things env setup
 * does, and rendering that card alone made the step look like it stopped a third of the
 * way through: the terminal narrated a config being generated and an activation sequence
 * being orchestrated, and there was nothing on screen for either.
 */
function StepEnvSetup({
  world,
  progress,
  tick,
  ids,
  autoRounds,
  runRounds,
  custom,
  onRoundsChange,
}: {
  world: ConsoleWorld;
  progress: number;
  tick: number;
  ids: { proj: string; sim: string; graph: string; task: string };
  autoRounds: number;
  runRounds: number;
  custom: boolean;
  onRoundsChange: (rounds: number | null) => void;
}) {
  const shown = Math.max(1, Math.round(world.agents.length * progress));
  const done = shown >= world.agents.length;

  // Sub-phases follow the same tick budget the terminal narrates, so a card turns
  // COMPLETE on the beat its log line prints.
  const configDone = tick >= AGENT_TICKS + 3;
  const activationDone = tick >= AGENT_TICKS + 5;
  const ready = tick >= AGENT_TICKS + 7;

  const cfg = useMemo(() => simConfig(world), [world]);
  const plan = useMemo(() => activationPlan(world), [world]);
  const state = (isDone: boolean, isActive: boolean) => (isDone ? "done" : isActive ? "active" : "pending");

  // Same sequencing the four cards' own `state()` calls below use, collapsed into
  // "which one card is the current stop on the tour right now" — card 01 is instant
  // (never the active one), and 05 stays the spotlight once ready, since that's the
  // moment the viewer needs to notice the rounds config before moving on.
  useSpotlightCard(!done ? "02" : !configDone ? "03" : !activationDone ? "04" : "05");

  return (
    <div className="space-y-4 p-5">
      <StepCard
        index="01"
        title="Simulation Instance Init"
        endpoint="/api/simulation/create"
        description="Create a simulation instance and fetch the simulation world parameter templates."
        state="done"
        badge="Complete"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            ["Project ID", ids.proj],
            ["Graph ID", ids.graph],
            ["Simulation ID", ids.sim],
            ["Task ID", ids.task],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-black/10 bg-white px-4 py-3">
              <CardCaption>{label}</CardCaption>
              <div className="mt-1 break-all font-mono text-[13px] text-black/80">{value}</div>
            </div>
          ))}
        </div>
      </StepCard>

      <StepCard
        index="02"
        title="Generate Agent Profiles"
        endpoint="/api/simulation/prepare"
        description="Using context and related topics from the reality seeds, a complete agent profile is generated for each entity in the world."
        state={done ? "done" : "active"}
        badge={done ? "Complete" : `${Math.round(progress * 100)}%`}
      >
        <StatRow
          stats={[
            { value: String(shown), label: "Current Agents" },
            { value: String(world.agents.length), label: "Expected Total" },
            { value: String(world.agents.reduce((n, a) => n + a.topics.length, 0)), label: "Related Topics" },
          ]}
        />

        <div className="mt-6">
          <CardCaption>Generated agent profiles</CardCaption>
          <div data-testid="agent-profiles" className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
            {world.agents.slice(0, shown).map((a) => (
              <div key={a.id} data-testid={`agent-${a.id}`} className="rounded-lg border border-black/10 bg-white p-4">
                {/* `min-w-0` on both halves is load-bearing: a flex child defaults to
                    min-width:auto, so an unbreakable mono handle like
                    `pengamat_kebijakan_publik_204` refuses to shrink and pushes the role
                    straight out through the card's right edge.

                    Wrapping rather than truncating: the reference console shows the whole
                    handle and lets the role run onto a second and third line, and a handle
                    is an identifier — half of one is worse than a taller card. */}
                {/* 12px and a narrower role column so a typical handle
                    (`pengamat_kebijakan_publik_204`) sits on one line; only the longest
                    derived ones wrap, and `break-all` keeps even those inside the card. */}
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 flex-1 break-all font-mono text-[12px] font-semibold leading-snug text-black">
                    {a.id}
                  </span>
                  <span className="min-w-0 max-w-[38%] break-words text-right font-mono text-[11px] leading-tight text-black/40">
                    @{a.role}
                  </span>
                </div>
                <div className="mt-2 inline-block rounded bg-black/[0.05] px-2 py-0.5 text-[12px] text-black/60">
                  {a.topics[0] ?? "General"}
                </div>
                <p className="mt-2.5 text-[13px] leading-relaxed text-black/70">{a.bio}</p>
                {/* Capped at three with a `+N` tail, as the reference console does — five
                    chips per card across two columns turns the list into a wall of pills
                    and the count is the useful part anyway. */}
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  {a.topics.slice(0, 3).map((t) => (
                    <span key={t} className="rounded bg-[#eaf2fb] px-2 py-0.5 text-[11px] text-[#2c5f9e]">
                      {t}
                    </span>
                  ))}
                  {a.topics.length > 3 && (
                    <span title={a.topics.slice(3).join(", ")} className="font-mono text-[11px] text-black/35">
                      +{a.topics.length - 3}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </StepCard>

      <StepCard
        index="03"
        title="Generate Config"
        endpoint="/api/simulation/prepare"
        description="Dual-platform simulation config parameters, derived from the simulation requirement and the agent profiles."
        state={state(configDone, done && !configDone)}
        badge={configDone ? "Complete" : "Pending"}
      >
        <StatRow
          stats={[
            { value: `${cfg.durationHours}h`, label: "Duration" },
            { value: String(cfg.totalRounds), label: "Total Rounds" },
            { value: `${cfg.activePerHour[0]}–${cfg.activePerHour[1]}`, label: "Active / Hour" },
          ]}
        />

        <div className="mt-4">
          <CardCaption>Hourly activity weighting</CardCaption>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {ACTIVITY_WINDOWS.map((w) => (
              <div
                key={w.label}
                className="flex items-center justify-between rounded-lg border border-black/10 bg-white px-3 py-2"
              >
                <div>
                  <div className="text-[12.5px] text-black/70">{w.label}</div>
                  <div className="font-mono text-[11px] text-black/40">{w.window}</div>
                </div>
                <span className="font-mono text-[13px] font-semibold text-[#7b3fb5]">×{w.factor}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <CardCaption>Agent config · {cfg.agents.length} agents</CardCaption>
          <div data-testid="agent-config" className="mt-2 space-y-2">
            {cfg.agents.map((a) => (
              <div key={a.agentId} className="rounded-lg border border-black/10 bg-white p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[11px] text-black/40">Agent {a.index}</span>
                  <span className="text-[13px] font-semibold text-black">{a.displayName}</span>
                  <span className="rounded border border-black/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-black/45">
                    {a.entityType}
                  </span>
                  <span className="ml-auto rounded bg-black/[0.05] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-black/55">
                    {a.stance}
                  </span>
                </div>

                {/* 24 bars — the agent's day. A table of numbers can't show that a
                    night-owl and a nine-to-fiver behave differently; this can. */}
                <div className="mt-2 flex h-6 items-end gap-[2px]" aria-hidden>
                  {a.activeHours.map((v, h) => (
                    <span
                      key={h}
                      className="flex-1 rounded-sm bg-[#7b3fb5]"
                      style={{ height: `${Math.max(8, v * 100)}%`, opacity: 0.25 + v * 0.75 }}
                    />
                  ))}
                </div>
                <div className="mt-1 flex justify-between font-mono text-[9px] text-black/30">
                  {[0, 6, 12, 18, 24].map((h) => (
                    <span key={h}>{h}</span>
                  ))}
                </div>

                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
                  {[
                    ["Posts/hr", String(a.postsPerHour)],
                    ["Comments/hr", String(a.commentsPerHour)],
                    ["Response Delay", a.responseDelay],
                    ["Activity Level", `${a.activityLevel}%`],
                    ["Sentiment Bias", a.sentimentBias > 0 ? `+${a.sentimentBias}` : String(a.sentimentBias)],
                    ["Influence Weight", String(a.influenceWeight)],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-baseline justify-between gap-2">
                      <span className="font-mono text-[10.5px] uppercase tracking-wider text-black/35">{k}</span>
                      <span className="font-mono text-[12px] text-black/80">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </StepCard>

      <StepCard
        index="04"
        title="Initial Activation Orchestration"
        endpoint="/api/simulation/prepare"
        description="Orchestrate the opening sequence from the narrative direction and the agent profiles."
        state={state(activationDone, configDone && !activationDone)}
        badge={activationDone ? "Complete" : "Pending"}
      >
        <CardCaption>Narrative guide direction</CardCaption>
        <p className="mt-2 border-l-2 border-[#e8622a] pl-3 text-[13.5px] leading-relaxed text-black/75">
          {plan.narrative}
        </p>

        <div className="mt-4">
          <CardCaption>Initial hot topics</CardCaption>
          <Chips items={plan.hotTopics} testid="activation-topics" />
        </div>

        <div className="mt-4">
          <CardCaption>Initial activation sequence ({plan.sequence.length})</CardCaption>
          <div data-testid="activation-sequence" className="mt-2 space-y-2">
            {plan.sequence.map((s) => (
              <div key={s.agentId} className="rounded-lg border border-black/10 bg-white p-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-[#f0eefb] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#6b4bb5]">
                    {s.entityType}
                  </span>
                  <span className="font-mono text-[11px] text-black/40">Agent {s.index}</span>
                  <span className="min-w-0 break-all font-mono text-[11.5px] text-black/60">@{s.agentId}</span>
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-black/75">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </StepCard>

      <StepCard
        index="05"
        title="Ready"
        endpoint="/api/simulation/start"
        description="The simulation environment is ready. You can start running the simulation."
        state={ready ? "active" : "pending"}
        badge={ready ? "Ready" : "Pending"}
      >
        {/* Rounds config. The switch is a real control, not a decoration: a custom value
            shortens what step 3 actually plays and what the monitor reports, so a
            presenter who is short on time can cut the run rather than sit through it. */}
        <div className="rounded-lg border border-black/10 bg-white p-4">
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-semibold text-black">Simulation Rounds Config</div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-black/55">
                Auto-calculated from the time config (
                <span className="font-mono text-black/75">{cfg.durationHours}</span> hours /{" "}
                <span className="font-mono text-black/75">{HOURS_PER_ROUND}</span> hours per round).
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={custom}
              data-testid="rounds-custom-toggle"
              onClick={() => onRoundsChange(custom ? null : autoRounds)}
              className="flex shrink-0 items-center gap-2 rounded-full border border-black/10 px-3 py-1.5 text-[12.5px] text-black/70 transition-colors hover:text-black"
            >
              <span
                aria-hidden
                className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${custom ? "bg-[#7b3fb5]" : "bg-black/20"}`}
              >
                <span
                  className={`absolute left-0 top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${
                    custom ? "translate-x-3.5" : "translate-x-0.5"
                  }`}
                />
              </span>
              Custom
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-baseline gap-2">
            <span data-testid="rounds-value" className="font-mono text-[26px] font-bold leading-none text-black">
              {runRounds}
            </span>
            <span className="font-mono text-[12px] text-black/45">rounds</span>
            <span className="ml-auto font-mono text-[12px] text-black/45">Est. {estimateRunTime(runRounds)}</span>
          </div>

          {custom ? (
            <div className="mt-3">
              <input
                type="range"
                min={1}
                max={autoRounds}
                step={1}
                value={runRounds}
                data-testid="rounds-slider"
                aria-label="Simulation rounds"
                onChange={(e) => onRoundsChange(Number(e.target.value))}
                className="w-full accent-[#7b3fb5]"
              />
              <div className="mt-1 flex justify-between font-mono text-[11px] text-black/35">
                <span>1</span>
                <span>{autoRounds}</span>
              </div>
              {/* The ceiling is the world's own round count — there is no honest way to
                  run more rounds than there is simulated conversation for. */}
              <p className="mt-1.5 text-[12px] leading-relaxed text-black/45">
                Shorten the run to fit the time you have. The cap is the {autoRounds} rounds this world generated.
              </p>
            </div>
          ) : (
            <p className="mt-2 text-[12px] leading-relaxed text-[#7b3fb5]">
              Need to adjust rounds? Switch to custom mode →
            </p>
          )}
        </div>
      </StepCard>
    </div>
  );
}

function StepSimulation({ world, round, total }: { world: ConsoleWorld; round: number; total: number }) {
  const acts = (p: PlatformKey) =>
    world.rounds.slice(0, round + 1).reduce((n, r) => n + r.posts.filter((x) => x.platform === p).length, 0);
  const byPlatform = (p: PlatformKey) =>
    world.rounds.slice(0, round + 1).flatMap((r) => r.posts.filter((x) => x.platform === p).map((post) => ({ post, r: r.round })));
  const name = (id: string) => world.agents.find((a) => a.id === id);

  return (
    <div className="flex flex-col">
      <div className="grid grid-cols-2 gap-3 border-b border-black/10 bg-white p-4">
        {(["plaza", "community"] as PlatformKey[]).map((p) => (
          <div key={p} className="rounded-lg border border-black/10 px-4 py-3">
            <div className="flex items-center gap-2 font-mono text-[12px] font-semibold uppercase tracking-wider text-black/70">
              {p === "plaza" ? <Globe className="h-4 w-4" /> : <MessagesSquare className="h-4 w-4" />}
              {p === "plaza" ? "Info Plaza" : "Topic Community"}
            </div>
            {/* Elapsed simulated time, not just the round index — the run is configured
                in hours, so a viewer needs the clock to connect the two. */}
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[11px] text-black/45">
              <span>
                ROUND <span className="text-black">{round + 1}</span>/{total}
              </span>
              <span>
                ELAPSED <span className="text-black">{(round + 1) * HOURS_PER_ROUND}h</span> 0m
              </span>
              <span>
                ACTS <span className="text-black">{acts(p)}</span>
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-b border-black/10 bg-white px-4 py-2 font-mono text-[12px] text-black/50">
        <span>
          TOTAL EVENTS: <span className="text-black">{acts("plaza") + acts("community")}</span>
        </span>
        {/* Per-platform split. The headline totals hide that the two platforms carry very
            different volumes, which is one of the things a dual-platform run exists to show. */}
        <span className="flex items-center gap-1.5">
          <Globe className="h-3.5 w-3.5" /> <span className="text-black">{acts("plaza")}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <MessagesSquare className="h-3.5 w-3.5" /> <span className="text-black">{acts("community")}</span>
        </span>
        <span className="text-black/40">· {world.rounds[round]?.headline}</span>
      </div>

      <div data-testid="sim-feeds" className="grid grid-cols-2 gap-3 p-4">
        {(["plaza", "community"] as PlatformKey[]).map((p) => {
          // Posts from earlier rounds keep the same `key` on every re-render (the array
          // only ever grows by appending), so React leaves those DOM nodes alone and the
          // mount animation below plays only for genuinely new cards — the ones the
          // current round just added. A small per-card stagger inside that round is what
          // makes a batch of simultaneous posts read as arriving one at a time rather
          // than popping in as a block.
          let newInRound = 0;
          return (
            <div key={p} className="space-y-3">
              {byPlatform(p).map(({ post, r }, i) => {
                const a = name(post.agentId);
                const replied = post.replyTo ? name(post.replyTo) : undefined;
                const isNewest = r === round;
                const delayMs = isNewest ? newInRound++ * 70 : 0;
                return (
                  <div
                    key={`${post.agentId}-${r}-${i}`}
                    data-testid={`sim-post-${post.agentId}`}
                    className="topic-rise rounded-lg border border-black/10 bg-white p-4"
                    style={isNewest ? { animationDelay: `${delayMs}ms` } : undefined}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black text-[12px] font-bold text-white"
                        aria-hidden
                      >
                        {(a?.displayName ?? "?").slice(0, 1)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-black">
                        {a?.displayName ?? post.agentId}
                      </span>
                      {/* Action type alongside stance: what the agent *did* is a different
                          fact from where they stand, and the feed shows both. */}
                      <span className="shrink-0 rounded bg-black/[0.06] px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-black/55">
                        {post.replyTo ? "Reply" : "Post"}
                      </span>
                      <span className="shrink-0 rounded border border-black/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-black/45">
                        {post.stance}
                      </span>
                    </div>

                    {replied && (
                      <div className="mt-2 flex items-center gap-1.5 font-mono text-[11px] text-black/40">
                        <MessageCircle className="h-3 w-3" /> Replied to @{replied.displayName}
                      </div>
                    )}

                    <p className="mt-2 text-[14px] leading-relaxed text-black/85">{post.text}</p>
                    {/* Round, the simulated wall-clock at that round, then engagement —
                        the run is measured in hours, so a bare round number under-reads. */}
                    <div className="mt-2 text-right font-mono text-[11px] text-black/35">
                      R{r + 1} • {simClock(r)} · {post.engagement.toLocaleString("en-US")} acts
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StepReport({
  world,
  written,
  reportId,
  tab,
}: {
  world: ConsoleWorld;
  written: number;
  reportId: string;
  tab: Tab;
}) {
  const done = written >= world.report.sections.length;
  return (
    <div className={tab === "workbench" ? "grid grid-cols-1 xl:grid-cols-2" : ""}>
      <div className="border-b border-black/10 xl:border-b-0 xl:border-r">
        <ReportDocument report={world.report} written={written} reportId={reportId} />
      </div>

      {tab === "workbench" && (
        <div className="p-5">
          <div className="rounded-lg border border-black/10 bg-white">
            <div className="flex items-center gap-2 border-b border-black/10 px-4 py-3">
              <span className="h-2 w-2 rounded-full bg-black" aria-hidden />
              <span className="font-mono text-[12px] font-semibold uppercase tracking-wider text-black/70">
                {world.report.sections[Math.min(written, world.report.sections.length - 1)]?.heading}
              </span>
              <span className="ml-auto rounded bg-black px-2 py-0.5 font-mono text-[11px] text-white">
                Section {Math.min(written + (done ? 0 : 1), world.report.sections.length)}/{world.report.sections.length}
              </span>
            </div>

            <div className="border-b border-black/10 px-4 py-2.5">
              <span className="rounded bg-[#eaf2fb] px-2.5 py-1 text-[12px] font-medium text-[#2c5f9e]">
                Active Memories ({world.report.memories.length})
              </span>
              <span className="ml-2 px-2.5 py-1 text-[12px] text-black/45">
                Involved Entities ({world.ontology.nodes.length})
              </span>
            </div>

            <ol data-testid="report-memories" className="space-y-2 p-4">
              {world.report.memories.map((m, i) => (
                <li key={i} className="flex gap-3 rounded-lg bg-black/[0.03] p-3">
                  <span className="font-mono text-[11px] text-black/35">{i + 1}</span>
                  <span className="text-[13px] leading-relaxed text-black/75">{m}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

