"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { ProjQuarter } from "@/lib/danantara/types";

/** AUM growth projection — baseline vs optimistic, as a layered area chart. */
export function AumProjection({ quarters }: { quarters: ProjQuarter[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  const h = 170;
  const padX = 8;
  const padTop = 14;
  const padBottom = 22;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((e) => setW(Math.max(280, e[0].contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!quarters.length) return null;

  const min = Math.min(...quarters.map((q) => q.base)) * 0.985;
  const max = Math.max(...quarters.map((q) => q.bull)) * 1.005;
  const span = max - min || 1;
  const innerW = w - padX * 2;
  const innerH = h - padTop - padBottom;

  const x = (i: number) => padX + (i / (quarters.length - 1)) * innerW;
  const y = (v: number) => padTop + innerH - ((v - min) / span) * innerH;

  const line = (pick: (q: ProjQuarter) => number) =>
    quarters.map((q, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(pick(q)).toFixed(1)}`).join(" ");
  const area = (pick: (q: ProjQuarter) => number) =>
    `${line(pick)} L${x(quarters.length - 1).toFixed(1)},${(padTop + innerH).toFixed(1)} L${x(0).toFixed(1)},${(padTop + innerH).toFixed(1)} Z`;

  return (
    <div ref={ref} className="h-full w-full">
      <svg width={w} height={h} className="overflow-visible">
        <defs>
          <linearGradient id="dn-bull" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.62 0.20 290)" stopOpacity="0.32" />
            <stop offset="100%" stopColor="oklch(0.62 0.20 290)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="dn-base" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.78 0.14 230)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="oklch(0.78 0.14 230)" stopOpacity="0" />
          </linearGradient>
        </defs>

        <path d={area((q) => q.bull)} fill="url(#dn-bull)" />
        <path d={line((q) => q.bull)} fill="none" stroke="oklch(0.62 0.20 290)" strokeWidth={1.5} strokeDasharray="4 3" />
        <path d={area((q) => q.base)} fill="url(#dn-base)" />
        <path d={line((q) => q.base)} fill="none" stroke="oklch(0.78 0.14 230)" strokeWidth={2} />

        {quarters.map((q, i) => (
          <g key={q.label}>
            <circle cx={x(i)} cy={y(q.base)} r={2.5} fill="oklch(0.78 0.14 230)" />
            {q.marker && (
              <text
                x={x(i)}
                y={y(q.bull) - 6}
                textAnchor={i === 0 ? "start" : "end"}
                className="fill-foreground text-[9px] font-bold"
              >
                {q.marker}
              </text>
            )}
            <text x={x(i)} y={h - 6} textAnchor="middle" className="fill-muted-foreground text-[9px]">
              {q.label}
            </text>
          </g>
        ))}
      </svg>

      <div className="mt-1 flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-primary" /> Baseline
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded" style={{ background: "oklch(0.62 0.20 290)" }} /> Optimistik (hilirisasi)
        </span>
      </div>
    </div>
  );
}
