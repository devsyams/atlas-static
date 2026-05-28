"use client";

import { useCallback, useEffect, useState, type ComponentType, type ReactNode } from "react";
import {
  Activity,
  CheckCircle2,
  Coffee,
  Gauge,
  MonitorPlay,
  Route,
  ShieldCheck,
  Siren,
  Sparkles,
  TrafficCone,
  TrendingUp,
  Truck,
} from "lucide-react";
import { Ticker } from "@/components/crisis/Ticker";
import { PredictionMeters } from "@/components/crisis/PredictionMeters";
import { ScoreGauge } from "@/components/crisis/ScoreGauge";
import { CountUp } from "@/components/crisis/CountUp";
import { BriefingPanel } from "@/components/ai/BriefingPanel";
import type { Intervention, OpsSnapshot } from "@/lib/jasamarga/types";
import { fmtRupiah, loadColor } from "@/lib/jasamarga/ui";
import { cn } from "@/lib/utils";
import { RouteRibbon } from "./RouteRibbon";
import { OpsInsight } from "./OpsInsight";
import { IncidentFeed } from "./IncidentFeed";
import { TopRuas } from "./TopRuas";
import { SpmBoard } from "./SpmBoard";
import { RestAreaPanel } from "./RestAreaPanel";
import { ResponseFleet } from "./ResponseFleet";
import { TrafficConsole } from "./TrafficConsole";
import { CommandWall } from "./CommandWall";

const BRIEFING_STAGES = [
  "Menarik telemetri ruas & gardu",
  "Memetakan insiden & posisi armada",
  "Mengukur kepatuhan SPM",
  "Memproyeksikan beban lalu lintas",
  "Menyusun laporan piket",
];

type LiveState = "loading" | "live" | "offline";

