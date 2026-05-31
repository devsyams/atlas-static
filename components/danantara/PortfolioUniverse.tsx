"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { FlaskConical, RotateCcw, TrendingDown, TrendingUp } from "lucide-react";
import type { Holding, SectorKey } from "@/lib/danantara/types";
import { projectHoldings, scenarioDeltas } from "@/lib/danantara/data";
import { changeColor, fmtT, SECTOR_COLOR, SECTOR_SHORT, withAlpha } from "@/lib/danantara/ui";
import { inset, squarify, type Rect } from "@/lib/danantara/treemap";
import { cn } from "@/lib/utils";

type Metric = "day" | "ytd";

interface PlacedHolding {
  h: Holding;
  rect: Rect;
  sector: SectorKey;
}

const PRESETS: { label: string; stress: number }[] = [
  { label: "Normal", stress: 0 },
  { label: "Koreksi", stress: 0.4 },
  { label: "Krisis", stress: 0.85 },
];

export function PortfolioUniverse({
  holdings,
  aum,
  stress,
  onStress,
  metric,
  onSelect,
}: {
  holdings: Holding[];
  aum: number;
  stress: number;
  onStress: (v: number) => void;
  metric: Metric;
  onSelect: (h: Holding) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1000, h: 360 });
  const [mounted, setMounted] = useState(false);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0].contentRect;
      if (cr.width > 0 && cr.height > 0) setSize({ w: cr.width, h: cr.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 30);
    return () => clearTimeout(t);
  }, []);

  // Apply the stress scenario to today's moves (YTD coloring is unaffected).
  const projected = useMemo(() => projectHoldings(holdings, stress), [holdings, stress]);

  // Nested squarified layout: sectors first, then holdings within each sector.
  const placed = useMemo<PlacedHolding[]>(() => {
    const sectors = Array.from(new Set(holdings.map((h) => h.sector)));
    const sectorItems = sectors.map((key, i) => ({
      i,
      v: holdings.filter((h) => h.sector === key).reduce((a, h) => a + h.value_t, 0),
      key,
    }));
    const sectorRects = squarify(sectorItems, { x: 0, y: 0, w: size.w, h: size.h });
    const result: PlacedHolding[] = [];
    sectorItems.forEach((s, si) => {
      const sr = sectorRects.get(si);
      if (!sr) return;
      const inner = inset(sr, 2, sr.h > 46 ? 15 : 2);
      const hs = projected.filter((h) => h.sector === s.key);
      const items = hs.map((h, idx) => ({ i: idx, v: h.value_t }));
      const hRects = squarify(items, inner);
      hs.forEach((h, idx) => {
        const r = hRects.get(idx);
        if (r) result.push({ h, rect: r, sector: s.key });
      });
    });
    return result;
  }, [holdings, projected, size]);

  // Sector header chips (positioned at each sector rect's top-left).
  const sectorChips = useMemo(() => {
    const sectors = Array.from(new Set(holdings.map((h) => h.sector)));
    const sectorItems = sectors.map((key, i) => ({
      i,
      v: holdings.filter((h) => h.sector === key).reduce((a, h) => a + h.value_t, 0),
      key,
    }));
    const sectorRects = squarify(sectorItems, { x: 0, y: 0, w: size.w, h: size.h });
    return sectorItems
      .map((s) => {
        const r = sectorRects.get(s.i);
        if (!r || r.h <= 46) return null;
        return { key: s.key, x: r.x, y: r.y, w: r.w, weight: (s.v / aum) * 100 };
      })
      .filter(Boolean) as { key: SectorKey; x: number; y: number; w: number; weight: number }[];
  }, [holdings, size, aum]);

  // Scenario P&L (today's value move under the current stress level).
  const scenarioMoveT = projected.reduce((a, h) => a + (h.value_t * h.change_pct) / 100, 0);
  const scenarioPct = (scenarioMoveT / aum) * 100;
  const { ihsg: ihsgShock, usdidr: fxShock } = scenarioDeltas(stress);
  const stressed = stress > 0.001;

  return (
    <div className="flex h-full flex-col">
      {/* Treemap canvas */}
      <div ref={wrapRef} className="relative min-h-0 flex-1 overflow-hidden">
        {/* sector group outlines + labels */}
        {sectorChips.map((s) => (
          <div
            key={`chip-${s.key}`}
            className="pointer-events-none absolute z-[2] flex items-center gap-1 px-1.5 pt-1 text-[9px] font-bold uppercase tracking-[0.1em]"
            style={{ left: s.x, top: s.y, width: s.w, color: s.key && SECTOR_COLOR[s.key] }}
          >
            <span className="truncate">{SECTOR_SHORT[s.key]}</span>
            <span className="text-muted-foreground/60">{s.weight.toFixed(0)}%</span>
          </div>
        ))}

        {placed.map(({ h, rect }, idx) => {
          const m = metric === "day" ? h.change_pct : h.ytd_pct;
          const mag = Math.min(1, Math.abs(m) / 6);
          const col = changeColor(m);
          const big = rect.w > 58 && rect.h > 34;
          const med = rect.w > 40 && rect.h > 20;
          return (
            <button
              key={h.id}
              type="button"
              onClick={() => onSelect(h)}
              title={`${h.name} · ${fmtT(h.value_t)} · ${m >= 0 ? "+" : ""}${m.toFixed(2)}%`}
              className="group absolute overflow-hidden rounded-[5px] border text-left transition-[background-color,transform,opacity] duration-500 hover:z-10 hover:scale-[1.015] hover:brightness-125"
              style={{
                left: rect.x + 1,
                top: rect.y + 1,
                width: Math.max(0, rect.w - 2),
                height: Math.max(0, rect.h - 2),
                background: withAlpha(col, 0.16 + mag * 0.5),
                borderColor: withAlpha(col, 0.5),
                boxShadow: big ? `inset 0 0 18px ${withAlpha(col, 0.25)}` : undefined,
                opacity: mounted ? 1 : 0,
                transform: mounted ? "none" : "scale(0.96)",
                transitionDelay: mounted ? `${Math.min(idx * 12, 260)}ms` : "0ms",
              }}
            >
              {med && (
                <div className="flex h-full flex-col justify-between p-1.5">
                  <span className="truncate text-[11px] font-extrabold leading-none text-foreground">
                    {h.short}
                  </span>
                  {big && (
                    <span className="flex items-center gap-1 text-[10px] font-bold tabular-nums" style={{ color: col }}>
                      {m >= 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                      {m >= 0 ? "+" : ""}
                      {m.toFixed(1)}%
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}

        {/* scenario badge */}
        {stressed && (
          <div className="pointer-events-none absolute right-2 top-2 z-[5] flex items-center gap-1.5 rounded-md border border-warning/50 bg-background/85 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-warning backdrop-blur">
            <FlaskConical className="h-3 w-3" /> Skenario Stres · IHSG {ihsgShock}%
          </div>
        )}
      </div>

      {/* Stress-test control bar */}
      <div className="mt-2 shrink-0 rounded-md border border-border/60 bg-background/50 px-3 py-2 backdrop-blur">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <FlaskConical className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Uji Stres Pasar</span>
          </div>

          <div className="flex items-center gap-1">
            {PRESETS.map((p) => {
              const active = Math.abs(stress - p.stress) < 0.02;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => onStress(p.stress)}
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] font-bold transition-colors",
                    active
                      ? "border-primary/50 bg-primary/15 text-primary"
                      : "border-border/60 bg-background/40 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(stress * 100)}
            onChange={(e) => onStress(Number(e.target.value) / 100)}
            aria-label="Tingkat guncangan pasar"
            className="dn-range h-1 min-w-[120px] flex-1 cursor-pointer appearance-none rounded-full bg-border/70"
          />

          <div className="flex shrink-0 items-center gap-3 text-[11px]">
            <span className="text-muted-foreground">
              USD/IDR <span className="font-bold text-warning">+{fxShock}%</span>
            </span>
            <span className="flex flex-col items-end leading-tight">
              <span className="text-[8px] uppercase tracking-[0.1em] text-muted-foreground">Dampak NAV</span>
              <span
                className="font-extrabold tabular-nums"
                style={{ color: changeColor(scenarioPct) }}
              >
                {scenarioMoveT >= 0 ? "+" : "−"}
                {fmtT(Math.abs(scenarioMoveT))} ({scenarioPct >= 0 ? "+" : ""}
                {scenarioPct.toFixed(1)}%)
              </span>
            </span>
            {stressed && (
              <button
                type="button"
                onClick={() => onStress(0)}
                title="Setel ulang"
                className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border/60 text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
