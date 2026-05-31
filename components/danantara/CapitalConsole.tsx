"use client";

import { useState } from "react";
import { ArrowRight, Check, Sparkles, TrendingUp } from "lucide-react";
import type { CapitalMove } from "@/lib/danantara/types";
import { fmtT, riskColor, SECTOR_SHORT } from "@/lib/danantara/ui";
import { cn } from "@/lib/utils";

/**
 * Capital-allocation decision-support. The AI proposes deployments with a thesis,
 * projected return, horizon and risk; "Setujui" stages it to the committee
 * (demo: local toast). Mirrors the JasaMarga Traffic Console gimmick.
 */
export function CapitalConsole({
  allocations,
  onApprove,
}: {
  allocations: CapitalMove[];
  onApprove: (m: CapitalMove) => void;
}) {
  const [approved, setApproved] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      {allocations.map((m) => {
        const isApproved = approved === m.id;
        return (
          <div
            key={m.id}
            className={cn(
              "rounded-lg border bg-background/40 p-2.5 transition-colors",
              m.recommended ? "border-primary/40" : "border-border/50",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  {m.recommended && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gradient-accent px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-primary-foreground">
                      <Sparkles className="h-2.5 w-2.5" /> Disarankan
                    </span>
                  )}
                  <span className="rounded border border-border/60 bg-muted/30 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {SECTOR_SHORT[m.sector]}
                  </span>
                </div>
                <h4 className="mt-1 text-[13px] font-bold leading-tight text-foreground">{m.title}</h4>
              </div>
              <div className="shrink-0 text-right">
                <div className="flex items-center gap-0.5 text-[15px] font-extrabold leading-none text-success">
                  <TrendingUp className="h-3.5 w-3.5" />
                  {m.return_pct}%
                </div>
                <div className="mt-0.5 text-[8px] uppercase tracking-wide text-muted-foreground">proy. imbal hasil</div>
              </div>
            </div>

            <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{m.thesis}</p>

            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span>
                  Modal <span className="font-bold text-foreground">{fmtT(m.capital_t)}</span>
                </span>
                <span>
                  Horizon <span className="font-bold text-foreground">{m.horizon}</span>
                </span>
                <span>
                  Risiko <span className={cn("font-bold", riskColor(m.risk))}>{m.risk}</span>
                </span>
              </div>
              <button
                type="button"
                disabled={isApproved}
                onClick={() => {
                  setApproved(m.id);
                  onApprove(m);
                }}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1 text-[10px] font-bold transition-colors",
                  isApproved
                    ? "border border-success/40 bg-success/10 text-success"
                    : "border border-primary/40 bg-primary/15 text-primary hover:bg-primary/25",
                )}
              >
                {isApproved ? (
                  <>
                    <Check className="h-3 w-3" /> Diteruskan
                  </>
                ) : (
                  <>
                    Setujui <ArrowRight className="h-3 w-3" />
                  </>
                )}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
