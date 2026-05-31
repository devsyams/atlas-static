"use client";

import { useCallback, useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import {
  Activity,
  Banknote,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Coins,
  Eye,
  Gauge,
  Landmark,
  LayoutGrid,
  Megaphone,
  MessageCircle,
  Newspaper,
  PieChart,
  Radar,
  ScanEye,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
  Waypoints,
  Zap,
} from "lucide-react";
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
import { DividendBoard, NewsCoverage, OfficialFeed, SocialPulsePanel, SourceStrip } from "./SovereignFeeds";
import { ReputationMeter } from "./ReputationMeter";
import { IssueRadar } from "./IssueRadar";
import { SentimentTimeline } from "./SentimentTimeline";
import { ShareOfVoice } from "./ShareOfVoice";
import { CrisisWatch } from "./CrisisWatch";
import { HoaxWatch } from "./HoaxWatch";
import { ActorMap } from "./ActorMap";
import { ImpactLab } from "./ImpactLab";
import { NexorusAiLive } from "./NexorusAiLive";
import { IMPACT_EVENTS } from "@/lib/danantara/impact";

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
  const [selected, setSelected] = useState<Holding | null>(null);
  const [approved, setApproved] = useState<CapitalMove | null>(null);

  const loadData = useCallback(() => {
    setLive("loading");
    fetch("/api/v1/danantara")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((payload: SovereignSnapshot) => {
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

  const accent = data ? strengthColor((stressedStrength ?? data.strength).score) : undefined;

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
            <Sparkles className="h-3.5 w-3.5" /> Brief Komite
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
      {mode === "markets" ? (
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
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
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
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

      {/* Markets & Portfolio grid */}
      {mode === "markets" && (
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        {/* Hero — Portfolio Universe treemap + stress test */}
        <Tile
          title="Portfolio Universe — SOE Value Map"
          icon={LayoutGrid}
          className="lg:col-span-8"
          tileClassName="border-primary/40"
          headerRight={
            <div className="flex overflow-hidden rounded-md border border-border/60 text-[10px] font-bold">
              {(["day", "ytd"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setMetric(v)}
                  className={cn("px-2 py-0.5", metric === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                >
                  {v === "day" ? "Hari ini" : "YTD"}
                </button>
              ))}
            </div>
          }
          bodyClassName="p-2"
          style={{ height: 460 }}
        >
          {data ? (
            <PortfolioUniverse
              holdings={data.holdings}
              aum={data.aum_t}
              stress={stress}
              onStress={handleStress}
              metric={metric}
              onSelect={setSelected}
            />
          ) : (
            <Empty state={live} />
          )}
        </Tile>

        {/* Strength meter — headline gimmick */}
        <Tile title="Resilience Index" icon={Gauge} className="lg:col-span-4" tileClassName="border-primary/40" bodyClassName="overflow-auto scrollbar-thin p-2" style={{ height: 460 }}>
          {data && stressedStrength ? <StrengthMeter strength={stressedStrength} stressed={stress > 0.001} /> : <Empty state={live} />}
        </Tile>

        {/* Markets board */}
        <Tile title="Markets & Macro" icon={Banknote} className="lg:col-span-5" tileClassName="border-primary/30" bodyClassName="p-2">
          {data ? <MarketsBoard markets={data.markets} /> : <Empty state={live} />}
        </Tile>

        {/* AI insight */}
        <Tile title="Nexorus AI Analysis" icon={Sparkles} className="lg:col-span-4" bodyClassName="p-0">
          {data ? <InsightPanel data={data} score={(stressedStrength ?? data.strength).score} level={(stressedStrength ?? data.strength).level} /> : <Empty state={live} />}
        </Tile>

        {/* Sector allocation */}
        <Tile title="Sector Allocation" icon={PieChart} className="lg:col-span-3" bodyClassName="p-3" style={{ minHeight: 200 }}>
          {data ? <SectorDonut sectors={data.sectors} aum={data.aum_t} /> : <Empty state={live} />}
        </Tile>

        {/* Capital allocation console */}
        <Tile title="Capital Allocation Console" icon={Zap} className="lg:col-span-5" tileClassName="border-primary/30" bodyClassName="overflow-auto scrollbar-thin p-3" style={{ maxHeight: 420 }}>
          {data ? <CapitalConsole allocations={data.allocations} onApprove={setApproved} /> : <Empty state={live} />}
        </Tile>

        {/* Predictions */}
        <Tile title="Nexorus AI Predictions" icon={TrendingUp} className="lg:col-span-4" style={{ maxHeight: 420 }}>
          <PredictionMeters predictions={data?.predictions ?? []} updatedAt={data?.updated_at} />
        </Tile>

        {/* Top movers */}
        <Tile title="Portfolio Movers" icon={Activity} className="lg:col-span-3" bodyClassName="overflow-auto scrollbar-thin p-2.5" style={{ maxHeight: 420 }}>
          {data ? <TopMovers holdings={data.holdings} onSelect={setSelected} /> : <Empty state={live} />}
        </Tile>

        {/* AUM projection */}
        <Tile title="AUM Growth Projection (6 Quarters)" icon={CalendarClock} className="lg:col-span-8" bodyClassName="p-3" style={{ minHeight: 230 }}>
          {data ? <AumProjection quarters={data.projection} /> : <Empty state={live} />}
        </Tile>

        {/* Dividends */}
        <Tile title="Dividend Contributors" icon={Coins} className="lg:col-span-4" bodyClassName="p-3" style={{ maxHeight: 280 }}>
          {data ? <DividendBoard dividends={data.dividends} ytd={data.dividend_ytd_t} /> : <Empty state={live} />}
        </Tile>

        {/* Social pulse */}
        <Tile title="Public Sentiment" icon={MessageCircle} className="lg:col-span-4" bodyClassName="p-2.5" style={{ maxHeight: 340 }}>
          {data ? <SocialPulsePanel data={data.social} /> : <Empty state={live} />}
        </Tile>

        {/* News */}
        <Tile title="Media Coverage" icon={Newspaper} className="lg:col-span-4" bodyClassName="overflow-auto scrollbar-thin p-3" style={{ maxHeight: 340 }}>
          {data ? <NewsCoverage articles={data.news} /> : <Empty state={live} />}
        </Tile>

        {/* Official */}
        <Tile title="Official Channels" icon={Megaphone} className="lg:col-span-4" bodyClassName="overflow-auto scrollbar-thin p-3" style={{ maxHeight: 340 }}>
          {data ? <OfficialFeed posts={data.official} /> : <Empty state={live} />}
        </Tile>
      </div>
      )}

      {/* Media Intelligence grid */}
      {mode === "media" && (
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        {/* Impact Lab — issue → price-impact prediction (headline feature) */}
        <Tile
          title="Issue → Stock Price Impact Simulator"
          icon={Waypoints}
          className="lg:col-span-12"
          tileClassName="border-primary/40"
          headerRight={<span className="text-[10px] text-muted-foreground">Nexorus AI · model transmisi</span>}
          bodyClassName="p-3"
          style={{ height: 520 }}
        >
          {data ? (
            <ImpactLab holdings={data.holdings} aum={data.aum_t} events={IMPACT_EVENTS} eventId={impactEvent} onSelectEvent={setImpactEvent} />
          ) : (
            <Empty state={live} />
          )}
        </Tile>

        {/* Issue / narrative radar */}
        <Tile title="Narrative & Issue Radar" icon={Radar} className="lg:col-span-5" tileClassName="border-primary/40" bodyClassName="p-3" style={{ minHeight: 320 }}>
          {data ? <IssueRadar issues={data.media.issues} /> : <Empty state={live} />}
        </Tile>

        {/* Reputation index — headline gimmick */}
        <Tile title="Reputation Index" icon={ShieldCheck} className="lg:col-span-3" tileClassName="border-primary/40" bodyClassName="overflow-auto scrollbar-thin p-2" style={{ minHeight: 320 }}>
          {data ? <ReputationMeter reputation={data.media.reputation} /> : <Empty state={live} />}
        </Tile>

        {/* Sentiment timeline */}
        <Tile title="14-Day Sentiment Trend" icon={Activity} className="lg:col-span-4" bodyClassName="p-3" style={{ minHeight: 320 }}>
          {data ? <SentimentTimeline days={data.media.timeline} /> : <Empty state={live} />}
        </Tile>

        {/* Crisis early-warning */}
        <Tile title="Crisis Early-Warning" icon={Siren} className="lg:col-span-5" tileClassName="border-warning/30" bodyClassName="overflow-auto scrollbar-thin p-3" style={{ maxHeight: 380 }}>
          {data ? <CrisisWatch signals={data.media.crisis} onImpact={setImpactEvent} /> : <Empty state={live} />}
        </Tile>

        {/* Hoax / disinfo watch */}
        <Tile title="Hoax & Disinformation Watch" icon={ShieldAlert} className="lg:col-span-3" bodyClassName="overflow-auto scrollbar-thin p-3" style={{ maxHeight: 380 }}>
          {data ? <HoaxWatch hoaxes={data.media.hoaxes} /> : <Empty state={live} />}
        </Tile>

        {/* Share of voice */}
        <Tile title="Share of Voice by Entity" icon={BarChart3} className="lg:col-span-4" bodyClassName="overflow-auto scrollbar-thin p-3" style={{ maxHeight: 380 }}>
          {data ? <ShareOfVoice voice={data.media.voice} /> : <Empty state={live} />}
        </Tile>

        {/* Stakeholder sentiment — reuse MBG leadership widget */}
        <Tile title="Stakeholder Sentiment" icon={Users} className="lg:col-span-6" bodyClassName="overflow-auto scrollbar-thin p-3" style={{ maxHeight: 560 }}>
          {data ? <LeadershipSentiment data={data.media.stakeholders} /> : <Empty state={live} />}
        </Tile>

        {/* Key actors / influencers */}
        <Tile title="Actor & Influencer Map" icon={ScanEye} className="lg:col-span-6" bodyClassName="overflow-auto scrollbar-thin p-3" style={{ maxHeight: 560 }}>
          {data ? <ActorMap actors={data.media.actors} /> : <Empty state={live} />}
        </Tile>

        {/* Supporting public feeds */}
        <Tile title="Public Sentiment (Social)" icon={MessageCircle} className="lg:col-span-4" bodyClassName="p-2.5" style={{ maxHeight: 360 }}>
          {data ? <SocialPulsePanel data={data.social} /> : <Empty state={live} />}
        </Tile>
        <Tile title="Media Coverage" icon={Newspaper} className="lg:col-span-4" bodyClassName="overflow-auto scrollbar-thin p-3" style={{ maxHeight: 360 }}>
          {data ? <NewsCoverage articles={data.news} /> : <Empty state={live} />}
        </Tile>
        <Tile title="Official Channels" icon={Megaphone} className="lg:col-span-4" bodyClassName="overflow-auto scrollbar-thin p-3" style={{ maxHeight: 360 }}>
          {data ? <OfficialFeed posts={data.official} /> : <Empty state={live} />}
        </Tile>
      </div>
      )}

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
    </div>
  );
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
