"use client";

import { fmtCount } from "@/lib/danantara/ceo/format";
import { SOV_COLORS } from "@/lib/danantara/ui";

const R = 26;
const STROKE = 10;
const C = 2 * Math.PI * R;
const SIZE = 2 * (R + STROKE / 2) + 4;
const MID = SIZE / 2;

/** Neutral slice color (muted — should never compete with pos/neg). */
const NEUTRAL_COLOR = "oklch(0.55 0.02 250 / 0.55)";

interface Totals {
  pos: number;
  neg: number;
  neu: number;
  total: number;
}

/**
 * Aggregate sentiment donut for a board panel (AC14): positive / negative /
 * neutral mention share across all the panel's items. Hand-rolled SVG circle
 * segments — same pattern as SectorDonut, no chart dependency.
 */
export function SentimentPie({ totals }: { totals: Totals }) {
  const { pos, neg, neu, total } = totals;

  const slices = [
    { key: "pos", label: "Positif", value: pos, color: SOV_COLORS.strong, text: "text-success" },
    { key: "neu", label: "Netral", value: neu, color: NEUTRAL_COLOR, text: "text-muted-foreground" },
    { key: "neg", label: "Negatif", value: neg, color: SOV_COLORS.weak, text: "text-destructive" },
  ].map((s) => ({ ...s, pct: total > 0 ? Math.round((s.value / total) * 100) : 0 }));

  // Donut segments: cumulative offsets around the ring, zero-share slices skipped.
  const segments = slices
    .filter((s) => s.value > 0)
    .reduce<{ key: string; color: string; dash: number; off: number }[]>((acc, s) => {
      const frac = total > 0 ? s.value / total : 0;
      const off = acc.length ? acc[acc.length - 1].off + acc[acc.length - 1].dash : 0;
      acc.push({ key: s.key, color: s.color, dash: frac * C, off });
      return acc;
    }, []);

  return (
    <div data-testid="sentiment-pie" className="flex items-center gap-3">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90 shrink-0">
        <circle cx={MID} cy={MID} r={R} fill="none" stroke="oklch(0.32 0.03 265 / 0.35)" strokeWidth={STROKE} />
        {segments.map((seg) => (
          <circle
            key={seg.key}
            data-segment={seg.key}
            cx={MID}
            cy={MID}
            r={R}
            fill="none"
            stroke={seg.color}
            strokeWidth={STROKE}
            strokeDasharray={`${seg.dash} ${C - seg.dash}`}
            strokeDashoffset={-seg.off}
            className="transition-[stroke-dasharray,stroke-dashoffset] duration-700"
          />
        ))}
      </svg>

      <div className="min-w-0 flex-1 space-y-0.5">
        {slices.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5 text-[11px]">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
            <span className={`font-semibold tabular-nums ${s.text}`}>
              {s.label} {s.pct}%
            </span>
            <span className="truncate text-[10px] text-muted-foreground">({fmtCount(s.value)})</span>
          </div>
        ))}
      </div>
    </div>
  );
}
