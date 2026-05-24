"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import type { LayoutItem } from "react-grid-layout/legacy";
import {
  Bot,
  Gauge,
  Globe2,
  GripVertical,
  Hash,
  Landmark,
  Lightbulb,
  Lock,
  MapPin,
  Newspaper,
  RotateCcw,
  TrendingUp,
  Unlock,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Article, ArticleDetail, DashboardData } from "@/lib/mbg/types";
import { CRISIS_COLORS, cityKeyFromLocation, scoreColor } from "@/lib/mbg/colors";
import { cn } from "@/lib/utils";
import { ScoreGauge } from "./ScoreGauge";
import { TopCities } from "./TopCities";
import { Keywords } from "./Keywords";
import { ArticleList } from "./ArticleList";
import { ActorAnalysis } from "./ActorAnalysis";
import { LeadershipSentiment } from "./LeadershipSentiment";
import { DetailModal } from "./DetailModal";

const IncidentMap = dynamic(() => import("./IncidentMap"), {
  ssr: false,
  loading: () => <MapFallback message="Memuat peta…" />,
});
const GridBoard = dynamic(() => import("./GridBoard"), { ssr: false });

const LAYOUT_KEY = "atlas:crisis:layout:v3";

const DEFAULT_LAYOUT: LayoutItem[] = [
  { i: "insight", x: 0, y: 0, w: 6, h: 3, minW: 3, minH: 2 },
  { i: "prediction", x: 6, y: 0, w: 6, h: 3, minW: 3, minH: 2 },
  { i: "map", x: 0, y: 3, w: 8, h: 9, minW: 4, minH: 5 },
  { i: "score", x: 8, y: 3, w: 4, h: 4, minW: 3, minH: 3 },
  { i: "aistatus", x: 8, y: 7, w: 4, h: 2, minW: 3, minH: 2 },
  { i: "topcities", x: 8, y: 9, w: 4, h: 5, minW: 3, minH: 3 },
  { i: "articles", x: 0, y: 12, w: 8, h: 6, minW: 3, minH: 3 },
  { i: "keywords", x: 8, y: 14, w: 4, h: 3, minW: 3, minH: 2 },
  { i: "actors", x: 0, y: 18, w: 12, h: 5, minW: 4, minH: 4 },
  { i: "leadership", x: 0, y: 23, w: 12, h: 6, minW: 4, minH: 4 },
];

function reconcileLayout(saved: LayoutItem[]): LayoutItem[] {
  const byId = new Map(saved.map((l) => [l.i, l]));
  // Keep saved positions, but never let a tile drop below its minimum size.
  return DEFAULT_LAYOUT.map((def) => {
    const s = byId.get(def.i);
    if (!s) return def;
    return {
      ...def,
      x: typeof s.x === "number" ? s.x : def.x,
      y: typeof s.y === "number" ? s.y : def.y,
      w: Math.max(s.w ?? def.w, def.minW ?? 2),
      h: Math.max(s.h ?? def.h, def.minH ?? 2),
    };
  });
}

type LiveState = "loading" | "live" | "offline";

interface ModalState {
  open: boolean;
  loading: boolean;
  error: string | null;
  detail: ArticleDetail | null;
  article: Article | null;
}
const INITIAL_MODAL: ModalState = {
  open: false,
  loading: false,
  error: null,
  detail: null,
  article: null,
};

interface Widget {
  i: string;
  title: string;
  icon: LucideIcon;
  headerRight?: ReactNode;
  tileClassName?: string;
  bodyClassName?: string;
  body: ReactNode;
}

