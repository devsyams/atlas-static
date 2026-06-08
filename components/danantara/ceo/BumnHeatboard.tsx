"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Building2, ThumbsDown, ThumbsUp } from "lucide-react";
import { topicsForBumn } from "@/lib/danantara/ceo/engine";
import { fmtCount, pieTotals, sentimentTint } from "@/lib/danantara/ceo/format";
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

/** A BUMN's leading positive/negative topic (title + its own pie + reach), or a placeholder. Clickable → opens that topic's detail. */
function TopicCell({
  issue,
  variant,
  onSelect,
}: {
  issue: CeoIssue | null;
  variant: "positive" | "negative";
  onSelect?: (id: string) => void;
}) {
  const positive = variant === "positive";
  const Icon = positive ? ThumbsUp : ThumbsDown;
  if (!issue) {
    // Empty topic slot — keeps every BUMN row showing both columns (v30.0).
    // A muted, dashed, tone-tinted cell with the tone icon + em-dash; never a
    // "No … topic" text line. Tone presence is computed live from drifting
    // sentiment, so the absence is handled here in the view, not the seed data.
    return (
      <span
        data-testid={`bumn-topic-${variant}`}
        data-empty="true"
        className={`flex h-full items-center gap-2 rounded border border-dashed px-2 py-1.5 text-base leading-snug opacity-50 ${
          positive ? "border-success/40 bg-success/5 text-success" : "border-destructive/40 bg-destructive/5 text-destructive"
        }`}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="tabular-nums text-muted-foreground">—</span>
      </span>
    );
  }
  return (
    <button
      type="button"
      data-testid={`bumn-topic-${variant}`}
      onClick={() => onSelect?.(issue.id)}
      // Border + icon keep the column tone; the background is tinted per-topic by
      // its own net sentiment (so cells vary, not a flat block); the title is white.
      className={`flex h-full w-full cursor-pointer items-start gap-2 rounded border px-2 py-1.5 text-left text-base leading-snug transition hover:brightness-125 ${
        positive ? "border-success/40 text-success" : "border-destructive/40 text-destructive"
      }`}
      style={{ backgroundColor: sentimentTint(issue.sentiment) }}
    >
      <span className="flex min-w-0 flex-1 items-start gap-1.5">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <span className="text-balance text-foreground">{issue.title}</span>
      </span>
      {/* Pie over reach, pinned top-right — same as the Danantara Issues rows. */}
      <span className="flex shrink-0 flex-col items-end gap-1">
        <SentimentPie totals={pieTotals(issue)} variant="mini" />
        <span className="text-base tabular-nums text-muted-foreground">{fmtCount(issue.reach)} reach</span>
      </span>
    </button>
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
  onSelectTopic,
}: {
  row: BumnSentiment;
  rank: number;
  issues: CeoIssue[];
  onSelectTopic?: (id: string) => void;
}) {
  const { positive, negative } = topicsForBumn(row.id, issues);
  return (
    <li
      data-testid={`bumn-tile-${row.id}`}
      className={`grid ${GRID} items-stretch gap-2.5 border-b border-border/40 px-3 py-2.5 last:border-b-0`}
      style={{ backgroundColor: sentimentTint(row.sentiment) }}
    >
      {/* Identity → the BUMN's own dashboard. Click the logo to open it. */}
      <Link
        href={`/bumn/${row.id}`}
        data-testid={`btn-bumn-tile-${row.id}`}
        title={`Open ${row.name} dashboard`}
        className="flex flex-col items-center gap-1 rounded-md pt-0.5 text-center transition-colors hover:bg-card/50"
      >
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
      </Link>
      {/* Negative topic on the left, then positive — same order as the Issues board. */}
      <TopicCell issue={negative} variant="negative" onSelect={onSelectTopic} />
      <TopicCell issue={positive} variant="positive" onSelect={onSelectTopic} />
    </li>
  );
}

/** A shimmering placeholder row, matching BumnRow's grid, shown while the board loads. */
function BumnSkeletonRow() {
  return (
    <li className={`grid ${GRID} items-stretch gap-2.5 border-b border-border/40 px-3 py-2.5 last:border-b-0`}>
      <div className="flex flex-col items-center gap-1.5 pt-0.5">
        <div className="skeleton h-9 w-9 rounded-md" />
        <div className="skeleton h-4 w-12" />
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="flex items-start gap-2 rounded-md border border-border/40 p-2">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="skeleton h-4 w-[90%]" />
            <div className="skeleton h-4 w-[60%]" />
          </div>
          <div className="skeleton h-9 w-9 shrink-0 rounded-full" />
        </div>
      ))}
    </li>
  );
}

/**
 * BUMN sentiment board (AC18 v24.0): one row per BUMN (most-negative first), each
 * row = BUMN identity | its negative topic | its positive topic, every topic cell
 * carrying its own sentiment pie. Rows keep the green↔red net-sentiment tint and
 * open the BUMN detail on click (AC10). While the board is still loading
 * (`loading`) the rows show a shimmering skeleton.
 */
export function BumnHeatboard({
  rows,
  issues,
  loading = false,
  onSelectTopic,
}: {
  rows: BumnSentiment[];
  issues: CeoIssue[];
  loading?: boolean;
  /** Open a specific topic's detail (a topic cell was clicked). */
  onSelectTopic?: (id: string) => void;
}) {
  return (
    <div data-testid="ceo-bumn" className="panel flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <Building2 className="h-5 w-5 text-primary" />
        <span className="text-xl font-semibold uppercase tracking-[0.18em]">BUMN Sentiment</span>
        <span className="ml-auto text-base uppercase tracking-widest text-muted-foreground">
          {loading ? "Loading…" : `${rows.length} BUMN · negative & positive topic`}
        </span>
      </div>
      {/* Column legend. */}
      <div className={`grid ${GRID} items-center gap-2.5 border-b border-border/60 bg-card px-3 py-1.5 text-base font-bold tracking-[0.14em] text-muted-foreground`}>
        <span className="text-center">BUMN</span>
        <span className="flex items-center gap-1.5 text-destructive">
          <ThumbsDown className="h-4 w-4 shrink-0" /> NEGATIVE TOPICS
        </span>
        <span className="flex items-center gap-1.5 text-success">
          <ThumbsUp className="h-4 w-4 shrink-0" /> POSITIVE TOPICS
        </span>
      </div>
      {loading ? (
        <ol data-testid="bumn-skeleton" aria-busy className="min-h-0 flex-1 overflow-y-auto">
          {Array.from({ length: 6 }, (_, i) => (
            <BumnSkeletonRow key={i} />
          ))}
        </ol>
      ) : (
        <ol data-testid="bumn-list" className="min-h-0 flex-1 overflow-y-auto">
          {rows.map((row, idx) => (
            <BumnRow key={row.id} row={row} rank={idx + 1} issues={issues} onSelectTopic={onSelectTopic} />
          ))}
        </ol>
      )}
    </div>
  );
}
