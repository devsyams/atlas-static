"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import {
  Activity,
  Banknote,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Coins,
  Eye,
  Gauge,
  GripVertical,
  Landmark,
  LayoutGrid,
  Lock,
  RotateCcw,
  MessageCircle,
  Newspaper,
  PieChart,
  Radar,
  ScanEye,
  ShieldAlert,
  ShieldCheck,
  Siren,
  MonitorPlay,
  Sparkles,
  TrendingUp,
  Users,
  Unlock,
  Wallet,
  Waypoints,
  Zap,
} from "lucide-react";
import dynamic from "next/dynamic";
import type { LayoutItem } from "react-grid-layout/legacy";
import { Ticker } from "@/components/crisis/Ticker";
import { PredictionMeters } from "@/components/crisis/PredictionMeters";
import { LeadershipSentiment } from "@/components/crisis/LeadershipSentiment";
import { BriefingPanel } from "@/components/ai/BriefingPanel";
import type { CapitalMove, Holding, SovereignSnapshot } from "@/lib/danantara/types";
import { computeStrength, projectHoldings } from "@/lib/danantara/data";
import { fmtAum, fmtT, reputationColor, strengthColor, withAlpha } from "@/lib/danantara/ui";
import { cn } from "@/lib/utils";
import { PortfolioUniverse } from "./PortfolioUniverse";
import { StrengthMeter } from "./StrengthMeter";
import { MarketsBoard } from "./MarketsBoard";
import { SectorDonut } from "./SectorDonut";
import { TopMovers } from "./TopMovers";
import { CapitalConsole } from "./CapitalConsole";
import { AumProjection } from "./AumProjection";
import { HoldingModal } from "./HoldingModal";
import { DividendBoard, NewsCoverage, SocialPulsePanel, SourceStrip } from "./SovereignFeeds";
import { ReputationMeter } from "./ReputationMeter";
import { IssueRadar } from "./IssueRadar";
import { SentimentTimeline } from "./SentimentTimeline";
import { ShareOfVoice } from "./ShareOfVoice";
import { CrisisWatch } from "./CrisisWatch";
import { ActorMap } from "./ActorMap";
import { ImpactLab } from "./ImpactLab";
import { NexorusAiLive } from "./NexorusAiLive";
import { AutoBrief } from "./AutoBrief";
import { NeuralBoot } from "./NeuralBoot";
import { IMPACT_EVENTS } from "@/lib/danantara/impact";

const GridBoard = dynamic(() => import("@/components/crisis/GridBoard"), { ssr: false });

const LAYOUT_KEY_MEDIA = "atlas:danantara:media:v2";
const LAYOUT_KEY_MARKETS = "atlas:danantara:markets:v2";

// Default layouts captured from the curated arrangement (v2).
const DEFAULT_LAYOUT_MEDIA: LayoutItem[] = [
  { i: "impact", x: 0, y: 0, w: 9, h: 6, minW: 6, minH: 6 },
  { i: "reputation", x: 9, y: 0, w: 3, h: 6, minW: 3, minH: 4 },
  { i: "radar", x: 0, y: 6, w: 5, h: 5, minW: 3, minH: 4 },
  { i: "sentiment", x: 5, y: 6, w: 7, h: 5, minW: 3, minH: 4 },
  { i: "crisis", x: 0, y: 11, w: 5, h: 5, minW: 4, minH: 4 },
  { i: "sov", x: 5, y: 11, w: 7, h: 5, minW: 3, minH: 4 },
  { i: "stakeholder", x: 0, y: 16, w: 6, h: 8, minW: 4, minH: 5 },
  { i: "actor", x: 6, y: 16, w: 6, h: 8, minW: 4, minH: 5 },
  { i: "social", x: 0, y: 24, w: 6, h: 5, minW: 3, minH: 4 },
  { i: "news", x: 6, y: 24, w: 6, h: 5, minW: 3, minH: 4 },
];

