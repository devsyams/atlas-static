"use client";

import { fmtCount } from "@/lib/danantara/ceo/format";
import type { TopicIntent } from "@/lib/danantara/ceo/topics-source";

/** Distinct, readable category colors (cycled for ≤ ~6 intents). */
const PALETTE = [
  "oklch(0.62 0.19 280)", // violet
  "oklch(0.70 0.15 200)", // teal
  "oklch(0.75 0.15 85)", // amber
  "oklch(0.62 0.17 25)", // red-orange
  "oklch(0.65 0.15 330)", // pink
  "oklch(0.68 0.16 145)", // green
];

interface Row {
  key: string;
  label: string;
  pct: number; // raw share-of-voice
  impressions: number;
  deskripsi: string;
  color: string;
  barPct: number; // width relative to the leader (0–100)
}

/**
 * Intent share leaderboard (AC4, v3.5) — replaces the donut with a **ranked
 * horizontal share-of-voice bar list**: the dominant intent sits on top with the
 * longest bar, each row showing the category, an animated bar, its impressions,
 * and its %. Bars scale to the leader so small categories stay legible. Far
 * easier to compare than slices for a 40–60 y/o exec. Readable type (≥16px).
 */
export function IntentShare({ intents }: { intents: TopicIntent[] }) {
  const present = intents.filter((i) => i.share_of_voice > 0).sort((a, b) => b.share_of_voice - a.share_of_voice);
  const max = present[0]?.share_of_voice || 1;

  const rows: Row[] = present.map((i, idx) => ({
    key: i.intent,
    label: i.intent,
    pct: Math.round(i.share_of_voice),
    impressions: i.impressions,
    deskripsi: i.deskripsi,
    color: PALETTE[idx % PALETTE.length],
    barPct: Math.max(4, (i.share_of_voice / max) * 100), // floor so a tiny share is still a visible sliver
  }));

  if (rows.length === 0) {
    return (
      <div data-testid="intent-share" className="text-base text-muted-foreground">
        No intent data in this window.
      </div>
    );
  }

  return (
    <ol data-testid="intent-share" className="space-y-3.5">
      {rows.map((r, idx) => (
        <li key={r.key} data-bar={r.key} title={r.deskripsi || undefined} className="group">
          <div className="flex items-baseline justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2 font-semibold text-foreground">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.color }} />
              <span className="truncate">{r.label}</span>
            </span>
            <span className="shrink-0 whitespace-nowrap text-base">
              <span className="font-mono tabular-nums text-muted-foreground">{fmtCount(r.impressions)}</span>
              <span className="mx-1.5 text-border">·</span>
              <span className="font-mono text-xl font-extrabold tabular-nums text-foreground">{r.pct}%</span>
            </span>
          </div>
          <div className="mt-1.5 h-3 w-full overflow-hidden rounded-full bg-muted/25">
            <span
              className="intent-bar block h-full origin-left rounded-full transition-[filter] group-hover:brightness-110"
              style={{ width: `${r.barPct}%`, background: r.color, animationDelay: `${idx * 70}ms` } as React.CSSProperties}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}
