"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Radio, RotateCw } from "lucide-react";
import { SentimentPie } from "@/components/danantara/ceo/SentimentPie";
import { fmtCount, pieTotals, sentimentTint } from "@/lib/danantara/ceo/format";
import type { CeoIssue } from "@/lib/danantara/ceo/types";
import type { TopicIntent, TopicsSummary } from "@/lib/danantara/ceo/topics-source";
import { IntentPie } from "./IntentPie";
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
export function BumnDashboard({ name, topicCode }: { name: string; topicCode: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [live, setLive] = useState<LiveState>("loading");
  const [refreshing, setRefreshing] = useState(false);
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

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
        <div>
          <div className="text-base font-bold uppercase tracking-[0.08em] text-primary">BUMN · Sentiment Command</div>
          <h1 className="mt-1 text-2xl font-bold leading-tight sm:text-[28px]">{name}</h1>
          <p className="mt-1.5 text-base text-muted-foreground">
            Public sentiment &amp; topics for {name} · last 7 days · Nexorus AI
          </p>
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
                />
              ) : (
                <p className="text-base text-muted-foreground">No sentiment data in this window.</p>
              )}
            </section>
            <section className="panel p-4">
              <h2 className="mb-3 text-lg font-semibold uppercase tracking-[0.14em] text-muted-foreground">Intent Share</h2>
              <IntentPie intents={intents} />
            </section>
          </div>

          {/* Topics list. */}
          <section data-testid="bumn-topics" className="space-y-3">
            <h2 className="text-lg font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Topics {issues.length > 0 && <span className="font-mono">({issues.length})</span>}
            </h2>
            {issues.length === 0 ? (
              <div data-testid="bumn-empty" className="rounded-lg border border-border/60 bg-card/40 p-6 text-base text-muted-foreground">
                {live === "loading" ? "Loading topics…" : "No topics in this window."}
              </div>
            ) : (
              issues.map((issue) => <TopicCard key={issue.id} issue={issue} />)
            )}
          </section>
        </>
      )}
    </div>
  );
}

/** Dominant tone of a topic from its positive/neutral/negative mention split. */
function topicTone(issue: CeoIssue): { label: string; cls: string } {
  const { pos, neg, neu } = pieTotals(issue);
  if (neg >= pos && neg >= neu) return { label: "Negative", cls: "border-destructive/50 bg-destructive/15 text-destructive" };
  if (pos >= neu) return { label: "Positive", cls: "border-success/50 bg-success/15 text-success" };
  return { label: "Neutral", cls: "border-border bg-muted/20 text-muted-foreground" };
}

/** One topic: title + sentiment badge, description, Impressions/Reach (with hints), breakdown pie. */
function TopicCard({ issue }: { issue: CeoIssue }) {
  const tone = topicTone(issue);
  return (
    <article
      data-testid={`bumn-topic-${issue.id}`}
      className="panel p-4"
      style={{ backgroundColor: sentimentTint(issue.sentiment) }}
    >
      <div className="flex items-start gap-3">
        <h3 className="min-w-0 flex-1 text-2xl font-semibold leading-snug text-balance">{issue.title}</h3>
        <span
          data-testid="topic-sentiment"
          className={`shrink-0 rounded-full border px-3 py-1 text-base font-bold uppercase tracking-wide ${tone.cls}`}
        >
          {tone.label}
        </span>
      </div>
      {issue.aiLine && <p className="mt-1.5 text-base leading-relaxed text-muted-foreground">{issue.aiLine}</p>}
      <div className="mt-3 flex flex-wrap items-start gap-4">
        <Metric label="Impressions" value={fmtCount(issue.mentions)} hint="Total views across all posts in this topic" />
        <Metric label="Reach" value={fmtCount(issue.reach)} hint="Number of users exposed to this topic" />
        <div className="ml-auto">
          <SentimentPie totals={pieTotals(issue)} variant="full" />
        </div>
      </div>
    </article>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/30 px-3 py-2.5">
      <div className="text-base font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-mono text-2xl font-bold tabular-nums text-foreground">{value}</div>
      <p className="mt-1 max-w-[14rem] text-base leading-snug text-muted-foreground">{hint}</p>
    </div>
  );
}
