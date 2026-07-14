"use client";

/**
 * OpsGlance — PROTOTYPE of the "Tier-1 Glance" redesign.
 *
 * Same data + same components as OpsCommand, rearranged for the operator:
 *   • Tier 1 (always on): Map + Safe Meter + AI Insight + Live Incidents — 4 things, calm.
 *   • Tier 2 (on demand): everything else behind a tab row (renders only when opened).
 *   • Tier 3 (wow):       the existing Command Wall + Briefing, reached from the header.
 *
 * Motion discipline: the only thing meant to draw the eye is an incident. The dense
 * panels don't render until you ask for them, so nothing ambient competes for attention.
 *
 * This lives at /jasamarga/glance and does NOT touch the live /jasamarga page.
 */

import { useCallback, useEffect, useState, type ComponentType, type ReactNode } from "react";
import dynamic from "next/dynamic";
import {
  Activity,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  MessageCircle,
  MonitorPlay,
  Route,
  ShieldCheck,
  Siren,
  Sparkles,
  TrafficCone,
  TrendingUp,
  Video,
} from "lucide-react";

import { PredictionMeters } from "@/components/crisis/PredictionMeters";
import { ScoreGauge } from "@/components/crisis/ScoreGauge";
import { CountUp } from "@/components/crisis/CountUp";
import { BriefingPanel } from "@/components/ai/BriefingPanel";
import type { CorridorPulse, Intervention, OpsSnapshot } from "@/lib/jasamarga/types";
import { loadColor } from "@/lib/jasamarga/ui";
import { safetyColor } from "@/lib/jasamarga/safety";
import { CORRIDORS, getCorridor } from "@/lib/jasamarga/corridors";
import { cn } from "@/lib/utils";

import { SafeMeter } from "./SafeMeter";
import type { Prediction } from "@/lib/mbg/types";

import { OpsInsight } from "./OpsInsight";
import { useOpsAi } from "./useOpsAi";
import { IncidentFeed } from "./IncidentFeed";
import { TopRuas } from "./TopRuas";
import { TrafficConsole } from "./TrafficConsole";
import { CommandWall } from "./CommandWall";
import { SocialPulse } from "./SocialPulse";
import { ForecastTimeline } from "./ForecastTimeline";
import { VisionWall } from "./VisionWall";

const CorridorMap = dynamic(() => import("./CorridorMap").then((m) => m.CorridorMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-[12px] text-muted-foreground">Memuat peta…</div>
  ),
});

const BRIEFING_STAGES = [
  "Menarik data lalu lintas (Google/Waze)",
  "Menyapu topik media intelligence (Nexorus)",
  "Memproyeksikan beban lalu lintas",
  "Menyusun laporan piket",
];

type LiveState = "loading" | "live" | "offline";

/** Tier-2 drill tabs — dense panels grouped by question, shown only on demand. */
type DrillTab = "forecast" | "bottleneck" | "cctv" | "social" | "console";

const TABS: { id: DrillTab; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { id: "forecast", label: "Prakiraan", icon: TrendingUp },
  { id: "bottleneck", label: "Titik Macet", icon: Route },
  { id: "cctv", label: "CCTV AI", icon: Video },
  { id: "social", label: "Sentimen Publik", icon: MessageCircle },
  { id: "console", label: "Rekayasa", icon: TrafficCone },
];

