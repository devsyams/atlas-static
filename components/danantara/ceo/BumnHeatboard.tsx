"use client";

import Image from "next/image";
import { useState } from "react";
import { Building2, TrendingDown, TrendingUp } from "lucide-react";
import { groupBumnBySentiment } from "@/lib/danantara/ceo/engine";
import { fmtCount, pieTotals, sentimentTint } from "@/lib/danantara/ceo/format";
import { RankBadge } from "./RankBadge";
import { SentimentPie } from "./SentimentPie";
import type { BumnSentiment, CeoIssue } from "@/lib/danantara/ceo/types";

/** Stable monogram background from the sector key (logo fallback). */
function monogramColor(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 360;
  return `oklch(0.5 0.13 ${h})`;
}

/**
 * BUMN logo: real brand asset at `/public/bumn/{id}.png`, with a clean monogram
 * (ticker on a sector-tinted tile) as the fallback when the file is absent.
 */
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

/**
 * One BUMN row, styled like a topic row: rank + logo + BUMN name with a muted
 * context line (its top issue) on the left, and the BUMN's own sentiment pie
 * stacked over its mention count on the right.
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
  const topIssue = issues.find((i) => i.id === row.topIssueId);
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
        className="ceo-row flex w-full cursor-pointer items-start gap-2 px-3 py-2.5 text-left hover:bg-card/40"
      >
        <div className="flex w-7 shrink-0 flex-col items-end gap-0.5 pt-0.5">
          <span data-testid="bumn-rank" className="font-mono text-xl tabular-nums text-muted-foreground">{rank}.</span>
          <RankBadge delta={row.rankDelta} />
        </div>
        <BumnLogo row={row} />
        {/* Left: small BUMN ticker (logo carries identity) over its dominant topic as the headline. */}
        <div className="min-w-0 flex-1 pt-0.5">
          <span data-testid="bumn-name" className="text-base font-bold uppercase tracking-wide text-muted-foreground">{row.short}</span>
          <p data-testid="bumn-headline" className="text-2xl font-semibold leading-snug text-balance">
            {topIssue?.title ?? row.name}
          </p>
        </div>
        {/* Right: the BUMN's own sentiment pie stacked over its mention count. */}
        <div className="flex shrink-0 flex-col items-end gap-1 pt-0.5">
          <SentimentPie totals={pieTotals(row)} variant="mini" />
          <span className="text-base tabular-nums text-muted-foreground">{fmtCount(row.mentions)} mentions</span>
        </div>
      </button>
    </li>
  );
}

function BumnGroup({
  variant,
  rows,
  issues,
  onSelect,
}: {
  variant: "positive" | "negative";
  rows: BumnSentiment[];
  issues: CeoIssue[];
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
          No {positive ? "positive" : "negative"} BUMN right now.
        </p>
      ) : (
        <ol>
          {rows.map((row, idx) => (
            <BumnRow key={row.id} row={row} rank={idx + 1} issues={issues} onSelect={onSelect} />
          ))}
        </ol>
      )}
    </section>
  );
}

/**
 * BUMN sentiment board (v20.0): mirrors the Danantara Issues board — two
 * side-by-side sub-columns, SENTIMEN POSITIF (net sentiment ≥ 0) and SENTIMEN
 * NEGATIF (< 0), each holding issues-style BUMN rows (logo + name + top-issue
 * context | the BUMN's own pie over its mention count). Rows keep the green↔red
 * tint and open the BUMN detail on click (AC10).
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
  const { positive, negative } = groupBumnBySentiment(rows);

  return (
    <div data-testid="ceo-bumn" className="panel flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <Building2 className="h-5 w-5 text-primary" />
        <span className="text-xl font-semibold uppercase tracking-[0.18em]">BUMN Sentiment</span>
        <span className="ml-auto text-base uppercase tracking-widest text-muted-foreground">
          {rows.length} BUMN · positive vs negative
        </span>
      </div>
      <div
        data-testid="bumn-groups"
        className="grid min-h-0 flex-1 grid-cols-2 items-start gap-x-1.5 overflow-y-auto"
      >
        <BumnGroup variant="positive" rows={positive} issues={issues} onSelect={onSelect} />
        <BumnGroup variant="negative" rows={negative} issues={issues} onSelect={onSelect} />
      </div>
    </div>
  );
}
