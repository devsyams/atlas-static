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

/** The default tier — the counter-topic cards below the simulator use it. */
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
 * Threat Index Response Simulator (A14 v3.0) — a **side-by-side comparison** of all three
 * response tiers. Each colour-coded card scales the same negative-post volume anchor by its
 * own noise multiplier (`responseCalculator`) into counter-actions + a Clipper / Homeless /
 * KOL split, and carries **its own** Threat Index projection (`now → modeled post-response`
 * at *that* tier): a heavier deployment cuts the threat further, so Enterprise projects a
 * lower post-response index than Basic. All pure and client-side; the executive compares
 * Basic/Professional/Enterprise — and their outcomes — at a glance.
 */
export function ThreatIndexResponseSimulator({
  issues,
  summary,
}: {
  issues: CeoIssue[];
  summary: TopicsSummary | null | undefined;
}) {
  // One plan per tier: `volumeAnchor`/`threatIndex` are shared across tiers, but
  // `postResponseThreatIndex` is tier-specific (a bigger response reduces the threat more).
  const cards = useMemo(
    () =>
      TIER_ORDER.map((tier) => {
        const plan = boardThreatResponsePlan(issues, summary, tier);
        return { tier, plan, actions: responseCalculator(plan.volumeAnchor, tier) };
      }),
    [issues, summary],
  );

  return (
    <section data-testid="board-simulator" className="rounded-xl border border-border/60 bg-card/40 p-3">
      <div className="flex items-center gap-1.5 border-b border-border/40 pb-2.5 text-base font-bold uppercase tracking-[0.18em] text-primary">
        <Gauge className="h-4 w-4" /> Threat Index Response Simulator
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
        {cards.map(({ tier, plan, actions }) => {
          const ui = TIER_UI[tier];
          const isDefault = tier === DEFAULT_TIER;
          const reduced = plan.postResponseThreatIndex < plan.threatIndex;
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
                  {actions.counterActions.toLocaleString("en-US")}
                </div>
                <div className="mt-1 text-base tracking-[0.02em] text-muted-foreground">counter-actions</div>
              </div>

              {/* This tier's own Threat Index outcome: now → modeled post-response. */}
              <div className="mt-3 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-base">
                <span className="uppercase tracking-[0.14em] text-muted-foreground">Threat Index</span>
                <span className="font-mono font-bold tabular-nums text-foreground">{plan.threatIndex}</span>
                <span aria-hidden className="text-muted-foreground">
                  →
                </span>
                <span
                  data-testid={`tier-post-${tier}`}
                  className={`font-mono text-lg font-extrabold tabular-nums ${reduced ? "text-success" : "text-foreground"}`}
                >
                  {plan.postResponseThreatIndex}
                </span>
                <span className="uppercase tracking-[0.14em] text-muted-foreground">after response</span>
              </div>

              <div className="mt-4 flex flex-col gap-2 border-t border-border/40 pt-3">
                <ChannelRow label="Clipper content" value={actions.clipper} testId={`tier-${tier}-clipper`} />
                <ChannelRow label="Homeless post" value={actions.homeless} testId={`tier-${tier}-homeless`} />
                <ChannelRow label="KOL post" value={actions.kol} testId={`tier-${tier}-kol`} />
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
