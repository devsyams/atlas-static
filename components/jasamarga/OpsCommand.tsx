"use client";

import { useCallback, useEffect, useState, type ComponentType, type ReactNode } from "react";
import {
  Activity,
  CalendarClock,
  CheckCircle2,
  Clock,
  CloudRain,
  Gauge,
  Map as MapIcon,
  Megaphone,
  MessageCircle,
  MonitorPlay,
  Newspaper,
  Pause,
  Play,
  Route,
  ShieldCheck,
  Siren,
  Sparkles,
  TrafficCone,
  TrendingUp,
  Video,
} from "lucide-react";
import { Ticker } from "@/components/crisis/Ticker";
import { PredictionMeters } from "@/components/crisis/PredictionMeters";
import { ScoreGauge } from "@/components/crisis/ScoreGauge";
import { CountUp } from "@/components/crisis/CountUp";
import { BriefingPanel } from "@/components/ai/BriefingPanel";
import type { CctvFeed, CorridorPulse, Intervention, OpsSnapshot, WeatherZone } from "@/lib/jasamarga/types";
import { projectSegments } from "@/lib/jasamarga/data";
import { loadColor, loadLevel } from "@/lib/jasamarga/ui";
import { safetyColor } from "@/lib/jasamarga/safety";
import { CORRIDORS, getCorridor } from "@/lib/jasamarga/corridors";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";
import { SafeMeter } from "./SafeMeter";
import { RouteRibbon } from "./RouteRibbon";
import { OpsInsight } from "./OpsInsight";
import { IncidentFeed } from "./IncidentFeed";
import { TopRuas } from "./TopRuas";
import { TrafficConsole } from "./TrafficConsole";
import { CommandWall } from "./CommandWall";
import { SocialPulse } from "./SocialPulse";
import { OfficialFeed } from "./OfficialFeed";
import { NewsCoverage } from "./NewsCoverage";
import { ForecastTimeline } from "./ForecastTimeline";
import { TravelTimeBoard } from "./TravelTimeBoard";
import { SourceStatus } from "./SourceStatus";
import { VisionWall } from "./VisionWall";
import { CameraModal } from "./CameraModal";

const CorridorMap = dynamic(() => import("./CorridorMap").then((m) => m.CorridorMap), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-[12px] text-muted-foreground">Memuat peta…</div>,
});

const BRIEFING_STAGES = [
  "Menarik data lalu lintas (Google/Waze)",
  "Menyapu laporan Waze & media sosial",
  "Memindai berita & kanal resmi",
  "Memproyeksikan beban lalu lintas",
  "Menyusun laporan piket",
];

const IMPACT_CLASS: Record<WeatherZone["impact"], string> = {
  rendah: "text-success",
  sedang: "text-warning",
  tinggi: "text-destructive",
};

type LiveState = "loading" | "live" | "offline";

