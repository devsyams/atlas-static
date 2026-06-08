"use client";

import { Minus, ThumbsDown, ThumbsUp } from "lucide-react";
import { pieTotals } from "@/lib/danantara/ceo/format";

export type ToneKey = "positive" | "neutral" | "negative";

/**
 * Single source of truth for sentiment tone styling — shared by the Danantara
 * issue cards and the BUMN sentiment summary so the look never drifts.
 */
export const TONE: Record<
  ToneKey,
  { label: string; tone: string; text: string; bar: string; soft: string; Icon: typeof ThumbsUp }
> = {
  positive: { label: "Positive", tone: "oklch(0.72 0.17 150)", text: "text-success", bar: "bg-success", soft: "border-success/40 bg-success/10", Icon: ThumbsUp },
  neutral: { label: "Neutral", tone: "oklch(0.66 0.03 260)", text: "text-muted-foreground", bar: "bg-muted-foreground/45", soft: "border-border bg-muted/10", Icon: Minus },
  negative: { label: "Negative", tone: "oklch(0.62 0.22 25)", text: "text-destructive", bar: "bg-destructive", soft: "border-destructive/40 bg-destructive/10", Icon: ThumbsDown },
};

const SEGS: ToneKey[] = ["positive", "neutral", "negative"];

/** Dominant tone + the three sentiment shares (raw %) for a topic's mention split. */
export function readSentiment(item: { mentions: number; posMentions: number; negMentions: number }): {
  key: ToneKey;
  share: Record<ToneKey, number>;
} {
  const { pos, neg, neu, total } = pieTotals(item);
  const t = total || 1;
  const share: Record<ToneKey, number> = {
    positive: (pos / t) * 100,
    neutral: (neu / t) * 100,
    negative: (neg / t) * 100,
  };
  let key: ToneKey = "neutral";
  if (neg >= pos && neg >= neu) key = "negative";
  else if (pos >= neu) key = "positive";
  return { key, share };
}

const SIZE = {
  sm: { bar: "h-2.5", bg: "bg-muted/25", legend: "text-base gap-x-4 gap-y-1", dot: "h-2.5 w-2.5", gap: "mt-2" },
  md: { bar: "h-5", bg: "bg-muted/30", legend: "text-lg gap-x-6 gap-y-2", dot: "h-3 w-3", gap: "mt-3" },
} as const;

/**
 * The shared sentiment **breakdown bar + per-sentiment legend** — one source of
 * truth used by the Danantara issue cards (`size="sm"`) and the BUMN Sentiment
 * Summary (`size="md"`). `share` is the three raw percentages (positive +
 * neutral + negative ≈ 100); they size the bar and are rounded for the legend.
 */
export function SentimentBreakdown({
  share,
  size = "sm",
  className = "",
}: {
  share: Record<ToneKey, number>;
  size?: "sm" | "md";
  className?: string;
}) {
  const s = SIZE[size];
  const r = (n: number) => Math.round(n);
  return (
    <div className={className}>
      <div
        data-testid="sentiment-bar"
        title={`Positive ${r(share.positive)}% · Neutral ${r(share.neutral)}% · Negative ${r(share.negative)}%`}
        className={`flex w-full overflow-hidden rounded-full ${s.bar} ${s.bg}`}
      >
        {SEGS.map((seg) => (
          <span key={seg} className={`h-full ${TONE[seg].bar}`} style={{ width: `${share[seg]}%` }} />
        ))}
      </div>
      <div data-testid="sentiment-legend" className={`flex flex-wrap items-center ${s.gap} ${s.legend}`}>
        {SEGS.map((seg) => (
          <span key={seg} className={`flex items-center gap-1.5 font-semibold tabular-nums ${TONE[seg].text}`}>
            <span className={`${s.dot} shrink-0 rounded-full ${TONE[seg].bar}`} /> {TONE[seg].label} {r(share[seg])}%
          </span>
        ))}
      </div>
    </div>
  );
}