export function OpsGlance() {
  const [data, setData] = useState<OpsSnapshot | null>(null);
  const [live, setLive] = useState<LiveState>("loading");
  const [corridorId, setCorridorId] = useState("japek");
  const [selectedSegment, setSelectedSegment] = useState<number | null>(null);
  const [pulses, setPulses] = useState<Record<string, CorridorPulse>>({});
  const [briefingOpen, setBriefingOpen] = useState(false);
  const [wallOpen, setWallOpen] = useState(false);
  const [shared, setShared] = useState<Intervention | null>(null);
  const [drill, setDrill] = useState<DrillTab | null>(null);

  // A12 — LLM-authored insight + predictions for the snapshot on screen.
  const ai = useOpsAi(data);

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

  useEffect(() => {
    loadData();
    const id = setInterval(loadData, 60 * 1000);
    return () => clearInterval(id);
  }, [loadData]);

  useEffect(() => {
    const loadPulses = () => {
      fetch("/api/v1/jasamarga-ops/pulse")
        .then((res) => (res.ok ? res.json() : Promise.reject()))
        .then((list: CorridorPulse[]) => setPulses(Object.fromEntries(list.map((p) => [p.id, p]))))
        .catch(() => {});
    };
    loadPulses();
    const id = setInterval(loadPulses, 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const handleCorridorChange = (id: string) => {
    if (id === corridorId) return;
    setSelectedSegment(null);
    setData(null);
    setCorridorId(id);
  };

  // A12 v4.0 — clicking a segment just selects it. The old behaviour also popped
  // a "nearest CCTV" modal, but those camera feeds were simulated and are gone.
  const handleMapSelect = useCallback((i: number | null) => setSelectedSegment(i), []);

  const accent = data ? loadColor(data.load_index) : undefined;
  const seg = selectedSegment != null ? data?.segments[selectedSegment] : null;
  const activeIncidents = data?.incidents.filter((i) => i.status !== "Selesai").length ?? 0;

  return (
    <div className="flex flex-col gap-3">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-primary">
            JasaMarga · Ops Command
            <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[9px] font-extrabold tracking-[0.1em] text-primary">
              GLANCE · PROTOTYPE
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold leading-tight sm:text-[26px]">
            {data?.corridor ?? "Jakarta–Cikampek"}
          </h1>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Diperbarui {data?.updated_at ?? "—"} · sumber publik/daring + analitik Nexorus AI
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <LiveBadge state={live} />
          <button
            type="button"
            onClick={() => setBriefingOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-gradient-accent px-2.5 py-1.5 text-[11px] font-bold text-primary-foreground transition-transform hover:scale-[1.02]"
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
        </div>
      </div>

      {/* Corridor selector */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Ruas Tol</span>
        {CORRIDORS.map((c) => {
          const active = c.id === corridorId;
          const pulse = pulses[c.id];
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
              {pulse && (
                <span
                  className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle"
                  style={{ background: safetyColor(pulse.score), boxShadow: `0 0 6px ${safetyColor(pulse.score)}` }}
                  title={`Skor keselamatan ${pulse.score} · ${pulse.level}`}
                />
              )}
              {c.short}
            </button>
          );
        })}
      </div>

      {shared && (
        <div className="flex items-center gap-2 rounded-md border border-success/40 bg-success/10 px-3 py-2 text-[12px] font-semibold text-success">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Rekomendasi diteruskan ke JMTC: <span className="font-bold">{shared.title}</span> ({shared.segment}).
          <button type="button" onClick={() => setShared(null)} className="ml-auto text-success/70 hover:text-success">
            ×
          </button>
        </div>
      )}

      {/* ── TIER 1: GLANCE ─────────────────────────────────────── */}
      {/* Map (big) on the left; Safe Meter + AI Insight stacked on the right. */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <Tile
          title={`Live Network — ${data?.corridor ?? "Jakarta–Cikampek"}`}
          icon={Route}
          className="lg:col-span-8"
          headerRight={
            seg ? (
              <span className="text-[10px] text-primary">
                {seg.label} · {seg.speed} km/j · +{seg.delay_min} mnt
              </span>
            ) : (
              <span className={cn("text-[10px]", data?.traffic_source === "tomtom" ? "text-success" : "text-muted-foreground")}>
                {data?.traffic_source === "tomtom" ? "● TomTom live" : "Simulasi"} · klik segmen
              </span>
            )
          }
          bodyClassName="p-0"
          style={{ height: 460 }}
        >
          {data ? (
            <CorridorMap
              corridor={getCorridor(corridorId)}
              segments={data.segments}
              incidents={data.incidents}
              selected={selectedSegment}
              onSelect={handleMapSelect}
            />
          ) : (
            <Empty state={live} />
          )}
        </Tile>

        <div className="flex flex-col gap-3 lg:col-span-4">
          <Tile title="Safe Meter" icon={ShieldCheck} tileClassName="border-primary/40" bodyClassName="p-0">
            {data ? <SafeMeter safety={data.safety} /> : <Empty state={live} />}
          </Tile>
          <Tile title="AI Ops Insight" icon={Activity} bodyClassName="p-0" className="flex-1">
            {data ? (
              <OpsInsight
                insight={ai.insight ?? data.insight}
                conditions={data.conditions}
                loadIndex={data.load_index}
                level={data.level}
                aiSource={ai.source}
              />
            ) : (
              <Empty state={live} />
            )}
          </Tile>
        </div>
      </div>

      {/* Live incidents — the one feed that stays on the glance view. */}
      <Tile
        title="Insiden Aktif"
        icon={Siren}
        tileClassName={activeIncidents > 0 ? "border-destructive/40" : undefined}
        headerRight={
          <span className="flex items-center gap-2 text-[10px]">
            {accent && (
              <span className="font-bold" style={{ color: accent }}>
                {data?.emoji} {data?.level}
              </span>
            )}
            <span className="rounded-full bg-background/60 px-1.5 py-0.5 font-bold text-muted-foreground">
              {activeIncidents} aktif
            </span>
          </span>
        }
        bodyClassName="overflow-auto scrollbar-thin p-3"
        style={{ maxHeight: 280 }}
      >
        {data ? <IncidentFeed incidents={data.incidents} /> : <Empty state={live} />}
      </Tile>

      {/* ── TIER 2: DRILL ──────────────────────────────────────── */}
      {/* Tab row; dense panels render only when their tab is open. */}
      <div className="rounded-lg border border-border/60 bg-card/40">
        <div className="flex flex-wrap items-center gap-1 border-b border-border/40 px-2 py-1.5">
          <span className="mr-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Detail
          </span>
          {TABS.map((t) => {
            const open = drill === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setDrill(open ? null : t.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-bold transition-colors",
                  open
                    ? "border-primary/50 bg-primary/15 text-primary"
                    : "border-transparent text-muted-foreground hover:bg-background/40 hover:text-foreground",
                )}
              >
                <Icon className="h-3 w-3" />
                {t.label}
              </button>
            );
          })}
          {drill && (
            <button
              type="button"
              onClick={() => setDrill(null)}
              className="ml-auto text-[11px] font-bold text-muted-foreground hover:text-foreground"
            >
              Tutup ×
            </button>
          )}
        </div>

        {!drill ? (
          <div className="flex items-center gap-2 px-3 py-4 text-[12px] text-muted-foreground">
            <ChevronRight className="h-3.5 w-3.5" />
            Pilih tab untuk membuka detail — prakiraan, waktu tempuh, CCTV, sentimen, atau konsol rekayasa.
          </div>
        ) : (
          <div className="p-3">{data ? <DrillPanel tab={drill} data={data} predictions={ai.predictions ?? data.predictions ?? []} onApply={setShared} accent={accent} /> : <Empty state={live} />}</div>
        )}
      </div>

      {/* ── TIER 3: WOW (existing modals) ──────────────────────── */}
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
    </div>
  );
}

/** Renders the dense panel(s) for the open drill tab — grouped by the question they answer. */
function DrillPanel({
  tab,
  data,
  predictions,
  onApply,
  accent,
}: {
  tab: DrillTab;
  data: OpsSnapshot;
  /** A12 — LLM predictions when live, so the drill-down agrees with the main tile. */
  predictions: Prediction[];
  onApply: (i: Intervention) => void;
  accent?: string;
}) {
  switch (tab) {
    case "forecast":
      return (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          <Panel title="Indeks Kemacetan" icon={TrendingUp} className="lg:col-span-3">
            <div className="flex flex-col items-center">
              <ScoreGauge score={data.load_index} />
              <div className="-mt-1 text-[32px] font-extrabold leading-none" style={{ color: accent }}>
                <CountUp value={data.load_index} decimals={1} />
              </div>
              <div className="text-sm font-bold" style={{ color: accent }}>
                {data.emoji} {data.level}
              </div>
            </div>
          </Panel>
          <Panel title="Proyeksi Beban 6 Jam" icon={CalendarClock} className="lg:col-span-5">
            <ForecastTimeline hours={data.forecast} />
          </Panel>
          <Panel title="Prediksi Kemacetan" icon={TrendingUp} className="lg:col-span-4">
            <PredictionMeters predictions={predictions} updatedAt={data.updated_at} />
          </Panel>
        </div>
      );
    case "bottleneck":
      return (
        <Panel title="Titik Macet Teratas" icon={Route}>
          <TopRuas ruas={data.top_ruas} />
        </Panel>
      );
    case "cctv":
      return (
        <Panel title="AI Vision — CCTV Live" icon={Video}>
          <VisionWall />
        </Panel>
      );
    case "social":
      return (
        <Panel title="Sentimen Publik" icon={MessageCircle}>
          <SocialPulse data={data.social} />
        </Panel>
      );
    case "console":
      return (
        <Panel title="Konsol Rekayasa Lalu Lintas" icon={TrafficCone}>
          <TrafficConsole interventions={data.interventions} onApply={onApply} />
        </Panel>
      );
  }
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
    <div
      className={cn("flex flex-col overflow-hidden rounded-lg border bg-card/60", tileClassName ?? "border-border/60", className)}
      style={style}
    >
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

/** Lightweight section wrapper used inside the drill panels. */
function Panel({
  title,
  icon: Icon,
  className,
  children,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("rounded-lg border border-border/50 bg-background/30", className)}>
      <div className="flex items-center gap-1.5 border-b border-border/40 px-2.5 py-1.5 text-[11px] font-medium">
        <Icon className="h-3 w-3 text-primary" />
        {title}
      </div>
      <div className="p-3">{children}</div>
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
