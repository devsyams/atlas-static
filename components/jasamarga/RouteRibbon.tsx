"use client";

import { AlertTriangle, Coffee, DoorOpen, Layers } from "lucide-react";
import type { IncidentItem, Landmark, RouteSegment } from "@/lib/jasamarga/types";
import { FLOW_COLORS, FLOW_LABEL } from "@/lib/jasamarga/ui";
import { cn } from "@/lib/utils";

/** Map a KM position to a 0–100% offset across the corridor. */
function pct(km: number, max: number) {
  return `${(km / max) * 100}%`;
}

/**
 * Subway-style live strip of the Jakarta–Cikampek corridor (KM 0 → end).
 * Speed/flow come from public traffic data; markers are public landmarks.
 */
export function RouteRibbon({
  segments,
  landmarks,
  incidents,
  selected,
  onSelect,
}: {
  segments: RouteSegment[];
  landmarks: Landmark[];
  incidents: IncidentItem[];
  selected: number | null;
  onSelect: (index: number | null) => void;
}) {
  const maxKm = segments[segments.length - 1]?.km_to ?? 72;
  const elevatedFrom = segments.find((s) => s.elevated)?.km_from;
  const elevatedTo = [...segments].reverse().find((s) => s.elevated)?.km_to;

  const incPins = incidents
    .map((i) => ({ inc: i, km: parseFloat(i.km.replace(/[^0-9.]/g, "")) }))
    .filter((p) => !Number.isNaN(p.km) && p.km <= maxKm);

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Elevated (Layang MBZ) indicator */}
      {elevatedFrom != null && elevatedTo != null && (
        <div className="relative h-4 shrink-0">
          <div
            className="absolute top-1 flex h-3 items-center justify-center rounded-full border border-primary/40 bg-primary/10"
            style={{ left: pct(elevatedFrom, maxKm), width: pct(elevatedTo - elevatedFrom, maxKm) }}
          >
            <span className="flex items-center gap-1 whitespace-nowrap px-1 text-[9px] font-bold uppercase tracking-wider text-primary">
              <Layers className="h-2.5 w-2.5" /> Layang MBZ
            </span>
          </div>
        </div>
      )}

      {/* Incident pins (from Waze / social / news / official) */}
      <div className="relative h-5 shrink-0">
        {incPins.map(({ inc, km }) => (
          <div key={inc.id} className="absolute -translate-x-1/2" style={{ left: pct(km, maxKm) }} title={`${inc.km} — ${inc.type} (${inc.source})`}>
            <AlertTriangle
              className={cn("h-4 w-4", inc.severity >= 7 ? "text-destructive jm-blink" : inc.severity >= 4 ? "text-warning" : "text-primary")}
              fill="currentColor"
              fillOpacity={0.18}
            />
          </div>
        ))}
      </div>

      {/* The ribbon */}
      <div className="relative flex h-11 w-full shrink-0 overflow-hidden rounded-lg border border-border/60">
        {segments.map((s, i) => {
          const color = FLOW_COLORS[s.status];
          const width = ((s.km_to - s.km_from) / maxKm) * 100;
          const dur = Math.max(2.2, 18 - (s.speed / 90) * 16);
          const active = selected === i;
          return (
            <button
              type="button"
              key={`${s.km_from}-${s.km_to}`}
              onClick={() => onSelect(active ? null : i)}
              title={`${s.label} · ${s.speed} km/j · +${s.delay_min} mnt`}
              className={cn(
                "group relative h-full border-r border-black/20 transition-[filter] last:border-r-0",
                active ? "z-10 brightness-125" : "hover:brightness-110",
              )}
              style={{ width: `${width}%`, background: color }}
            >
              <span className="jm-flow absolute inset-0" style={{ animationDuration: `${dur}s`, opacity: s.status === "lumpuh" ? 0.25 : 0.6 }} />
              {active && <span className="absolute inset-0 ring-2 ring-inset ring-white/70" />}
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold leading-none text-black/75 mix-blend-luminosity">
                {s.speed}
              </span>
            </button>
          );
        })}
      </div>

      {/* KM scale */}
      <div className="relative h-3 shrink-0">
        {segments.map((s) => (
          <span key={s.km_from} className="absolute -translate-x-1/2 text-[9px] tabular-nums text-muted-foreground" style={{ left: pct(s.km_from, maxKm) }}>
            {s.km_from}
          </span>
        ))}
        <span className="absolute right-0 text-[9px] tabular-nums text-muted-foreground">{maxKm}</span>
      </div>

      {/* Public landmarks: gerbang + rest areas (locations only) */}
      <div className="relative h-6 shrink-0 border-t border-border/30 pt-1">
        {landmarks.map((l) => (
          <div key={`${l.kind}-${l.km}`} className="absolute -translate-x-1/2" style={{ left: pct(l.km, maxKm) }} title={`${l.name} · KM ${l.km}`}>
            {l.kind === "gerbang" ? (
              <DoorOpen className="h-3.5 w-3.5 text-foreground/60" />
            ) : (
              <Coffee className="h-3 w-3 text-foreground/45" />
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-auto flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-[10px] text-muted-foreground">
        {(Object.keys(FLOW_COLORS) as (keyof typeof FLOW_COLORS)[]).map((k) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: FLOW_COLORS[k] }} />
            {FLOW_LABEL[k]}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <DoorOpen className="h-3 w-3" /> Gerbang
        </span>
        <span className="flex items-center gap-1.5">
          <Coffee className="h-3 w-3" /> Rest area
        </span>
        <span className="ml-auto text-muted-foreground/70">Sumber: Google · Waze · TomTom</span>
      </div>
    </div>
  );
}
