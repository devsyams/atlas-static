"use client";

import { useEffect } from "react";
import { Building2, TrendingDown, TrendingUp } from "lucide-react";
import type { Holding } from "@/lib/danantara/types";
import { changeColor, fmtT, SECTOR_LABEL, SECTOR_COLOR } from "@/lib/danantara/ui";

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-background/40 px-3 py-2">
      <div className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-[15px] font-extrabold tabular-nums" style={color ? { color } : undefined}>
        {value}
      </div>
    </div>
  );
}

/** Holding detail card — opens when a treemap tile / mover row is clicked. */
export function HoldingModal({ holding, onClose }: { holding: Holding | null; onClose: () => void }) {
  useEffect(() => {
    if (!holding) return;
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [holding, onClose]);

  if (!holding) return null;
  const col = changeColor(holding.change_pct);
  const up = holding.change_pct >= 0;
  const sectorCol = SECTOR_COLOR[holding.sector];

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-popover text-foreground shadow-[0_28px_70px_oklch(0.05_0.02_260/.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[11px] font-extrabold"
              style={{ background: `color-mix(in oklab, ${sectorCol} 22%, transparent)`, color: sectorCol }}
            >
              {holding.ticker ?? <Building2 className="h-4 w-4" />}
            </span>
            <div className="leading-tight">
              <div className="text-[15px] font-bold">{holding.name}</div>
              <div className="text-[10px] uppercase tracking-[0.14em]" style={{ color: sectorCol }}>
                {SECTOR_LABEL[holding.sector]} · {holding.listed ? "Tercatat (IDX)" : "Tidak tercatat"}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-xl leading-none text-muted-foreground hover:bg-white/5 hover:text-foreground"
            aria-label="Tutup"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Valuasi</div>
              <div className="text-[26px] font-extrabold leading-none">{fmtT(holding.value_t)}</div>
            </div>
            <span className="flex items-center gap-1 text-[20px] font-extrabold tabular-nums" style={{ color: col }}>
              {up ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
              {up ? "+" : ""}
              {holding.change_pct.toFixed(2)}%
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Stat label="Imbal hasil YTD" value={`${holding.ytd_pct >= 0 ? "+" : ""}${holding.ytd_pct}%`} color={changeColor(holding.ytd_pct)} />
            <Stat label="ROE" value={`${holding.roe}%`} />
            <Stat label="Dividen / thn" value={fmtT(holding.dividend_t)} />
            <Stat label="Beta (sensitivitas)" value={holding.beta.toFixed(2)} />
          </div>

          <p className="mt-4 rounded-lg border border-border/50 bg-background/40 px-3 py-2.5 text-[12px] leading-relaxed text-muted-foreground">
            {holding.blurb}
          </p>

          <div className="mt-3 text-[10px] text-muted-foreground/70">
            Sumber: data pasar publik (IDX) untuk emiten tercatat; valuasi appraisal untuk entitas tidak tercatat.
          </div>
        </div>
      </div>
    </div>
  );
}
