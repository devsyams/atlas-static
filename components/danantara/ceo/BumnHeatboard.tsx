"use client";

import Image from "next/image";
import { useState } from "react";
import { Building2, TrendingDown, TrendingUp } from "lucide-react";
import { topicsForBumn } from "@/lib/danantara/ceo/engine";
import { pieTotals, sentimentTint } from "@/lib/danantara/ceo/format";
import { RankBadge } from "./RankBadge";
import { SentimentPie } from "./SentimentPie";
import type { BumnSentiment, CeoIssue } from "@/lib/danantara/ceo/types";

const GRID = "grid-cols-[5rem_1fr_1fr]";

/** Stable monogram background from the sector key (logo fallback). */
function monogramColor(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 360;
  return `oklch(0.5 0.13 ${h})`;
}

/** BUMN logo: real asset at `/public/bumn/{id}.png`, monogram fallback when absent. */
function BumnLogo({ row }: { row: BumnSentiment }) {
  const [failed, setFailed] = useState(false);
  const initials = row.short.replace(/\s+/g, "").slice(0, 4).toUpperCase();
  return (
    <span data-testid="bumn-logo" className="shrink-0">
      {failed ? (
        <span
          aria-label={row.name}
          className="flex h-9 w-9 items-center justify-center rounded-md text-base font-extrabold tracking-tight text-white"
          style={{ backgroundColor: monogramColor(row.sector) }}
        >
          {initials}
        </span>
      ) : (
        <Image
          src={`/bumn/${row.id}.png`}
          alt={`${row.name} logo`}
          width={36}
          height={36}
          onError={() => setFailed(true)}
          className="h-9 w-9 rounded-md bg-white/90 object-contain p-0.5"
        />
      )}
    </span>
  );
}

/** A BUMN's leading positive/negative topic (title + its own pie + reach), or a placeholder. */
function TopicCell({ issue, variant }: { issue: CeoIssue | null; variant: "positive" | "negative" }) {
  const positive = variant === "positive";
  const Icon = positive ? TrendingUp : TrendingDown;
  if (!issue) {
    // Empty topic slot — keeps every BUMN row showing both columns (v30.0).
    // A muted, dashed, tone-tinted cell with the trend icon + em-dash; never a
    // "No … topic" text line. Tone presence is computed live from drifting
    // sentiment, so the absence is handled here in the view, not the seed data.
    return (
      <span
        data-testid={`bumn-topic-${variant}`}
        data-empty="true"
        className={`flex items-center gap-2 rounded border border-dashed px-2 py-1.5 text-base leading-snug opacity-50 ${
          positive ? "border-success/40 bg-success/5 text-success" : "border-destructive/40 bg-destructive/5 text-destructive"
        }`}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="tabular-nums text-muted-foreground">—</span>
      </span>
    );
  }
  return (
    <span
      data-testid={`bumn-topic-${variant}`}
      className={`flex items-start gap-2 rounded border px-2 py-1.5 text-base leading-snug ${
        positive
          ? "border-success/40 bg-success/10 text-success"
          : "border-destructive/40 bg-destructive/10 text-destructive"
      }`}
    >
      <span className="flex min-w-0 flex-1 items-start gap-1.5">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <span className="text-balance">{issue.title}</span>
      </span>
      {/* Pie over reach, pinned top-right — same as the Danantara Issues rows. */}
      <span className="flex shrink-0 flex-col items-end gap-1">
        <SentimentPie totals={pieTotals(issue)} variant="mini" />
        <span className="text-base tabular-nums text-muted-foreground">{(issue.reach / 1_000_000).toFixed(1)}M reach</span>
      </span>
    </span>
  );
}

/**
 * One BUMN row (AC18 v24.0): the BUMN identity (rank · logo · ticker) on the
 * left, then its leading negative topic and its leading positive topic — each a
 * styled cell with the topic's own sentiment pie + reach.
 */
function BumnRow({
  row,
  rank,
  issues,
  onSelect,
}: {
  row: BumnSentiment;
  rank: number;
  issues: CeoIssue[];
  onSelect?: (id: string) => void;
}) {
  const { positive, negative } = topicsForBumn(row.id, issues);
  return (
    <li
      data-testid={`bumn-tile-${row.id}`}
      className="border-b border-border/40 last:border-b-0"
      style={{ backgroundColor: sentimentTint(row.sentiment) }}
    >
      <button
        type="button"
        data-testid={`btn-bumn-tile-${row.id}`}
        onClick={() => onSelect?.(row.id)}
        className={`ceo-row grid w-full cursor-pointer ${GRID} items-start gap-2.5 px-3 py-2.5 text-left hover:bg-card/40`}
      >
        {/* Identity: logo (rank as a corner badge), then ticker + movement on one line. */}
        <div className="flex flex-col items-center gap-1 pt-0.5 text-center">
          <span className="relative inline-block">
            <BumnLogo row={row} />
            <span
              data-testid="bumn-rank"
              className="absolute -left-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full border border-background bg-foreground px-1 font-mono text-base font-bold tabular-nums leading-none text-background shadow-sm"
            >
              {rank}
            </span>
          </span>
          <span className="flex items-center gap-1">
            <span data-testid="bumn-name" className="max-w-full truncate text-xl font-bold leading-tight">{row.short}</span>
            <RankBadge delta={row.rankDelta} />
          </span>
        </div>
        {/* Positive topic on the left, then negative — same order as the Issues board. */}
        <TopicCell issue={positive} variant="positive" />
        <TopicCell issue={negative} variant="negative" />
      </button>
    </li>
  );
}

/**
 * BUMN sentiment board (AC18 v24.0): one row per BUMN (most-negative first), each
 * row = BUMN identity | its negative topic | its positive topic, every topic cell
 * carrying its own sentiment pie. Rows keep the green↔red net-sentiment tint and
 * open the BUMN detail on click (AC10).
 */
export function BumnHeatboard({
  rows,
  issues,
  onSelect,
}: {
  rows: BumnSentiment[];
  issues: CeoIssue[];
  onSelect?: (id: string) => void;
}) {
  return (
    <div data-testid="ceo-bumn" className="panel flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <Building2 className="h-5 w-5 text-primary" />
        <span className="text-xl font-semibold uppercase tracking-[0.18em]">BUMN Sentiment</span>
        <span className="ml-auto text-base uppercase tracking-widest text-muted-foreground">
          {rows.length} BUMN · positive & negative topic
        </span>
      </div>
      {/* Column legend. */}
      <div className={`grid ${GRID} items-center gap-2.5 border-b border-border/60 bg-card px-3 py-1.5 text-base font-bold tracking-[0.14em] text-muted-foreground`}>
        <span className="text-center">BUMN</span>
        <span className="text-success">POSITIVE TOPICS</span>
        <span className="text-destructive">NEGATIVE TOPICS</span>
      </div>
      <ol data-testid="bumn-list" className="min-h-0 flex-1 overflow-y-auto">
        {rows.map((row, idx) => (
          <BumnRow key={row.id} row={row} rank={idx + 1} issues={issues} onSelect={onSelect} />
        ))}
      </ol>
    </div>
  );
}