export function OpsCommand() {
  const [data, setData] = useState<OpsSnapshot | null>(null);
  const [live, setLive] = useState<LiveState>("loading");
  const [selectedSegment, setSelectedSegment] = useState<number | null>(null);
  const [briefingOpen, setBriefingOpen] = useState(false);
  const [wallOpen, setWallOpen] = useState(false);
  const [applied, setApplied] = useState<Intervention | null>(null);

  const loadData = useCallback(() => {
    setLive("loading");
    fetch("/api/v1/jasamarga-ops")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((payload: OpsSnapshot) => {
        setData(payload);
        setLive("live");
      })
      .catch(() => setLive("offline"));
  }, []);

  useEffect(() => {
    loadData();
    const id = setInterval(loadData, 60 * 1000);
    return () => clearInterval(id);
  }, [loadData]);

  const accent = data ? loadColor(data.load_index) : undefined;
  const seg = selectedSegment != null ? data?.segments[selectedSegment] : null;

  return (
    <div>
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-primary">
            JasaMarga · Tollroad Ops Command
          </div>
          <h1 className="mt-1 text-2xl font-bold leading-tight sm:text-[28px]">
            Pusat Kendali Lalu Lintas — {data?.corridor ?? "Jakarta–Cikampek"}
          </h1>
          <p className="mt-1.5 text-[12px] text-muted-foreground">
            Diperbarui {data?.updated_at ?? "—"} · pemantauan real-time JMTC + analitik Nexorus AI.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <LiveBadge state={live} />
          <button
            type="button"
            onClick={() => setBriefingOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-gradient-accent px-2.5 py-1.5 text-[11px] font-bold text-primary-foreground shadow-[0_4px_16px_-4px_oklch(0.55_0.18_280/.5)] transition-transform hover:scale-[1.02]"
          >
            <Sparkles className="h-3.5 w-3.5" /> Laporan Piket
          </button>
          <button
            type="button"
            onClick={() => setWallOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background/40 px-2.5 py-1.5 text-[11px] font-bold text-muted-foreground hover:text-foreground"
          >
            <MonitorPlay className="h-3.5 w-3.5" /> Command Wall
          </button>
          <button
            type="button"
            onClick={loadData}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background/40 px-2.5 py-1.5 text-[11px] font-bold text-muted-foreground hover:text-foreground"
          >
            ↻ Perbarui
          </button>
        </div>
      </div>

      <Ticker items={data?.ticker ?? []} />

      {applied && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-success/40 bg-success/10 px-3 py-2 text-[12px] font-semibold text-success">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Rekayasa diterapkan: <span className="font-bold">{applied.title}</span> ({applied.segment}) — memantau dampak,
          proyeksi waktu tempuh {applied.impact_time_pct}%.
          <button type="button" onClick={() => setApplied(null)} className="ml-auto text-success/70 hover:text-success">
            ×
          </button>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        {/* Route Ribbon — hero, full width */}
        <Tile
          title={`Live Network Ribbon — ${data?.corridor ?? "Jakarta–Cikampek"}`}
          icon={Route}
          className="lg:col-span-12"
          headerRight={
            seg ? (
              <span className="text-[10px] text-primary">
                {seg.label} · {seg.speed} km/j · VCR {seg.vcr}
              </span>
            ) : (
              <span className="text-[10px] text-muted-foreground">Klik segmen untuk detail</span>
            )
          }
          bodyClassName="p-3"
        >
          {data ? (
            <RouteRibbon
              segments={data.segments}
              gates={data.gates}
              restAreas={data.rest_areas}
              incidents={data.incidents}
              selected={selectedSegment}
              onSelect={setSelectedSegment}
            />
          ) : (
            <Empty state={live} />
          )}
        </Tile>

        {/* Network Load gauge + KPIs */}
        <Tile title="Indeks Beban Jaringan" icon={Gauge} className="lg:col-span-3" bodyClassName="p-2">
          {data ? (
            <div className="flex h-full flex-col items-center justify-center">
              <ScoreGauge score={data.load_index} />
              <div className="-mt-1 text-center">
                <div className="text-[40px] font-extrabold leading-none" style={{ color: accent }}>
                  <CountUp value={data.load_index} decimals={1} />
                </div>
                <div className="mt-1 text-sm font-bold" style={{ color: accent }}>
                  {data.emoji} {data.level}
                </div>
              </div>
              <div className="mt-3 grid w-full grid-cols-3 gap-1.5 text-center">
                <Kpi label="km/j" value={<CountUp value={data.avg_speed} />} />
                <Kpi label="insiden" value={<CountUp value={data.active_incidents} />} />
                <Kpi label="kend." value={<CountUp value={data.vehicles_now} />} />
              </div>
              <div className="mt-2 w-full rounded-md border border-border/50 bg-background/40 px-2 py-1.5 text-center">
                <div className="text-[9px] uppercase tracking-wide text-muted-foreground">Pendapatan hari ini</div>
                <div className="text-sm font-extrabold">{fmtRupiah(data.revenue_today)}</div>
                <div className="text-[9px] text-muted-foreground">target {fmtRupiah(data.revenue_target)}</div>
              </div>
            </div>
          ) : (
            <Empty state={live} />
          )}
        </Tile>

        {/* AI Ops Insight */}
        <Tile title="AI Ops Insight" icon={Activity} className="lg:col-span-5" bodyClassName="p-0">
          {data ? (
            <OpsInsight insight={data.insight} conditions={data.conditions} loadIndex={data.load_index} level={data.level} />
          ) : (
            <Empty state={live} />
          )}
        </Tile>

        {/* Congestion Forecast */}
        <Tile title="Prediksi Kemacetan" icon={TrendingUp} className="lg:col-span-4">
          <PredictionMeters predictions={data?.predictions ?? []} updatedAt={data?.updated_at} />
        </Tile>

        {/* Traffic Engineering Console — the gimmick */}
        <Tile title="Konsol Rekayasa Lalu Lintas" icon={TrafficCone} className="lg:col-span-5" tileClassName="border-primary/30">
          {data ? <TrafficConsole interventions={data.interventions} onApply={setApplied} /> : <Empty state={live} />}
        </Tile>

        {/* Live Incident Feed */}
        <Tile title="Insiden Langsung" icon={Siren} className="lg:col-span-4" bodyClassName="overflow-auto scrollbar-thin p-3" style={{ maxHeight: 360 }}>
          {data ? <IncidentFeed incidents={data.incidents} /> : <Empty state={live} />}
        </Tile>

        {/* Response Fleet */}
        <Tile title="Armada Respons" icon={Truck} className="lg:col-span-3">
          {data ? <ResponseFleet fleet={data.fleet} /> : <Empty state={live} />}
        </Tile>

        {/* SPM Compliance */}
        <Tile title="Kepatuhan SPM" icon={ShieldCheck} className="lg:col-span-5" style={{ maxHeight: 360 }}>
          {data ? <SpmBoard metrics={data.spm} overall={data.spm_compliance} /> : <Empty state={live} />}
        </Tile>

        {/* Top Ruas */}
        <Tile title="Titik Beban Teratas" icon={Route} className="lg:col-span-4" bodyClassName="overflow-auto scrollbar-thin p-3" style={{ maxHeight: 360 }}>
          {data ? <TopRuas ruas={data.top_ruas} /> : <Empty state={live} />}
        </Tile>

        {/* Rest Areas */}
        <Tile title="Okupansi Rest Area" icon={Coffee} className="lg:col-span-3" bodyClassName="overflow-auto scrollbar-thin p-3" style={{ maxHeight: 360 }}>
          {data ? <RestAreaPanel areas={data.rest_areas} /> : <Empty state={live} />}
        </Tile>
      </div>

      <BriefingPanel
        open={briefingOpen}
        onClose={() => setBriefingOpen(false)}
        endpoint="/api/v1/jasamarga-ops/briefing"
        stages={BRIEFING_STAGES}
        title="Laporan Piket AI"
        subtitle="Nexorus Ops Orchestration"
        docTitle="Nexorus AI · Laporan Piket JMTC"
        docMeta="JasaMarga Ops Command · Jakarta–Cikampek"
      />

      <CommandWall open={wallOpen} onClose={() => setWallOpen(false)} data={data} />
    </div>
  );
}

interface TileProps {
  title: string;
  icon: ComponentType<{ className?: string }>;
  className?: string;
  tileClassName?: string;
  bodyClassName?: string;
  headerRight?: ReactNode;
  style?: React.CSSProperties;
  children: ReactNode;
}

function Tile({ title, icon: Icon, className, tileClassName, bodyClassName, headerRight, style, children }: TileProps) {
  return (
    <div className={cn("flex flex-col overflow-hidden rounded-lg border bg-card/60", tileClassName ?? "border-border/60", className)} style={style}>
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/40 bg-background/40 px-2 py-1 text-[11px]">
        <div className="flex items-center gap-1.5 truncate">
          <Icon className="h-3 w-3 shrink-0 text-primary" />
          <span className="truncate font-medium">{title}</span>
        </div>
        <div className="flex items-center gap-1.5">{headerRight}</div>
      </div>
      <div className={cn("min-h-0 flex-1 scrollbar-thin", bodyClassName ?? "overflow-auto p-3")}>{children}</div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md border border-border/50 bg-background/40 py-1">
      <div className="text-sm font-extrabold leading-none">{value}</div>
      <div className="mt-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

function LiveBadge({ state }: { state: LiveState }) {
  const map = {
    loading: { text: "● memuat…", cls: "border-border bg-background/40 text-muted-foreground" },
    live: { text: "● Live", cls: "border-success/40 bg-success/10 text-success" },
    offline: { text: "● Offline", cls: "border-destructive/40 bg-destructive/10 text-destructive" },
  }[state];
  return <span className={cn("rounded-full border px-3 py-1.5 text-[11px] font-bold whitespace-nowrap", map.cls)}>{map.text}</span>;
}

function Empty({ state }: { state: LiveState }) {
  return (
    <div className="flex h-full min-h-[120px] items-center justify-center text-center text-[12px] text-muted-foreground">
      {state === "offline" ? "Data tidak dapat dimuat." : "Memuat data…"}
    </div>
  );
}
