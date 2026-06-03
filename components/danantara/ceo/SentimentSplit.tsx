"use client";

import { ThumbsDown, ThumbsUp } from "lucide-react";
import { fmtCount } from "@/lib/danantara/ceo/format";

/**
 * Explicit positive/negative sentiment — percentages primary, counts secondary.
 * compact: one-line percentages + micro split bar (for board rows/tiles).
 * full: labeled three-segment bar with percentages prominent and counts in parens (for the spotlight).
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

  // Precise percentages for bar widths
  const posPctBar = total > 0 ? (pos / total) * 100 : 0;
  const negPctBar = total > 0 ? (neg / total) * 100 : 0;
  const neuPctBar = Math.max(0, 100 - posPctBar - negPctBar);

  // Rounded percentages for labels
  const posPct = total > 0 ? Math.round((pos / total) * 100) : 0;
  const negPct = total > 0 ? Math.round((neg / total) * 100) : 0;
  const neuPct = Math.max(0, 100 - posPct - negPct);

  if (variant === "compact") {
    return (
      <span data-testid="sentiment-split" className="inline-flex items-center gap-1.5">
        <span className="inline-flex items-center gap-0.5 font-mono text-[10px] tabular-nums text-success">
          <ThumbsUp className="h-2.5 w-2.5" />
          {posPct}%
        </span>
        <span className="flex h-1 w-10 overflow-hidden rounded-full bg-muted/40">
          <span className="h-full bg-success/80" style={{ width: `${posPctBar}%` }} />
          <span className="h-full bg-muted-foreground/30" style={{ width: `${neuPctBar}%` }} />
          <span className="h-full bg-destructive/80" style={{ width: `${negPctBar}%` }} />
        </span>
        <span className="inline-flex items-center gap-0.5 font-mono text-[10px] tabular-nums text-destructive">
          <ThumbsDown className="h-2.5 w-2.5" />
          {negPct}%
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
        <span className="h-full bg-success" style={{ width: `${posPctBar}%` }} />
        <span className="h-full bg-muted-foreground/40" style={{ width: `${neuPctBar}%` }} />
        <span className="h-full bg-destructive" style={{ width: `${negPctBar}%` }} />
      </div>
      <div className="flex items-center justify-between font-mono text-[11px] tabular-nums">
        <span className="flex items-center gap-1 text-success">
          <ThumbsUp className="h-3 w-3" /> Positif {posPct}%
          <span className="text-success/60">({fmtCount(pos)})</span>
        </span>
        <span className="text-muted-foreground">
          Netral {neuPct}% <span className="opacity-60">({fmtCount(neu)})</span>
        </span>
        <span className="flex items-center gap-1 text-destructive">
          <ThumbsDown className="h-3 w-3" /> Negatif {negPct}%
          <span className="text-destructive/60">({fmtCount(neg)})</span>
        </span>
      </div>
    </div>
  );
}
