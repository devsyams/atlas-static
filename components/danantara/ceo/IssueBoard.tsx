"use client";

import { Flame, TrendingUp } from "lucide-react";
import { ESCALATING_THRESHOLD, RISING_THRESHOLD } from "@/lib/danantara/ceo/engine";
import { Sparkline } from "./Sparkline";
import { RankBadge } from "./RankBadge";
import { SentimentSplit } from "./SentimentSplit";
import type { CeoIssue } from "@/lib/danantara/ceo/types";
import { SOV_COLORS } from "@/lib/danantara/ui";

const STATUS_BADGE: Record<CeoIssue["status"], { label: string; cls: string }> = {
  normal: { label: "", cls: "" },
  rising: { label: "NAIK", cls: "bg-warning/15 text-warning border-warning/40" },
  escalating: { label: "ESKALASI", cls: "bg-destructive/15 text-destructive border-destructive/50 ceo-siren" },
};

/** Top-20 issues ranked by reach. Rows re-rank live; zero interaction needed. */
export function IssueBoard({ issues, onSelect }: { issues: CeoIssue[]; onSelect?: (id: string) => void }) {
  return (
    <div data-testid="ceo-issues" className="panel flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Flame className="h-3.5 w-3.5 text-primary" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">20 Isu Utama Danantara</span>
        <span className="ml-auto text-[10px] uppercase tracking-widest text-muted-foreground">Peringkat jangkauan</span>
      </div>
      <ol className="min-h-0 flex-1 overflow-y-auto">
        {issues.map((issue, rank) => {
          const badge = STATUS_BADGE[issue.status];
          return (
            <li
              key={issue.id}
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
                  <span className="font-mono text-sm tabular-nums text-muted-foreground">{rank + 1}</span>
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
        })}
      </ol>
    </div>
  );
}
