"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { SentimentDay } from "@/lib/danantara/types";
import { changeColor } from "@/lib/danantara/ui";

function fmtNet(n: number): string {
  return `${n > 0 ? "+" : ""}${n}`;
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="rounded-md border border-border/40 bg-background/40 px-2 py-1.5">
      <div className="truncate text-[8px] uppercase tracking-[0.1em] text-muted-foreground">{label}</div>
      <div className="text-[15px] font-extrabold leading-none tabular-nums" style={{ color }}>
        {value}
      </div>
      {sub && <div className="mt-0.5 truncate text-[8px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

/** 14-day net public-sentiment trend (pos% − neg%) with stats + episode markers. */
export function SentimentTimeline({ days }: { days: SentimentDay[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 420, h: 150 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((e) => {
      const cr = e[0].contentRect;
      setSize({ w: Math.max(260, cr.width), h: Math.max(110, cr.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!days.length) return null;

  const nets = days.map((d) => d.net);
  const last = nets[nets.length - 1];
  const first = nets[0];
  const avg = Math.round(nets.reduce((a, b) => a + b, 0) / nets.length);
  const worst = days[nets.indexOf(Math.min(...nets))];
  const delta = last - first;

  const { w, h } = size;
  const padX = 6;
  const padTop = 14;
  const padBottom = 20;
  const lo = Math.min(-40, ...nets);
  const hi = Math.max(40, ...nets);
  const span = hi - lo || 1;
  const innerW = w - padX * 2;
  const innerH = h - padTop - padBottom;
  const x = (i: number) => padX + (i / (days.length - 1)) * innerW;
  const y = (v: number) => padTop + innerH - ((v - lo) / span) * innerH;
  const zeroY = y(0);

  const line = days.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.net).toFixed(1)}`).join(" ");
  const area = `${line} L${x(days.length - 1).toFixed(1)},${zeroY.toFixed(1)} L${x(0).toFixed(1)},${zeroY.toFixed(1)} Z`;

  return (
    <div className="flex h-full flex-col gap-2">
      {/* Summary stats */}
      <div className="grid shrink-0 grid-cols-4 gap-1.5">
        <Stat label="Net terkini" value={fmtNet(last)} color={changeColor(last / 3)} />
        <Stat label="Rata-rata 14h" value={fmtNet(avg)} color={changeColor(avg / 3)} />
        <Stat label="Terendah" value={fmtNet(worst.net)} sub={worst.date} color={changeColor(worst.net / 3)} />
        <Stat label="Δ vs 14h lalu" value={fmtNet(delta)} color={changeColor(delta / 3)} />
      </div>

      {/* Area chart fills remaining height */}
      <div ref={ref} className="min-h-0 flex-1">
        <svg width={w} height={h} className="overflow-visible">
          <defs>
            <linearGradient id="dn-sent" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(0.72 0.16 155)" stopOpacity="0.34" />
              <stop offset={`${((zeroY - padTop) / innerH) * 100}%`} stopColor="oklch(0.72 0.16 155)" stopOpacity="0.04" />
              <stop offset={`${((zeroY - padTop) / innerH) * 100}%`} stopColor="oklch(0.62 0.22 25)" stopOpacity="0.04" />
              <stop offset="100%" stopColor="oklch(0.62 0.22 25)" stopOpacity="0.3" />
            </linearGradient>
          </defs>

          {/* faint horizontal guides */}
          {[hi, 0, lo].map((v) => (
            <line key={v} x1={padX} y1={y(v)} x2={w - padX} y2={y(v)} stroke="oklch(0.40 0.02 250 / 0.25)" strokeWidth={0.6} />
          ))}
          <line x1={padX} y1={zeroY} x2={w - padX} y2={zeroY} stroke="oklch(0.50 0.02 250 / 0.55)" strokeWidth={1} strokeDasharray="3 3" />

          <path d={area} fill="url(#dn-sent)" />
          <path d={line} fill="none" stroke="oklch(0.78 0.14 230)" strokeWidth={2} strokeLinejoin="round" />

          {/* last-point dot */}
          <circle cx={x(days.length - 1)} cy={y(last)} r={3} fill="oklch(0.78 0.14 230)" />

          {days.map((d, i) =>
            d.marker ? (
              <g key={d.date}>
                <line x1={x(i)} y1={padTop - 4} x2={x(i)} y2={h - padBottom} stroke="oklch(0.78 0.16 80 / 0.55)" strokeWidth={1} strokeDasharray="2 2" />
                <circle cx={x(i)} cy={y(d.net)} r={3.2} fill="oklch(0.78 0.16 80)" />
                <text x={Math.min(x(i), w - 64)} y={padTop - 5} textAnchor={i > days.length - 4 ? "end" : "start"} className="fill-warning text-[8px] font-bold">
                  {d.marker}
                </text>
              </g>
            ) : null,
          )}

          {days.map((d, i) =>
            i % 3 === 0 || i === days.length - 1 ? (
              <text key={`lbl-${d.date}`} x={x(i)} y={h - 4} textAnchor="middle" className="fill-muted-foreground text-[8px]">
                {d.date}
              </text>
            ) : null,
          )}
        </svg>
      </div>
    </div>
  );
}
