"use client";

import { ThumbsDown, ThumbsUp } from "lucide-react";
import { fmtCount } from "@/lib/danantara/ceo/format";

/**
 * Explicit positive/negative sentiment — counts, not just a net score.
 * compact: one-line counts + micro split bar (for board rows/tiles).
 * full: labeled three-segment bar with counts (for the spotlight).
 */
export function SentimentSplit({
  pos,
  neg,
  total,
  variant = "compact",
}: {
  pos: number;
  neg: number;
  total: number;
  variant?: "compact" | "full";
}) {
  const neu = Math.max(0, total - pos - neg);
  const posPct = total > 0 ? (pos / total) * 100 : 0;
  const negPct = total > 0 ? (neg / total) * 100 : 0;
  const neuPct = Math.max(0, 100 - posPct - negPct);

  if (variant === "compact") {
    return (
      <span data-testid="sentiment-split" className="inline-flex items-center gap-1.5">
        <span className="inline-flex items-center gap-0.5 font-mono text-[10px] tabular-nums text-success">
          <ThumbsUp className="h-2.5 w-2.5" />
          {fmtCount(pos)}
        </span>
        <span className="flex h-1 w-10 overflow-hidden rounded-full bg-muted/40">
          <span className="h-full bg-success/80" style={{ width: `${posPct}%` }} />
          <span className="h-full bg-muted-foreground/30" style={{ width: `${neuPct}%` }} />
          <span className="h-full bg-destructive/80" style={{ width: `${negPct}%` }} />
        </span>
        <span className="inline-flex items-center gap-0.5 font-mono text-[10px] tabular-nums text-destructive">
          <ThumbsDown className="h-2.5 w-2.5" />
          {fmtCount(neg)}
        </span>
      </span>
    );
  }

  return (
    <div data-testid="sentiment-split-full" className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-semibold uppercase tracking-[0.18em] text-muted-foreground">Sentimen Publik</span>
      </div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted/30">
        <span className="h-full bg-success" style={{ width: `${posPct}%` }} />
        <span className="h-full bg-muted-foreground/40" style={{ width: `${neuPct}%` }} />
        <span className="h-full bg-destructive" style={{ width: `${negPct}%` }} />
      </div>
      <div className="flex items-center justify-between font-mono text-[11px] tabular-nums">
        <span className="flex items-center gap-1 text-success">
          <ThumbsUp className="h-3 w-3" /> Positif {fmtCount(pos)}
        </span>
        <span className="text-muted-foreground">Netral {fmtCount(neu)}</span>
        <span className="flex items-center gap-1 text-destructive">
          <ThumbsDown className="h-3 w-3" /> Negatif {fmtCount(neg)}
        </span>
      </div>
    </div>
  );
}
