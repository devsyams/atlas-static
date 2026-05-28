import { CheckCircle2, ShieldAlert } from "lucide-react";
import type { SpmMetric } from "@/lib/jasamarga/types";
import { cn } from "@/lib/utils";

function barColor(compliance: number, ok: boolean): string {
  if (!ok) return "var(--destructive)";
  if (compliance < 95) return "var(--warning)";
  return "var(--success)";
}

/**
 * SPM (Standar Pelayanan Minimal) compliance — the BPJT-regulated scorecard.
 * Breaches surface in red because they are concession/penalty risk.
 */
export function SpmBoard({ metrics, overall }: { metrics: SpmMetric[]; overall: number }) {
  const breaches = metrics.filter((m) => !m.ok).length;

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex shrink-0 items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Standar Pelayanan Minimal · BPJT</span>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold",
            breaches ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-success/40 bg-success/10 text-success",
          )}
        >
          {breaches ? <ShieldAlert className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
          {breaches ? `${breaches} parameter di bawah standar` : "Patuh penuh"}
        </span>
      </div>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-auto scrollbar-thin pr-1">
        {metrics.map((m) => (
          <div key={m.category} className="rounded-lg border border-border/50 bg-background/40 px-2.5 py-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[11px] font-semibold">{m.category}</span>
              <span className={cn("shrink-0 text-[11px] font-extrabold tabular-nums", m.ok ? "text-foreground" : "text-destructive")}>
                {m.value}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full" style={{ width: `${m.compliance}%`, background: barColor(m.compliance, m.ok) }} />
              </div>
              <span className="w-9 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">{m.compliance}%</span>
            </div>
            <div className="mt-0.5 text-[9.5px] text-muted-foreground/80">Standar: {m.standard}</div>
          </div>
        ))}
      </div>

      <div className="mt-2 shrink-0 border-t border-border/40 pt-2 text-center text-[11px]">
        <span className="text-muted-foreground">Kepatuhan keseluruhan </span>
        <span className="font-extrabold text-foreground">{overall}%</span>
      </div>
    </div>
  );
}
