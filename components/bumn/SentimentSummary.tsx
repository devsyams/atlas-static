import { BarChart3, Eye, Minus, ThumbsDown, ThumbsUp } from "lucide-react";
import { fmtCount } from "@/lib/danantara/ceo/format";

interface Pct {
  positive: number;
  negative: number;
  neutral: number;
}

type Tone = "positive" | "negative" | "neutral";

const TONE = {
  positive: { label: "Positive", text: "text-success", bar: "bg-success", soft: "border-success/40 bg-success/10", Icon: ThumbsUp },
  neutral: { label: "Neutral", text: "text-muted-foreground", bar: "bg-muted-foreground/45", soft: "border-border bg-muted/10", Icon: Minus },
  negative: { label: "Negative", text: "text-destructive", bar: "bg-destructive", soft: "border-destructive/40 bg-destructive/10", Icon: ThumbsDown },
} as const;

/**
 * Sentiment summary (A8 v2.0) — a CEO-glanceable read that replaces the 3-slice
 * donut: a big dominant-sentiment verdict, a bold segmented bar with in-line
 * percentages, a legend, and the feed's total impressions/reach as context.
 * Readable type for 40–60 y/o (≥16px).
 */
export function SentimentSummary({
  percentage,
  totalImpressions,
  totalReach,
}: {
  percentage: Pct;
  totalImpressions: number;
  totalReach: number;
}) {
  const rows: { tone: Tone; pct: number }[] = [
    { tone: "positive", pct: percentage.positive },
    { tone: "neutral", pct: percentage.neutral },
    { tone: "negative", pct: percentage.negative },
  ];
  const dominant = [...rows].sort((a, b) => b.pct - a.pct)[0];
  const dom = TONE[dominant.tone];
  const DomIcon = dom.Icon;

  return (
    <div data-testid="sentiment-summary" className="space-y-4">
      {/* Dominant verdict. */}
      <div data-testid="sentiment-verdict" className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${dom.soft}`}>
        <DomIcon className={`h-8 w-8 shrink-0 ${dom.text}`} />
        <div className="leading-tight">
          <div className={`text-3xl font-extrabold ${dom.text}`}>
            {dom.label} <span className="tabular-nums">{Math.round(dominant.pct)}%</span>
          </div>
          <div className="text-base text-muted-foreground">Overall public sentiment</div>
        </div>
      </div>

      {/* Segmented bar. */}
      <div className="flex h-5 w-full overflow-hidden rounded-full bg-muted/30">
        {rows.map((r) => (
          <span key={r.tone} className={`h-full ${TONE[r.tone].bar}`} style={{ width: `${r.pct}%` }} />
        ))}
      </div>

      {/* Legend. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-lg">
        {rows.map((r) => {
          const t = TONE[r.tone];
          return (
            <span key={r.tone} className={`flex items-center gap-1.5 font-semibold tabular-nums ${t.text}`}>
              <span className={`h-3 w-3 rounded-full ${t.bar}`} /> {t.label} {Math.round(r.pct)}%
            </span>
          );
        })}
      </div>

      {/* Totals context. */}
      <div className="flex flex-wrap gap-x-7 gap-y-2 border-t border-border/50 pt-3 text-base text-muted-foreground">
        <span className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 shrink-0 text-primary/70" />
          <span className="font-bold text-foreground tabular-nums">{fmtCount(totalImpressions)}</span> impressions
        </span>
        <span className="flex items-center gap-2">
          <Eye className="h-5 w-5 shrink-0 text-primary/70" />
          <span className="font-bold text-foreground tabular-nums">{fmtCount(totalReach)}</span> reach
        </span>
      </div>
    </div>
  );
}
