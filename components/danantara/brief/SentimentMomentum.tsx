"use client";

import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { trendDirection, trendPoints, type TrendDay, type TrendInputPoint } from "@/lib/danantara/ceo/trend";
import { withAlpha } from "@/lib/danantara/ui";

const DIR = {
  up: { label: "Improving", color: "oklch(0.72 0.16 155)", Icon: TrendingUp },
  down: { label: "Deteriorating", color: "oklch(0.62 0.22 25)", Icon: TrendingDown },
  flat: { label: "Stable", color: "oklch(0.66 0.03 260)", Icon: Minus },
} as const;

const POS = "oklch(0.74 0.17 152)";
const NEG = "oklch(0.64 0.23 25)";

// Wide-and-short so it stays compact at full width.
const VB_W = 660;
const VB_H = 132;
const M = { left: 18, right: 18, top: 12, bottom: 20 };
const PW = VB_W - M.left - M.right;
const PH = VB_H - M.top - M.bottom;

function xLabel(date: string): string {
  const p = date.split("-");
  return p.length >= 3 ? `${Number(p[2])}/${Number(p[1])}` : date;
}

/** Catmull-Rom → cubic-bezier smoothing for a cool flowing line. */
function smooth(pts: Array<{ x: number; y: number }>): string {
  if (pts.length < 2) return pts.length ? `M ${pts[0].x} ${pts[0].y}` : "";
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

/**
 * 7-day sentiment trend (A11 v2.2) — a cool, compact line chart: smooth glowing
 * **positive** (green) and **negative** (red) curves with gradient fills, under
 * the ↑/↓/→ verdict headline. The partial trailing day (today) is excluded so it
 * can't fake a crash.
 */
export function SentimentMomentum({ points }: { points: TrendInputPoint[] }) {
  const all = trendPoints(points);
  const days = all.filter((d) => !d.partial && d.total > 0);
  if (days.length < 2) return null;

  const dir = trendDirection(all);
  const verdict = DIR[dir.direction];
  const { Icon } = verdict;

  const maxVal = Math.max(...days.flatMap((d) => [d.pos, d.neg]));
  const yMax = Math.min(100, Math.max(40, Math.ceil((maxVal + 8) / 10) * 10));
  const n = days.length;
  const x = (i: number) => M.left + (n === 1 ? PW / 2 : (i / (n - 1)) * PW);
  const y = (v: number) => M.top + (1 - Math.min(v, yMax) / yMax) * PH;
  const pts = (sel: (d: TrendDay) => number) => days.map((d, i) => ({ x: x(i), y: y(sel(d)) }));

  const posPts = pts((d) => d.pos);
  const negPts = pts((d) => d.neg);
  const base = M.top + PH;
  const areaOf = (p: Array<{ x: number; y: number }>) => `${smooth(p)} L ${p[p.length - 1].x.toFixed(1)} ${base} L ${p[0].x.toFixed(1)} ${base} Z`;
  const last = (p: Array<{ x: number; y: number }>) => p[p.length - 1];

  return (
    <div data-testid="sentiment-momentum" className="overflow-hidden rounded-xl border border-border/40 bg-[#0a0e14]/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Sentiment · 7 days</span>
        <span
          className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-bold"
          style={{ color: verdict.color, borderColor: withAlpha(verdict.color, 0.4), background: withAlpha(verdict.color, 0.1) }}
        >
          <Icon className="h-4 w-4" /> {verdict.label}
          <span className="font-mono text-xs font-medium text-muted-foreground">
            {dir.deltaPts > 0 ? "+" : ""}
            {dir.deltaPts} pts
          </span>
        </span>
      </div>

      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="mt-2 w-full" role="img" aria-label="Positive vs negative sentiment over 7 days">
        <defs>
          <linearGradient id="momPos" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={POS} stopOpacity={0.35} />
            <stop offset="100%" stopColor={POS} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="momNeg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={NEG} stopOpacity={0.28} />
            <stop offset="100%" stopColor={NEG} stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* Areas (red under, green over) */}
        <path d={areaOf(negPts)} fill="url(#momNeg)" />
        <path d={areaOf(posPts)} fill="url(#momPos)" />

        {/* Glowing smooth lines */}
        <path d={smooth(negPts)} fill="none" stroke={NEG} strokeWidth={2.5} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 4px ${withAlpha(NEG, 0.7)})` }} />
        <path d={smooth(posPts)} fill="none" stroke={POS} strokeWidth={2.5} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 5px ${withAlpha(POS, 0.8)})` }} />

        {/* Glowing end markers */}
        <circle cx={last(negPts).x} cy={last(negPts).y} r={6} fill={withAlpha(NEG, 0.25)} />
        <circle cx={last(negPts).x} cy={last(negPts).y} r={3} fill={NEG} />
        <circle cx={last(posPts).x} cy={last(posPts).y} r={7} fill={withAlpha(POS, 0.3)} />
        <circle cx={last(posPts).x} cy={last(posPts).y} r={3.5} fill={POS} />

        {/* Date labels */}
        {days.map((d, i) => (
          <text key={d.date} x={x(i)} y={VB_H - 6} textAnchor="middle" className="fill-muted-foreground" fontSize={9}>
            {xLabel(d.date)}
          </text>
        ))}
      </svg>

      <div className="mt-1 flex items-center justify-center gap-5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: POS }} /> Positive
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: NEG }} /> Negative
        </span>
      </div>
    </div>
  );
}
