"use client";

import { useMemo } from "react";
import { Gauge } from "lucide-react";
import {
  TIER_LABEL,
  TIER_MULTIPLIER,
  TIER_STRATEGY,
  responseCalculator,
  type ResponseTier,
} from "@/lib/danantara/ceo/counter-noise";
import { boardThreatResponsePlan } from "@/lib/danantara/ceo/board-threat-simulator";
import type { CeoIssue } from "@/lib/danantara/ceo/types";
import type { TopicsSummary } from "@/lib/danantara/ceo/topics-source";

/** Left→right, strongest first — the executive reads the ceiling before the floor. */
const TIER_ORDER: ResponseTier[] = ["enterprise", "professional", "basic"];

/** The default tier — the Threat Index headline and the topic-card volume both use it. */
const DEFAULT_TIER: ResponseTier = "professional";

/**
 * Per-tier accent classes, kept static so Tailwind never tree-shakes them.
 * Enterprise red (`destructive`) · Professional sky blue (`primary`) · Basic grey.
 */
const TIER_UI: Record<ResponseTier, { card: string; name: string; value: string; pill: string }> = {
  enterprise: {
    card: "border-destructive/50",
    name: "text-destructive",
    value: "text-destructive",
    pill: "border-destructive/40 text-destructive",
  },
  professional: {
    card: "border-primary/60",
    name: "text-primary",
    value: "text-primary",
    pill: "border-primary/40 text-primary",
  },
  basic: {
    card: "border-border",
    name: "text-muted-foreground",
    value: "text-foreground",
    pill: "border-border text-muted-foreground",
  },
};

/**
 * Threat Index Response Simulator (A14 v2.0) — a **side-by-side comparison** of all three
 * response tiers, no longer a one-tier-at-a-time view behind a toggle. A compact Threat
 * Index headline (now → modeled post-response, at the default tier) sits above three
 * colour-coded cards: each scales the **same** negative-post volume anchor by its own noise
 * multiplier (`responseCalculator`) and shows the counter-actions plus the Clipper / Homeless
 * / KOL split. All pure and client-side; the executive compares Basic/Professional/Enterprise
 * at a glance instead of clicking through them.
 */
export function ThreatIndexResponseSimulator({
  issues,
  summary,
}: {
  issues: CeoIssue[];
  summary: TopicsSummary | null | undefined;
}) {
  // The default tier drives the headline; `volumeAnchor` is the board's negative-post
  // baseline, which every card then multiplies by its own tier factor.
  const plan = useMemo(() => boardThreatResponsePlan(issues, summary, DEFAULT_TIER), [issues, summary]);
  const anchor = plan.volumeAnchor;

  return (
    <section data-testid="board-simulator" className="rounded-xl border border-border/60 bg-card/40 p-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border/40 pb-2.5">
        <div className="flex items-center gap-1.5 text-base font-bold uppercase tracking-[0.18em] text-primary">
          <Gauge className="h-4 w-4" /> Threat Index Response Simulator
        </div>
        {/* Threat Index headline: now → modeled post-response, at the default tier. */}
        <div className="ml-auto flex items-center gap-2 text-base text-muted-foreground">
          <span className="uppercase tracking-[0.16em]">Threat Index</span>
          <span
            data-testid="board-threat-index"
            className="font-mono text-2xl font-extrabold tabular-nums text-foreground"
          >
            {plan.threatIndex}
          </span>
          <span aria-hidden>→</span>
          <span
            data-testid="board-post-response"
            className="font-mono text-2xl font-extrabold tabular-nums text-success"
          >
            {plan.postResponseThreatIndex}
          </span>
          <span className="uppercase tracking-[0.16em]">after response</span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
        {TIER_ORDER.map((tier) => {
          const ui = TIER_UI[tier];
          const ca = responseCalculator(anchor, tier);
          const isDefault = tier === DEFAULT_TIER;
          return (
            <div
              key={tier}
              data-testid={`tier-card-${tier}`}
              className={`flex flex-col rounded-xl border ${ui.card} bg-background/40 p-4`}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className={`text-2xl font-extrabold uppercase tracking-tight ${ui.name}`}>{TIER_LABEL[tier]}</h3>
                <div className="flex shrink-0 items-center gap-1.5">
                  {isDefault && (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-base font-bold tracking-[0.12em] text-primary-foreground">
                      DEFAULT
                    </span>
                  )}
                  <span
                    className={`rounded-full border px-2 py-0.5 text-base font-semibold tracking-[0.12em] ${ui.pill}`}
                  >
                    {TIER_MULTIPLIER[tier]}× NOISE
                  </span>
                </div>
              </div>

              <p className="mt-2 text-base leading-snug text-muted-foreground">{TIER_STRATEGY[tier]}</p>

              <div className="mt-4">
                <div
                  data-testid={`tier-actions-${tier}`}
                  className={`font-mono text-4xl font-extrabold leading-none tabular-nums ${ui.value}`}
                >
                  {ca.counterActions.toLocaleString("en-US")}
                </div>
                <div className="mt-1 text-base tracking-[0.02em] text-muted-foreground">counter-actions</div>
              </div>

              <div className="mt-4 flex flex-col gap-2 border-t border-border/40 pt-3">
                <ChannelRow label="Clipper content" value={ca.clipper} testId={`tier-${tier}-clipper`} />
                <ChannelRow label="Homeless post" value={ca.homeless} testId={`tier-${tier}-homeless`} />
                <ChannelRow label="KOL post" value={ca.kol} testId={`tier-${tier}-kol`} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ChannelRow({ label, value, testId }: { label: string; value: number; testId: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-base">
      <span className="text-muted-foreground">{label}</span>
      <span data-testid={testId} className="font-mono text-lg font-bold tabular-nums text-foreground">
        {value.toLocaleString("en-US")}
      </span>
    </div>
  );
}
