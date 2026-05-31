import { AlertTriangle, ArrowRight, Flame, TrendingUp } from "lucide-react";
import type { CrisisSignal } from "@/lib/danantara/types";
import { toneColor } from "@/lib/danantara/ui";
import { cn } from "@/lib/utils";

const STATUS_CHIP: Record<CrisisSignal["status"], string> = {
  Muncul: "border-primary/40 bg-primary/10 text-primary",
  Naik: "border-warning/40 bg-warning/10 text-warning",
  Memuncak: "border-destructive/40 bg-destructive/10 text-destructive",
  Mereda: "border-success/40 bg-success/10 text-success",
};

/** Reputational crisis early-warning — emerging negative signals, ranked by severity. */
export function CrisisWatch({ signals, onImpact }: { signals: CrisisSignal[]; onImpact?: (eventId: string) => void }) {
  const sorted = [...signals].sort((a, b) => b.severity - a.severity);
  return (
    <div className="space-y-2">
      {sorted.map((s) => {
        const col = toneColor(s.severity);
        return (
          <div key={s.id} className="rounded-lg border border-border/50 bg-background/40 p-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-start gap-2">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md" style={{ background: `color-mix(in oklab, ${col} 20%, transparent)`, color: col }}>
                  {s.severity >= 6 ? <Flame className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="rounded border border-border/60 bg-muted/30 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-muted-foreground">{s.entity}</span>
                    <span className={cn("rounded-full border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide", STATUS_CHIP[s.status])}>{s.status}</span>
                  </div>
                  <div className="mt-1 text-[12px] font-semibold leading-snug">{s.title}</div>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[15px] font-extrabold leading-none tabular-nums" style={{ color: col }}>
                  {s.severity.toFixed(1)}
                </div>
                <div className="flex items-center justify-end gap-0.5 text-[9px] font-bold text-destructive">
                  <TrendingUp className="h-2.5 w-2.5" />+{s.velocity}%
                </div>
              </div>
            </div>
            <p className="mt-1.5 text-[10.5px] leading-snug text-muted-foreground">{s.detail}</p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="text-[9px] text-muted-foreground/70">{s.source} · {s.time}</span>
              {s.event_id && onImpact && (
                <button
                  type="button"
                  onClick={() => onImpact(s.event_id!)}
                  className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary transition-colors hover:bg-primary/20"
                >
                  Lihat dampak <ArrowRight className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
