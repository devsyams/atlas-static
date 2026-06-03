"use client";

import { SOV_COLORS, withAlpha } from "@/lib/danantara/ui";

/** Mention/sentiment trend area chart (inline SVG, no deps). */
export function TrendChart({
  history,
  escalating,
  className = "h-28 w-full",
  label,
}: {
  history: number[];
  escalating: boolean;
  className?: string;
  label?: string;
}) {
  const w = 600;
  const h = 120;
  if (history.length < 2) return null;
  const min = Math.min(...history);
  const max = Math.max(...history);
  const span = max - min || 1;
  const pts = history.map(
    (v, i) => [(i / (history.length - 1)) * w, h - 6 - ((v - min) / span) * (h - 12)] as const,
  );
  const line = pts.map((p) => p.join(",")).join(" ");
  const area = `0,${h} ${line} ${w},${h}`;
  const color = escalating ? SOV_COLORS.weak : SOV_COLORS.strong;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} preserveAspectRatio="none" aria-hidden aria-label={label}>
      <polygon points={area} fill={withAlpha(color, 0.15)} />
      <polyline points={line} fill="none" stroke={color} strokeWidth="2" />
    </svg>
  );
}
