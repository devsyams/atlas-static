"use client";

import { useState } from "react";
import type { SectorAgg } from "@/lib/danantara/types";
import { fmtT, SECTOR_COLOR } from "@/lib/danantara/ui";
import { cn } from "@/lib/utils";

const R = 52;
const STROKE = 18;
const C = 2 * Math.PI * R;

/** Allocation donut by sector (SVG) with an interactive legend + center total. */
export function SectorDonut({ sectors, aum }: { sectors: SectorAgg[]; aum: number }) {
  const [active, setActive] = useState<string | null>(null);
  const segs = sectors.reduce<{ s: SectorAgg; dash: number; gap: number; off: number }[]>((acc, s) => {
    const frac = s.value_t / aum;
    const off = acc.length ? acc[acc.length - 1].off + acc[acc.length - 1].dash : 0;
    acc.push({ s, dash: frac * C, gap: C - frac * C, off });
    return acc;
  }, []);
  const shown = active ? sectors.find((x) => x.key === active) : null;

  return (
    <div className="flex h-full items-center gap-3">
      <div className="relative shrink-0">
        <svg width={140} height={140} viewBox="0 0 140 140" className="-rotate-90">
          <circle cx={70} cy={70} r={R} fill="none" stroke="oklch(0.32 0.03 265 / 0.35)" strokeWidth={STROKE} />
          {segs.map(({ s, dash, gap, off }) => (
            <circle
              key={s.key}
              cx={70}
              cy={70}
              r={R}
              fill="none"
              stroke={SECTOR_COLOR[s.key]}
              strokeWidth={active === s.key ? STROKE + 4 : STROKE}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-off}
              className="transition-[stroke-width] duration-200"
              style={{ opacity: active && active !== s.key ? 0.35 : 1 }}
              onMouseEnter={() => setActive(s.key)}
              onMouseLeave={() => setActive(null)}
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex rotate-0 flex-col items-center justify-center text-center">
          {shown ? (
            <>
              <div className="text-[15px] font-extrabold leading-none" style={{ color: SECTOR_COLOR[shown.key] }}>
                {shown.weight_pct}%
              </div>
              <div className="mt-0.5 max-w-[88px] text-[8px] leading-tight text-muted-foreground">{shown.label}</div>
            </>
          ) : (
            <>
              <div className="text-[8px] uppercase tracking-[0.14em] text-muted-foreground">AUM</div>
              <div className="text-[13px] font-extrabold leading-none">{fmtT(aum)}</div>
            </>
          )}
        </div>
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        {sectors.map((s) => (
          <button
            key={s.key}
            type="button"
            onMouseEnter={() => setActive(s.key)}
            onMouseLeave={() => setActive(null)}
            className={cn(
              "flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left transition-colors",
              active === s.key && "bg-sidebar-accent",
            )}
          >
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: SECTOR_COLOR[s.key] }} />
            <span className="flex-1 truncate text-[10px] text-muted-foreground">{s.label}</span>
            <span className="shrink-0 text-[10px] font-bold tabular-nums text-foreground">{s.weight_pct}%</span>
          </button>
        ))}
      </div>
    </div>
  );
}
