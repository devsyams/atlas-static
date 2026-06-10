"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Radio, RotateCw } from "lucide-react";
import { TONE } from "@/components/danantara/ceo/SentimentBreakdown";
import type { CeoIssue } from "@/lib/danantara/ceo/types";
import type { TopicIntent, TopicsSummary } from "@/lib/danantara/ceo/topics-source";
import { BumnLogo } from "./BumnLogo";
import { IntentShare } from "./IntentShare";
import { CLUSTER_ID, SentimentSummarySplit } from "./SentimentSummarySplit";
import { TopicCard, TopicCardSkeleton, topDriver, topicTone } from "./TopicCard";

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
 * Per-BUMN CEO sentiment dashboard — **option 2** (A8 v4.0 / AC10). Same data,
 * header, and BFF call as `/bumn`'s `BumnDashboard`, but: the Sentiment Summary
 * is split into side-by-side **Negative (left) / Positive (right)** boxes, and
 * the topics are **clustered by dominant tone — Negative first, Positive after,
 * Neutral trailing**. Clicking a summary box jumps to its cluster.
 */
export function BumnDashboardV2({
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

  // Cluster the topics by dominant tone — negative first (AC10b).
  const negatives = issues.filter((i) => topicTone(i).label === "Negative");
  const positives = issues.filter((i) => topicTone(i).label === "Positive");
  const neutrals = issues.filter((i) => topicTone(i).label === "Neutral");

  return (
    <div className="space-y-5">
      {/* Header — identical to the /bumn option. */}
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
          {/* Split sentiment summary — the negative/positive kanan-kiri boxes. */}
          <section className="panel p-4">
            <h2 className="mb-3 text-lg font-semibold uppercase tracking-[0.14em] text-muted-foreground">Sentiment Summary</h2>
            {hasSummary(summary) ? (
              <SentimentSummarySplit
                percentage={summary.percentage}
                totalImpressions={summary.total_impressions}
                totalReach={summary.total_reach}
                counts={{ negative: negatives.length, positive: positives.length }}
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

          {/* Topic clusters — negative first, positive after, neutral trailing. */}
          {issues.length === 0 && live === "loading" ? (
            <section data-testid="bumn-topics-skeleton" aria-busy className="space-y-3">
              {Array.from({ length: 4 }, (_, i) => (
                <TopicCardSkeleton key={i} />
              ))}
            </section>
          ) : (
            <>
              <TopicCluster tone="negative" issues={negatives} always />
              <TopicCluster tone="positive" issues={positives} always />
              <TopicCluster tone="neutral" issues={neutrals} />
            </>
          )}
        </>
      )}
    </div>
  );
}

/**
 * One tone cluster: a tinted header (icon + label + count) over the dossier
 * cards, ranked within the cluster. With `always`, an empty cluster still
 * renders a placeholder — so the summary boxes always have a jump target.
 */
function TopicCluster({ tone, issues, always = false }: { tone: "negative" | "positive" | "neutral"; issues: CeoIssue[]; always?: boolean }) {
  if (issues.length === 0 && !always) return null;
  const t = TONE[tone];
  const Icon = t.Icon;
  return (
    <section id={CLUSTER_ID[tone]} data-testid={CLUSTER_ID[tone]} className="scroll-mt-24 space-y-3">
      <h2 className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-lg font-semibold uppercase tracking-[0.14em] ${t.soft} ${t.text}`}>
        <Icon className="h-5 w-5 shrink-0" /> {t.label} Topics{" "}
        {issues.length > 0 && <span className="font-mono">({issues.length})</span>}
      </h2>
      {issues.length === 0 ? (
        <div className="rounded-lg border border-border/60 bg-card/40 p-6 text-base text-muted-foreground">
          No {t.label.toLowerCase()} topics in this window.
        </div>
      ) : (
        issues.map((issue, idx) => <TopicCard key={issue.id} issue={issue} rank={idx + 1} />)
      )}
    </section>
  );
}
