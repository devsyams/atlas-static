"use client";

import { Building2 } from "lucide-react";
import { Sparkline } from "./Sparkline";
import type { BumnSentiment } from "@/lib/danantara/ceo/types";

/** Sentiment −100..100 → tile background (red ↔ green via oklch). */
function heatColor(sentiment: number): string {
  const t = (sentiment + 100) / 200; // 0 (worst) .. 1 (best)
  const hue = 25 + t * 130; // red 25 → green 155
  const chroma = 0.07 + (Math.abs(sentiment) / 100) * 0.1;
  return `oklch(0.45 ${chroma.toFixed(3)} ${hue.toFixed(0)} / 0.35)`;
}

/** Top-20 BUMN by net public sentiment, most-negative first. */
export function BumnHeatboard({ rows }: { rows: BumnSentiment[] }) {
  return (
    <div data-testid="ceo-bumn" className="panel flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Building2 className="h-3.5 w-3.5 text-primary" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">Sentimen 20 BUMN</span>
        <span className="ml-auto text-[10px] uppercase tracking-widest text-muted-foreground">Paling tertekan dulu</span>
      </div>
      <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-2 gap-1.5 overflow-y-auto p-2">
        {rows.map((row) => (
          <div
            key={row.id}
            data-testid={`bumn-tile-${row.id}`}
            className="flex flex-col justify-between rounded-md border border-border/60 p-2"
            style={{ backgroundColor: heatColor(row.sentiment) }}
          >
            <div className="flex items-start justify-between gap-1">
              <span className="truncate text-[12px] font-semibold leading-tight">{row.short}</span>
              <span
                className={`font-mono text-sm font-bold tabular-nums ${
                  row.sentiment <= -20 ? "text-destructive" : row.sentiment >= 20 ? "text-success" : "text-warning"
                }`}
              >
                {row.sentiment > 0 ? "+" : ""}
                {Math.round(row.sentiment)}
              </span>
            </div>
            <div className="mt-1 flex items-end justify-between gap-1">
              <span className="truncate text-[9px] text-muted-foreground">{row.mentions.toLocaleString("id-ID")} sebutan</span>
              <Sparkline data={row.trend} width={40} height={14} stroke="oklch(0.85 0.02 250 / 0.8)" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
