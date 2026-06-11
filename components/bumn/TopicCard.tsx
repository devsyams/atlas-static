"use client";

import type { CSSProperties } from "react";
import { BarChart3, Eye, Minus, ThumbsDown, ThumbsUp } from "lucide-react";
import { SentimentPie } from "@/components/danantara/ceo/SentimentPie";
import { fmtCount, pieTotals } from "@/lib/danantara/ceo/format";
import type { CeoIssue } from "@/lib/danantara/ceo/types";

/** A shimmering placeholder card, matching TopicCard's shape, shown while topics load. */
export function TopicCardSkeleton() {
  return (
    <div className="panel overflow-hidden p-0">
      <div className="grid grid-cols-[3rem_1fr] gap-x-4 p-4 pl-6 sm:grid-cols-[3.5rem_1fr]">
        <div className="skeleton h-10 w-10 rounded-md" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[7fr_3fr] sm:items-center">
          <div className="min-w-0 space-y-3">
            <div className="skeleton h-6 w-[80%]" />
            <div className="skeleton h-4 w-[95%]" />
            <div className="skeleton h-4 w-[60%]" />
            <div className="flex gap-6 pt-2">
              <div className="skeleton h-8 w-24" />
              <div className="skeleton h-8 w-24" />
            </div>
          </div>
          <div className="flex justify-center">
            <div className="skeleton h-24 w-24 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** The loudest topic (by reach) whose dominant tone matches — the "why" behind the verdict. */
export function topDriver(issues: CeoIssue[], want: "Negative" | "Positive"): { title: string; reach: number } | undefined {
  const top = issues
    .filter((i) => topicTone(i).label === want)
    .sort((a, b) => b.reach - a.reach)[0];
  return top ? { title: top.title, reach: top.reach } : undefined;
}

/** Dominant tone of a topic from its positive/neutral/negative mention split. */
export function topicTone(issue: CeoIssue): { label: string; tone: string; badge: string; Icon: typeof ThumbsUp } {
  const { pos, neg, neu } = pieTotals(issue);
  if (neg >= pos && neg >= neu)
    return { label: "Negative", tone: "oklch(0.62 0.22 25)", badge: "border-destructive/50 bg-destructive/15 text-destructive", Icon: ThumbsDown };
  if (pos >= neu)
    return { label: "Positive", tone: "oklch(0.72 0.17 150)", badge: "border-success/50 bg-success/15 text-success", Icon: ThumbsUp };
  return { label: "Neutral", tone: "oklch(0.66 0.03 260)", badge: "border-border bg-muted/25 text-muted-foreground", Icon: Minus };
}

/**
 * One topic, as a sentiment-driven dossier card (A8 v3.0): an editorial rank
 * numeral, a glowing sentiment spine + tone wash, the title with an explicit
 * sentiment badge, the description, refined Impressions/Reach stats, and a
 * compact breakdown donut. Lifts + glows on hover; staggers in on load.
 * Shared by the /bumn (v1) and /bumn-v2 (clustered option) dashboards.
 */
export function TopicCard({ issue, rank }: { issue: CeoIssue; rank: number }) {
  const t = topicTone(issue);
  const { Icon } = t;
  return (
    <article
      data-testid={`bumn-topic-${issue.id}`}
      className="topic-card topic-rise panel overflow-hidden p-0"
      style={{ "--tone": t.tone, animationDelay: `${(rank - 1) * 60}ms` } as CSSProperties}
    >
      <span className="topic-spine" aria-hidden />
      <div className="topic-card-bg grid grid-cols-[3rem_1fr] gap-x-4 p-4 pl-6 sm:grid-cols-[3.5rem_1fr]">
        <div className="topic-rank pt-1 font-mono text-4xl font-extrabold sm:text-5xl">{String(rank).padStart(2, "0")}</div>

        {/* Body: ~70% text · ~30% pie, the donut large and centered. */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[7fr_3fr] sm:items-center">
          <div className="min-w-0">
            <div className="flex items-start gap-3">
              <h3 className="min-w-0 flex-1 text-2xl font-semibold leading-snug text-balance">{issue.title}</h3>
              <span
                data-testid="topic-sentiment"
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-base font-bold uppercase tracking-wide ${t.badge}`}
              >
                <Icon className="h-4 w-4" /> {t.label}
              </span>
            </div>

            {issue.aiLine && <p className="mt-2 text-base leading-relaxed text-muted-foreground">{issue.aiLine}</p>}

            <div className="mt-4 flex flex-wrap items-center gap-x-7 gap-y-3 border-t border-border/40 pt-3">
              <Stat icon={BarChart3} label="Impressions" caption="total views" value={fmtCount(issue.mentions)} title="Total views across all posts in this topic" />
              <Stat icon={Eye} label="Reach" caption="users reached" value={fmtCount(issue.reach)} title="Number of users exposed to this topic" />
            </div>
          </div>

          <div className="flex justify-center sm:border-l sm:border-border/40 sm:pl-4">
            <SentimentPie totals={pieTotals(issue)} variant="full" size={48} layout="stack" />
          </div>
        </div>
      </div>
    </article>
  );
}

function Stat({
  icon: Icon,
  label,
  caption,
  value,
  title,
}: {
  icon: typeof BarChart3;
  label: string;
  caption: string;
  value: string;
  title: string;
}) {
  return (
    <div title={title} className="flex items-center gap-2.5">
      <Icon className="h-5 w-5 shrink-0 text-primary/70" />
      <div className="leading-tight">
        <div className="font-mono text-2xl font-bold tabular-nums text-foreground">{value}</div>
        <div className="text-base text-muted-foreground">
          {label} · <span className="text-muted-foreground/70">{caption}</span>
        </div>
      </div>
    </div>
  );
}
