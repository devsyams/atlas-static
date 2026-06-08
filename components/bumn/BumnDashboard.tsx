"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { BarChart3, Eye, Minus, Radio, RotateCw, ThumbsDown, ThumbsUp } from "lucide-react";
import { SentimentPie } from "@/components/danantara/ceo/SentimentPie";
import { fmtCount, pieTotals } from "@/lib/danantara/ceo/format";
import type { CeoIssue } from "@/lib/danantara/ceo/types";
import type { TopicIntent, TopicsSummary } from "@/lib/danantara/ceo/topics-source";
import { BumnLogo } from "./BumnLogo";
import { IntentShare } from "./IntentShare";
import { SentimentSummary } from "./SentimentSummary";

interface Payload {
  issues?: CeoIssue[];
  summary?: TopicsSummary | null;
  intent?: TopicIntent[];
}

type LiveState = "loading" | "live" | "offline";

/** A usable summary has at least one non-zero sentiment share. */
function hasSummary(summary: TopicsSummary | null | undefined): summary is TopicsSummary {
  if (!summary?.percentage) return false;
  const { positive, negative, neutral } = summary.percentage;
  return Boolean(positive || negative || neutral);
}

/**
 * Per-BUMN CEO sentiment dashboard (A8). Reads the shared live topics feed for
 * this BUMN's code, and shows a sentiment-summary pie + an intent-share pie, then
 * a list of topics each with its own breakdown. Simple, readable (≥16px) for a
 * 40–60 y/o executive; header mirrors the shared /danantara-v2 style.
 */
export function BumnDashboard({
  name,
  topicCode,
  slug,
  short,
  sector,
}: {
  name: string;
  topicCode: string;
  slug?: string;
  short?: string;
  sector?: string;
}) {
  const [data, setData] = useState<Payload | null>(null);
  const [live, setLive] = useState<LiveState>("loading");
  const [refreshing, setRefreshing] = useState(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadTopics = useCallback(
    (fresh = false) => {
      const qs = new URLSearchParams({ code: topicCode });
      if (fresh) qs.set("fresh", "1");
      fetch(`/api/v1/danantara/topics?${qs.toString()}`)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((json: Payload) => {
          if (!mountedRef.current) return;
          setData(json);
          setLive("live");
        })
        .catch(() => {
          if (mountedRef.current) setLive("offline");
        })
        .finally(() => {
          if (mountedRef.current) setRefreshing(false);
        });
    },
    [topicCode],
  );

  useEffect(() => {
    loadTopics(false);
  }, [loadTopics]);

  const issues = data?.issues ?? [];
  const intents = data?.intent ?? [];
  const summary = data?.summary;

  return (
    <div className="space-y-5">
      {/* Header — shared /danantara-v2 style. */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {slug && <BumnLogo slug={slug} name={name} short={short ?? name} colorKey={sector} size={56} className="self-center" />}
          <div>
            <div className="text-base font-bold uppercase tracking-[0.08em] text-primary">BUMN · Sentiment Command</div>
            <h1 className="mt-1 text-2xl font-bold leading-tight sm:text-[28px]">{name}</h1>
            <p className="mt-1.5 text-base text-muted-foreground">
              Public sentiment &amp; topics for {name} · last 7 days · Nexorus AI
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {live === "offline" ? (
            <span className="flex items-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/10 px-3 py-1 text-base font-semibold uppercase tracking-widest text-destructive">
              <Radio className="h-4 w-4" /> Offline
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-3 py-1 text-base font-semibold uppercase tracking-widest text-success">
              <Radio className={`h-4 w-4 ${live === "live" ? "animate-pulse" : ""}`} /> {live === "live" ? "Live" : "Loading"}
            </span>
          )}
          <button
            type="button"
            data-testid="bumn-refresh"
            onClick={() => {
              setRefreshing(true);
              loadTopics(true);
            }}
            disabled={refreshing}
            title="Refresh — re-fetch the latest data from the live feed"
            className="flex items-center gap-1.5 rounded-full border border-border bg-background/40 px-3 py-1 text-base font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
          >
            <RotateCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {live === "offline" && !data ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-base text-muted-foreground">
          Data could not be loaded. Please try Refresh.
        </div>
      ) : (
        <>
          {/* Sentiment summary + intent share. */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="panel p-4">
              <h2 className="mb-3 text-lg font-semibold uppercase tracking-[0.14em] text-muted-foreground">Sentiment Summary</h2>
              {hasSummary(summary) ? (
                <SentimentSummary
                  percentage={summary.percentage}
                  totalImpressions={summary.total_impressions}
                  totalReach={summary.total_reach}
                  drivers={{
                    negative: topDriver(issues, "Negative"),
                    positive: topDriver(issues, "Positive"),
                  }}
                />
              ) : (
                <p className="text-base text-muted-foreground">No sentiment data in this window.</p>
              )}
            </section>
            <section className="panel p-4">
              <h2 className="mb-3 text-lg font-semibold uppercase tracking-[0.14em] text-muted-foreground">Intent Share</h2>
              <IntentShare intents={intents} />
            </section>
          </div>

          {/* Topics list. */}
          <section data-testid="bumn-topics" className="space-y-3">
            <h2 className="text-lg font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Topics {issues.length > 0 && <span className="font-mono">({issues.length})</span>}
            </h2>
            {issues.length === 0 && live === "loading" ? (
              <div data-testid="bumn-topics-skeleton" aria-busy className="space-y-3">
                {Array.from({ length: 4 }, (_, i) => (
                  <TopicCardSkeleton key={i} />
                ))}
              </div>
            ) : issues.length === 0 ? (
              <div data-testid="bumn-empty" className="rounded-lg border border-border/60 bg-card/40 p-6 text-base text-muted-foreground">
                No topics in this window.
              </div>
            ) : (
              issues.map((issue, idx) => <TopicCard key={issue.id} issue={issue} rank={idx + 1} />)
            )}
          </section>
        </>
      )}
    </div>
  );
}

/** A shimmering placeholder card, matching TopicCard's shape, shown while topics load. */
function TopicCardSkeleton() {
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
function topDriver(issues: CeoIssue[], want: "Negative" | "Positive"): { title: string; reach: number } | undefined {
  const top = issues
    .filter((i) => topicTone(i).label === want)
    .sort((a, b) => b.reach - a.reach)[0];
  return top ? { title: top.title, reach: top.reach } : undefined;
}

/** Dominant tone of a topic from its positive/neutral/negative mention split. */
function topicTone(issue: CeoIssue): { label: string; tone: string; badge: string; Icon: typeof ThumbsUp } {
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
 */
function TopicCard({ issue, rank }: { issue: CeoIssue; rank: number }) {
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
