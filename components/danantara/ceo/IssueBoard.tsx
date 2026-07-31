"use client";

import { type CSSProperties } from "react";
import { BarChart3, Eye, Flame, ThumbsDown, ThumbsUp } from "lucide-react";
import { groupIssuesBySentiment } from "@/lib/danantara/ceo/engine";
import { fmtCount } from "@/lib/danantara/ceo/format";
import type { CeoIssue } from "@/lib/danantara/ceo/types";
import { SentimentBreakdown, TONE, readSentiment } from "./SentimentBreakdown";

const STATUS_BADGE: Record<CeoIssue["status"], { label: string; cls: string }> = {
  normal: { label: "", cls: "" },
  rising: { label: "RISING", cls: "border-warning/40 bg-warning/15 text-warning" },
  escalating: { label: "ESCALATING", cls: "border-destructive/50 bg-destructive/15 text-destructive ceo-siren" },
};

/**
 * One Danantara topic, rendered as a compact **issue-briefing card** (v41.2)
 * mirroring the BUMN Sentiment Summary: a glowing tone spine + editorial rank
 * numeral, the full title, the `penjelasan` (aiLine), a metrics row
 * (Sentiment · Impressions · Reach), the sentiment **breakdown bar** (no pie),
 * and the **value of each sentiment** below it. Tuned to read cleanly inside the
 * side-by-side Negative/Positive columns for a 40–60 y/o exec. Lifts/glows on
 * hover; staggers in on load. Clicking opens the topic detail.
 */
function IssueCard({ issue, rank, onSelect }: { issue: CeoIssue; rank: number; onSelect?: (id: string) => void }) {
  const { key, share } = readSentiment(issue);
  const t = TONE[key];
  const { Icon } = t;
  const status = STATUS_BADGE[issue.status];

  return (
    <li data-testid={`issue-row-${issue.id}`} className="topic-rise" style={{ animationDelay: `${(rank - 1) * 55}ms` } as CSSProperties}>
      <button
        type="button"
        data-testid={`btn-issue-row-${issue.id}`}
        onClick={() => onSelect?.(issue.id)}
        className="topic-card panel block w-full cursor-pointer overflow-hidden p-0 text-left"
        style={{ "--tone": t.tone } as CSSProperties}
      >
        <span className="topic-spine" aria-hidden />
        <div className="topic-card-bg grid grid-cols-[1.75rem_1fr] gap-x-2.5 p-3 pl-4">
          <div className="topic-rank pt-0.5 font-mono text-2xl font-extrabold sm:text-3xl">{String(rank).padStart(2, "0")}</div>

          <div className="min-w-0">
            {/* Title — clamped to a fixed two-line box (v46.3). Both are needed: the
                clamp stops a long title pushing the card taller, the min-height stops
                a short one letting it collapse. Without them a card is 195px or 220px
                purely on whether the title wraps, and the Negative/Positive columns
                stop lining up. Full text stays one click away in the detail modal. */}
            <div className="flex items-start gap-2">
              <h3
                data-testid="issue-title"
                title={issue.title}
                className="line-clamp-2 min-h-[2.75em] min-w-0 flex-1 text-lg font-semibold leading-snug text-balance text-foreground"
              >
                {issue.title}
              </h3>
              {status.label && (
                <span className={`shrink-0 rounded border px-1.5 py-0.5 text-base font-bold tracking-wider ${status.cls}`}>{status.label}</span>
              )}
            </div>

            {/* Penjelasan — always rendered, so a topic without one doesn't collapse
                the card below its neighbours. */}
            <p
              data-testid="issue-ailine"
              title={issue.aiLine}
              className="mt-1 line-clamp-2 min-h-[2.75em] text-base font-normal leading-snug text-muted-foreground"
            >
              {issue.aiLine}
            </p>

            {/* Metrics row — Sentiment · Impressions · Reach (mirrors the BUMN Sentiment Summary).
                The verdict here is the qualitative tone; the exact %s live once in the legend below. */}
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border/40 pt-2.5 text-base">
              <span className={`flex items-center gap-1.5 font-bold ${t.text}`} title="Dominant public sentiment">
                <Icon className="h-5 w-5 shrink-0" /> {t.label}
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground" title="Total impressions">
                <BarChart3 className="h-4 w-4 shrink-0 text-primary/70" />
                <span className="font-bold tabular-nums text-foreground">{fmtCount(issue.mentions)}</span> impressions
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground" title="Users reached">
                <Eye className="h-4 w-4 shrink-0 text-primary/70" />
                <span className="font-bold tabular-nums text-foreground">{fmtCount(issue.reach)}</span> reach
              </span>
            </div>

            {/* Sentiment breakdown bar + value of each sentiment (shared component). */}
            <SentimentBreakdown share={share} size="sm" className="mt-2.5" />
          </div>
        </div>
      </button>
    </li>
  );
}

