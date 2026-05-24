"use client";

import { useEffect, useState } from "react";
import { Loader2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { ForecastResult } from "@/lib/ai/scripted";
import { cn } from "@/lib/utils";

const TRAJ: Record<string, { cls: string; bar: string; Icon: typeof TrendingUp }> = {
  naik: { cls: "text-destructive", bar: "bg-destructive", Icon: TrendingUp },
  stabil: { cls: "text-warning", bar: "bg-warning", Icon: Minus },
  turun: { cls: "text-success", bar: "bg-success", Icon: TrendingDown },
};

export function ForecastWidget() {
  const [data, setData] = useState<ForecastResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch("/api/v1/ai/forecast")
      .then((r) => r.json())
      .then((d: ForecastResult) => alive && setData(d))
      .catch(() => alive && setData(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-[12px] text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-primary" /> Menyusun prakiraan…
      </div>
    );
  }
  if (!data || !data.provinces.length) {
    return <div className="text-[12px] text-muted-foreground">Prakiraan belum tersedia.</div>;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex shrink-0 items-center justify-between text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        <span>Trajektori eskalasi 7 hari</span>
        <span className="text-primary/80">Prakiraan oleh Synapse</span>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-auto scrollbar-thin">
        {data.provinces.map((p) => {
          const t = TRAJ[p.trajectory] ?? TRAJ.stabil;
          const Icon = t.Icon;
          return (
            <div key={`${p.name}-${p.city}`} className="rounded-lg border border-border/60 bg-background/40 px-2.5 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-[12px] font-bold text-foreground">{p.city}</div>
                  <div className="truncate text-[10px] text-muted-foreground">{p.name}</div>
                </div>
                <div className={cn("flex shrink-0 items-center gap-1 text-[12px] font-extrabold", t.cls)}>
                  <Icon className="h-3.5 w-3.5" />
                  {p.probability}%
                </div>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
                <div className={cn("h-full rounded-full transition-[width] duration-500", t.bar)} style={{ width: `${p.probability}%` }} />
              </div>
              <div className="mt-1 truncate text-[10px] text-muted-foreground">{p.drivers}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
