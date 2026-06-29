"use client";

import { SOV_COLORS } from "@/lib/danantara/ui";

/**
 * The threat dial (A10 v3.0) — the Crisis Gate's signature element. A 180° gauge
 * whose arc runs through three traffic-light zones (green Aman → yellow caution →
 * red Awas) with a needle pointing at the live score. The needle's position *in a colored zone*
 * is the instant read for a CEO at a glance; the ends are labelled 0 · AMAN and
 * KRISIS · 100 so the scale and its direction are unmistakable. Pure visual — it
 * takes the (already animated) score and the active band colour.
 */

const CX = 200;
const CY = 188;
const R = 158;
const TRACK = 26;

/** Score (0..100) → point on the semicircle (0 = left, 50 = top, 100 = right). */
function point(score: number, radius = R) {
  const f = Math.min(100, Math.max(0, score)) / 100;
  const theta = Math.PI * (1 - f);
  return { x: CX + radius * Math.cos(theta), y: CY - radius * Math.sin(theta) };
}

/** Arc path between two scores along the dial. */
function arc(s0: number, s1: number) {
  const a = point(s0);
  const b = point(s1);
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${R} ${R} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

// Three traffic-light zones (boundaries 25 / 65 mirror crisisBand): green Aman →
// yellow caution (Waspada + Siaga) → red Awas. The orange band was dropped.
const ZONES: Array<{ from: number; to: number; color: string }> = [
  { from: 0, to: 25, color: SOV_COLORS.strong },
  { from: 25, to: 65, color: SOV_COLORS.ok },
  { from: 65, to: 100, color: SOV_COLORS.weak },
];

export function CrisisGauge({
  score,
  color,
  live,
  className = "w-[min(420px,42vh,72vw)]",
}: {
  score: number;
  color: string;
  live: boolean;
  className?: string;
}) {
  const needleDeg = 180 * (Math.min(100, Math.max(0, score)) / 100);
  const tip = R - 26;

  return (
    <svg viewBox="0 0 400 212" className={className} role="img" aria-label={`Indeks ancaman ${Math.round(score)} dari 100`}>
      {/* Zone arcs — the colored danger scale. A small gap separates the bands. */}
      {ZONES.map((z, i) => (
        <path
          key={z.from}
          d={arc(z.from + (i === 0 ? 0 : 0.8), z.to - (i === ZONES.length - 1 ? 0 : 0.8))}
          fill="none"
          stroke={z.color}
          strokeWidth={TRACK}
          strokeLinecap="round"
          opacity={live ? 0.95 : 0.28}
        />
      ))}

      {/* Needle — points to the live score; colored by the active band. */}
      {live && (
        <g transform={`rotate(${needleDeg} ${CX} ${CY})`} style={{ filter: `drop-shadow(0 0 6px ${color})` }}>
          <path d={`M ${CX} ${CY - 6} L ${CX} ${CY + 6} L ${CX - tip} ${CY} Z`} fill={color} />
        </g>
      )}
      {/* Hub */}
      <circle cx={CX} cy={CY} r={12} fill={live ? color : "var(--border)"} />
      <circle cx={CX} cy={CY} r={5} fill="var(--background)" />

      {/* End labels — anchor the scale and its direction. */}
      <text x={point(0).x - 4} y={CY + 22} textAnchor="start" className="font-mono" fontSize="13" fill="oklch(0.72 0.16 155)" letterSpacing="1.5">
        0 · AMAN
      </text>
      <text x={point(100).x + 4} y={CY + 22} textAnchor="end" className="font-mono" fontSize="13" fill="oklch(0.62 0.22 25)" letterSpacing="1.5">
        AWAS · 100
      </text>
    </svg>
  );
}
