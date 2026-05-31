import { TrendingDown, TrendingUp } from "lucide-react";
import type { MarketQuote } from "@/lib/danantara/types";
import { cn } from "@/lib/utils";

/** Tiny inline sparkline; green when the series ends above where it started. */
function Spark({ points }: { points: number[] }) {
  const w = 64;
  const h = 22;
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const up = points[points.length - 1] >= points[0];
  const stroke = up ? "oklch(0.72 0.16 155)" : "oklch(0.62 0.22 25)";
  const d = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((p - min) / span) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} className="shrink-0 overflow-visible" aria-hidden>
      <path d={d} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle
        cx={w}
        cy={h - ((points[points.length - 1] - min) / span) * h}
        r={1.8}
        fill={stroke}
      />
    </svg>
  );
}

/** Markets & macro board — public market data, finance semantics (up = green). */
export function MarketsBoard({ markets }: { markets: MarketQuote[] }) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {markets.map((m) => {
        const up = m.delta >= 0;
        return (
          <div
            key={m.key}
            className="flex items-center justify-between gap-2 rounded-md border border-border/50 bg-background/40 px-2.5 py-2"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1 truncate text-[10px] text-muted-foreground">
                {m.label}
                {m.live && (
                  <span className="inline-flex items-center gap-0.5 rounded-full border border-success/40 bg-success/10 px-1 text-[8px] font-bold uppercase text-success">
                    <span className="h-1 w-1 animate-pulse rounded-full bg-success" />
                    live
                  </span>
                )}
              </div>
              <div className="truncate text-[14px] font-extrabold tabular-nums text-foreground">
                {m.value}
                {m.unit && <span className="ml-0.5 text-[10px] font-medium text-muted-foreground">{m.unit}</span>}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Spark points={m.spark} />
              <span className={cn("flex items-center gap-0.5 text-[11px] font-bold tabular-nums", up ? "text-success" : "text-destructive")}>
                {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {up ? "+" : ""}
                {m.delta}%
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
