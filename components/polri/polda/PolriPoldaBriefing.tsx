"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, BarChart3, Eye, Hash, Radio, ThumbsDown, ThumbsUp } from "lucide-react";
import { DetailModal, type DetailSelection } from "@/components/danantara/ceo/DetailModal";
import { SentimentBreakdown } from "@/components/danantara/ceo/SentimentBreakdown";
import { IntentShare } from "@/components/bumn/IntentShare";
import { TopicCard } from "@/components/bumn/TopicCard";
import { fmtCount } from "@/lib/danantara/ceo/format";
import type { CeoState } from "@/lib/danantara/ceo/types";
import { getPoldaBriefing } from "@/lib/polri/mock";

export function PolriPoldaBriefing({ slug }: { slug: string }) {
  const briefing = getPoldaBriefing(slug);
  const [detail, setDetail] = useState<DetailSelection | null>(null);

  const detailState = useMemo<CeoState>(
    () => ({ tickCount: 0, issues: briefing?.topics ?? [], bumn: [] }),
    [briefing],
  );

  if (!briefing) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-10">
        <Link href="/polri" className="inline-flex items-center gap-2 text-base text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Polri
        </Link>
        <div className="panel p-8 text-center text-muted-foreground">Polda briefing unavailable.</div>
      </div>
    );
  }

  const totalMentions = briefing.topics.reduce((total, topic) => total + topic.mentions, 0);
  const totalReach = briefing.topics.reduce((total, topic) => total + topic.reach, 0);
  const totalPositive = briefing.topics.reduce((total, topic) => total + topic.posMentions, 0);
  const totalNegative = briefing.topics.reduce((total, topic) => total + topic.negMentions, 0);
  const totalNeutral = Math.max(0, totalMentions - totalPositive - totalNegative);
  const share =
    totalMentions > 0
      ? {
          positive: Math.round((totalPositive / totalMentions) * 100),
          neutral: Math.round((totalNeutral / totalMentions) * 100),
          negative: Math.round((totalNegative / totalMentions) * 100),
        }
      : { positive: 0, neutral: 0, negative: 0 };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-10">
      <header className="flex items-center gap-3 border-b border-border/60 pb-4">
        <Link
          href="/polri"
          data-testid="brief-back-link"
          aria-label="Back to Polri command"
          title="Back to Polri command"
          className="rounded-full border border-border bg-card/50 p-2.5 text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <Image
          src={`/polri/polda/${briefing.polda.id}.png`}
          alt={`${briefing.polda.name} logo`}
          width={48}
          height={48}
          className="h-12 w-12 rounded-lg bg-white/90 object-contain p-1"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            <span className="flex items-center gap-1 text-warning">
              <Radio className="h-3 w-3" /> Mock
            </span>
            {briefing.polda.name} · Media Briefing
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Executive Briefing</h1>
        </div>
        <span
          data-testid="brief-threat-chip"
          className={`rounded-full border px-3 py-1 text-sm font-bold uppercase tracking-[0.16em] ${
            briefing.polda.sentiment >= 0
              ? "border-success/40 bg-success/10 text-success"
              : "border-destructive/40 bg-destructive/10 text-destructive"
          }`}
        >
          Sentiment {briefing.polda.sentiment > 0 ? "+" : ""}
          {Math.round(briefing.polda.sentiment)}
        </span>
      </header>

      <section data-testid="brief-verdict" className="panel flex flex-col gap-5 p-5">
        <p className="text-lg leading-relaxed text-muted-foreground sm:text-xl">
          Public sentiment toward {briefing.polda.name} is{" "}
          <span className={briefing.polda.sentiment >= 0 ? "font-bold text-success" : "font-bold text-destructive"}>
            {briefing.polda.sentiment >= 0 ? "broadly positive" : "under pressure"} ({Math.max(share.positive, share.negative, share.neutral)}%)
          </span>
          {" "}— here is the full picture.
        </p>
        <SentimentBreakdown share={share} size="md" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Kpi icon={<Eye className="h-4 w-4" />} label="Total reach" value={fmtCount(totalReach)} />
          <Kpi icon={<BarChart3 className="h-4 w-4" />} label="Impressions" value={fmtCount(totalMentions)} />
          <Kpi icon={<Hash className="h-4 w-4" />} label="Topics" value={String(briefing.topics.length)} />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground">What&apos;s driving it</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {briefing.positive && (
            <DriverCard
              kind="win"
              title="Biggest win"
              topic={briefing.positive}
              onClick={() => setDetail({ type: "issue", id: briefing.positive!.id })}
            />
          )}
          {briefing.negative && (
            <DriverCard
              kind="concern"
              title="Main concern"
              topic={briefing.negative}
              onClick={() => setDetail({ type: "issue", id: briefing.negative!.id })}
            />
          )}
        </div>
      </section>

      {briefing.intent.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground">Share of voice</h2>
          <IntentShare intents={briefing.intent} />
        </section>
      )}

      <section data-testid="brief-topics" className="flex flex-col gap-3">
        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground">All topics ({briefing.topics.length})</h2>
        <ol className="flex flex-col gap-3">
          {briefing.topics.map((topic, index) => (
            <li key={topic.id}>
              <button
                type="button"
                data-testid={`brief-topic-${topic.id}`}
                onClick={() => setDetail({ type: "issue", id: topic.id })}
                className="block w-full text-left"
              >
                <TopicCard issue={topic} rank={index + 1} />
              </button>
            </li>
          ))}
        </ol>
      </section>

      {detail && <DetailModal selection={detail} state={detailState} onClose={() => setDetail(null)} onNavigate={setDetail} />}
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

function DriverCard({
  kind,
  title,
  topic,
  onClick,
}: {
  kind: "win" | "concern";
  title: string;
  topic: { id: string; title: string; aiLine: string; reach: number };
  onClick: () => void;
}) {
  const positive = kind === "win";
  const Icon = positive ? ThumbsUp : ThumbsDown;
  return (
    <button
      type="button"
      data-testid={`brief-driver-${kind}`}
      onClick={onClick}
      className={`panel p-4 text-left transition-colors hover:bg-card/70 ${
        positive ? "border-success/30" : "border-destructive/30"
      }`}
    >
      <span className={`flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.2em] ${positive ? "text-success" : "text-destructive"}`}>
        <Icon className="h-4 w-4" /> {title}
      </span>
      <span className="mt-2 block text-lg font-semibold leading-snug text-foreground">{topic.title}</span>
      <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">{topic.aiLine}</span>
      <span className="mt-3 block font-mono text-[13px] text-muted-foreground">reach {fmtCount(topic.reach)}</span>
    </button>
  );
}
