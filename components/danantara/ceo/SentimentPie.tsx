"use client";

import { fmtCount } from "@/lib/danantara/ceo/format";
import { SOV_COLORS } from "@/lib/danantara/ui";

/** Neutral slice color (muted — should never compete with pos/neg). */
const NEUTRAL_COLOR = "oklch(0.55 0.02 250 / 0.55)";

interface Totals {
  pos: number;
  neg: number;
  neu: number;
  total: number;
}

interface Slice {
  key: string;
  label: string;
  value: number;
  color: string;
  text: string;
  pct: number;
}

interface Segment {
  key: string;
  color: string;
  dash: number;
  off: number;
}

function buildSlices({ pos, neg, neu, total }: Totals): Slice[] {
  return [
    { key: "pos", label: "Positive", value: pos, color: SOV_COLORS.strong, text: "text-success" },
    { key: "neu", label: "Neutral", value: neu, color: NEUTRAL_COLOR, text: "text-muted-foreground" },
    { key: "neg", label: "Negative", value: neg, color: SOV_COLORS.weak, text: "text-destructive" },
  ].map((s) => ({ ...s, pct: total > 0 ? Math.round((s.value / total) * 100) : 0 }));
}

/** Donut segments: cumulative offsets around the ring, zero-share slices skipped. */
function buildSegments(slices: Slice[], total: number, circumference: number): Segment[] {
  return slices
    .filter((s) => s.value > 0)
    .reduce<Segment[]>((acc, s) => {
      const frac = total > 0 ? s.value / total : 0;
      const off = acc.length ? acc[acc.length - 1].off + acc[acc.length - 1].dash : 0;
      acc.push({ key: s.key, color: s.color, dash: frac * circumference, off });
      return acc;
    }, []);
}

function Donut({ segments, r, stroke }: { segments: Segment[]; r: number; stroke: number }) {
  const size = 2 * (r + stroke / 2) + 2;
  const mid = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 shrink-0">
      <circle cx={mid} cy={mid} r={r} fill="none" stroke="oklch(0.32 0.03 265 / 0.35)" strokeWidth={stroke} />
      {segments.map((seg) => (
        <circle
          key={seg.key}
          data-segment={seg.key}
          cx={mid}
          cy={mid}
          r={r}
          fill="none"
          stroke={seg.color}
          strokeWidth={stroke}
          strokeDasharray={`${seg.dash} ${2 * Math.PI * r - seg.dash}`}
          strokeDashoffset={-seg.off}
          className="transition-[stroke-dasharray,stroke-dashoffset] duration-700"
        />
      ))}
    </svg>
  );
}

/**
 * Sentiment donut (AC14): positive / negative / neutral mention share.
 * Hand-rolled SVG circle segments — same pattern as SectorDonut, no chart dependency.
 *
 * full: donut + labeled legend with counts (panel-scale).
 * mini: tiny per-row/per-tile donut with inline pos%/neg% labels only.
 */
export function SentimentPie({
  totals,
  variant = "full",
  size = 26,
  layout = "row",
}: {
  totals: Totals;
  variant?: "full" | "mini";
  /** Donut radius for the full variant (default 26). */
  size?: number;
  /** full layout: donut beside the legend (row) or above it, centered (stack). */
  layout?: "row" | "stack";
}) {
  const slices = buildSlices(totals);

  if (variant === "mini") {
    // Readability scale (AC15): 16px labels, donut sized to match.
    const R = 11;
    // Draw neg → neutral → pos so the donut's green arc lands on the LEFT and red
    // on the RIGHT, matching the flanking value% · donut · value% labels (v16.0).
    const segments = buildSegments([...slices].reverse(), totals.total, 2 * Math.PI * R);
    const pos = slices.find((s) => s.key === "pos")!;
    const neg = slices.find((s) => s.key === "neg")!;
    return (
      // value% · donut · value% — green (pos) left, donut centered, red (neg) right.
      <span data-testid="sentiment-pie-mini" className="inline-flex items-center gap-1.5">
        <span className={`font-mono text-base tabular-nums ${pos.text}`}>{pos.pct}%</span>
        <Donut segments={segments} r={R} stroke={6} />
        <span className={`font-mono text-base tabular-nums ${neg.text}`}>{neg.pct}%</span>
      </span>
    );
  }

  const R = size;
  const stroke = R >= 38 ? 14 : 10;
  const segments = buildSegments(slices, totals.total, 2 * Math.PI * R);
  const stack = layout === "stack";
  // Dominant ("final") sentiment shown in the centre of the donut.
  const dominant = totals.total > 0 ? [...slices].sort((a, b) => b.pct - a.pct)[0] : null;
  return (
    <div data-testid="sentiment-pie" className={stack ? "flex flex-col items-center gap-3" : "flex items-center gap-3"}>
      <span className="relative inline-flex shrink-0 items-center justify-center">
        <Donut segments={segments} r={R} stroke={stroke} />
        {dominant && (
          <span
            data-testid="sentiment-pie-center"
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <span className={`font-mono font-extrabold tabular-nums ${dominant.text} ${R >= 44 ? "text-xl" : "text-lg"}`}>
              {dominant.pct}%
            </span>
          </span>
        )}
      </span>
      <div className={stack ? "space-y-1" : "min-w-0 flex-1 space-y-0.5"}>
        {slices.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5 text-base">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
            <span className={`font-semibold tabular-nums ${s.text}`}>
              {s.label} {s.pct}%
            </span>
            <span className="truncate text-base text-muted-foreground">({fmtCount(s.value)})</span>
          </div>
        ))}
      </div>
    </div>
  );
}
