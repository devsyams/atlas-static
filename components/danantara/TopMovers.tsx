import { TrendingDown, TrendingUp } from "lucide-react";
import type { Holding } from "@/lib/danantara/types";
import { changeColor, fmtT } from "@/lib/danantara/ui";
import { cn } from "@/lib/utils";

function Row({ h, onSelect }: { h: Holding; onSelect: (h: Holding) => void }) {
  const up = h.change_pct >= 0;
  const col = changeColor(h.change_pct);
  return (
    <button
      type="button"
      onClick={() => onSelect(h)}
      className="flex w-full items-center gap-2 rounded-md border border-border/40 bg-background/30 px-2 py-1.5 text-left transition-colors hover:border-primary/30 hover:bg-sidebar-accent"
    >
      <span className="flex h-6 w-12 shrink-0 items-center justify-center rounded bg-muted/40 text-[10px] font-bold text-foreground/80">
        {h.ticker ?? "—"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11px] font-semibold leading-tight">{h.short}</span>
        <span className="block truncate text-[9px] text-muted-foreground">{fmtT(h.value_t)}</span>
      </span>
      <span className="flex shrink-0 items-center gap-0.5 text-[12px] font-extrabold tabular-nums" style={{ color: col }}>
        {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {up ? "+" : ""}
        {h.change_pct.toFixed(2)}%
      </span>
    </button>
  );
}

/** Top gainers & losers across the listed + appraised portfolio. */
export function TopMovers({ holdings, onSelect }: { holdings: Holding[]; onSelect: (h: Holding) => void }) {
  const sorted = [...holdings].sort((a, b) => b.change_pct - a.change_pct);
  const gainers = sorted.slice(0, 4);
  const losers = sorted.slice(-4).reverse();

  return (
    <div className="grid grid-cols-2 gap-2">
      <Col title="Penguat" icon={<TrendingUp className="h-3 w-3 text-success" />} items={gainers} onSelect={onSelect} />
      <Col title="Pelemah" icon={<TrendingDown className="h-3 w-3 text-destructive" />} items={losers} onSelect={onSelect} />
    </div>
  );
}

function Col({
  title,
  icon,
  items,
  onSelect,
}: {
  title: string;
  icon: React.ReactNode;
  items: Holding[];
  onSelect: (h: Holding) => void;
}) {
  return (
    <div>
      <div className={cn("mb-1.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground")}>
        {icon} {title}
      </div>
      <div className="space-y-1.5">
        {items.map((h) => (
          <Row key={h.id} h={h} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}
