"use client";

import { useState } from "react";
import { AtSign, ChevronDown, Clock, MapPin, Navigation, Newspaper, TriangleAlert } from "lucide-react";
import type { IncidentItem, SourceType } from "@/lib/jasamarga/types";
import { cn } from "@/lib/utils";

function sevClass(sev: number): string {
  if (sev >= 7) return "bg-destructive/15 text-destructive";
  if (sev >= 4) return "bg-warning/15 text-warning";
  return "bg-success/15 text-success";
}

const STATUS_CLASS: Record<string, string> = {
  Terkonfirmasi: "border-destructive/40 text-destructive",
  Berlangsung: "border-warning/40 text-warning",
  Dilaporkan: "border-primary/40 text-primary",
  Selesai: "border-success/40 text-success",
};

const SOURCE_ICON: Partial<Record<SourceType, typeof AtSign>> = {
  medsos: AtSign,
  waze: TriangleAlert,
  berita: Newspaper,
  resmi: AtSign,
  traffic: Navigation,
};

/** Live incident log — sourced from public reports (Waze / X / news / official). */
export function IncidentFeed({ incidents }: { incidents: IncidentItem[] }) {
  const [open, setOpen] = useState<string | null>(incidents[0]?.id ?? null);

  if (!incidents.length) {
    return <div className="py-6 text-center text-[13px] text-muted-foreground">Tidak ada insiden dilaporkan.</div>;
  }

  const sorted = [...incidents].sort((a, b) => b.severity - a.severity);

  return (
    <div className="flex flex-col gap-2">
      {sorted.map((inc) => {
        const expanded = open === inc.id;
        const SrcIcon = SOURCE_ICON[inc.source_type] ?? AtSign;
        return (
          <div key={inc.id} className={cn("rounded-xl border transition-colors", expanded ? "border-primary/40 bg-primary/5" : "border-border/50 bg-background/40 hover:border-border")}>
            <button type="button" onClick={() => setOpen(expanded ? null : inc.id)} className="flex w-full items-start gap-2.5 px-2.5 py-2.5 text-left">
              <span className={cn("mt-0.5 min-w-[34px] shrink-0 rounded-md px-1.5 py-1 text-center text-[11px] font-extrabold", sevClass(inc.severity))}>
                {inc.severity.toFixed(1)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold leading-snug">
                  {inc.type} · {inc.km}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-0.5">
                    <MapPin className="h-2.5 w-2.5" />
                    {inc.direction}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <SrcIcon className="h-2.5 w-2.5" />
                    {inc.source}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <Clock className="h-2.5 w-2.5" />
                    {inc.reported}
                  </span>
                </div>
              </div>
              <span className={cn("shrink-0 rounded-full border bg-background/40 px-1.5 py-0.5 text-[9px] font-bold", STATUS_CLASS[inc.status] ?? "border-border text-muted-foreground")}>
                {inc.status}
              </span>
              <ChevronDown className={cn("mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")} />
            </button>
            {expanded && (
              <div className="border-t border-border/40 px-2.5 py-2 text-[11px] leading-relaxed text-foreground/80">
                {inc.detail}
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                  <span className="rounded bg-background/60 px-1.5 py-0.5 font-mono">Sumber: {inc.source}</span>
                  {inc.lanes_blocked != null && <span>{inc.lanes_blocked} lajur dilaporkan tertutup</span>}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
