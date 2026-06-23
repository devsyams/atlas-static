"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BarChart3, Eye, Hash, Radio, RefreshCw, ThumbsDown, ThumbsUp } from "lucide-react";
import type { CeoIssue, CeoState } from "@/lib/danantara/ceo/types";
import type { TopicIntent, TopicsSummary } from "@/lib/danantara/ceo/topics-source";
import { biggestThreat, crisisIndex } from "@/lib/danantara/ceo/crisis";
import { dominantTone, topWin } from "@/lib/danantara/ceo/briefing";
import type { TrendInputPoint } from "@/lib/danantara/ceo/trend";
import { fmtCount } from "@/lib/danantara/ceo/format";
import { withAlpha } from "@/lib/danantara/ui";
import { SentimentBreakdown } from "@/components/danantara/ceo/SentimentBreakdown";
import { DetailModal, type DetailSelection } from "@/components/danantara/ceo/DetailModal";
// import { SentimentMomentum } from "./SentimentMomentum"; // hidden — see momentum render below
import { TopicCard, TopicCardSkeleton } from "@/components/bumn/TopicCard";
import { IntentShare } from "@/components/bumn/IntentShare";

type Live = "loading" | "live" | "offline";

const TONE_COPY = {
  positive: { word: "broadly positive", className: "text-success" },
  negative: { word: "under pressure", className: "text-destructive" },
  neutral: { word: "largely neutral", className: "text-muted-foreground" },
} as const;

/**
 * Danantara Executive Briefing (A11) — the drill-down behind the /krisis alarm,
 * driven only by the Danantara-wide feed (`danantara_main`). A top-down read for a
 * busy CEO: a one-line verdict + KPIs, the biggest win and the main concern, the
 * share of voice, then every topic. English chrome; topic titles stay Indonesian.
 */
