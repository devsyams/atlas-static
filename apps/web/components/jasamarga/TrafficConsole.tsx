"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Cpu, Play, Sparkles, TrafficCone } from "lucide-react";
import type { Intervention } from "@/lib/jasamarga/types";
import { riskColor } from "@/lib/jasamarga/ui";
import { cn } from "@/lib/utils";

type Phase = "idle" | "simulating" | "simulated" | "applied";

/**
 * Traffic Engineering Console — the signature gimmick. The AI recommends a
 * "rekayasa lalu lintas", simulates its projected impact, and lets the operator
 * apply it. (Demo: apply is a visual confirmation, not a real control action.)
 */
export function TrafficConsole({
  interventions,
  onApply,
}: {
  interventions: Intervention[];
  onApply?: (i: Intervention) => void;
}) {
  const recommended = interventions.find((i) => i.recommended) ?? interventions[0];
  const [selectedId, setSelectedId] = useState(recommended?.id ?? "");
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);

  const selected = interventions.find((i) => i.id === selectedId) ?? recommended;

  // Reset the flow whenever a different option is chosen.
  useEffect(() => {
    setPhase("idle");
    setProgress(0);
  }, [selectedId]);

  useEffect(() => {
    if (phase !== "simulating") return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 1600);
      setProgress(Math.round(t * 100));
      if (t < 1) raf = requestAnimationFrame(tick);
      else setPhase("simulated");
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  if (!selected) {
    return <div className="py-6 text-center text-[12px] text-muted-foreground">Tidak ada opsi rekayasa.</div>;
  }

  const apply = () => {
    setPhase("applied");
    onApply?.(selected);
  };

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex shrink-0 items-center justify-between text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <TrafficCone className="h-3.5 w-3.5 text-primary" /> Konsol Rekayasa Lalu Lintas
        </span>
        <span className="text-gradient font-bold">Nexorus AI</span>
      </div>

      {/* Option chips */}
      <div className="flex shrink-0 flex-wrap gap-1.5">
        {interventions.map((i) => (
          <button
            key={i.id}
            type="button"
            onClick={() => setSelectedId(i.id)}
            className={cn(
              "rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors",
              i.id === selectedId
                ? "border-primary/50 bg-primary/15 text-primary"
                : "border-border/60 bg-background/40 text-muted-foreground hover:text-foreground",
            )}
          >
            {i.recommended && <Sparkles className="mr-1 inline h-2.5 w-2.5" />}
            {i.title}
          </button>
        ))}
      </div>

      {/* Selected detail */}
      <div className="min-h-0 flex-1 rounded-lg border border-border/60 bg-background/40 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-bold">{selected.title}</div>
          {selected.recommended && (
            <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
              Disarankan AI
            </span>
          )}
        </div>
        <div className="mt-0.5 text-[10px] text-muted-foreground">{selected.segment}</div>
        <div className="mt-1.5">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold",
              selected.officially_announced
                ? "border-success/40 bg-success/10 text-success"
                : "border-muted-foreground/30 bg-background/40 text-muted-foreground",
            )}
          >
            {selected.officially_announced ? "✓ Sudah diumumkan @PTJASAMARGA" : "Belum diumumkan resmi"}
          </span>
        </div>
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-foreground/80">{selected.rationale}</p>

        {/* Projected impact */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Metric label="Waktu tempuh" value={`${selected.impact_time_pct}%`} good />
          <Metric label="Antrean urai" value={`~${selected.impact_clear_min}m`} good />
          <Metric label="Risiko" value={selected.risk} className={riskColor(selected.risk)} />
        </div>

        {/* Flow */}
        <div className="mt-3">
          {phase === "idle" && (
            <button
              type="button"
              onClick={() => setPhase("simulating")}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-primary/40 bg-gradient-accent px-3 py-2 text-[12px] font-bold text-primary-foreground transition-transform hover:scale-[1.01]"
            >
              <Cpu className="h-3.5 w-3.5" /> Simulasikan dampak
            </button>
          )}

          {phase === "simulating" && (
            <div>
              <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Cpu className="h-3 w-3 animate-pulse text-primary" /> Mensimulasikan aliran lalu lintas…
                </span>
                <span className="tabular-nums">{progress}%</span>
              </div>
              <div className="relative h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-accent transition-[width]" style={{ width: `${progress}%` }} />
                <span className="syn-shimmer absolute top-0 left-0 h-full w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent" />
              </div>
            </div>
          )}

          {phase === "simulated" && (
            <button
              type="button"
              onClick={apply}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-success/50 bg-success/15 px-3 py-2 text-[12px] font-bold text-success transition-transform hover:scale-[1.01]"
            >
              <Play className="h-3.5 w-3.5" /> Teruskan rekomendasi ke JMTC
            </button>
          )}

          {phase === "applied" && (
            <div className="flex items-center gap-2 rounded-md border border-success/50 bg-success/10 px-3 py-2 text-[12px] font-bold text-success">
              <CheckCircle2 className="h-4 w-4" />
              <span>Rekomendasi diteruskan ke JMTC · memantau dampak…</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, good, className }: { label: string; value: string; good?: boolean; className?: string }) {
  return (
    <div className="rounded-md border border-border/50 bg-card/40 px-2 py-1.5 text-center">
      <div className={cn("text-sm font-extrabold leading-none", good ? "text-success" : "", className)}>{value}</div>
      <div className="mt-1 text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}
