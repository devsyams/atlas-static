"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Check, Globe, Landmark, Layers, Lightbulb, Sparkles, TriangleAlert, Waypoints } from "lucide-react";
import { ProbabilityMeter } from "@/components/crisis/ProbabilityMeter";
import type { Holding } from "@/lib/danantara/types";
import { type ImpactEvent, simulateCombined, simulateImpact } from "@/lib/danantara/impact";
import { changeColor, fmtT, withAlpha } from "@/lib/danantara/ui";
import { cn } from "@/lib/utils";

const KIND_META = {
  makro: { label: "Makro", Icon: Globe, cls: "text-primary" },
  isu: { label: "Isu", Icon: TriangleAlert, cls: "text-warning" },
  entitas: { label: "Entitas", Icon: Activity, cls: "text-accent-foreground" },
} as const;

export function ImpactLab({
  holdings,
  aum,
  events,
  eventId,
  onSelectEvent,
}: {
  holdings: Holding[];
  aum: number;
  events: ImpactEvent[];
  eventId: string;
  onSelectEvent: (id: string) => void;
}) {
  const [mode, setMode] = useState<"single" | "multi">("single");
  const [multi, setMulti] = useState<Set<string>>(() => new Set([eventId]));
  const [computing, setComputing] = useState(false);
  const [typedHeadline, setTypedHeadline] = useState("");
  // A slightly longer simulation on the first run per session; refresh → snappy.
  const firstRunRef = useRef(typeof window !== "undefined" ? sessionStorage.getItem("dn_impact_ran") !== "1" : false);

  // External selection (e.g. "Lihat dampak" from the crisis watch) jumps to single.
  useEffect(() => {
    setMode("single");
  }, [eventId]);

  const event = events.find((e) => e.id === eventId) ?? events[0];
  const multiEvents = useMemo(() => events.filter((e) => multi.has(e.id)), [events, multi]);

  const result = useMemo(
    () => (mode === "single" ? simulateImpact(event, holdings, aum) : simulateCombined(multiEvents, holdings, aum)),
    [mode, event, multiEvents, holdings, aum],
  );
  const maxAbs = Math.max(5, ...result.entities.map((e) => Math.abs(e.impact_pct)));

  // Monte-Carlo "simulating" animation whenever the scenario changes. The first
  // run per session runs a touch longer (cold engine); later runs are snappy.
  const sig = mode === "single" ? event.id : [...multi].sort().join(",");
  useEffect(() => {
    const isFirst = firstRunRef.current;
    setComputing(true);
    const t = setTimeout(
      () => {
        setComputing(false);
        firstRunRef.current = false;
        if (isFirst) {
          try {
            sessionStorage.setItem("dn_impact_ran", "1");
          } catch {
            /* ignore */
          }
        }
      },
      isFirst ? 2000 : 1300,
    );
    return () => clearTimeout(t);
  }, [sig, mode]);

  // Typewriter the AI insight headline once computing completes.
  useEffect(() => {
    if (computing) {
      setTypedHeadline("");
      return;
    }
    const full = result.insight.headline;
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setTypedHeadline(full.slice(0, i));
      if (i >= full.length) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [computing, result.insight.headline]);

  const toggleMulti = (id: string) =>
    setMulti((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="flex h-full flex-col gap-2 lg:flex-row">
      {/* Event selector rail */}
      <div className="flex shrink-0 flex-col gap-1.5 lg:w-52">
        {/* mode toggle */}
        <div className="flex shrink-0 items-center gap-1 rounded-md border border-border/60 bg-background/40 p-0.5 text-[10px] font-bold">
          {([
            { id: "single", label: "Tunggal", Icon: Waypoints },
            { id: "multi", label: "Multi-faktor", Icon: Layers },
          ] as const).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={cn(
                "inline-flex flex-1 items-center justify-center gap-1 rounded px-1.5 py-1 transition-colors",
                mode === m.id ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <m.Icon className="h-3 w-3" /> {m.label}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between px-1 text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
          <span>{mode === "single" ? "Pilih peristiwa" : `Gabungkan (${multi.size})`}</span>
          {mode === "multi" && multi.size > 0 && (
            <button type="button" onClick={() => setMulti(new Set())} className="text-[9px] normal-case text-primary hover:underline">
              bersihkan
            </button>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto scrollbar-thin">
          {events.map((e) => {
            const km = KIND_META[e.kind];
            const active = mode === "single" ? e.id === event.id : multi.has(e.id);
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => (mode === "single" ? onSelectEvent(e.id) : toggleMulti(e.id))}
                className={cn(
                  "shrink-0 rounded-md border px-2.5 py-1.5 text-left transition-colors",
                  active ? "border-primary/50 bg-primary/15" : "border-border/50 bg-background/30 hover:border-primary/30 hover:bg-sidebar-accent",
                )}
              >
                <div className="flex items-center gap-1">
                  {mode === "multi" && (
                    <span className={cn("flex h-3 w-3 items-center justify-center rounded-sm border", active ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
                      {active && <Check className="h-2.5 w-2.5" />}
                    </span>
                  )}
                  <km.Icon className={cn("h-3 w-3 shrink-0", km.cls)} />
                  <span className={cn("text-[8px] font-bold uppercase tracking-wide", km.cls)}>{km.label}</span>
                </div>
                <div className={cn("mt-0.5 text-[11px] font-semibold leading-tight", active ? "text-foreground" : "text-muted-foreground")}>{e.label}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Results */}
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        {/* Aggregate header */}
        <div className="grid shrink-0 grid-cols-3 gap-2">
          <Agg icon={Landmark} label="Dampak NAV" value={`${result.nav_impact_t >= 0 ? "+" : "−"}${fmtT(Math.abs(result.nav_impact_t))}`} sub={`${result.nav_impact_pct >= 0 ? "+" : ""}${result.nav_impact_pct}%`} color={changeColor(result.nav_impact_pct)} />
          <Agg icon={TriangleAlert} label="Dampak Reputasi" value={`${result.reputation_impact >= 0 ? "+" : ""}${result.reputation_impact}`} sub="poin indeks" color={changeColor(result.reputation_impact)} />
          <Agg icon={Sparkles} label="Keyakinan AI" value={`${Math.round(result.avg_confidence * 100)}%`} sub="rata-rata kanal" />
        </div>

        {/* Active scenario(s) line */}
        {mode === "multi" && (
          <div className="shrink-0 rounded-md border border-primary/25 bg-primary/5 px-2.5 py-1 text-[10px] text-muted-foreground">
            <span className="font-bold text-primary">Skenario gabungan:</span> {result.event.detail}
          </div>
        )}

        {/* Transmission bars */}
        <div className="relative min-h-0 flex-1 overflow-auto scrollbar-thin rounded-md border border-border/40 bg-background/20 p-2">
          {computing && (
            <ComputingOverlay
              targetPct={result.entities[0]?.impact_pct ?? result.nav_impact_pct}
              label={result.entities[0]?.short ?? "NAV"}
              confidence={result.avg_confidence}
            />
          )}
          <div className="mb-1 px-1 text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Transmisi ke harga · {result.entities.length} entitas terdampak
          </div>
          {result.entities.length === 0 ? (
            <div className="flex h-full min-h-[80px] items-center justify-center text-[11px] text-muted-foreground">Pilih minimal satu peristiwa.</div>
          ) : (
            <div key={result.event.id} className="space-y-1">
              {result.entities.map((e, i) => {
                const col = changeColor(e.impact_pct);
                const w = (Math.abs(e.impact_pct) / maxAbs) * 42;
                const neg = e.impact_pct < 0;
                return (
                  <div key={e.id} className="dn-settle group flex items-center gap-2" style={{ animationDelay: `${Math.min(i * 28, 320)}ms` }} title={e.channel}>
                    <span className="w-16 shrink-0 truncate text-right text-[10px] font-bold">{e.short}</span>
                    <div className="relative h-4 flex-1">
                      <div className="absolute inset-y-0 left-1/2 w-px bg-border/70" />
                      <div
                        className="absolute top-1/2 h-3 -translate-y-1/2 rounded-sm transition-[width,left] duration-500"
                        style={{ background: withAlpha(col, 0.85), width: `${w}%`, left: neg ? `${50 - w}%` : "50%" }}
                      />
                      <span
                        className="absolute top-1/2 -translate-y-1/2 text-[9px] font-bold tabular-nums"
                        style={{ color: col, [neg ? "right" : "left"]: `calc(50% + ${w}% + 4px)` } as React.CSSProperties}
                      >
                        {e.impact_pct >= 0 ? "+" : ""}
                        {e.impact_pct}%
                      </span>
                    </div>
                    <span className="hidden w-40 shrink-0 truncate text-[9px] text-muted-foreground xl:block">{e.channel}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Insight + prediction */}
        <div className="grid shrink-0 gap-2 lg:grid-cols-2">
          <div className="rounded-lg border border-primary/30 bg-primary/10 p-2.5">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-primary">
              <Lightbulb className="h-3.5 w-3.5" /> Insight Nexorus AI
            </div>
            <div className="mt-1 text-[12px] font-bold leading-snug text-foreground">
              {computing ? <span className="text-muted-foreground">menganalisis…</span> : typedHeadline}
              {!computing && typedHeadline.length < result.insight.headline.length && <span className="dn-caret text-primary" />}
            </div>
            <p className="mt-1 text-[10.5px] leading-snug text-muted-foreground">{result.insight.text}</p>
            <div className="mt-1.5 border-t border-primary/20 pt-1.5 text-[10.5px] font-medium leading-snug text-foreground/90">➜ {result.insight.action}</div>
          </div>
          <ProbabilityMeter prediction={result.prediction} />
        </div>
      </div>
    </div>
  );
}

/**
 * Monte-Carlo "simulating" overlay — fans out hundreds of random price paths from
 * the event, then converges them toward the projected outcome with a confidence
 * cone, while a counter ticks through "scenarios". Canvas-rendered for smoothness.
 */
function ComputingOverlay({ targetPct, label, confidence }: { targetPct: number; label: string; confidence: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [count, setCount] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.parentElement?.clientWidth ?? 460;
    const H = 168;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const PATHS = 140;
    const STEPS = 56;
    const midY = H / 2;
    const up = targetPct >= 0;
    const targetY = midY - (Math.max(-9, Math.min(9, targetPct)) / 9) * (H * 0.36);
    const baseCol = up ? "0.72 0.16 155" : "0.62 0.22 25";

    // Pre-roll random walks that drift to (and tighten around) the target.
    const paths: number[][] = Array.from({ length: PATHS }, () => {
      const endJ = (Math.random() * 2 - 1) * H * 0.14;
      const pts: number[] = [midY];
      let y = midY;
      const drift = (targetY - midY) / STEPS;
      for (let s = 1; s <= STEPS; s++) {
        const f = s / STEPS;
        y += drift + (Math.random() * 2 - 1) * H * 0.05 * (1 - f * 0.7);
        pts.push(y);
      }
      pts[STEPS] = targetY + endJ * 0.5;
      return pts;
    });

    let raf = 0;
    const start = performance.now();
    const dur = reduce ? 0 : 1150;

    const render = (t: number) => {
      ctx.clearRect(0, 0, W, H);
      // zero baseline
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = "oklch(0.55 0.02 250 / 0.4)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, midY);
      ctx.lineTo(W, midY);
      ctx.stroke();
      ctx.setLineDash([]);

      const reveal = Math.max(1, Math.floor(t * STEPS));
      const fade = 0.05 + 0.05 * (1 - t); // paths thin out as they converge
      for (let p = 0; p < PATHS; p++) {
        const pts = paths[p];
        ctx.beginPath();
        for (let s = 0; s <= reveal; s++) ctx[s === 0 ? "moveTo" : "lineTo"]((s / STEPS) * W, pts[s]);
        ctx.strokeStyle = `oklch(${baseCol} / ${fade})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // median line emphasised as it converges
      ctx.beginPath();
      for (let s = 0; s <= reveal; s++) {
        let sum = 0;
        for (let p = 0; p < PATHS; p++) sum += paths[p][s];
        const my = sum / PATHS;
        ctx[s === 0 ? "moveTo" : "lineTo"]((s / STEPS) * W, my);
      }
      ctx.strokeStyle = `oklch(${baseCol} / ${0.4 + 0.55 * t})`;
      ctx.lineWidth = 2.2;
      ctx.stroke();

      // endpoint marker on settle
      if (t > 0.8) {
        ctx.beginPath();
        ctx.arc(W - 3, targetY, 3.4, 0, 2 * Math.PI);
        ctx.fillStyle = `oklch(${baseCol})`;
        ctx.fill();
      }
      setCount(Math.round(t * 10000));
    };

    if (dur === 0) {
      render(1);
      setDone(true);
      return;
    }
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      render(t);
      if (t < 1) raf = requestAnimationFrame(tick);
      else setDone(true);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [targetPct]);

  const col = changeColor(targetPct);

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 overflow-hidden bg-background/88 px-4 backdrop-blur-sm">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
        <Waypoints className="h-3 w-3 text-primary" />
        <span className="text-gradient">Simulasi Monte Carlo</span>
      </div>
      <div className="relative w-full max-w-[520px]">
        <canvas ref={canvasRef} className="block w-full" />
      </div>
      <div className="font-mono text-[11px] tabular-nums text-muted-foreground">
        {done ? (
          <span>
            Proyeksi <span className="font-bold text-foreground">{label}</span>{" "}
            <span className="font-bold" style={{ color: col }}>
              {targetPct >= 0 ? "+" : ""}
              {targetPct}%
            </span>{" "}
            · keyakinan {Math.round(confidence * 100)}%
          </span>
        ) : (
          <span>
            Mensimulasikan <span className="font-bold text-foreground">{count.toLocaleString("id-ID")}</span> / 10.000 skenario…
          </span>
        )}
      </div>
    </div>
  );
}

function Agg({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: typeof Landmark;
  label: string;
  value: string;
  sub: string;
  color?: string;
}) {
  return (
    <div className="rounded-md border border-border/50 bg-background/40 px-2.5 py-1.5">
      <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
        <Icon className="h-3 w-3 text-primary" /> {label}
      </div>
      <div className="mt-0.5 text-[16px] font-extrabold leading-none tabular-nums" style={color ? { color } : undefined}>
        {value}
      </div>
      <div className="mt-0.5 text-[9px] text-muted-foreground">{sub}</div>
    </div>
  );
}
