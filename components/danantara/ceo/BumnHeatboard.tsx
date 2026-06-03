"use client";

import { Building2, TrendingDown, TrendingUp } from "lucide-react";
import { topicsForBumn } from "@/lib/danantara/ceo/engine";
import { pieTotals, sentimentTint } from "@/lib/danantara/ceo/format";
import { RankBadge } from "./RankBadge";
import { SentimentPie } from "./SentimentPie";
import type { BumnSentiment, CeoIssue } from "@/lib/danantara/ceo/types";

/**
 * One BUMN's leading positive/negative topic (AC16): the topic title over its
 * own mini sentiment pie (AC14 v10.0), or a placeholder when no such topic.
 */
function TopicCell({ issue, variant }: { issue: CeoIssue | null; variant: "positive" | "negative" }) {
  const positive = variant === "positive";
  if (!issue) {
    return (
      <span className="flex items-center text-base italic text-muted-foreground">
        No {positive ? "positive" : "negative"} topic
      </span>
    );
  }
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <span
      data-testid={`bumn-topic-${variant}`}
      className={`flex flex-col gap-1.5 rounded border px-2 py-1.5 text-base leading-snug ${
        positive
          ? "border-success/40 bg-success/10 text-success"
          : "border-destructive/40 bg-destructive/10 text-destructive"
      }`}
    >
      <span className="flex items-start gap-1.5">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{issue.title}</span>
      </span>
      {/* Pie carries the sentiment % labels; reach is the linked topic's reach (AC16 v11.0). */}
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <SentimentPie totals={pieTotals(issue)} variant="mini" />
        <span className="text-base tabular-nums text-muted-foreground">
          {(issue.reach / 1_000_000).toFixed(1)}M reach
        </span>
      </span>
    </span>
  );
}

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
        className="ceo-row grid w-full cursor-pointer grid-cols-[minmax(10rem,13rem)_1fr_1fr] items-start gap-3 px-3 py-2.5 text-left hover:bg-card/40"
      >
        {/* BUMN identity: rank number, rank-movement badge, name. */}
        <div className="flex min-w-0 items-center gap-2">
          <span data-testid="bumn-rank" className="w-6 shrink-0 text-right font-mono text-xl tabular-nums text-muted-foreground">
            {rank}
          </span>
          <RankBadge delta={row.rankDelta} />
          <span data-testid="bumn-name" className="truncate text-xl font-semibold leading-tight">{row.short}</span>
        </div>
        <TopicCell issue={positive} variant="positive" />
        <TopicCell issue={negative} variant="negative" />
      </button>
    </li>
  );
}

/**
 * BUMN sentiment board (AC16 v7.0): a single full-width list, one BUMN per row
 * (most-negative first), each naming the BUMN's leading positive and negative
 * topic — the CEO's "good story / bad story" for that company at a glance, each
 * topic cell carrying its own mini sentiment pie (AC14 v10.0). The v4–v6
 * side-by-side sentiment sub-columns are gone; the row keeps a subtle green↔red
 * sentiment tint and stays clickable for detail (AC10).
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
          {rows.length} BUMN · positive vs negative topics
        </span>
      </div>
      {/* Column legend so the two topic cells read unambiguously. */}
      <div className="grid grid-cols-[minmax(10rem,13rem)_1fr_1fr] items-center gap-3 border-b border-border/60 bg-card px-3 py-1.5 text-base font-bold tracking-[0.14em] text-muted-foreground">
        <span>BUMN</span>
        <span className="text-success">POSITIVE TOPIC</span>
        <span className="text-destructive">NEGATIVE TOPIC</span>
      </div>
      <ol data-testid="bumn-list" className="min-h-0 flex-1 overflow-y-auto">
        {rows.map((row, idx) => (
          <BumnRow key={row.id} row={row} rank={idx + 1} issues={issues} onSelect={onSelect} />
        ))}
      </ol>
    </div>
  );
}
