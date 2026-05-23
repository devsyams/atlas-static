"use client";

import { useEffect } from "react";
import type { Article, ArticleDetail, ForecastTrend } from "@/lib/mbg/types";
import { scoreTagClass } from "@/lib/mbg/colors";
import { cn } from "@/lib/utils";

const TREND_TEXT: Record<ForecastTrend, string> = {
  up: "text-destructive",
  down: "text-success",
  stable: "text-warning",
};
const TREND_FILL: Record<ForecastTrend, string> = {
  up: "bg-destructive",
  down: "bg-success",
  stable: "bg-warning",
};
const TREND_ARROW: Record<ForecastTrend, string> = { up: "▲", down: "▼", stable: "◆" };

export function DetailModal({
  open,
  loading,
  error,
  detail,
  article,
  onClose,
}: {
  open: boolean;
  loading: boolean;
  error: string | null;
  detail: ArticleDetail | null;
  article: Article | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  if (!open) return null;

  const trend: ForecastTrend = detail?.forecast?.trend ?? "stable";
  const probability = detail?.forecast?.probability ?? 50;
  const articleLocation = article?.location
    ? `${article.location.city}, ${article.location.province}`
    : null;
  const issueTag = article?.dominant_issue || null;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-[440px] overflow-y-auto rounded-2xl border border-border bg-popover text-[13px] text-foreground shadow-[0_28px_70px_oklch(0.05_0.02_260/.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            Details
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-xl leading-none text-muted-foreground hover:bg-white/5 hover:text-foreground"
            aria-label="Tutup"
          >
            ×
          </button>
        </div>

        {loading ? (
          <div className="px-5 py-10 text-center text-muted-foreground">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-[3px] border-border border-t-primary" />
            <div>Memuat detail artikel…</div>
          </div>
        ) : error ? (
          <div className="px-5 py-10 text-center text-muted-foreground">
            Gagal memuat detail: {error}
          </div>
        ) : detail ? (
          <>
            <div className="border-b border-border px-4 py-3.5">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-bold text-secondary-foreground">
                  {detail.category || "Umum"}
                </span>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[10px] font-bold",
                    scoreTagClass(detail.score),
                  )}
                >
                  S{detail.score}
                </span>
                {articleLocation && (
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-foreground/80">
                    {articleLocation}
                  </span>
                )}
                {issueTag && (
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-foreground/80">
                    {issueTag}
                  </span>
                )}
                <a
                  href={detail.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary"
                  title="Buka artikel"
                >
                  🔗
                </a>
              </div>
              <div className="mb-2 text-[15px] font-bold leading-snug">{detail.title}</div>
              <div className="flex flex-wrap gap-3.5 text-[11px] text-muted-foreground">
                <span>⏱ {detail.relative_time}</span>
                <span>📰 {detail.source}</span>
              </div>
            </div>

            <div className="border-b border-border px-4 py-3.5">
              <div className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                Ringkasan
              </div>
              <div className="leading-relaxed text-foreground/85">
                {detail.summary || "Ringkasan tidak tersedia."}
              </div>
            </div>

            <div className="border-b border-border px-4 py-3.5">
              <div className="mb-2.5 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                  Prakiraan
                </span>
                <span className={cn("text-[10px] font-bold", TREND_TEXT[trend])}>
                  {TREND_ARROW[trend]}
                </span>
              </div>
              <div className="mb-3 text-[13px] text-foreground/90">
                {detail.forecast?.question || "Apakah isu ini akan meningkat?"}
              </div>
              <div className="mb-2 flex items-center justify-between gap-2.5">
                <span className={cn("text-[28px] font-extrabold", TREND_TEXT[trend])}>
                  {probability}%
                </span>
                <span className="text-xs text-muted-foreground">
                  dalam {detail.forecast?.timeframe || "7 hari"}
                </span>
              </div>
              <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className={cn("h-full rounded-full transition-[width] duration-500", TREND_FILL[trend])}
                  style={{ width: `${probability}%` }}
                />
              </div>
              {detail.forecast?.reasoning && (
                <div className="mb-2 text-[11px] leading-relaxed text-muted-foreground">
                  {detail.forecast.reasoning}
                </div>
              )}
              {detail.forecast?.recommendation && (
                <div className="mb-2.5 rounded-lg bg-primary/15 px-2.5 py-2 text-[11px] leading-relaxed text-primary">
                  <strong>Rekomendasi:</strong> {detail.forecast.recommendation}
                </div>
              )}
              <div className="flex justify-between gap-2.5 text-[10px] text-muted-foreground/70">
                <span>Diperbarui hari ini</span>
                <span>Prakiraan oleh AI engine</span>
              </div>
            </div>

            <div className="px-4 py-3.5">
              <div className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                Sinyal ({detail.signals?.length || 0})
              </div>
              {detail.signals && detail.signals.length > 0 ? (
                detail.signals.map((signal, i) => (
                  <div
                    key={i}
                    className="border-b border-white/5 py-2.5 last:border-b-0"
                  >
                    <div className="mb-1.5 flex justify-between gap-2 text-[11px] text-muted-foreground">
                      <span className="text-primary">@{signal.source || "sumber"}</span>
                      <span>{signal.type || "info"}</span>
                    </div>
                    <div className="leading-relaxed text-foreground/85">{signal.quote || ""}</div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-muted-foreground">Tidak ada sinyal terdeteksi</div>
              )}
              <a
                href={detail.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2.5 inline-block text-[11px] text-primary hover:underline"
              >
                🔗 Lihat artikel lengkap
              </a>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
