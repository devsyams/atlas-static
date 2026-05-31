import { ArrowRight, Minus, TrendingDown, TrendingUp, Zap } from "lucide-react";
import type { TravelTime } from "@/lib/jasamarga/types";
import { cn } from "@/lib/utils";

function fmtMin(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return h > 0 ? `${h}j ${min}m` : `${min}m`;
}

function delayColor(extra: number): string {
  if (extra >= 45) return "text-destructive";
  if (extra >= 15) return "text-warning";
  if (extra <= 0) return "text-success";
  return "text-foreground/80";
}

/** Live travel-time board (departures-board style) from routing/traffic APIs. */
export function TravelTimeBoard({ routes }: { routes: TravelTime[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      {routes.map((r, i) => {
        const extra = r.minutes - r.normal_minutes;
        const Trend = r.trend === "up" ? TrendingUp : r.trend === "down" ? TrendingDown : Minus;
        const trendCls = r.trend === "up" ? "text-destructive" : r.trend === "down" ? "text-success" : "text-muted-foreground";
        return (
          <div
            key={`${r.route}-${i}`}
            className={cn("rounded-lg border bg-background/40 px-2.5 py-2", r.best ? "border-success/40" : "border-border/50")}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1 text-[11px] font-semibold leading-tight">
                  <span className="truncate">{r.route}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-1 text-[9.5px] text-muted-foreground">
                  <ArrowRight className="h-2.5 w-2.5" /> {r.via}
                  {r.best && (
                    <span className="ml-1 inline-flex items-center gap-0.5 rounded-full border border-success/40 bg-success/10 px-1 py-0 font-bold text-success">
                      <Zap className="h-2.5 w-2.5" /> tercepat
                    </span>
                  )}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-mono text-sm font-extrabold tabular-nums leading-none">{fmtMin(r.minutes)}</div>
                <div className={cn("mt-0.5 flex items-center justify-end gap-0.5 text-[10px] font-bold tabular-nums", delayColor(extra))}>
                  <Trend className={cn("h-3 w-3", trendCls)} />
                  {extra > 0 ? `+${fmtMin(extra)}` : extra < 0 ? `−${fmtMin(-extra)}` : "normal"}
                </div>
              </div>
            </div>
          </div>
        );
      })}
      <div className="mt-0.5 text-center text-[9.5px] text-muted-foreground/70">
        Sumber: routing/traffic API · dibanding waktu tempuh tipikal
      </div>
    </div>
  );
}
