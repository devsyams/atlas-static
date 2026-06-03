"use client";

import { ChevronUp, ChevronDown } from "lucide-react";

/**
 * League-table rank movement: ▲n climbed (green), ▼n dropped (red). An unchanged
 * rank renders nothing (v17.0 — the neutral "stay" dash was visual noise on a
 * board that is mostly steady). Movement is measured against the rolling window.
 * Type sizes follow the CEO readability scale (AC15): nothing below 16px.
 */
export function RankBadge({ delta }: { delta: number }) {
  if (delta > 0) {
    return (
      <span
        data-testid="rank-up"
        className="inline-flex items-center gap-px rounded bg-success/15 px-1 py-px font-mono text-base font-bold tabular-nums text-success"
        title={`Up ${delta} ranks (2h)`}
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
        title={`Down ${Math.abs(delta)} ranks (2h)`}
      >
        <ChevronDown className="h-4 w-4" />
        {Math.abs(delta)}
      </span>
    );
  }
  // Unchanged rank: render nothing.
  return null;
}