export function OpsCommand() {
  const [data, setData] = useState<OpsSnapshot | null>(null);
  const [live, setLive] = useState<LiveState>("loading");
  const [selectedSegment, setSelectedSegment] = useState<number | null>(null);
  const [corridorId, setCorridorId] = useState("japek");
  const [heroView, setHeroView] = useState<"peta" | "ribbon">("peta");
  const [briefingOpen, setBriefingOpen] = useState(false);
  const [wallOpen, setWallOpen] = useState(false);
  const [shared, setShared] = useState<Intervention | null>(null);
  const [pulses, setPulses] = useState<Record<string, CorridorPulse>>({});
  const [activeCam, setActiveCam] = useState<CctvFeed | null>(null);
  const [forecastIdx, setForecastIdx] = useState(0); // 0 = now (live)
  const [playing, setPlaying] = useState(false);

  const loadData = useCallback(() => {
    setLive("loading");
    fetch(`/api/v1/jasamarga-ops?corridor=${corridorId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((payload: OpsSnapshot) => {
        setData(payload);
        setLive("live");
      })
      .catch(() => setLive("offline"));
  }, [corridorId]);

  const handleCorridorChange = (id: string) => {
    if (id === corridorId) return;
    setSelectedSegment(null);
    setForecastIdx(0);      // reset the time machine to "now"
    setPlaying(false);
    setData(null);          // show the loader during the switch
    setCorridorId(id);
  };

  useEffect(() => {
    loadData();
    const id = setInterval(loadData, 60 * 1000);
    return () => clearInterval(id);
  }, [loadData]);

  // Per-corridor pulse for the route-selector status dots (independent of selection).
  useEffect(() => {
    const loadPulses = () => {
      fetch("/api/v1/jasamarga-ops/pulse")
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((list: CorridorPulse[]) => {
          setPulses(Object.fromEntries(list.map((p) => [p.id, p])));
        })
        .catch(() => {});
    };
    loadPulses();
    const id = setInterval(loadPulses, 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const accent = data ? loadColor(data.load_index) : undefined;
  const seg = selectedSegment != null ? data?.segments[selectedSegment] : null;

  // Map → camera: select a segment AND pop the nearest CCTV feed (by km midpoint).
  const handleMapSelect = useCallback(
    (i: number | null) => {
      setSelectedSegment(i);
      if (i == null || !data) return;
      const s = data.segments[i];
      if (!s) return;
      const mid = (s.km_from + s.km_to) / 2;
      let nearest: CctvFeed | null = null;
      let best = Infinity;
      for (const c of data.cctv) {
        const km = parseFloat(c.km.replace(/[^\d.]/g, ""));
        if (Number.isNaN(km)) continue;
        const d = Math.abs(km - mid);
        if (d < best) {
          best = d;
          nearest = c;
        }
      }
      if (nearest) setActiveCam(nearest);
    },
    [data],
  );

  // --- Predictive time machine (map-only forecast scrubber) ---
  const fc = data?.forecast ?? [];
  // Guard the index against the current forecast length (corridors may differ).
  const safeIdx = fc.length ? Math.min(forecastIdx, fc.length - 1) : 0;
  const projected =
    data && safeIdx > 0 && fc[safeIdx]
      ? projectSegments(data.segments, data.load_index, fc[safeIdx].load)
      : data?.segments ?? [];
  const fcHour = fc[safeIdx];
  const fcLevel = fcHour ? loadLevel(fcHour.load) : null;
  const fcColor = fcHour ? loadColor(fcHour.load) : undefined;

  // Auto-play: advance the scrubber ~every 1.6s, looping back to "now".
  useEffect(() => {
    if (!playing || fc.length <= 1) return;
    const id = setInterval(() => {
      setForecastIdx((i) => (i + 1) % fc.length);
    }, 1600);
    return () => clearInterval(id);
  }, [playing, fc.length]);

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-primary">
            JasaMarga · Tollroad Ops Command
          </div>
          <h1 className="mt-1 text-2xl font-bold leading-tight sm:text-[28px]">
            Pemantauan Lalu Lintas — {data?.corridor ?? "Jakarta–Cikampek"}
          </h1>
          <p className="mt-1.5 text-[12px] text-muted-foreground">
            Diperbarui {data?.updated_at ?? "—"} · 100% dari sumber publik/daring (traffic API, medsos, berita, BMKG, kanal resmi) + analitik Nexorus AI.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <LiveBadge state={live} />
          <button
            type="button"
            onClick={() => setBriefingOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-gradient-accent px-2.5 py-1.5 text-[11px] font-bold text-primary-foreground shadow-[0_4px_16px_-4px_oklch(0.55_0.18_280/.5)] transition-transform hover:scale-[1.02]"
          >
            <Sparkles className="h-3.5 w-3.5" /> Briefing
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

      {/* Source provenance strip — answers "where's the data from?" */}
      {data && (
        <div className="mb-3 rounded-lg border border-border/50 bg-card/50 px-3 py-2">
          <SourceStatus sources={data.sources} />
        </div>
      )}

      {shared && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-success/40 bg-success/10 px-3 py-2 text-[12px] font-semibold text-success">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Rekomendasi diteruskan ke JMTC: <span className="font-bold">{shared.title}</span> ({shared.segment}) — proyeksi waktu tempuh {shared.impact_time_pct}%.
          <button type="button" onClick={() => setShared(null)} className="ml-auto text-success/70 hover:text-success">
            ×
          </button>
        </div>
      )}

      {/* Route selector */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Ruas Tol</span>
        {CORRIDORS.map((c) => {
          const active = c.id === corridorId;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => handleCorridorChange(c.id)}
              className={cn(
                "rounded-full border px-3 py-1 text-[11px] font-bold transition-colors",
                active
                  ? "border-primary/50 bg-primary/15 text-primary"
                  : "border-border/60 bg-background/40 text-muted-foreground hover:text-foreground",
              )}
            >
              {pulses[c.id] && (
                <span
                  className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle"
                  style={{ background: safetyColor(pulses[c.id].score), boxShadow: `0 0 6px ${safetyColor(pulses[c.id].score)}` }}
                  title={`Skor keselamatan ${pulses[c.id].score} · ${pulses[c.id].level}`}
                />
              )}
              {c.short}
            </button>
          );
        })}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        {/* Live Network — hero, full width, map/ribbon toggle */}
        <Tile
          title={`Live Network — ${data?.corridor ?? "Jakarta–Cikampek"}`}
          icon={heroView === "peta" ? MapIcon : Route}
          className="lg:col-span-12"
          headerRight={
            <div className="flex items-center gap-2">
              {seg ? (
                <span className="text-[10px] text-primary">
                  {seg.label} · {seg.speed} km/j · +{seg.delay_min} mnt
                </span>
              ) : (
                <span className={cn("text-[10px]", data?.traffic_source === "tomtom" ? "text-success" : "text-muted-foreground")}>
                  {data?.traffic_source === "tomtom" ? "● TomTom live" : "Simulasi"} · klik segmen
                </span>
              )}
              <div className="flex overflow-hidden rounded-md border border-border/60 text-[10px] font-bold">
                {(["peta", "ribbon"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setHeroView(v)}
                    className={cn("px-2 py-0.5 capitalize", heroView === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          }
          bodyClassName="p-0"
          style={{ height: 440 }}
        >
          {data ? (
            heroView === "peta" ? (
              <div className="relative h-full">
                <CorridorMap
                  corridor={getCorridor(corridorId)}
                  segments={projected}
                  incidents={data.incidents}
                  selected={selectedSegment}
                  onSelect={handleMapSelect}
                  safetyScore={data.safety.score}
                />
                {/* Forecast corner badge — so a screenshot reads as a projection, not live */}
                {safeIdx > 0 && fcHour && (
                  <div className="pointer-events-none absolute right-2 top-2 z-[500] flex items-center gap-1.5 rounded-md border border-warning/50 bg-background/80 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-warning backdrop-blur">
                    <Clock className="h-3 w-3" /> Prakiraan · {fcHour.hour}
                  </div>
                )}
                {/* Time-machine control bar — scrub the forecast, recolor the corridor */}
                <div className="absolute inset-x-2 bottom-2 z-[500] rounded-md border border-border/60 bg-background/70 px-2.5 py-2 backdrop-blur">
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setPlaying((p) => !p)}
                      title={playing ? "Jeda" : "Putar prakiraan"}
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-primary/40 bg-primary/15 text-primary transition-colors hover:bg-primary/25"
                    >
                      {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={Math.max(0, fc.length - 1)}
                      value={safeIdx}
                      onChange={(e) => {
                        setPlaying(false);
                        setForecastIdx(Number(e.target.value));
                      }}
                      aria-label="Penggeser waktu prakiraan"
                      className="jm-range h-1 flex-1 cursor-pointer appearance-none rounded-full bg-border/70"
                    />
                    <div className="flex shrink-0 flex-col items-end leading-tight">
                      {safeIdx === 0 ? (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-success">
                          <span className="h-1.5 w-1.5 rounded-full bg-success" /> Sekarang
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-[11px] font-bold text-foreground">
                          <span className="rounded bg-warning/20 px-1 py-0.5 text-[8px] font-extrabold uppercase tracking-[0.1em] text-warning">
                            Prakiraan
                          </span>
                          {fcHour?.hour}
                        </span>
                      )}
                      {fcLevel && (
                        <span className="text-[10px] font-semibold" style={{ color: fcColor }}>
                          {fcLevel.emoji} {fcLevel.label}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3">
                <RouteRibbon
                  segments={data.segments}
                  landmarks={data.landmarks}
                  incidents={data.incidents}
                  selected={selectedSegment}
                  onSelect={setSelectedSegment}
                />
              </div>
            )
          ) : (
            <Empty state={live} />
          )}
        </Tile>

        {/* AI Vision — CCTV Vision Wall (headline feature) */}
        <Tile
          title="AI Vision — CCTV Koridor"
          icon={Video}
          className="lg:col-span-6"
          tileClassName="border-primary/40"
          headerRight={<span className="text-[10px] text-muted-foreground">Nexorus Vision · simulasi</span>}
          bodyClassName="p-2"
          style={{ minHeight: 300 }}
        >
          {data ? <VisionWall cctv={data.cctv} onOpen={setActiveCam} /> : <Empty state={live} />}
        </Tile>

        {/* Safe Meter — the headline gimmick */}
        <Tile title="Safe Meter" icon={ShieldCheck} className="lg:col-span-6" tileClassName="border-primary/40" bodyClassName="p-0">
          {data ? <SafeMeter safety={data.safety} /> : <Empty state={live} />}
        </Tile>

        {/* Congestion Index gauge + KPIs + weather */}
        <Tile title="Indeks Kemacetan" icon={Gauge} className="lg:col-span-3" bodyClassName="p-2">
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
                <Kpi label="+mnt" value={<CountUp value={data.avg_delay_min} />} />
                <Kpi label="insiden" value={<CountUp value={data.active_incidents} />} />
              </div>
              <div className="mt-2 w-full rounded-md border border-border/50 bg-background/40 px-2 py-1.5">
                <div className="mb-1 flex items-center gap-1 text-[9px] uppercase tracking-wide text-muted-foreground">
                  <CloudRain className="h-3 w-3" /> Cuaca koridor (BMKG)
                </div>
                {data.weather.map((w) => (
                  <div key={w.zone} className="flex items-center justify-between text-[10px]">
                    <span className="truncate text-muted-foreground">{w.zone}</span>
                    <span className={cn("font-semibold", IMPACT_CLASS[w.impact])}>
                      {w.condition} {w.temp}°
                    </span>
                  </div>
                ))}
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
          {data ? <TrafficConsole interventions={data.interventions} onApply={setShared} /> : <Empty state={live} />}
        </Tile>

        {/* Live Incident Feed (public reports) */}
        <Tile title="Insiden (Laporan Publik)" icon={Siren} className="lg:col-span-4" bodyClassName="overflow-auto scrollbar-thin p-3" style={{ maxHeight: 360 }}>
          {data ? <IncidentFeed incidents={data.incidents} /> : <Empty state={live} />}
        </Tile>

        {/* Social Pulse */}
        <Tile title="Sentimen Publik" icon={MessageCircle} className="lg:col-span-3" style={{ maxHeight: 360 }}>
          {data ? <SocialPulse data={data.social} /> : <Empty state={live} />}
        </Tile>

        {/* Congestion Forecast Timeline — predictive, from public typical-traffic */}
        <Tile title="Proyeksi Beban 6 Jam" icon={CalendarClock} className="lg:col-span-8" bodyClassName="p-3" style={{ minHeight: 230 }}>
          {data ? <ForecastTimeline hours={data.forecast} /> : <Empty state={live} />}
        </Tile>

        {/* Travel-Time Board */}
        <Tile title="Papan Waktu Tempuh" icon={Clock} className="lg:col-span-4" bodyClassName="overflow-auto scrollbar-thin p-3" style={{ maxHeight: 300 }}>
          {data ? <TravelTimeBoard routes={data.travel_times} /> : <Empty state={live} />}
        </Tile>

        {/* Official Feed */}
        <Tile title="Kanal Resmi" icon={Megaphone} className="lg:col-span-4" bodyClassName="overflow-auto scrollbar-thin p-3" style={{ maxHeight: 340 }}>
          {data ? <OfficialFeed posts={data.official} /> : <Empty state={live} />}
        </Tile>

        {/* News Coverage */}
        <Tile title="Liputan Media" icon={Newspaper} className="lg:col-span-4" bodyClassName="overflow-auto scrollbar-thin p-3" style={{ maxHeight: 340 }}>
          {data ? <NewsCoverage articles={data.news} /> : <Empty state={live} />}
        </Tile>

        {/* Top Ruas */}
        <Tile title="Titik Macet Teratas" icon={Route} className="lg:col-span-4" bodyClassName="overflow-auto scrollbar-thin p-3" style={{ maxHeight: 340 }}>
          {data ? <TopRuas ruas={data.top_ruas} /> : <Empty state={live} />}
        </Tile>
      </div>

      <BriefingPanel
        open={briefingOpen}
        onClose={() => setBriefingOpen(false)}
        endpoint={`/api/v1/jasamarga-ops/briefing?corridor=${corridorId}`}
        stages={BRIEFING_STAGES}
        title="Executive Briefing"
        subtitle="Nexorus AI Orchestration"
        docTitle="Nexorus AI · Executive Briefing — JMTC"
        docMeta={`JasaMarga Ops Command · ${data?.corridor ?? "Jakarta–Cikampek"} (sumber publik)`}
      />

      <CommandWall open={wallOpen} onClose={() => setWallOpen(false)} data={data} />

      <CameraModal cam={activeCam} onClose={() => setActiveCam(null)} />
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