export function CrisisDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [live, setLive] = useState<LiveState>("loading");
  const [selectedCityKey, setSelectedCityKey] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(INITIAL_MODAL);
  const [editMode, setEditMode] = useState(false);
  const [layout, setLayout] = useState<LayoutItem[]>(DEFAULT_LAYOUT);

  const loadData = useCallback(() => {
    setLive("loading");
    fetch("/api/v1/mbg-crisis")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((payload: DashboardData) => {
        setData(payload);
        setLive("live");
      })
      .catch(() => setLive("offline"));
  }, []);

  useEffect(() => {
    loadData();
    const id = setInterval(loadData, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [loadData]);

  // Restore a saved layout after mount (avoids SSR hydration mismatch).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LAYOUT_KEY);
      if (raw) setLayout(reconcileLayout(JSON.parse(raw) as LayoutItem[]));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!data || !selectedCityKey) return;
    if (!data.city_map_points.some((p) => p.city_key === selectedCityKey)) {
      setSelectedCityKey(null);
    }
  }, [data, selectedCityKey]);

  const persistLayout = useCallback(
    (next: LayoutItem[]) => {
      if (!editMode) return;
      setLayout(next);
      try {
        localStorage.setItem(LAYOUT_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
    },
    [editMode],
  );

  const resetLayout = () => {
    setLayout(DEFAULT_LAYOUT);
    try {
      localStorage.removeItem(LAYOUT_KEY);
    } catch {
      /* ignore */
    }
  };

  const showMap = !!data && (data.ai_status === "ready" || data.ai_status === "partial");

  const activeCity = useMemo(
    () => data?.city_map_points.find((p) => p.city_key === selectedCityKey) ?? null,
    [data, selectedCityKey],
  );

  const visibleArticles = useMemo(() => {
    const all = data?.articles ?? [];
    const filtered = selectedCityKey
      ? all.filter((a) => cityKeyFromLocation(a.location) === selectedCityKey)
      : all;
    return filtered.slice(0, 8);
  }, [data, selectedCityKey]);

  const mappedCount = data?.mapped_article_count ?? 0;
  const unmappedCount = data?.unmapped_article_count ?? 0;
  const mapTitle = !data
    ? "Menunggu data lokasi…"
    : mappedCount > 0
      ? `${mappedCount} artikel AI-terpetakan`
      : "Belum ada kota yang bisa dipetakan";
  const filterNote = activeCity ? `Sorotan: ${activeCity.city}` : "Semua artikel";
  const legendStatus = activeCity
    ? `Kota aktif: ${activeCity.city}`
    : "Pilih kota untuk menyorot artikel terkait.";

  const openDetail = (index: number) => {
    const article = visibleArticles[index];
    if (!article) return;
    setModal({ open: true, loading: true, error: null, detail: null, article });
    const params = new URLSearchParams({
      url: article.link,
      title: article.title,
      source: article.source,
      date: article.date,
      score: String(article.score),
    });
    fetch(`/api/v1/article-detail?${params.toString()}`)
      .then((res) => res.json())
      .then((detail: ArticleDetail) => setModal((m) => ({ ...m, loading: false, detail })))
      .catch((err: Error) => setModal((m) => ({ ...m, loading: false, error: err.message })));
  };
  const closeDetail = useCallback(() => setModal((m) => ({ ...m, open: false })), []);

  const score = data?.score ?? 0;
  const scoreCol = scoreColor(score);

  const aiTone =
    data?.ai_status === "ready"
      ? "border-success/45"
      : data?.ai_status === "partial"
        ? "border-warning/45"
        : data?.ai_status === "unavailable"
          ? "border-destructive/45"
          : "border-border/60";
  const aiText =
    !data
      ? { t: "Memeriksa AI engine…", c: "Lokasi kota dan isu dominan akan diisi setelah analisis AI siap." }
      : data.ai_status === "ready"
        ? {
            t: "AI engine aktif untuk kota dan isu",
            c: `${data.mapped_article_count} artikel berhasil dipetakan ke kota. Heatmap dan ranking kota memakai analisis AI ini.`,
          }
        : data.ai_status === "partial"
          ? {
              t: "AI engine hanya memetakan sebagian artikel",
              c: `${data.mapped_article_count} artikel berhasil dipetakan, ${data.unmapped_article_count} masih belum cukup yakin untuk dipakai di peta.`,
            }
          : {
              t: "AI engine belum tersedia untuk heatmap",
              c: "Skor krisis dan berita tetap tampil, tetapi peta dan ranking kota dinonaktifkan sampai AI engine siap.",
            };

  const chip = "inline-flex items-center rounded-full border border-border bg-background/40 px-2 py-0.5 text-[10px] font-bold text-foreground/80";

  const widgets: Widget[] = [
    {
      i: "insight",
      title: "Insight",
      icon: Lightbulb,
      body: (
        <div>
          <div className="text-base font-extrabold leading-tight">
            {data ? data.insight?.title ?? "Insight belum tersedia" : "Menyusun insight…"}
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            {data
              ? data.insight?.text ?? "Belum cukup sinyal untuk menyusun insight."
              : "Analisis akan muncul setelah sinyal artikel dan sentimen siap."}
          </p>
        </div>
      ),
    },
    {
      i: "prediction",
      title: "Prediction",
      icon: TrendingUp,
      body: (
        <div>
          <div className="text-sm font-extrabold leading-tight">
            {data ? data.prediction?.question ?? "Prediction belum tersedia" : "Menyusun prediction…"}
          </div>
          <div className="mt-2 flex items-baseline gap-2.5">
            <span className="text-[40px] font-extrabold leading-none text-destructive">
              {data?.prediction ? `${data.prediction.probability}%` : "--"}
            </span>
            <span className="rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-[11px] font-extrabold text-destructive">
              {data?.prediction?.answer_label ?? "estimasi AI"}
            </span>
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
            {data?.prediction?.reasoning ??
              "Estimasi akan muncul setelah AI membaca sinyal berita dan sentimen."}
          </p>
        </div>
      ),
    },
    {
      i: "map",
      title: "Indonesia Incident Map",
      icon: Globe2,
      bodyClassName: "overflow-hidden p-2",
      headerRight: (
        <>
          <span className={chip}>{mappedCount} terpeta</span>
          <span className={chip}>{unmappedCount} belum</span>
          <button
            type="button"
            onClick={() => setSelectedCityKey(null)}
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold",
              selectedCityKey
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-border bg-background/40 text-foreground/80 hover:text-foreground",
            )}
          >
            Semua
          </button>
        </>
      ),
      body: (
        <div className="flex h-full flex-col gap-2">
          <div className="shrink-0 text-[11px] text-muted-foreground">{mapTitle}</div>
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-md border border-border/60 bg-background/40">
            {showMap ? (
              <IncidentMap
                points={data!.city_map_points}
                selectedCityKey={selectedCityKey}
                onSelectCity={setSelectedCityKey}
              />
            ) : (
              <MapFallback
                message={
                  live === "offline"
                    ? "Data API tidak dapat dimuat."
                    : !data
                      ? "Menunggu data lokasi…"
                      : "Analisis lokasi AI engine tidak tersedia."
                }
              />
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-2">
              <LegendDot color={CRISIS_COLORS.safe} /> Rendah
              <LegendDot color={CRISIS_COLORS.watch} /> Waspada
              <LegendDot color={CRISIS_COLORS.crisis} /> Krisis
            </div>
            <div>{legendStatus}</div>
          </div>
        </div>
      ),
    },
    {
      i: "score",
      title: "Crisis Index",
      icon: Gauge,
      bodyClassName: "overflow-hidden p-2",
      body: (
        <div className="flex h-full flex-col items-center justify-center">
          <ScoreGauge score={score} />
          <div className="-mt-1 text-center">
            <div className="text-[40px] font-extrabold leading-none" style={{ color: scoreCol }}>
              {data ? score.toFixed(1) : "–"}
            </div>
            <div className="mt-1 text-sm font-bold" style={{ color: data ? scoreCol : undefined }}>
              {data ? `${data.emoji} ${data.level}` : "Memuat data…"}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {data ? `${data.article_count} artikel · ${data.high_crisis_count} krisis tinggi` : ""}
            </div>
          </div>
          <div className="mt-3 flex h-[6px] w-full gap-0.5">
            <div className="rounded-full" style={{ flex: 2, background: CRISIS_COLORS.safe }} />
            <div className="rounded-full" style={{ flex: 3, background: CRISIS_COLORS.watch }} />
            <div className="rounded-full" style={{ flex: 3, background: CRISIS_COLORS.crisis }} />
            <div className="rounded-full" style={{ flex: 2, background: CRISIS_COLORS.danger }} />
          </div>
          <div className="mt-1.5 flex w-full justify-between text-[9px] uppercase tracking-wide text-muted-foreground/70">
            <span>0 Aman</span>
            <span>Waspada</span>
            <span>Krisis</span>
            <span>Darurat 10</span>
          </div>
        </div>
      ),
    },
    {
      i: "aistatus",
      title: "AI Status",
      icon: Bot,
      tileClassName: aiTone,
      body: (
        <div>
          <div className="text-xs font-extrabold">{aiText.t}</div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{aiText.c}</p>
        </div>
      ),
    },
    {
      i: "topcities",
      title: "Kota teratas",
      icon: MapPin,
      headerRight: <span className="text-[10px] text-muted-foreground">Konsentrasi isu negatif</span>,
      body: (
        <TopCities
          bare
          cities={showMap ? data!.top_cities : []}
          selectedCityKey={selectedCityKey}
          onSelect={setSelectedCityKey}
        />
      ),
    },
    {
      i: "articles",
      title: "Berita terkini",
      icon: Newspaper,
      headerRight: <span className="text-[10px] text-muted-foreground">{filterNote}</span>,
      body: (
        <ArticleList
          bare
          articles={visibleArticles}
          selectedCityKey={selectedCityKey}
          filterNote={filterNote}
          onOpen={openDetail}
        />
      ),
    },
    {
      i: "keywords",
      title: "Kata kunci terdeteksi",
      icon: Hash,
      body: <Keywords bare keywords={data?.top_keywords ?? []} />,
    },
    {
      i: "actors",
      title: "Actor Threat Analysis",
      icon: Users,
      body: <ActorAnalysis data={data?.actor_thread_analysis ?? null} />,
    },
    {
      i: "leadership",
      title: "Leadership Sentiment",
      icon: Landmark,
      body: <LeadershipSentiment data={data?.leadership_sentiment ?? null} />,
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-primary">
            MBG Crisis Dashboard
          </div>
          <h1 className="mt-1 text-2xl font-bold leading-tight sm:text-[28px]">
            Peta insiden dan pemantauan krisis MBG
          </h1>
          <p className="mt-1.5 text-[12px] text-muted-foreground">
            Diperbarui {data?.updated_at ?? "—"} · seret kartu untuk menata ulang dasbor.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <LiveBadge state={live} />
          <button
            type="button"
            onClick={() => setEditMode((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-bold transition-colors",
              editMode
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-background/40 text-muted-foreground hover:text-foreground",
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

      {editMode && (
        <div className="mb-3 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-[11px] text-primary">
          Mode atur aktif — seret judul kartu untuk memindahkan, tarik sudut kanan-bawah untuk
          mengubah ukuran. Tata letak tersimpan otomatis.
        </div>
      )}

      <div className="rounded-lg border border-border/40 bg-background/30 p-2">
        <GridBoard
          layout={layout}
          cols={12}
          rowHeight={70}
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
                className={cn(
                  "flex flex-col overflow-hidden rounded-lg border bg-card/60",
                  w.tileClassName ?? "border-border/60",
                )}
              >
                <div
                  className={cn(
                    "widget-drag flex shrink-0 items-center justify-between gap-2 border-b border-border/40 bg-background/40 px-2 py-1 text-[11px]",
                    editMode && "cursor-move select-none",
                  )}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    {editMode && <GripVertical className="h-3 w-3 shrink-0 opacity-50" />}
                    <Icon className="h-3 w-3 shrink-0 text-primary" />
                    <span className="truncate font-medium">{w.title}</span>
                  </div>
                  {w.headerRight && (
                    <div className="widget-action flex items-center gap-1.5">{w.headerRight}</div>
                  )}
                </div>
                <div className={cn("min-h-0 flex-1 scrollbar-thin", w.bodyClassName ?? "overflow-auto p-3")}>
                  {w.body}
                </div>
              </div>
            );
          })}
        </GridBoard>
      </div>

      <DetailModal
        open={modal.open}
        loading={modal.loading}
        error={modal.error}
        detail={modal.detail}
        article={modal.article}
        onClose={closeDetail}
      />
    </div>
  );
}

function LiveBadge({ state }: { state: LiveState }) {
  const map = {
    loading: { text: "● memuat…", cls: "border-border bg-background/40 text-muted-foreground" },
    live: { text: "● Live", cls: "border-success/40 bg-success/10 text-success" },
    offline: { text: "● Offline", cls: "border-destructive/40 bg-destructive/10 text-destructive" },
  }[state];
  return (
    <span className={cn("rounded-full border px-3 py-1.5 text-[11px] font-bold whitespace-nowrap", map.cls)}>
      {map.text}
    </span>
  );
}

function LegendDot({ color }: { color: string }) {
  return <span className="inline-block h-3 w-3 rounded-full" style={{ background: color }} />;
}

function MapFallback({ message }: { message: string }) {
  return (
    <div className="absolute inset-0 z-[400] flex flex-col items-center justify-center gap-2 bg-[radial-gradient(circle_at_top_left,oklch(0.55_0.18_280/.18),transparent_30%),linear-gradient(180deg,oklch(0.20_0.025_260/.6),oklch(0.16_0.02_260/.4))] p-6 text-center">
      <strong className="text-sm">Peta tidak tersedia</strong>
      <span className="text-xs text-muted-foreground">{message}</span>
    </div>
  );
}