export function DanantaraBrief() {
  const [issues, setIssues] = useState<CeoIssue[]>([]);
  const [summary, setSummary] = useState<TopicsSummary | null>(null);
  const [intent, setIntent] = useState<TopicIntent[]>([]);
  const [trend, setTrend] = useState<TrendInputPoint[] | null>(null);
  const [live, setLive] = useState<Live>("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState<DetailSelection | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback((fresh = false) => {
    fetch(`/api/v1/danantara/topics${fresh ? "?fresh=1" : ""}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j: { issues?: CeoIssue[]; summary?: TopicsSummary; intent?: TopicIntent[] }) => {
        if (!mountedRef.current) return;
        setIssues(Array.isArray(j.issues) ? j.issues : []);
        setSummary(j.summary ?? null);
        setIntent(Array.isArray(j.intent) ? j.intent : []);
        setLive("live");
      })
      .catch(() => {
        if (mountedRef.current) setLive("offline");
      })
      .finally(() => {
        if (mountedRef.current) setRefreshing(false);
      });
  }, []);

  // The trend feed is independent — if it fails the briefing still renders (momentum just omitted).
  const loadTrend = useCallback((fresh = false) => {
    fetch(`/api/v1/danantara/sentiment-trend${fresh ? "?fresh=1" : ""}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j: { points?: TrendInputPoint[] }) => {
        if (mountedRef.current) setTrend(Array.isArray(j.points) ? j.points : null);
      })
      .catch(() => {
        if (mountedRef.current) setTrend(null);
      });
  }, []);

  useEffect(() => {
    load(false);
    loadTrend(false);
  }, [load, loadTrend]);

  const reading = crisisIndex(issues, summary);
  const tone = dominantTone(summary);
  const win = topWin(issues);
  const concern = biggestThreat(issues);
  const detailState = useMemo<CeoState>(() => ({ tickCount: 0, issues, bumn: [] }), [issues]);
  const share = summary
    ? { positive: summary.percentage.positive, neutral: summary.percentage.neutral, negative: summary.percentage.negative }
    : { positive: 0, neutral: 0, negative: 0 };
  const toneCopy = TONE_COPY[tone.tone];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-10">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border/60 pb-4">
        <Link
          href="/danantara/krisis"
          data-testid="brief-back-link"
          aria-label="Back to crisis gate"
          title="Back to crisis gate"
          className="rounded-full border border-border bg-card/50 p-2.5 text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <Image src="/danantara.png" alt="Danantara" width={40} height={40} className="h-10 w-10 rounded-lg object-contain" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            <span className="flex items-center gap-1 text-success">
              <Radio className="h-3 w-3" /> Live
            </span>
            Danantara · Media Briefing
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Executive Briefing</h1>
        </div>
        {live === "live" && (
          <span
            data-testid="brief-threat-chip"
            className="rounded-full border px-3 py-1 text-sm font-bold uppercase tracking-[0.16em]"
            style={{ color: reading.color, borderColor: withAlpha(reading.color, 0.45), background: withAlpha(reading.color, 0.12) }}
          >
            {reading.level} · {reading.score}
          </span>
        )}
        <button
          type="button"
          onClick={() => {
            setRefreshing(true);
            load(true);
            loadTrend(true);
          }}
          aria-label="Refresh"
          title="Refresh"
          className="rounded-full border border-border bg-card/50 p-2.5 text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </header>

      {live === "offline" ? (
        <div data-testid="brief-offline" className="rounded-2xl border border-border/50 py-16 text-center text-muted-foreground">
          <p className="text-2xl font-semibold">Data unavailable</p>
          <p className="mt-1 text-sm">The Danantara feed could not be reached. Try refreshing.</p>
        </div>
      ) : (
        <>
          {/* Verdict hero */}
          <section data-testid="brief-verdict" className="panel flex flex-col gap-5 p-6">
            <p className="text-lg leading-relaxed text-muted-foreground sm:text-xl">
              Public sentiment toward Danantara is{" "}
              {live === "loading" ? (
                <span className="text-foreground">…</span>
              ) : (
                <span className={`font-bold ${toneCopy.className}`}>
                  {toneCopy.word} ({Math.round(tone.pct)}%)
                </span>
              )}
              {" "}— here is the full picture.
            </p>
            <SentimentBreakdown share={share} size="md" />
            {/* Sentiment trend hidden — re-enable by uncommenting */}
            {/* {live === "live" && trend && trend.length >= 2 && <SentimentMomentum points={trend} />} */}
            <div className="grid grid-cols-3 gap-3">
              <Kpi icon={<Eye className="h-4 w-4" />} label="Total reach" value={fmtCount(summary?.total_reach ?? 0)} />
              <Kpi icon={<BarChart3 className="h-4 w-4" />} label="Impressions" value={fmtCount(summary?.total_impressions ?? 0)} />
              <Kpi icon={<Hash className="h-4 w-4" />} label="Topics" value={String(issues.length)} />
            </div>
          </section>

          {/* What's driving it */}
          {live === "live" && (win || concern) && (
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground">What&apos;s driving it</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {win && <DriverCard kind="win" issue={win} onClick={() => setDetail({ type: "issue", id: win.id })} />}
                {concern && <DriverCard kind="concern" issue={concern} onClick={() => setDetail({ type: "issue", id: concern.id })} />}
              </div>
            </section>
          )}

          {/* Share of voice */}
          {live === "live" && intent.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground">Share of voice</h2>
              <IntentShare intents={intent} />
            </section>
          )}

          {/* All topics */}
          <section data-testid="brief-topics" className="flex flex-col gap-3">
            <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground">
              All topics{live === "live" ? ` (${issues.length})` : ""}
            </h2>
            <ol className="flex flex-col gap-3">
              {live === "loading"
                ? Array.from({ length: 4 }, (_, i) => <TopicCardSkeleton key={i} />)
                : issues.map((issue, idx) => (
                    <li key={issue.id}>
                      <button
                        type="button"
                        data-testid={`brief-topic-${issue.id}`}
                        onClick={() => setDetail({ type: "issue", id: issue.id })}
                        className="block w-full text-left"
                      >
                        <TopicCard issue={issue} rank={idx + 1} />
                      </button>
                    </li>
                  ))}
            </ol>
          </section>
        </>
      )}

      {detail && (
        <DetailModal selection={detail} state={detailState} onClose={() => setDetail(null)} onNavigate={setDetail} />
      )}
    </div>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-card/40 px-4 py-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
        <span className="text-primary/70">{icon}</span>
        {label}
      </div>
      <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-foreground">{value}</div>
    </div>
  );
}

function DriverCard({ kind, issue, onClick }: { kind: "win" | "concern"; issue: CeoIssue; onClick: () => void }) {
  const win = kind === "win";
  const Icon = win ? ThumbsUp : ThumbsDown;
  const accent = win ? "oklch(0.72 0.16 155)" : "oklch(0.62 0.22 25)";
  return (
    <button
      type="button"
      data-testid={`brief-driver-${kind}`}
      onClick={onClick}
      className="flex flex-col gap-2 rounded-2xl border bg-card/40 p-5 text-left transition-colors hover:bg-card/70"
      style={{ borderColor: withAlpha(accent, 0.4) }}
    >
      <span className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.2em]" style={{ color: accent }}>
        <Icon className="h-4 w-4" /> {win ? "Biggest win" : "Main concern"}
      </span>
      <span className="text-lg font-semibold leading-snug text-foreground">{issue.title}</span>
      {issue.aiLine && <span className="line-clamp-2 text-sm text-muted-foreground">{issue.aiLine}</span>}
      <span className="mt-1 font-mono text-[13px] text-muted-foreground">reach {fmtCount(issue.reach)}</span>
    </button>
  );
}