function IssueSection({
  variant,
  issues,
  onSelect,
}: {
  variant: "positive" | "negative";
  issues: CeoIssue[];
  onSelect?: (id: string) => void;
}) {
  const positive = variant === "positive";
  const Icon = positive ? ThumbsUp : ThumbsDown;
  return (
    <section data-testid={`issue-group-${variant}`}>
      <div
        className={`sticky top-0 z-10 flex items-center gap-2 border-y border-border/60 bg-card px-3 py-2 ${
          positive ? "text-success" : "text-destructive"
        }`}
      >
        <Icon className="h-4 w-4" />
        <span className="text-lg font-bold tracking-[0.18em]">{positive ? "POSITIVE TOPICS" : "NEGATIVE TOPICS"}</span>
        <span className="font-mono text-lg tabular-nums">({issues.length})</span>
      </div>
      {issues.length === 0 ? (
        <p className="px-3 py-3 text-base text-muted-foreground">No {positive ? "positive" : "negative"} topics right now.</p>
      ) : (
        <ol className="space-y-2.5 p-2">
          {issues.map((issue, idx) => (
            <IssueCard key={issue.id} issue={issue} rank={idx + 1} onSelect={onSelect} />
          ))}
        </ol>
      )}
    </section>
  );
}

/** A shimmering placeholder card while the feed loads. */
function IssueSkeletonCard() {
  return (
    <li className="panel overflow-hidden p-0">
      <div className="grid grid-cols-[1.75rem_1fr] gap-x-2.5 p-3 pl-4">
        <div className="skeleton h-7 w-7 rounded-md" />
        {/* Mirrors the real card: a two-line title, a two-line penjelasan, the bar
            and the legend — so the reveal doesn't jump. */}
        <div className="space-y-2.5">
          <div className="skeleton h-5 w-[85%]" />
          <div className="skeleton h-5 w-[60%]" />
          <div className="skeleton h-4 w-[90%]" />
          <div className="skeleton h-4 w-[55%]" />
          <div className="skeleton h-2 w-full rounded-full" />
          <div className="skeleton h-4 w-2/3" />
        </div>
      </div>
    </li>
  );
}

function IssueSkeletonColumn({ variant }: { variant: "positive" | "negative" }) {
  const positive = variant === "positive";
  const Icon = positive ? ThumbsUp : ThumbsDown;
  return (
    <section data-testid={`issue-skeleton-${variant}`} aria-busy>
      <div
        className={`sticky top-0 z-10 flex items-center gap-2 border-y border-border/60 bg-card px-3 py-2 ${
          positive ? "text-success" : "text-destructive"
        }`}
      >
        <Icon className="h-4 w-4" />
        <span className="text-lg font-bold tracking-[0.18em]">{positive ? "POSITIVE TOPICS" : "NEGATIVE TOPICS"}</span>
      </div>
      <ol className="space-y-2.5 p-2">
        {Array.from({ length: 3 }, (_, i) => (
          <IssueSkeletonCard key={i} />
        ))}
      </ol>
    </section>
  );
}

/**
 * Danantara topic board (AC12 v41.0): two **side-by-side** columns — NEGATIVE
 * topics on the left (problems lead) and POSITIVE on the right — each a stack of
 * compact issue-briefing cards. Sentiment reads as a verdict chip + segmented
 * bar (no tiny pie); titles get room, type is ≥16px. While the feed loads
 * (`loading`) the columns show a shimmering skeleton.
 */
export function IssueBoard({
  issues,
  loading = false,
  onSelect,
}: {
  issues: CeoIssue[];
  loading?: boolean;
  onSelect?: (id: string) => void;
}) {
  const { positive, negative } = groupIssuesBySentiment(issues);

  return (
    <div data-testid="ceo-issues" className="panel flex flex-col overflow-hidden xl:h-full">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <Flame className="h-5 w-5 text-primary" />
        <span className="text-xl font-semibold uppercase tracking-[0.18em]">Danantara Issues</span>
        <span className="ml-auto text-base uppercase tracking-widest text-muted-foreground">
          {loading ? "Loading…" : `${issues.length} topics · negative vs positive`}
        </span>
      </div>
      <div data-testid="issue-groups" className="grid min-h-0 flex-1 grid-cols-1 items-start gap-2 overflow-y-auto sm:grid-cols-2 sm:gap-x-2">
        {loading ? (
          <>
            <IssueSkeletonColumn variant="negative" />
            <IssueSkeletonColumn variant="positive" />
          </>
        ) : (
          <>
            {/* Negative on the left (client/boss direction) — problems lead. */}
            <IssueSection variant="negative" issues={negative} onSelect={onSelect} />
            <IssueSection variant="positive" issues={positive} onSelect={onSelect} />
          </>
        )}
      </div>
    </div>
  );
}
