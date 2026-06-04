"use client";

import Image from "next/image";
import { useState } from "react";
import { Building2 } from "lucide-react";
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
 * BUMN logo (v19.0): real brand asset at `/public/bumn/{id}.png`, with a clean
 * monogram (ticker on a sector-tinted tile) as the fallback when the file is
 * absent — so the board is complete now and real logos drop in automatically.
 */
function BumnLogo({ row }: { row: BumnSentiment }) {
  const [failed, setFailed] = useState(false);
  const initials = row.short.replace(/\s+/g, "").slice(0, 4).toUpperCase();
  return (
    <span data-testid="bumn-logo" className="shrink-0">
      {failed ? (
        <span
          aria-label={row.name}
          className="flex h-10 w-10 items-center justify-center rounded-md text-base font-extrabold tracking-tight text-white"
          style={{ backgroundColor: monogramColor(row.sector) }}
        >
          {initials}
        </span>
      ) : (
        <Image
          src={`/bumn/${row.id}.png`}
          alt={`${row.name} logo`}
          width={40}
          height={40}
          onError={() => setFailed(true)}
          className="h-10 w-10 rounded-md bg-white/90 object-contain p-0.5"
        />
      )}
    </span>
  );
}

/**
 * One BUMN row, styled like a topic row (v19.0): rank + logo + BUMN name with a
 * muted context line (its top issue) on the left, and the BUMN's own sentiment
 * pie stacked over its mention count on the right.
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
        className="ceo-row flex w-full cursor-pointer items-start gap-2.5 px-3 py-2.5 text-left hover:bg-card/40"
      >
        {/* Rank number + movement badge. */}
        <div className="flex w-9 shrink-0 flex-col items-end gap-0.5 pt-0.5">
          <span data-testid="bumn-rank" className="font-mono text-xl tabular-nums text-muted-foreground">{rank}.</span>
          <RankBadge delta={row.rankDelta} />
        </div>
        <BumnLogo row={row} />
        {/* Left: BUMN name + muted context line (its top issue). */}
        <div className="min-w-0 flex-1 pt-0.5">
          <span data-testid="bumn-name" className="text-xl font-semibold leading-snug">{row.name}</span>
          {topIssue && (
            <p data-testid="bumn-context" className="mt-1 line-clamp-2 text-base font-normal leading-snug text-muted-foreground">
              {topIssue.title}
            </p>
          )}
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

/**
 * BUMN sentiment board (v19.0): a single list styled like the Danantara Issues
 * board — one row per BUMN (most-negative first) with a logo, name + context,
 * and the BUMN's own sentiment pie over its mention count. Rows keep the green↔red
 * sentiment tint and stay clickable for detail (AC10).
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
          {rows.length} BUMN · most-negative first
        </span>
      </div>
      <ol data-testid="bumn-list" className="min-h-0 flex-1 overflow-y-auto">
        {rows.map((row, idx) => (
          <BumnRow key={row.id} row={row} rank={idx + 1} issues={issues} onSelect={onSelect} />
        ))}
      </ol>
    </div>
  );
}