const DEFAULT_LAYOUT_MARKETS: LayoutItem[] = [
  { i: "hero", x: 0, y: 0, w: 9, h: 7, minW: 5, minH: 5 },
  { i: "strength", x: 9, y: 0, w: 3, h: 7, minW: 3, minH: 5 },
  { i: "markets", x: 0, y: 7, w: 5, h: 5, minW: 3, minH: 4 },
  { i: "insight", x: 5, y: 7, w: 4, h: 5, minW: 3, minH: 4 },
  { i: "donut", x: 9, y: 7, w: 3, h: 5, minW: 3, minH: 4 },
  { i: "capital", x: 0, y: 12, w: 5, h: 6, minW: 3, minH: 4 },
  { i: "predictions", x: 5, y: 12, w: 4, h: 6, minW: 3, minH: 4 },
  { i: "movers", x: 9, y: 12, w: 3, h: 6, minW: 3, minH: 4 },
  { i: "projection", x: 0, y: 18, w: 8, h: 4, minW: 4, minH: 3 },
  { i: "dividends", x: 8, y: 18, w: 4, h: 4, minW: 3, minH: 3 },
  { i: "social", x: 0, y: 22, w: 6, h: 5, minW: 3, minH: 4 },
  { i: "news", x: 6, y: 22, w: 6, h: 5, minW: 3, minH: 4 },
];

function reconcileLayout(saved: LayoutItem[], def: LayoutItem[]): LayoutItem[] {
  const byId = new Map(saved.map((l) => [l.i, l]));
  return def.map((d) => {
    const s = byId.get(d.i);
    if (!s) return d;
    return {
      ...d,
      x: typeof s.x === "number" ? s.x : d.x,
      y: typeof s.y === "number" ? s.y : d.y,
      w: Math.max(s.w ?? d.w, d.minW ?? 2),
      h: Math.max(s.h ?? d.h, d.minH ?? 2),
    };
  });
}

interface Widget {
  i: string;
  title: string;
  icon: ComponentType<{ className?: string }>;
  tileClassName?: string;
  bodyClassName?: string;
  headerRight?: ReactNode;
  body: ReactNode;
}

const BRIEFING_STAGES = [
  "Menarik data pasar (IDX & valas)",
  "Menilai kinerja portofolio BUMN",
  "Mengukur arus dividen & likuiditas",
  "Memodelkan skenario & risiko",
  "Menyusun brief komite investasi",
];

type LiveState = "loading" | "live" | "offline";
type Metric = "day" | "ytd";

