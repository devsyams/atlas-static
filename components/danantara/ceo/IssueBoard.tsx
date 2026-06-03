"use client";

import { Flame, TrendingDown, TrendingUp } from "lucide-react";
import { ESCALATING_THRESHOLD, groupIssuesBySentiment, RISING_THRESHOLD, sentimentTotals } from "@/lib/danantara/ceo/engine";
import { Sparkline } from "./Sparkline";
import { RankBadge } from "./RankBadge";
import { SentimentPie } from "./SentimentPie";
import { SentimentSplit } from "./SentimentSplit";
import type { CeoIssue } from "@/lib/danantara/ceo/types";
import { SOV_COLORS } from "@/lib/danantara/ui";

const STATUS_BADGE: Record<CeoIssue["status"], { label: string; cls: string }> = {
  normal: { label: "", cls: "" },
  rising: { label: "NAIK", cls: "bg-warning/15 text-warning border-warning/40" },
  escalating: { label: "ESKALASI", cls: "bg-destructive/15 text-destructive border-destructive/50 ceo-siren" },
};

function IssueRow({ issue, rank, onSelect }: { issue: CeoIssue; rank: number; onSelect?: (id: string) => void }) {
  const badge = STATUS_BADGE[issue.status];
  return (
    <li
      data-testid={`issue-row-${issue.id}`}
      className={`border-b border-border/40 last:border-b-0 ${issue.status === "escalating" ? "ceo-flash" : ""}`}
    >
      <button
        type="button"
        data-testid={`btn-issue-row-${issue.id}`}
        onClick={() => onSelect?.(issue.id)}
        className="ceo-row flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left hover:bg-card/80"
      >
        <div className="flex w-8 shrink-0 flex-col items-end gap-0.5">
          <span className="font-mono text-sm tabular-nums text-muted-foreground">{rank}</span>
          <RankBadge delta={issue.rankDelta} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[13px] font-medium leading-snug">{issue.title}</span>
            {badge.label && (
              <span className={`shrink-0 rounded border px-1 py-px text-[9px] font-bold tracking-wider ${badge.cls}`}>
                {badge.label}
              </span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
            <span>{(issue.reach / 1_000_000).toFixed(1)} jt jangkauan</span>
            <span>·</span>
            <SentimentSplit pos={issue.posMentions} neg={issue.negMentions} total={issue.mentions} />
          </div>
        </div>
        <Sparkline
          data={issue.history}
          stroke={issue.status === "escalating" ? SOV_COLORS.weak : issue.status === "rising" ? SOV_COLORS.watch : SOV_COLORS.strong}
        />
        <span
          className={`flex w-16 shrink-0 items-center justify-end gap-0.5 font-mono text-xs tabular-nums ${
            issue.velocity >= ESCALATING_THRESHOLD ? "text-destructive" : issue.velocity >= RISING_THRESHOLD ? "text-warning" : "text-muted-foreground"
          }`}
        >
          <TrendingUp className="h-3 w-3" />
          {issue.velocity >= 0 ? "+" : ""}
          {Math.round(issue.velocity)}%
        </span>
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
        className={`sticky top-0 z-10 flex items-center gap-1.5 border-y border-border/60 bg-card px-3 py-1.5 ${
          positive ? "text-success" : "text-destructive"
        }`}
      >
        <Icon className="h-3 w-3" />
        <span className="text-[10px] font-bold tracking-[0.18em]">
          {positive ? "TOPIK POSITIF" : "TOPIK NEGATIF"}
        </span>
        <span className="font-mono text-[10px] tabular-nums">({issues.length})</span>
      </div>
      {issues.length === 0 ? (
        <p className="px-3 py-3 text-[11px] text-muted-foreground">
          Tidak ada topik {positive ? "positif" : "negatif"} saat ini.
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
 * Danantara topics grouped by dominant sentiment (AC12): positive section first,
 * negative below, each ranked by reach, headed by the aggregate sentiment pie (AC14).
 */
export function IssueBoard({ issues, onSelect }: { issues: CeoIssue[]; onSelect?: (id: string) => void }) {
  const { positive, negative } = groupIssuesBySentiment(issues);
  const totals = sentimentTotals(issues);

  return (
    <div data-testid="ceo-issues" className="panel flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Flame className="h-3.5 w-3.5 text-primary" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">Isu Danantara</span>
        <span className="ml-auto text-[10px] uppercase tracking-widest text-muted-foreground">
          {issues.length} topik · positif vs negatif
        </span>
      </div>
      <div className="border-b border-border px-3 py-2">
        <SentimentPie totals={totals} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <IssueGroup variant="positive" issues={positive} onSelect={onSelect} />
        <IssueGroup variant="negative" issues={negative} onSelect={onSelect} />
      </div>
    </div>
  );
}
