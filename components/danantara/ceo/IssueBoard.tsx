"use client";

import { Flame, TrendingDown, TrendingUp } from "lucide-react";
import { groupIssuesBySentiment } from "@/lib/danantara/ceo/engine";
import { pieTotals, sentimentTint } from "@/lib/danantara/ceo/format";
import { RankBadge } from "./RankBadge";
import { SentimentPie } from "./SentimentPie";
import type { CeoIssue } from "@/lib/danantara/ceo/types";

const STATUS_BADGE: Record<CeoIssue["status"], { label: string; cls: string }> = {
  normal: { label: "", cls: "" },
  rising: { label: "RISING", cls: "bg-warning/15 text-warning border-warning/40" },
  escalating: { label: "ESCALATING", cls: "bg-destructive/15 text-destructive border-destructive/50 ceo-siren" },
};

/**
 * One topic row (AC12/AC14 v14.0): rank + full title on the left (title wraps,
 * never truncates) with a muted AI context line beneath it (sneak peek, 2-line
 * clamp, v18.0), and the sentiment pie stacked over the reach value on the right.
 */
function IssueRow({ issue, rank, onSelect }: { issue: CeoIssue; rank: number; onSelect?: (id: string) => void }) {
  const badge = STATUS_BADGE[issue.status];
  return (
    <li
      data-testid={`issue-row-${issue.id}`}
      className={`border-b border-border/40 last:border-b-0 ${issue.status === "escalating" ? "ceo-flash" : ""}`}
      style={{ backgroundColor: sentimentTint(issue.sentiment) }}
    >
      <button
        type="button"
        data-testid={`btn-issue-row-${issue.id}`}
        onClick={() => onSelect?.(issue.id)}
        className="ceo-row flex w-full cursor-pointer items-start gap-2.5 px-3 py-2.5 text-left hover:bg-card/40"
      >
        {/* Rank number + movement badge. */}
        <div className="flex w-9 shrink-0 flex-col items-end gap-0.5 pt-0.5">
          <span className="font-mono text-xl tabular-nums text-muted-foreground">{rank}.</span>
          <RankBadge delta={issue.rankDelta} />
        </div>
        {/* Left: full title + status badge, with a muted AI context line beneath (AC12 v18.0). */}
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex items-start gap-2">
            <span data-testid="issue-title" className="text-2xl font-semibold leading-snug text-balance">{issue.title}</span>
            {badge.label && (
              <span className={`mt-0.5 shrink-0 rounded border px-1.5 py-px text-base font-bold tracking-wider ${badge.cls}`}>
                {badge.label}
              </span>
            )}
          </div>
          {issue.aiLine && (
            <p data-testid="issue-ailine" className="mt-1 line-clamp-2 text-base font-normal leading-snug text-muted-foreground">
              {issue.aiLine}
            </p>
          )}
        </div>
        {/* Right: sentiment pie stacked over the reach value (AC14 v14.0). */}
        <div className="flex shrink-0 flex-col items-end gap-1 pt-0.5">
          <SentimentPie totals={pieTotals(issue)} variant="mini" />
          <span className="text-base tabular-nums text-muted-foreground">
            {(issue.reach / 1_000_000).toFixed(1)}M reach
          </span>
        </div>
      </button>
    </li>
  );
}

function IssueGroup({
  variant,
  issues,
  onSelect,
}: {
  variant: "positive" | "negative";
  issues: CeoIssue[];
  onSelect?: (id: string) => void;
}) {
  const positive = variant === "positive";
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <section data-testid={`issue-group-${variant}`}>
      <div
        className={`sticky top-0 z-10 flex items-center gap-2 border-y border-border/60 bg-card px-3 py-2 ${
          positive ? "text-success" : "text-destructive"
        }`}
      >
        <Icon className="h-4 w-4" />
        <span className="text-lg font-bold tracking-[0.18em]">
          {positive ? "POSITIVE TOPICS" : "NEGATIVE TOPICS"}
        </span>
        <span className="font-mono text-lg tabular-nums">({issues.length})</span>
      </div>
      {issues.length === 0 ? (
        <p className="px-3 py-3 text-base text-muted-foreground">
          No {positive ? "positive" : "negative"} topics right now.
        </p>
      ) : (
        <ol>
          {issues.map((issue, idx) => (
            <IssueRow key={issue.id} issue={issue} rank={idx + 1} onSelect={onSelect} />
          ))}
        </ol>
      )}
    </section>
  );
}

/**
 * Danantara topic board (AC12 v9.0): topics grouped by dominant sentiment into a
 * POSITIVE TOPICS and a NEGATIVE TOPICS sub-column, rendered side by side, each
 * ranked by reach. Every row is a stacked card (title over a pie + velocity meta
 * line) carrying a green↔red sentiment tint and its own per-topic pie.
 */
export function IssueBoard({ issues, onSelect }: { issues: CeoIssue[]; onSelect?: (id: string) => void }) {
  const { positive, negative } = groupIssuesBySentiment(issues);

  return (
    <div data-testid="ceo-issues" className="panel flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <Flame className="h-5 w-5 text-primary" />
        <span className="text-xl font-semibold uppercase tracking-[0.18em]">Danantara Issues</span>
        <span className="ml-auto text-base uppercase tracking-widest text-muted-foreground">
          {issues.length} topics · positive vs negative
        </span>
      </div>
      <div
        data-testid="issue-groups"
        className="grid min-h-0 flex-1 grid-cols-2 items-start gap-x-1.5 overflow-y-auto"
      >
        <IssueGroup variant="positive" issues={positive} onSelect={onSelect} />
        <IssueGroup variant="negative" issues={negative} onSelect={onSelect} />
      </div>
    </div>
  );
}
