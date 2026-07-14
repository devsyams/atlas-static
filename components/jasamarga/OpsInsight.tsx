import { Activity, Zap } from "lucide-react";
import type { ConditionChip, OpsInsight as OpsInsightData } from "@/lib/jasamarga/types";
import { loadColor } from "@/lib/jasamarga/ui";

function withAlpha(oklch: string, a: number): string {
  return oklch.replace(/\)\s*$/, ` / ${a})`);
}

const TONE: Record<ConditionChip["tone"], string> = {
  good: "border-success/40 text-success",
  warn: "border-warning/40 text-warning",
  bad: "border-destructive/40 text-destructive",
};

/** AI Ops Insight — severity-tinted headline + recommended action + live conditions. */
export function OpsInsight({
  insight,
  conditions,
  loadIndex,
  level,
  aiSource = "scripted",
}: {
  insight: OpsInsightData;
  conditions: ConditionChip[];
  loadIndex: number;
  level: string;
  /** Where the words came from — the badge must never claim an LLM wrote template text. */
  aiSource?: "llm" | "scripted";
}) {
  const accent = loadColor(loadIndex);
  const live = aiSource === "llm";

  return (
    <div className="relative h-full p-3.5 pl-4">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(130% 110% at 0% 0%, ${withAlpha(accent, 0.16)}, transparent 58%)` }}
      />
      <div
        className="pointer-events-none absolute left-0 top-0 h-full w-[3px]"
        style={{ background: accent, boxShadow: `0 0 16px ${withAlpha(accent, 0.9)}` }}
      />

      <div className="relative z-[1] flex h-full flex-col">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70" style={{ background: accent }} />
              <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: accent }} />
            </span>
            <span className="text-gradient text-[10px] font-bold uppercase tracking-[0.18em]">Analisis Nexorus AI</span>
            <span
              className={`text-[9px] font-bold uppercase tracking-wide ${live ? "text-success" : "text-muted-foreground"}`}
            >
              {live ? "● Nexorus AI · LLM" : "Simulasi"}
            </span>
          </span>
          <span
            className="inline-flex items-center gap-1 rounded-full border border-current/30 bg-current/10 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide"
            style={{ color: accent }}
          >
            <Activity className="h-3 w-3" /> {level}
          </span>
        </div>

        <h3 className="mt-2.5 text-lg font-extrabold leading-[1.15] text-foreground sm:text-xl">{insight.title}</h3>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{insight.text}</p>

        {insight.action && (
          <div className="mt-3 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
              <Zap className="h-3.5 w-3.5" /> Rekayasa Disarankan
            </div>
            <p className="mt-1 text-[12.5px] font-medium leading-relaxed text-foreground/90">{insight.action}</p>
          </div>
        )}

        {conditions.length > 0 && (
          <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
            {conditions.map((c) => (
              <span
                key={c.label}
                className={`rounded-full border bg-background/40 px-2 py-0.5 text-[10px] font-semibold ${TONE[c.tone]}`}
              >
                {c.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
