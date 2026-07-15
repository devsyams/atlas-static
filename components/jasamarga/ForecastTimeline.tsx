import { TrendingUp } from "lucide-react";
import type { ForecastHour } from "@/lib/jasamarga/types";
import { loadColor, loadLevel } from "@/lib/jasamarga/ui";
import { cn } from "@/lib/utils";

/**
 * 6-hour congestion projection. LLM-generated from current state + BMKG's
 * forward weather signals when live (A12 v6.0); falls back to the
 * deterministic curve otherwise. `source` badges which one is on screen —
 * the same live/demo honesty convention as `OpsInsight` (AC21).
 */
export function ForecastTimeline({ hours, source }: { hours: ForecastHour[]; source?: "llm" | "scripted" }) {
  if (!hours.length) {
    return <div className="py-6 text-center text-[12px] text-muted-foreground">Proyeksi belum tersedia.</div>;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-1 flex shrink-0 items-center justify-between text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> Proyeksi 6 jam ke depan
          {source && (
            <span
              className={cn(
                "normal-case tracking-normal text-[9px] font-bold",
                source === "llm" ? "text-success" : "text-muted-foreground",
              )}
            >
              {source === "llm" ? "● Nexorus AI · LLM" : "Simulasi"}
            </span>
          )}
        </span>
        <span className="text-muted-foreground/70 normal-case tracking-normal">
          {source === "llm" ? "Proyeksi AI: beban terkini + prakiraan cuaca BMKG" : "Estimasi tren beban (non-kalibrasi)"}
        </span>
      </div>

      <div className="relative min-h-0 flex-1">
        {/* "ambang macet" gridline at load 5 */}
        <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-border/60">
          <span className="absolute -top-2 right-0 bg-card/60 px-1 text-[8px] text-muted-foreground/70">ambang macet</span>
        </div>

        <div className="flex h-full items-end gap-2">
          {hours.map((h) => {
            const color = loadColor(h.load);
            const { label: lvl } = loadLevel(h.load);
            return (
              <div key={h.hour} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                {h.label && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide",
                      h.label === "Puncak" ? "bg-destructive/20 text-destructive" : "bg-primary/20 text-primary",
                    )}
                  >
                    {h.label}
                  </span>
                )}
                <span className="text-[10px] font-extrabold tabular-nums" style={{ color }}>
                  {h.load.toFixed(1)}
                </span>
                <div
                  className="w-full max-w-[34px] rounded-t-md transition-[height]"
                  style={{ height: `${Math.max(6, (h.load / 10) * 100)}%`, background: color }}
                  title={`${h.hour} · ${lvl}`}
                />
                <span className="text-[9px] tabular-nums text-muted-foreground">{h.hour}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
