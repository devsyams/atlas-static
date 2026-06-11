"use client";

import { BarChart3, ChevronDown, Eye } from "lucide-react";
import { fmtCount } from "@/lib/danantara/ceo/format";
import { SentimentBreakdown, TONE, type ToneKey } from "@/components/danantara/ceo/SentimentBreakdown";
import type { Driver } from "./SentimentSummary";

interface Pct {
  positive: number;
  negative: number;
  neutral: number;
}

/** The clusters the two boxes jump to — `BumnDashboardV2` renders sections with these ids. */
export const CLUSTER_ID: Record<"negative" | "positive" | "neutral", string> = {
  negative: "bumn-cluster-negative",
  positive: "bumn-cluster-positive",
  neutral: "bumn-cluster-neutral",
};

/**
 * Sentiment summary, split option (A8 v4.0 / AC10a) — instead of one dominant
 * verdict, two side-by-side tone boxes: **Negative left, Positive right**
 * (negative-first, matching the cluster order below). Each box is a button
 * showing its share %, topic count, and loudest driver, and **click-jumps**
 * (smooth-scrolls) to its topic cluster. The shared segmented bar (with the
 * neutral share) and the Impressions/Reach KPI tiles sit beneath.
 */
export function SentimentSummarySplit({
  percentage,
  totalImpressions,
  totalReach,
  counts,
  drivers,
}: {
  percentage: Pct;
  totalImpressions: number;
  totalReach: number;
  counts: { negative: number; positive: number };
  drivers?: { negative?: Driver; positive?: Driver };
}) {
  return (
    <div data-testid="sentiment-summary-split" className="space-y-4">
      {/* The kanan-kiri pair: negative left, positive right. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ToneBox tone="negative" pct={percentage.negative} count={counts.negative} driver={drivers?.negative} />
        <ToneBox tone="positive" pct={percentage.positive} count={counts.positive} driver={drivers?.positive} />
      </div>

      {/* Segmented bar + legend keeps the neutral share visible. */}
      <SentimentBreakdown
        share={{ positive: percentage.positive, neutral: percentage.neutral, negative: percentage.negative }}
        size="md"
      />

      {/* Scale KPIs, same as the v1 summary. */}
      <div className="grid grid-cols-2 gap-3">
        <Kpi icon={BarChart3} label="Impressions" value={fmtCount(totalImpressions)} title="Total views across all posts in this window" />
        <Kpi icon={Eye} label="Reach" value={fmtCount(totalReach)} title="Unique users exposed in this window" />
      </div>
    </div>
  );
}

/** One clickable tone box — the whole box jumps to its topic cluster. */
function ToneBox({
  tone,
  pct,
  count,
  driver,
}: {
  tone: "negative" | "positive";
  pct: number;
  count: number;
  driver?: Driver;
}) {
  const t = TONE[tone as ToneKey];
  const Icon = t.Icon;
  return (
    <button
      type="button"
      data-testid={`summary-box-${tone}`}
      onClick={() => document.getElementById(CLUSTER_ID[tone])?.scrollIntoView({ behavior: "smooth", block: "start" })}
      title={`Jump to the ${t.label.toLowerCase()} topics`}
      className={`group flex flex-col gap-2 rounded-lg border px-4 py-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg ${t.soft}`}
    >
      <div className="flex items-center gap-3">
        <Icon className={`h-8 w-8 shrink-0 ${t.text}`} />
        <div className="leading-tight">
          <div className={`text-3xl font-extrabold ${t.text}`}>
            {t.label} <span className="tabular-nums">{Math.round(pct)}%</span>
          </div>
          <div className="text-base text-muted-foreground">
            <span className="font-mono font-semibold tabular-nums">{count}</span> {count === 1 ? "topic" : "topics"} · share of sentiment
          </div>
        </div>
      </div>
      {driver && (
        <div className="min-w-0 border-t border-border/40 pt-2">
          <div className="truncate text-base font-semibold text-foreground" title={driver.title}>
            {driver.title}
          </div>
          <div className="text-base text-muted-foreground">
            Loudest {t.label.toLowerCase()} · <span className="font-mono tabular-nums">{fmtCount(driver.reach)}</span> reach
          </div>
        </div>
      )}
      <div className={`mt-auto flex items-center gap-1 text-base font-semibold ${t.text}`}>
        View {t.label.toLowerCase()} topics
        <ChevronDown className="h-4 w-4 transition-transform group-hover:translate-y-0.5" />
      </div>
    </button>
  );
}

/** A highlighted scale metric — bordered tile, big mono number, captioned. */
function Kpi({
  icon: Icon,
  label,
  value,
  title,
}: {
  icon: typeof BarChart3;
  label: string;
  value: string;
  title: string;
}) {
  return (
    <div
      title={title}
      className="flex flex-col justify-center rounded-lg border border-border/70 bg-card/40 px-4 py-3"
    >
      <div className="flex items-center gap-1.5 text-base font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-4 w-4 shrink-0 text-primary/70" /> {label}
      </div>
      <div className="mt-0.5 font-mono text-3xl font-extrabold tabular-nums text-foreground">{value}</div>
    </div>
  );
}
