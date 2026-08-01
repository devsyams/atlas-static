"use client";

import { useMemo } from "react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Gauge, Radar, Target, TrendingUp, Users } from "lucide-react";
import { TIER_LABEL, TIER_MULTIPLIER, type ResponseTier } from "@/lib/danantara/ceo/counter-noise";
import { boardThreatResponsePlan } from "@/lib/danantara/ceo/board-threat-simulator";
import type { CeoIssue } from "@/lib/danantara/ceo/types";
import type { TopicsSummary } from "@/lib/danantara/ceo/topics-source";

export function ThreatIndexResponseSimulator({
  issues,
  summary,
  tier,
}: {
  issues: CeoIssue[];
  summary: TopicsSummary | null | undefined;
  tier: ResponseTier;
}) {
  const plan = useMemo(() => boardThreatResponsePlan(issues, summary, tier), [issues, summary, tier]);
  const revealed = true;

  return (
    <section data-testid="board-simulator" className="rounded-xl border border-border/60 bg-card/40 p-3">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/40 pb-2.5">
        <div className="flex items-center gap-1.5 text-base font-bold uppercase tracking-[0.18em] text-primary">
          <Gauge className="h-4 w-4" /> Threat Index Response Simulator
        </div>
        <span className="ml-auto rounded-full border border-border/60 px-2.5 py-0.5 text-base uppercase tracking-[0.16em] text-muted-foreground">
          {TIER_LABEL[tier]} ×{TIER_MULTIPLIER[tier]}
        </span>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="grid gap-3 sm:grid-cols-2">
          <Metric
            data-testid="board-threat-index"
            icon={<Radar className="h-4 w-4" />}
            label="Threat Index now"
            value={plan.threatIndex.toLocaleString("en-US")}
          />
          <Metric
            data-testid="board-post-response"
            icon={<TrendingUp className="h-4 w-4" />}
            label="Modeled after response"
            value={plan.postResponseThreatIndex.toLocaleString("en-US")}
          />
          <Metric
            data-testid="board-total-actions"
            icon={<Target className="h-4 w-4" />}
            label="Total actions"
            value={plan.totalActions.toLocaleString("en-US")}
          />
          <Metric
            data-testid="board-volume-anchor"
            icon={<Users className="h-4 w-4" />}
            label="Volume anchor"
            value={plan.volumeAnchor.toLocaleString("en-US")}
          />
        </div>

        <div className="grid gap-2.5 rounded-lg border border-border/50 bg-background/40 p-3">
          <Row label="KOL posts" value={plan.channelSplit.kol} testId="board-kol" />
          <Row label="Clipper captions" value={plan.channelSplit.clipper} testId="board-clipper" />
          <Row label="Grassroots actions" value={plan.channelSplit.grassroots} testId="board-grassroots" />
          <Row label="Projected reach" value={plan.projectedReach.toLocaleString("en-US")} testId="board-reach" />
          <Row label="Response multiplier" value={plan.multiplier.toFixed(1)} testId="board-multiplier" />
        </div>
      </div>

      {revealed && (
        <p className="mt-3 text-base leading-snug text-muted-foreground">
          Threat Index now {plan.threatIndex} → modeled after response {plan.postResponseThreatIndex} with {plan.totalActions} total
          actions across the board.
        </p>
      )}
    </section>
  );
}

function Metric({
  icon,
  label,
  value,
  ...props
}: ComponentPropsWithoutRef<"div"> & { icon: ReactNode; label: string; value: string }) {
  return (
    <div {...props} className="rounded-lg border border-border/50 bg-background/40 p-3">
      <div className="flex items-center gap-1.5 text-base font-bold uppercase tracking-[0.14em] text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 font-mono text-3xl font-extrabold tabular-nums text-foreground">{value}</div>
    </div>
  );
}

function Row({ label, value, testId }: { label: string; value: number | string; testId: string }) {
  const formatted = typeof value === "number" ? value.toLocaleString("en-US") : value;
  return (
    <div className="flex items-center justify-between gap-3 text-base">
      <span className="text-muted-foreground">{label}</span>
      <span data-testid={testId} className="font-mono text-2xl font-extrabold tabular-nums text-foreground">
        {formatted}
      </span>
    </div>
  );
}
