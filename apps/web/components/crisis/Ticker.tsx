import { Activity, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { MarketTickerItem } from "@/lib/mbg/types";
import { cn } from "@/lib/utils";

function Delta({ delta }: { delta: number }) {
  const up = delta > 0;
  const down = delta < 0;
  const Icon = up ? TrendingUp : down ? TrendingDown : Minus;
  const cls = up ? "text-destructive" : down ? "text-success" : "text-muted-foreground";
  const pct = Math.abs(delta).toLocaleString("id-ID", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return (
    <span className={cn("inline-flex items-center gap-0.5 font-bold", cls)}>
      <Icon className="h-3 w-3" />
      {pct}%
    </span>
  );
}

function Cell({ item }: { item: MarketTickerItem }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-5 text-[11px]">
      <span className="font-semibold text-foreground/65">{item.label}</span>
      <span className="font-bold text-foreground">{item.value}</span>
      {typeof item.delta === "number" && <Delta delta={item.delta} />}
      <span className="pl-5 text-border" aria-hidden>
        •
      </span>
    </span>
  );
}

/** A continuously scrolling markets & food-prices strip (pauses on hover). */
export function Ticker({ items }: { items: MarketTickerItem[] }) {
  if (!items.length) return null;

  const Row = ({ hidden }: { hidden?: boolean }) => (
    <div className="flex shrink-0 items-center" aria-hidden={hidden}>
      {items.map((it, i) => (
        <Cell key={`${it.label}-${i}`} item={it} />
      ))}
    </div>
  );

  return (
    <div className="group sticky top-0 z-20 mb-4 flex items-stretch overflow-hidden rounded-md border border-border/50 bg-card/90 shadow-sm backdrop-blur-md">
      {/* fixed label */}
      <div className="z-10 flex shrink-0 items-center gap-1.5 border-r border-border/50 bg-card/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
        <Activity className="h-3.5 w-3.5" />
        Nexorus
      </div>

      {/* scrolling marquee */}
      <div className="relative flex-1 overflow-hidden py-1.5">
        <div className="ticker-track flex w-max group-hover:[animation-play-state:paused]">
          <Row />
          <Row hidden />
        </div>
        <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-card/70 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-card/70 to-transparent" />
      </div>
    </div>
  );
}
