"use client";

import type { TopicIntent } from "@/lib/danantara/ceo/topics-source";

/** Distinct, readable slice colors (cycled for ≤ ~6 intents). */
const PALETTE = [
  "oklch(0.62 0.19 280)", // violet
  "oklch(0.70 0.15 200)", // teal
  "oklch(0.75 0.15 85)", // amber
  "oklch(0.62 0.17 25)", // red-orange
  "oklch(0.65 0.15 330)", // pink
  "oklch(0.68 0.16 145)", // green
];

interface Slice {
  key: string;
  label: string;
  pct: number; // raw share-of-voice (label)
  color: string;
  dash: number;
  off: number;
}

/**
 * Intent share donut (AC4): one slice per `intent[]` category, sized by its
 * share-of-voice, with a labeled legend. Hand-rolled SVG — same approach as
 * `SentimentPie`, no chart dependency. Readable type for 40–60 y/o (≥16px).
 */
export function IntentPie({ intents }: { intents: TopicIntent[] }) {
  const R = 40;
  const STROKE = 16;
  const C = 2 * Math.PI * R;
  const size = 2 * (R + STROKE / 2) + 2;
  const mid = size / 2;

  const present = intents.filter((i) => i.share_of_voice > 0);
  const total = present.reduce((a, i) => a + i.share_of_voice, 0) || 1;

  // Cumulative offsets via reduce (no post-render mutation).
  const slices = present.reduce<Slice[]>((acc, i, idx) => {
    const dash = (i.share_of_voice / total) * C;
    const off = acc.length ? acc[acc.length - 1].off + acc[acc.length - 1].dash : 0;
    acc.push({
      key: i.intent,
      label: i.intent,
      pct: Math.round(i.share_of_voice),
      color: PALETTE[idx % PALETTE.length],
      dash,
      off,
    });
    return acc;
  }, []);

  return (
    <div data-testid="intent-pie" className="flex flex-wrap items-center gap-x-5 gap-y-3">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 shrink-0">
        <circle cx={mid} cy={mid} r={R} fill="none" stroke="oklch(0.32 0.03 265 / 0.35)" strokeWidth={STROKE} />
        {slices.map((s) => (
          <circle
            key={s.key}
            data-segment={s.key}
            cx={mid}
            cy={mid}
            r={R}
            fill="none"
            stroke={s.color}
            strokeWidth={STROKE}
            strokeDasharray={`${s.dash} ${C - s.dash}`}
            strokeDashoffset={-s.off}
            className="transition-[stroke-dasharray,stroke-dashoffset] duration-700"
          />
        ))}
      </svg>

      <ul className="min-w-0 flex-1 space-y-1.5">
        {slices.length === 0 && <li className="text-base text-muted-foreground">No intent data.</li>}
        {slices.map((s) => (
          <li key={s.key} className="flex items-center gap-2 text-base">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: s.color }} />
            <span className="min-w-0 flex-1 truncate font-medium">{s.label}</span>
            <span className="shrink-0 font-mono font-bold tabular-nums">{s.pct}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
