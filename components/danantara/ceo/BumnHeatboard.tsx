"use client";

import { Building2, TrendingDown, TrendingUp } from "lucide-react";
import { groupBumnBySentiment } from "@/lib/danantara/ceo/engine";
import { Sparkline } from "./Sparkline";
import { RankBadge } from "./RankBadge";
import { SentimentPie } from "./SentimentPie";
import type { BumnSentiment } from "@/lib/danantara/ceo/types";

/** Sentiment −100..100 → tile background (red ↔ green via oklch). */
function heatColor(sentiment: number): string {
  const t = (sentiment + 100) / 200; // 0 (worst) .. 1 (best)
  const hue = 25 + t * 130; // red 25 → green 155
  const chroma = 0.07 + (Math.abs(sentiment) / 100) * 0.1;
  return `oklch(0.45 ${chroma.toFixed(3)} ${hue.toFixed(0)} / 0.35)`;
}

function BumnTile({ row, onSelect }: { row: BumnSentiment; onSelect?: (id: string) => void }) {
  return (
    <div
      data-testid={`bumn-tile-${row.id}`}
      className="rounded-md border border-border/60"
      style={{ backgroundColor: heatColor(row.sentiment) }}
    >
      <button
        type="button"
        data-testid={`btn-bumn-tile-${row.id}`}
        onClick={() => onSelect?.(row.id)}
        className="flex h-full w-full cursor-pointer flex-col justify-between rounded-md p-2 text-left hover:ring-1 hover:ring-primary/40"
      >
        <div className="flex items-start justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <RankBadge delta={row.rankDelta} />
            <span data-testid="bumn-name" className="truncate text-xl font-semibold leading-tight">{row.short}</span>
          </span>
          <span
            className={`font-mono text-2xl font-bold tabular-nums ${
              row.sentiment <= -20 ? "text-destructive" : row.sentiment >= 20 ? "text-success" : "text-warning"
            }`}
          >
            {row.sentiment > 0 ? "+" : ""}
            {Math.round(row.sentiment)}
          </span>
        </div>
        <div className="mt-1.5 flex items-end justify-between gap-2">
          {/* Per-BUMN sentiment pie (AC14 v5.0). */}
          <SentimentPie
            totals={{
              pos: row.posMentions,
              neg: row.negMentions,
              neu: Math.max(0, row.mentions - row.posMentions - row.negMentions),
              total: row.mentions,
            }}
            variant="mini"
          />
          <Sparkline data={row.trend} width={56} height={22} stroke="oklch(0.85 0.02 250 / 0.8)" />
        </div>
      </button>
    </div>
  );
}

function BumnGroup({
  variant,
  rows,
  onSelect,
}: {
  variant: "positive" | "negative";
  rows: BumnSentiment[];
  onSelect?: (id: string) => void;
}) {
  const positive = variant === "positive";
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <section data-testid={`bumn-group-${variant}`}>
      <div
        className={`sticky top-0 z-10 flex items-center gap-2 border-y border-border/60 bg-card px-3 py-2 ${
          positive ? "text-success" : "text-destructive"
        }`}
      >
        <Icon className="h-4 w-4" />
        <span className="text-lg font-bold tracking-[0.18em]">
          {positive ? "SENTIMEN POSITIF" : "SENTIMEN NEGATIF"}
        </span>
        <span className="font-mono text-lg tabular-nums">({rows.length})</span>
      </div>
      {rows.length === 0 ? (
        <p className="px-3 py-3 text-base text-muted-foreground">
          Tidak ada BUMN dengan sentimen {positive ? "positif" : "negatif"} saat ini.
        </p>
      ) : (
        // Single tile column — the group itself is already a half-width sub-column.
        <div className="grid grid-cols-1 gap-1.5 p-2">
          {rows.map((row) => (
            <BumnTile key={row.id} row={row} onSelect={onSelect} />
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * BUMN grouped by net-sentiment sign (AC13 v5.0): positive and negative
 * sub-columns side by side (most-positive / most-negative leading), with a
 * per-BUMN sentiment pie on every tile (AC14 v5.0).
 */
export function BumnHeatboard({ rows, onSelect }: { rows: BumnSentiment[]; onSelect?: (id: string) => void }) {
  const { positive, negative } = groupBumnBySentiment(rows);

  return (
    <div data-testid="ceo-bumn" className="panel flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <Building2 className="h-5 w-5 text-primary" />
        <span className="text-xl font-semibold uppercase tracking-[0.18em]">Sentimen BUMN</span>
        <span className="ml-auto text-base uppercase tracking-widest text-muted-foreground">
          {rows.length} BUMN · positif vs negatif
        </span>
      </div>
      <div
        data-testid="bumn-groups"
        className="grid min-h-0 flex-1 grid-cols-2 items-start gap-x-1.5 overflow-y-auto"
      >
        <BumnGroup variant="positive" rows={positive} onSelect={onSelect} />
        <BumnGroup variant="negative" rows={negative} onSelect={onSelect} />
      </div>
    </div>
  );
}
