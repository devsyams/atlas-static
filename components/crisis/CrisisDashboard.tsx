"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { Article, ArticleDetail, DashboardData } from "@/lib/mbg/types";
import { CRISIS_COLORS, cityKeyFromLocation, scoreColor } from "@/lib/mbg/colors";
import { cn } from "@/lib/utils";
import { SummaryCards } from "./SummaryCards";
import { ScoreGauge } from "./ScoreGauge";
import { AiStatusCard } from "./AiStatusCard";
import { TopCities } from "./TopCities";
import { Keywords } from "./Keywords";
import { ArticleList } from "./ArticleList";
import { DetailModal } from "./DetailModal";

const IncidentMap = dynamic(() => import("./IncidentMap"), {
  ssr: false,
  loading: () => <MapFallback message="Memuat peta…" />,
});

const CHIP = "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-bold";

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

export function CrisisDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [live, setLive] = useState<LiveState>("loading");
  const [selectedCityKey, setSelectedCityKey] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(INITIAL_MODAL);

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

  // Drop a selection that no longer exists in the latest data.
  useEffect(() => {
    if (!data || !selectedCityKey) return;
    if (!data.city_map_points.some((p) => p.city_key === selectedCityKey)) {
      setSelectedCityKey(null);
    }
  }, [data, selectedCityKey]);

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
  const mapCopy = !data
    ? "Headline dan ringkasan RSS dipakai untuk membaca lokasi insiden yang terdeteksi."
    : mappedCount > 0
      ? "Klik kota untuk menyorot berita terkait. Heatmap dan ranking kota berasal dari artikel yang sama."
      : "AI engine belum menemukan koordinat kota yang cukup yakin dari artikel yang sedang tampil.";

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
          <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
            Memetakan lokasi berita berisiko tinggi untuk membantu membaca persebaran isu Makan
            Bergizi Gratis secara cepat.
          </p>
        </div>
        <LiveBadge state={live} />
      </div>

      <SummaryCards insight={data?.insight ?? null} prediction={data?.prediction ?? null} loading={!data} />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.95fr)]">
        {/* Map panel */}
        <section className="panel flex flex-col overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-3 p-4 pb-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                Indonesia Incident Map
              </div>
              <div className="mt-1.5 text-lg font-bold">{mapTitle}</div>
              <div className="mt-1 text-[13px] leading-snug text-muted-foreground">{mapCopy}</div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className={cn(CHIP, "border-border bg-background/40 text-foreground/80")}>
                {mappedCount} artikel terpeta
              </span>
              <span className={cn(CHIP, "border-border bg-background/40 text-foreground/80")}>
                {unmappedCount} belum terpetakan
              </span>
              <button
                type="button"
                onClick={() => setSelectedCityKey(null)}
                className={cn(
                  CHIP,
                  "cursor-pointer",
                  selectedCityKey
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border bg-background/40 text-foreground/80 hover:text-foreground",
                )}
              >
                Tampilkan semua
              </button>
            </div>
          </div>

          <div className="relative mx-4 mb-4 h-[520px] overflow-hidden rounded-xl border border-border/60 bg-background/40">
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

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/40 px-4 py-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <LegendDot color={CRISIS_COLORS.safe} /> Rendah
              <LegendDot color={CRISIS_COLORS.watch} /> Waspada
              <LegendDot color={CRISIS_COLORS.crisis} /> Krisis
            </div>
            <div>{legendStatus}</div>
          </div>
        </section>

        {/* Sidebar */}
        <aside className="flex flex-col gap-4">
          <div className="panel p-4">
            <div className="flex justify-center">
              <ScoreGauge score={score} />
            </div>
            <div className="mt-1 text-center">
              <div className="text-[46px] font-extrabold leading-none" style={{ color: scoreCol }}>
                {data ? score.toFixed(1) : "–"}
              </div>
              <div className="mt-1.5 text-base font-bold" style={{ color: data ? scoreCol : undefined }}>
                {data ? `${data.emoji} ${data.level}` : "Memuat data…"}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {data ? `${data.article_count} artikel · ${data.high_crisis_count} krisis tinggi` : ""}
              </div>
            </div>
            <div className="mt-3.5 flex h-[7px] gap-0.5">
              <div className="rounded-full" style={{ flex: 2, background: CRISIS_COLORS.safe }} />
              <div className="rounded-full" style={{ flex: 3, background: CRISIS_COLORS.watch }} />
              <div className="rounded-full" style={{ flex: 3, background: CRISIS_COLORS.crisis }} />
              <div className="rounded-full" style={{ flex: 2, background: CRISIS_COLORS.danger }} />
            </div>
            <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground/70">
              <span>0 Aman</span>
              <span>Waspada</span>
              <span>Krisis</span>
              <span>10 Darurat</span>
            </div>
          </div>

          <AiStatusCard data={data} />

          {showMap && (
            <TopCities
              cities={data!.top_cities}
              selectedCityKey={selectedCityKey}
              onSelect={setSelectedCityKey}
            />
          )}

          <Keywords keywords={data?.top_keywords ?? []} />

          <ArticleList
            articles={visibleArticles}
            selectedCityKey={selectedCityKey}
            filterNote={filterNote}
            onOpen={openDetail}
          />

          <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
            <span>{data?.updated_at ?? ""}</span>
            <button
              type="button"
              onClick={loadData}
              className="rounded-md border border-border bg-background/40 px-2.5 py-1.5 font-bold hover:text-foreground"
            >
              ↻ Perbarui
            </button>
          </div>
        </aside>
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
    <div className="absolute inset-0 z-[500] flex flex-col items-center justify-center gap-2 bg-[radial-gradient(circle_at_top_left,oklch(0.55_0.18_280/.18),transparent_30%),linear-gradient(180deg,oklch(0.20_0.025_260/.6),oklch(0.16_0.02_260/.4))] p-6 text-center">
      <strong className="text-base">Peta tidak tersedia</strong>
      <span className="text-sm text-muted-foreground">{message}</span>
    </div>
  );
}
