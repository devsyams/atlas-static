import type { ComponentType, ReactNode } from "react";
import {
  Activity,
  Radar,
  Bell,
  Gauge,
  TrendingUp,
  TrendingDown,
  Globe2,
  BarChart3,
  ListFilter,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function CommandCenter() {
  return (
    <div className="rounded-lg border border-border/40 bg-background/30 p-3">
      <div className="grid grid-cols-12 gap-3">
        {KPIS.map((k) => (
          <StatTile key={k.label} {...k} />
        ))}

        <Tile
          title="Signal Volume — 24h"
          icon={Activity}
          className="col-span-12 lg:col-span-8"
        >
          <AreaChart data={SIGNAL_SERIES} />
        </Tile>

        <Tile
          title="Top Categories"
          icon={BarChart3}
          className="col-span-12 lg:col-span-4"
        >
          <div className="space-y-3 py-1">
            {CATEGORIES.map((c) => (
              <div key={c.label}>
                <div className="mb-1 flex items-center justify-between text-[11px]">
                  <span>{c.label}</span>
                  <span className="text-muted-foreground">{c.value}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted/40">
                  <div
                    className="h-full rounded-full bg-gradient-accent"
                    style={{ width: `${c.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Tile>

        <Tile
          title="Geospatial Activity"
          icon={Globe2}
          className="col-span-12 lg:col-span-8"
        >
          <MapPlaceholder />
        </Tile>

        <Tile
          title="Live Feed"
          icon={ListFilter}
          className="col-span-12 lg:col-span-4"
        >
          <div className="scrollbar-thin max-h-64 space-y-2.5 overflow-y-auto pr-1">
            {FEED.map((f, i) => (
              <div key={i} className="flex gap-2">
                <span
                  className={cn(
                    "mt-1 h-1.5 w-1.5 shrink-0 rounded-full",
                    f.level === "high"
                      ? "bg-destructive"
                      : f.level === "med"
                        ? "bg-warning"
                        : "bg-success",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[12px] font-medium">{f.text}</span>
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                      {f.time}
                    </span>
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {f.source}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Tile>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tile chrome — matches the widget shell from atlas-lovable          */
/* ------------------------------------------------------------------ */

function Tile({
  title,
  icon: Icon,
  className,
  children,
}: {
  title: string;
  icon?: ComponentType<{ className?: string }>;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border/60 bg-card/60",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-border/40 bg-background/40 px-2 py-1 text-[11px]">
        <div className="flex items-center gap-1.5 truncate">
          {Icon && <Icon className="h-3 w-3 text-primary" />}
          <span className="truncate font-medium">{title}</span>
        </div>
        <MoreHorizontal className="h-3 w-3 text-muted-foreground/50" />
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* KPI stat tile                                                       */
/* ------------------------------------------------------------------ */

function StatTile({
  label,
  value,
  delta,
  up,
  icon: Icon,
  spark,
}: (typeof KPIS)[number]) {
  return (
    <div className="col-span-6 overflow-hidden rounded-lg border border-border/60 bg-card/60 p-3 lg:col-span-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <Icon className="h-3 w-3 text-primary" />
            {label}
          </div>
          <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
        </div>
        <Sparkline data={spark} />
      </div>
      <div
        className={cn(
          "mt-2 inline-flex items-center gap-1 text-[10px]",
          up ? "text-success" : "text-destructive",
        )}
      >
        {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {delta}
        <span className="text-muted-foreground">vs. prev 24h</span>
      </div>
    </div>
  );
}

function Sparkline({ data }: { data: number[] }) {
  const w = 64;
  const h = 28;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const stepX = w / (data.length - 1);
  const y = (v: number) => h - 2 - ((v - min) / (max - min || 1)) * (h - 4);
  const line = data.map((v, i) => `${i === 0 ? "M" : "L"}${i * stepX},${y(v)}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <path
        d={line}
        fill="none"
        stroke="var(--primary)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.9}
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Area chart (inline SVG)                                             */
/* ------------------------------------------------------------------ */

function AreaChart({ data }: { data: number[] }) {
  const w = 720;
  const h = 200;
  const padY = 14;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const stepX = w / (data.length - 1);
  const y = (v: number) => h - padY - ((v - min) / (max - min || 1)) * (h - padY * 2);
  const line = data.map((v, i) => `${i === 0 ? "M" : "L"}${i * stepX},${y(v)}`).join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;
  const gridLines = [0.25, 0.5, 0.75];

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="h-44 w-full"
      role="img"
      aria-label="Signal volume over the last 24 hours"
    >
      <defs>
        <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {gridLines.map((g) => (
        <line
          key={g}
          x1={0}
          x2={w}
          y1={h * g}
          y2={h * g}
          stroke="var(--border)"
          strokeWidth={1}
          strokeDasharray="3 5"
        />
      ))}
      <path d={area} fill="url(#areaFill)" />
      <path
        d={line}
        fill="none"
        stroke="var(--primary)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Map placeholder                                                     */
/* ------------------------------------------------------------------ */

function MapPlaceholder() {
  const dots = [
    { x: 22, y: 38, pulse: true },
    { x: 48, y: 30 },
    { x: 63, y: 52, pulse: true },
    { x: 78, y: 40 },
    { x: 35, y: 64 },
    { x: 86, y: 66, pulse: true },
    { x: 14, y: 58 },
  ];
  return (
    <div className="relative h-56 overflow-hidden rounded-md border border-border/40 bg-background/40">
      {/* grid */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.10] [background-image:linear-gradient(to_right,var(--grid)_1px,transparent_1px),linear-gradient(to_bottom,var(--grid)_1px,transparent_1px)] [background-size:36px_36px]" />
      {/* glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_40%,oklch(0.55_0.18_280/.22),transparent_55%),radial-gradient(ellipse_at_80%_70%,oklch(0.70_0.16_235/.18),transparent_55%)]" />
      {/* nodes */}
      {dots.map((d, i) => (
        <span
          key={i}
          className="absolute"
          style={{ left: `${d.x}%`, top: `${d.y}%` }}
        >
          {d.pulse && (
            <span className="absolute -left-2 -top-2 h-4 w-4 animate-ping rounded-full bg-primary/40" />
          )}
          <span className="relative block h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />
        </span>
      ))}
      {/* corner telemetry */}
      <div className="absolute left-2 top-2 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
        <Radar className="mb-1 inline h-3 w-3 text-primary" /> Live Track · 7 nodes
      </div>
      <div className="absolute bottom-2 right-2 font-mono text-[9px] tracking-widest text-muted-foreground">
        LAT -6.2088 · LON 106.8456
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mock data                                                          */
/* ------------------------------------------------------------------ */

const KPIS = [
  {
    label: "Active Signals",
    value: "12,480",
    delta: "+4.2%",
    up: true,
    icon: Activity,
    spark: [6, 8, 7, 10, 9, 12, 11, 14, 13, 16],
  },
  {
    label: "Sources Online",
    value: "318",
    delta: "+2.1%",
    up: true,
    icon: Radar,
    spark: [10, 11, 10, 12, 11, 13, 12, 13, 14, 14],
  },
  {
    label: "Alerts (24h)",
    value: "47",
    delta: "-8.6%",
    up: false,
    icon: Bell,
    spark: [14, 12, 13, 10, 11, 9, 10, 8, 7, 6],
  },
  {
    label: "Sentiment Index",
    value: "0.62",
    delta: "+0.05",
    up: true,
    icon: Gauge,
    spark: [7, 7, 8, 8, 9, 9, 10, 11, 11, 12],
  },
];

const SIGNAL_SERIES = [
  18, 22, 20, 27, 24, 33, 30, 42, 38, 36, 47, 44, 52, 49, 58, 54, 63, 60, 71, 66, 74, 70, 82, 78,
];

const CATEGORIES = [
  { label: "Geopolitics", value: 84 },
  { label: "Economy", value: 67 },
  { label: "Security", value: 58 },
  { label: "Infrastructure", value: 41 },
  { label: "Public Sentiment", value: 33 },
];

const FEED = [
  { text: "Signal spike detected in Sector 7", source: "Anomaly Engine", time: "00:12", level: "high" },
  { text: "New source onboarded: Maritime AIS", source: "Ingest", time: "00:31", level: "low" },
  { text: "Sentiment shift — financial sector", source: "NLP Pipeline", time: "01:04", level: "med" },
  { text: "Cross-source correlation confirmed", source: "Fusion", time: "01:22", level: "low" },
  { text: "Threshold breach: alert volume", source: "Monitor", time: "01:47", level: "high" },
  { text: "Briefing digest compiled", source: "Reports", time: "02:10", level: "low" },
  { text: "Geofence event — northern corridor", source: "Geo", time: "02:38", level: "med" },
] as const;
