"use client";

import { ChevronUp, ChevronDown, Minus } from "lucide-react";

/**
 * League-table rank movement: ▲n climbed (green), ▼n dropped (red), = stayed.
 * Movement is measured against the rolling window ("2 jam terakhir").
 * Type sizes follow the CEO readability scale (AC15): nothing below 16px.
 */
export function RankBadge({ delta }: { delta: number }) {
  if (delta > 0) {
    return (
      <span
        data-testid="rank-up"
        className="inline-flex items-center gap-px rounded bg-success/15 px-1 py-px font-mono text-base font-bold tabular-nums text-success"
        title={`Naik ${delta} peringkat (2 jam)`}
      >
        <ChevronUp className="h-4 w-4" />
        {delta}
      </span>
    );
  }
  if (delta < 0) {
    return (
      <span
        data-testid="rank-down"
        className="inline-flex items-center gap-px rounded bg-destructive/15 px-1 py-px font-mono text-base font-bold tabular-nums text-destructive"
        title={`Turun ${Math.abs(delta)} peringkat (2 jam)`}
      >
        <ChevronDown className="h-4 w-4" />
        {Math.abs(delta)}
      </span>
    );
  }
  return (
    <span
      data-testid="rank-stay"
      className="inline-flex items-center rounded bg-muted/40 px-1 py-px text-base font-bold text-muted-foreground"
      title="Peringkat tetap (2 jam)"
    >
      <Minus className="h-4 w-4" />
    </span>
  );
}
