"use client";

import { Newspaper, ScanEye, Siren, Sparkles } from "lucide-react";
import { ESCALATING_THRESHOLD, RISING_THRESHOLD } from "@/lib/danantara/ceo/engine";
import type { BumnSentiment, CeoIssue } from "@/lib/danantara/ceo/types";
import { SentimentSplit } from "./SentimentSplit";
import { TrendChart } from "./TrendChart";

/** Auto-rotating deep-dive. The dashboard does the clicking for the CEO. */
export function Spotlight({ issue, bumn }: { issue: CeoIssue | undefined; bumn: BumnSentiment[] }) {
  if (!issue) return <div data-testid="ceo-spotlight" className="panel h-full" />;
  const escalating = issue.status === "escalating";
  const related = bumn.filter((b) => issue.relatedBumn.includes(b.id));

  return (
    <div
      data-testid="ceo-spotlight"
      className={`panel flex h-full flex-col overflow-hidden ${escalating ? "border-destructive/60" : ""}`}
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <ScanEye className="h-3.5 w-3.5 text-primary" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">Sorotan Otomatis</span>
        {escalating && (
          <span className="ceo-siren ml-auto flex items-center gap-1 rounded border border-destructive/50 bg-destructive/15 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-destructive">
            <Siren className="h-3 w-3" /> ESKALASI — DIPANTAU
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        <div>
          <h2 className="text-lg font-semibold leading-snug">{issue.title}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-3 font-mono text-xs tabular-nums text-muted-foreground">
            <span>{(issue.reach / 1_000_000).toFixed(1)} jt jangkauan</span>
            <span>{issue.mentions.toLocaleString("id-ID")} sebutan</span>
            <span className={issue.velocity >= ESCALATING_THRESHOLD ? "font-bold text-destructive" : issue.velocity >= RISING_THRESHOLD ? "text-warning" : ""}>
              {issue.velocity >= 0 ? "+" : ""}
              {Math.round(issue.velocity)}% / 2 jam
            </span>
          </div>
        </div>

        <TrendChart history={issue.history} escalating={escalating} />

        <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 p-2.5">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <p className="text-[13px] leading-relaxed">{issue.aiLine}</p>
        </div>

        <SentimentSplit pos={issue.posMentions} neg={issue.negMentions} total={issue.mentions} variant="full" />

        <div className="space-y-1.5">
          {issue.headlines.map((headline) => (
            <div key={headline.title} className="flex items-start gap-2 text-[12px]">
              <Newspaper className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 leading-snug">{headline.title}</span>
              <span className="shrink-0 text-[10px] text-muted-foreground">
                {headline.source} · {headline.time}
              </span>
            </div>
          ))}
        </div>

        {related.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {related.map((b) => (
              <span
                key={b.id}
                className="rounded-full border border-border bg-background/40 px-2 py-0.5 text-[10px] font-medium"
              >
                {b.short}{" "}
                <span className={b.sentiment < 0 ? "text-destructive" : "text-success"}>
                  {b.sentiment > 0 ? "+" : ""}
                  {Math.round(b.sentiment)}
                </span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