export function SovereignCommand() {
  const [data, setData] = useState<SovereignSnapshot | null>(null);
  const [live, setLive] = useState<LiveState>("loading");
  const [mode, setMode] = useState<"media" | "markets">("media");
  const [impactEvent, setImpactEvent] = useState<string>("fx_up_big");
  const [stress, setStress] = useState(0);
  const [metric, setMetric] = useState<Metric>("day");
  const [briefingOpen, setBriefingOpen] = useState(false);
  const [autoBriefOpen, setAutoBriefOpen] = useState(false);
  const [selected, setSelected] = useState<Holding | null>(null);
  const [approved, setApproved] = useState<CapitalMove | null>(null);
  const [alert, setAlert] = useState<{ text: string; tone: "good" | "warn" | "bad" } | null>(null);
  const [fx, setFx] = useState(0); // increments each refresh → KPI shine
  const prevRef = useRef<SovereignSnapshot | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [layoutMedia, setLayoutMedia] = useState<LayoutItem[]>(DEFAULT_LAYOUT_MEDIA);
  const [layoutMarkets, setLayoutMarkets] = useState<LayoutItem[]>(DEFAULT_LAYOUT_MARKETS);

  // Restore saved layouts after mount (avoids SSR hydration mismatch).
  useEffect(() => {
    try {
      const m = localStorage.getItem(LAYOUT_KEY_MEDIA);
      if (m) setLayoutMedia(reconcileLayout(JSON.parse(m) as LayoutItem[], DEFAULT_LAYOUT_MEDIA));
      const k = localStorage.getItem(LAYOUT_KEY_MARKETS);
      if (k) setLayoutMarkets(reconcileLayout(JSON.parse(k) as LayoutItem[], DEFAULT_LAYOUT_MARKETS));
    } catch {
      /* ignore */
    }
  }, []);

  const persistLayout = useCallback(
    (next: LayoutItem[]) => {
      if (!editMode) return;
      const key = mode === "media" ? LAYOUT_KEY_MEDIA : LAYOUT_KEY_MARKETS;
      if (mode === "media") setLayoutMedia(next);
      else setLayoutMarkets(next);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* ignore */
      }
    },
    [editMode, mode],
  );

  const resetLayout = useCallback(() => {
    if (mode === "media") {
      setLayoutMedia(DEFAULT_LAYOUT_MEDIA);
      try {
        localStorage.removeItem(LAYOUT_KEY_MEDIA);
      } catch {
        /* ignore */
      }
    } else {
      setLayoutMarkets(DEFAULT_LAYOUT_MARKETS);
      try {
        localStorage.removeItem(LAYOUT_KEY_MARKETS);
      } catch {
        /* ignore */
      }
    }
  }, [mode]);

  const loadData = useCallback(() => {
    setLive("loading");
    fetch("/api/v1/danantara")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((payload: SovereignSnapshot) => {
        if (prevRef.current) {
          setAlert(buildAlert(prevRef.current, payload));
          setFx((f) => f + 1);
        }
        prevRef.current = payload;
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

  // Auto-dismiss the live alert toast.
  useEffect(() => {
    if (!alert) return;
    const t = setTimeout(() => setAlert(null), 5500);
    return () => clearTimeout(t);
  }, [alert]);

  // Recompute the Strength Index under the active stress scenario.
  const stressedStrength = useMemo(() => {
    if (!data) return null;
    if (stress < 0.001) return data.strength;
    const projected = projectHoldings(data.holdings, stress);
    return computeStrength(projected, data.social.positivity, undefined, stress);
  }, [data, stress]);

  const handleStress = useCallback((v: number) => {
    setStress(v);
    if (v > 0) setMetric("day"); // shock only reshapes today's moves
  }, []);

  // Crisis "Lihat dampak" → load that scenario AND scroll the simulator into view
  // so the recompute animation is actually seen.
  const handleCrisisImpact = useCallback((eventId: string) => {
    setImpactEvent(eventId);
    requestAnimationFrame(() => {
      document.getElementById("dn-w-impact")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const accent = data ? strengthColor((stressedStrength ?? data.strength).score) : undefined;

  const mediaWidgets: Widget[] = [
    {
      i: "impact",
      title: "Issue → Stock Price Impact Simulator",
      icon: Waypoints,
      tileClassName: "border-primary/40",
      headerRight: <span className="text-[10px] text-muted-foreground">Nexorus AI · model transmisi</span>,
      bodyClassName: "p-3",
      body: data ? <ImpactLab holdings={data.holdings} aum={data.aum_t} events={IMPACT_EVENTS} eventId={impactEvent} onSelectEvent={setImpactEvent} /> : <Empty state={live} />,
    },
    { i: "radar", title: "Narrative & Issue Radar", icon: Radar, tileClassName: "border-primary/40", bodyClassName: "p-3", body: data ? <IssueRadar issues={data.media.issues} /> : <Empty state={live} /> },
    { i: "reputation", title: "Reputation Index", icon: ShieldCheck, tileClassName: "border-primary/40", bodyClassName: "overflow-auto scrollbar-thin p-2", body: data ? <ReputationMeter reputation={data.media.reputation} /> : <Empty state={live} /> },
    { i: "sentiment", title: "14-Day Sentiment Trend", icon: Activity, bodyClassName: "p-3", body: data ? <SentimentTimeline days={data.media.timeline} /> : <Empty state={live} /> },
    { i: "crisis", title: "Crisis Early-Warning", icon: Siren, tileClassName: "border-warning/30", bodyClassName: "overflow-auto scrollbar-thin p-3", body: data ? <CrisisWatch signals={data.media.crisis} onImpact={handleCrisisImpact} /> : <Empty state={live} /> },
    { i: "sov", title: "Share of Voice by Entity", icon: BarChart3, bodyClassName: "overflow-auto scrollbar-thin p-3", body: data ? <ShareOfVoice voice={data.media.voice} /> : <Empty state={live} /> },
    { i: "stakeholder", title: "Stakeholder Sentiment", icon: Users, bodyClassName: "overflow-auto scrollbar-thin p-3", body: data ? <LeadershipSentiment data={data.media.stakeholders} /> : <Empty state={live} /> },
    { i: "actor", title: "Actor & Influencer Map", icon: ScanEye, bodyClassName: "overflow-auto scrollbar-thin p-3", body: data ? <ActorMap actors={data.media.actors} /> : <Empty state={live} /> },
    { i: "social", title: "Public Sentiment (Social)", icon: MessageCircle, bodyClassName: "p-2.5", body: data ? <SocialPulsePanel data={data.social} /> : <Empty state={live} /> },
    { i: "news", title: "Media Coverage", icon: Newspaper, bodyClassName: "overflow-auto scrollbar-thin p-3", body: data ? <NewsCoverage articles={data.news} /> : <Empty state={live} /> },
  ];

  const marketsWidgets: Widget[] = [
    {
      i: "hero",
      title: "Portfolio Universe — SOE Value Map",
      icon: LayoutGrid,
      tileClassName: "border-primary/40",
      headerRight: (
        <div className="flex overflow-hidden rounded-md border border-border/60 text-[10px] font-bold">
          {(["day", "ytd"] as const).map((v) => (
            <button key={v} type="button" onClick={() => setMetric(v)} className={cn("px-2 py-0.5", metric === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
              {v === "day" ? "Hari ini" : "YTD"}
            </button>
          ))}
        </div>
      ),
      bodyClassName: "p-2",
      body: data ? <PortfolioUniverse holdings={data.holdings} aum={data.aum_t} stress={stress} onStress={handleStress} metric={metric} onSelect={setSelected} /> : <Empty state={live} />,
    },
    { i: "strength", title: "Resilience Index", icon: Gauge, tileClassName: "border-primary/40", bodyClassName: "overflow-auto scrollbar-thin p-2", body: data && stressedStrength ? <StrengthMeter strength={stressedStrength} stressed={stress > 0.001} /> : <Empty state={live} /> },
    { i: "markets", title: "Markets & Macro", icon: Banknote, tileClassName: "border-primary/30", bodyClassName: "p-2", body: data ? <MarketsBoard markets={data.markets} /> : <Empty state={live} /> },
    { i: "insight", title: "Nexorus AI Analysis", icon: Sparkles, bodyClassName: "p-0", body: data ? <InsightPanel data={data} score={(stressedStrength ?? data.strength).score} level={(stressedStrength ?? data.strength).level} /> : <Empty state={live} /> },
    { i: "donut", title: "Sector Allocation", icon: PieChart, bodyClassName: "p-3", body: data ? <SectorDonut sectors={data.sectors} aum={data.aum_t} /> : <Empty state={live} /> },
    { i: "capital", title: "Capital Allocation Console", icon: Zap, tileClassName: "border-primary/30", bodyClassName: "overflow-auto scrollbar-thin p-3", body: data ? <CapitalConsole allocations={data.allocations} onApprove={setApproved} /> : <Empty state={live} /> },
    { i: "predictions", title: "Nexorus AI Predictions", icon: TrendingUp, bodyClassName: "overflow-auto scrollbar-thin p-3", body: <PredictionMeters predictions={data?.predictions ?? []} updatedAt={data?.updated_at} /> },
    { i: "movers", title: "Portfolio Movers", icon: Activity, bodyClassName: "overflow-auto scrollbar-thin p-2.5", body: data ? <TopMovers holdings={data.holdings} onSelect={setSelected} /> : <Empty state={live} /> },
    { i: "projection", title: "AUM Growth Projection (6 Quarters)", icon: CalendarClock, bodyClassName: "p-3", body: data ? <AumProjection quarters={data.projection} /> : <Empty state={live} /> },
    { i: "dividends", title: "Dividend Contributors", icon: Coins, bodyClassName: "p-3", body: data ? <DividendBoard dividends={data.dividends} ytd={data.dividend_ytd_t} /> : <Empty state={live} /> },
    { i: "social", title: "Public Sentiment", icon: MessageCircle, bodyClassName: "p-2.5", body: data ? <SocialPulsePanel data={data.social} /> : <Empty state={live} /> },
    { i: "news", title: "Media Coverage", icon: Newspaper, bodyClassName: "overflow-auto scrollbar-thin p-3", body: data ? <NewsCoverage articles={data.news} /> : <Empty state={live} /> },
  ];

  const widgets = mode === "media" ? mediaWidgets : marketsWidgets;
  const layout = mode === "media" ? layoutMedia : layoutMarkets;

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-primary">
            Danantara · Sovereign Wealth Command
          </div>
          <h1 className="mt-1 text-2xl font-bold leading-tight sm:text-[28px]">
            Pusat Komando Aset Negara — {data?.fund ?? "Danantara Indonesia"}
          </h1>
          <p className="mt-1.5 text-[12px] text-muted-foreground">
            Diperbarui {data?.updated_at ?? "—"} · 100% dari sumber publik/daring (IDX, kurs valas, komoditas, berita, kanal resmi) + analitik Nexorus AI.
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
            onClick={() => setAutoBriefOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background/40 px-2.5 py-1.5 text-[11px] font-bold text-muted-foreground hover:text-foreground"
          >
            <MonitorPlay className="h-3.5 w-3.5" /> War Room
          </button>
          <button
            type="button"
            onClick={() => setEditMode((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-bold transition-colors",
              editMode ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-background/40 text-muted-foreground hover:text-foreground",
            )}
          >
            {editMode ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
            {editMode ? "Selesai atur" : "Atur tata letak"}
          </button>
          {editMode && (
            <button
              type="button"
              onClick={resetLayout}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background/40 px-2.5 py-1.5 text-[11px] font-bold text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </button>
          )}
          <button
            type="button"
            onClick={loadData}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background/40 px-2.5 py-1.5 text-[11px] font-bold text-muted-foreground hover:text-foreground"
          >
            ↻ Perbarui
          </button>
        </div>
      </div>

      {/* Mode tabs */}
      <div className="mb-3 flex items-center gap-1 rounded-lg border border-border/60 bg-background/40 p-1 text-[12px] font-bold sm:w-fit">
        {([
          { id: "media", label: "Media Intelligence", icon: ScanEye },
          { id: "markets", label: "Portfolio & Markets", icon: LayoutGrid },
        ] as const).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setMode(t.id)}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 transition-colors sm:flex-none",
              mode === t.id ? "bg-gradient-accent text-primary-foreground shadow-[0_4px_16px_-6px_oklch(0.55_0.18_280/.6)]" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>

      <Ticker items={data?.ticker ?? []} />

      {data && (
        <div className="mb-3 rounded-lg border border-border/50 bg-card/50 px-3 py-2">
          <SourceStrip sources={data.sources} />
        </div>
      )}

      {approved && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-success/40 bg-success/10 px-3 py-2 text-[12px] font-semibold text-success">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Alokasi diteruskan ke Komite Investasi: <span className="font-bold">{approved.title}</span> — modal {fmtT(approved.capital_t)}, proyeksi {approved.return_pct}%.
          <button type="button" onClick={() => setApproved(null)} className="ml-auto text-success/70 hover:text-success">
            ×
          </button>
        </div>
      )}

      {/* KPI strip */}
      <div className="relative mb-3 overflow-hidden rounded-lg">
      {mode === "markets" ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <KpiCard icon={Landmark} label="Aset Kelolaan" value={data ? fmtAum(data.aum_t) : "—"} sub={data ? `≈ $${data.aum_usd_b} B` : ""} highlight />
          <KpiCard
            icon={TrendingUp}
            label="NAV hari ini"
            value={data ? `${data.day_change_pct >= 0 ? "+" : ""}${data.day_change_pct}%` : "—"}
            tone={data ? (data.day_change_pct >= 0 ? "good" : "bad") : undefined}
          />
          <KpiCard
            icon={Activity}
            label="Imbal hasil YTD"
            value={data ? `${data.ytd_return_pct >= 0 ? "+" : ""}${data.ytd_return_pct}%` : "—"}
            tone={data ? (data.ytd_return_pct >= 0 ? "good" : "bad") : undefined}
          />
          <KpiCard icon={Coins} label="Dividen YTD" value={data ? fmtT(data.dividend_ytd_t) : "—"} />
          <KpiCard
            icon={Gauge}
            label="Ketahanan"
            value={data ? `${(stressedStrength ?? data.strength).score}/100` : "—"}
            sub={data ? (stressedStrength ?? data.strength).level : ""}
            valueColor={accent}
          />
          <KpiCard icon={Wallet} label="Entitas Portofolio" value={data ? String(data.holdings_count) : "—"} sub={data ? `${data.listed_count} tercatat IDX` : ""} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <KpiCard
            icon={ShieldCheck}
            label="Indeks Reputasi"
            value={data ? `${data.media.reputation.score}/100` : "—"}
            sub={data ? data.media.reputation.level : ""}
            valueColor={data ? reputationColor(data.media.reputation.score) : undefined}
            highlight
          />
          <KpiCard
            icon={Activity}
            label="Sentimen Net"
            value={data ? `${data.media.totals.net_sentiment >= 0 ? "+" : ""}${data.media.totals.net_sentiment}` : "—"}
            tone={data ? (data.media.totals.net_sentiment >= 0 ? "good" : "bad") : undefined}
          />
          <KpiCard icon={MessageCircle} label="Sebutan 24 jam" value={data ? data.media.totals.mentions_24h.toLocaleString("id-ID") : "—"} />
          <KpiCard icon={Eye} label="Jangkauan" value={data ? fmtReachShort(data.media.totals.reach) : "—"} sub="estimasi impresi" />
          <KpiCard
            icon={ShieldAlert}
            label="Pangsa Negatif"
            value={data ? `${data.media.totals.share_negative}%` : "—"}
            tone={data ? (data.media.totals.share_negative >= 40 ? "bad" : undefined) : undefined}
          />
          <KpiCard icon={Newspaper} label="Outlet Memantau" value={data ? String(data.media.totals.outlets) : "—"} sub="media + kanal" />
        </div>
      )}
        {fx > 0 && (
          <span key={fx} className="dn-shine pointer-events-none absolute inset-y-0 left-0 z-[2] w-1/3 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        )}
      </div>

      {/* Dashboard grid — draggable & resizable in edit mode (per-tab layout) */}
      {editMode && (
        <div className="mb-3 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-[11px] text-primary">
          Mode atur aktif — seret judul kartu untuk memindahkan, tarik sudut kanan-bawah untuk mengubah ukuran. Tata letak tersimpan otomatis (terpisah per tab).
        </div>
      )}
      <div className="rounded-lg border border-border/40 bg-background/30 p-2">
        <GridBoard
          key={mode}
          layout={layout}
          cols={12}
          rowHeight={64}
          margin={[12, 12]}
          isDraggable={editMode}
          isResizable={editMode}
          draggableHandle=".widget-drag"
          draggableCancel=".widget-action"
          onLayoutChange={persistLayout}
        >
          {widgets.map((w) => {
            const Icon = w.icon;
            return (
              <div
                key={w.i}
                id={`dn-w-${w.i}`}
                className={cn("flex flex-col overflow-hidden rounded-lg border bg-card/60", w.tileClassName ?? "border-border/60")}
              >
                <div className={cn("widget-drag flex shrink-0 items-center justify-between gap-2 border-b border-border/40 bg-background/40 px-2 py-1 text-[11px]", editMode && "cursor-move select-none")}>
                  <div className="flex items-center gap-1.5 truncate">
                    {editMode && <GripVertical className="h-3 w-3 shrink-0 opacity-50" />}
                    <Icon className="h-3 w-3 shrink-0 text-primary" />
                    <span className="truncate font-medium">{w.title}</span>
                  </div>
                  <div className="widget-action flex items-center gap-1.5">{w.headerRight}</div>
                </div>
                <div className={cn("min-h-0 flex-1 scrollbar-thin", w.bodyClassName ?? "overflow-auto p-3")}>{w.body}</div>
              </div>
            );
          })}
        </GridBoard>
      </div>

      <BriefingPanel
        open={briefingOpen}
        onClose={() => setBriefingOpen(false)}
        endpoint="/api/v1/danantara/briefing"
        stages={BRIEFING_STAGES}
        title="Investment Committee Brief"
        subtitle="Nexorus AI Orchestration"
        docTitle="Nexorus AI · Investment Committee Brief — Danantara"
        docMeta="Danantara Sovereign Wealth Command (sumber publik)"
      />

      <HoldingModal holding={selected} onClose={() => setSelected(null)} />

      <NexorusAiLive data={data} />
      <AutoBrief open={autoBriefOpen} onClose={() => setAutoBriefOpen(false)} data={data} />
      <NeuralBoot />

      {/* Live AI alert toast (bottom-left, clear of the Live orb) */}
      {alert && (
        <div
          className={cn(
            "dn-slide-in fixed bottom-10 left-4 z-[60] flex max-w-[320px] items-start gap-2 rounded-xl border bg-popover/95 px-3 py-2.5 shadow-[0_18px_50px_oklch(0.05_0.02_260/.6)] backdrop-blur-xl",
            alert.tone === "good" ? "border-success/50" : alert.tone === "bad" ? "border-destructive/50" : "border-warning/50",
          )}
        >
          <Zap className={cn("mt-0.5 h-4 w-4 shrink-0", alert.tone === "good" ? "text-success" : alert.tone === "bad" ? "text-destructive" : "text-warning")} />
          <div className="min-w-0">
            <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Nexorus AI · Pembaruan</div>
            <p className="mt-0.5 text-[11.5px] leading-snug text-foreground/90">{alert.text}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/** Build a one-line "what changed" alert between two consecutive snapshots. */
function buildAlert(prev: SovereignSnapshot, next: SovereignSnapshot): { text: string; tone: "good" | "warn" | "bad" } {
  const dRep = next.media.reputation.score - prev.media.reputation.score;
  const dMen = next.media.totals.mentions_24h - prev.media.totals.mentions_24h;
  const c = [...next.media.crisis].sort((a, b) => b.velocity - a.velocity)[0];
  if (Math.abs(dRep) >= 2) {
    return { text: `Indeks reputasi ${dRep > 0 ? "naik" : "turun"} ${Math.abs(dRep)} poin → ${next.media.reputation.score}/100.`, tone: dRep > 0 ? "good" : "bad" };
  }
  if (Math.abs(dMen) >= 250) {
    return {
      text: `${dMen > 0 ? "Lonjakan" : "Penurunan"} sebutan: ${Math.abs(dMen).toLocaleString("id-ID")} (kini ${next.media.totals.mentions_24h.toLocaleString("id-ID")}/24 jam).`,
      tone: dMen > 0 ? "warn" : "good",
    };
  }
  return { text: `Sinyal dini diperbarui: ${c.title} (+${c.velocity}% / 24 jam).`, tone: c.severity >= 6 ? "bad" : "warn" };
}

/* ----------------------------------------------------------- AI insight */

function InsightPanel({ data, score, level }: { data: SovereignSnapshot; score: number; level: string }) {
  const accent = strengthColor(score);
  const TONE: Record<"good" | "warn" | "bad", string> = {
    good: "border-success/40 text-success",
    warn: "border-warning/40 text-warning",
    bad: "border-destructive/40 text-destructive",
  };
  return (
    <div className="relative h-full p-3.5 pl-4">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(130% 110% at 0% 0%, ${withAlpha(accent, 0.16)}, transparent 58%)` }}
      />
      <div className="pointer-events-none absolute left-0 top-0 h-full w-[3px]" style={{ background: accent, boxShadow: `0 0 16px ${withAlpha(accent, 0.9)}` }} />
      <div className="relative z-[1] flex h-full flex-col">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70" style={{ background: accent }} />
              <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: accent }} />
            </span>
            <span className="text-gradient text-[10px] font-bold uppercase tracking-[0.18em]">Analisis Nexorus AI</span>
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-current/30 bg-current/10 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide" style={{ color: accent }}>
            <Activity className="h-3 w-3" /> {level}
          </span>
        </div>

        <h3 className="mt-2.5 text-lg font-extrabold leading-[1.15] text-foreground sm:text-xl">{data.insight.title}</h3>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{data.insight.text}</p>

        {data.insight.action && (
          <div className="mt-3 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
              <Zap className="h-3.5 w-3.5" /> Rekomendasi Strategis
            </div>
            <p className="mt-1 text-[12.5px] font-medium leading-relaxed text-foreground/90">{data.insight.action}</p>
          </div>
        )}

        {data.conditions.length > 0 && (
          <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
            {data.conditions.map((c) => (
              <span key={c.label} className={`rounded-full border bg-background/40 px-2 py-0.5 text-[10px] font-semibold ${TONE[c.tone]}`}>
                {c.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- shells */

function fmtReachShort(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} M`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} jt`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)} rb`;
  return String(n);
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
  highlight,
  valueColor,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  tone?: "good" | "bad";
  highlight?: boolean;
  valueColor?: string;
}) {
  return (
    <div className={cn("rounded-lg border bg-card/60 px-3 py-2.5", highlight ? "border-primary/40" : "border-border/60")}>
      <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
        <Icon className="h-3 w-3 text-primary" /> {label}
      </div>
      <div
        className={cn(
          "mt-1 truncate text-[19px] font-extrabold leading-none tabular-nums",
          tone === "good" && "text-success",
          tone === "bad" && "text-destructive",
        )}
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </div>
      {sub && <div className="mt-1 truncate text-[10px] text-muted-foreground">{sub}</div>}
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
