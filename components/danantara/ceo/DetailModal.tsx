"use client";

import { useEffect } from "react";
import { AlertTriangle, Building2, Newspaper, Tag, TrendingUp, X } from "lucide-react";
import { ESCALATING_THRESHOLD, RISING_THRESHOLD } from "@/lib/danantara/ceo/engine";
import { fmtCount } from "@/lib/danantara/ceo/format";
import type { CeoState } from "@/lib/danantara/ceo/types";
import { SECTOR_LABEL } from "@/lib/danantara/ui";
import { RankBadge } from "./RankBadge";
import { SentimentSplit } from "./SentimentSplit";
import { TrendChart } from "./TrendChart";

export type DetailSelection = { type: "issue"; id: string } | { type: "bumn"; id: string };

const CATEGORY_LABEL: Record<string, string> = {
  "tata-kelola": "Tata Kelola",
  investasi: "Investasi",
  kebijakan: "Kebijakan",
  pasar: "Pasar",
  sosial: "Sosial",
};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  normal: { label: "", cls: "" },
  rising: { label: "NAIK", cls: "bg-warning/15 text-warning border-warning/40" },
  escalating: {
    label: "ESKALASI",
    cls: "bg-destructive/15 text-destructive border-destructive/50 ceo-siren",
  },
};

export function DetailModal({
  selection,
  state,
  onClose,
  onNavigate,
}: {
  selection: DetailSelection;
  state: CeoState;
  onClose: () => void;
  /** Switch the modal to another item (e.g. click a related-BUMN chip). */
  onNavigate: (next: DetailSelection) => void;
}) {
  // Esc closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (selection.type === "issue") {
    const issue = state.issues.find((i) => i.id === selection.id);
    if (!issue) return null;

    const escalating = issue.status === "escalating";
    const badge = STATUS_BADGE[issue.status];
    const relatedBumn = issue.relatedBumn
      .map((id) => state.bumn.find((b) => b.id === id))
      .filter(Boolean) as (typeof state.bumn)[number][];

    return (
      <div
        data-testid="ceo-detail-overlay"
        className="fixed inset-0 z-40 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {/* Panel: ceo-detail for overlay-click test; inner wrapper ceo-detail-issue for content tests */}
        <div
          data-testid="ceo-detail"
          className="panel relative flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden"
        >
          <div data-testid="ceo-detail-issue" className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {/* Header */}
            <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
              <AlertTriangle className="h-4 w-4 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate text-2xl font-semibold">{issue.title}</span>
              {badge.label && (
                <span
                  className={`shrink-0 rounded border px-2 py-0.5 text-base font-bold tracking-wider ${badge.cls}`}
                >
                  {badge.label}
                </span>
              )}
              <span className="shrink-0">
                <RankBadge delta={issue.rankDelta} />
              </span>
              <button
                type="button"
                data-testid="ceo-detail-close"
                aria-label="Tutup"
                onClick={onClose}
                className="ml-1 shrink-0 rounded p-1 text-muted-foreground hover:bg-white/5 hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
              {/* Stats row */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-lg tabular-nums">
                <span className="text-muted-foreground">
                  <span className="font-semibold text-foreground">{(issue.reach / 1_000_000).toFixed(1)} jt</span>{" "}
                  jangkauan
                </span>
                <span className="text-muted-foreground">
                  <span className="font-semibold text-foreground">{fmtCount(issue.mentions)}</span> sebutan
                </span>
                <span
                  className={`flex items-center gap-0.5 font-semibold ${
                    issue.velocity >= ESCALATING_THRESHOLD
                      ? "text-destructive"
                      : issue.velocity >= RISING_THRESHOLD
                        ? "text-warning"
                        : "text-muted-foreground"
                  }`}
                >
                  <TrendingUp className="h-3.5 w-3.5" />
                  {issue.velocity >= 0 ? "+" : ""}
                  {Math.round(issue.velocity)}% velocity
                </span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Tag className="h-3 w-3" />
                  {CATEGORY_LABEL[issue.category] ?? issue.category}
                </span>
              </div>

              {/* Trend chart */}
              <TrendChart history={issue.history} escalating={escalating} className="h-40 w-full" />

              {/* Sentiment split */}
              <SentimentSplit pos={issue.posMentions} neg={issue.negMentions} total={issue.mentions} variant="full" />

              {/* Headlines */}
              <div>
                <div className="mb-2 text-lg font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Pemberitaan Utama
                </div>
                <div className="space-y-1.5">
                  {issue.headlines.map((h) => (
                    <div key={h.title} className="flex items-start gap-2 text-lg">
                      <Newspaper className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 leading-snug">{h.title}</span>
                      <span className="shrink-0 text-base text-muted-foreground">
                        {h.source} · {h.time}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Related BUMN chips */}
              {relatedBumn.length > 0 && (
                <div>
                  <div className="mb-2 text-lg font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    BUMN Terkait
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {relatedBumn.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        data-testid={`related-bumn-${b.id}`}
                        onClick={() => onNavigate({ type: "bumn", id: b.id })}
                        className="rounded-full border border-border bg-background/40 px-3 py-1 text-base font-medium hover:border-primary/50 hover:bg-primary/10"
                      >
                        {b.short}{" "}
                        <span className={b.sentiment < 0 ? "text-destructive" : "text-success"}>
                          {b.sentiment > 0 ? "+" : ""}
                          {Math.round(b.sentiment)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // BUMN variant
  const bumn = state.bumn.find((b) => b.id === selection.id);
  if (!bumn) return null;

  const relatedIssues = state.issues.filter((i) => i.relatedBumn.includes(bumn.id));
  // topIssueId first
  const sortedIssues = bumn.topIssueId
    ? [
        ...relatedIssues.filter((i) => i.id === bumn.topIssueId),
        ...relatedIssues.filter((i) => i.id !== bumn.topIssueId),
      ]
    : relatedIssues;

  return (
    <div
      data-testid="ceo-detail-overlay"
      className="fixed inset-0 z-40 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        data-testid="ceo-detail"
        className="panel relative flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden"
      >
        <div data-testid="ceo-detail-bumn" className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {/* Header */}
          <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
            <Building2 className="h-4 w-4 shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate text-2xl font-semibold">{bumn.name}</span>
            <span className="shrink-0 rounded border border-border bg-background/40 px-2 py-0.5 text-base font-medium uppercase tracking-wider text-muted-foreground">
              {SECTOR_LABEL[bumn.sector]}
            </span>
            <span className="shrink-0">
              <RankBadge delta={bumn.rankDelta} />
            </span>
            <button
              type="button"
              data-testid="ceo-detail-close"
              aria-label="Tutup"
              onClick={onClose}
              className="ml-1 shrink-0 rounded p-1 text-muted-foreground hover:bg-white/5 hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            {/* Stats row */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-lg tabular-nums">
              <span className="text-muted-foreground">
                Sentimen bersih:{" "}
                <span
                  className={`font-bold ${bumn.sentiment < 0 ? "text-destructive" : bumn.sentiment > 0 ? "text-success" : "text-warning"}`}
                >
                  {bumn.sentiment > 0 ? "+" : ""}
                  {Math.round(bumn.sentiment)}
                </span>
              </span>
              <span className="text-muted-foreground">
                <span className="font-semibold text-foreground">{fmtCount(bumn.mentions)}</span> sebutan
              </span>
              <span className="text-muted-foreground">Sektor: {SECTOR_LABEL[bumn.sector]}</span>
            </div>

            {/* Sentiment trend chart */}
            <TrendChart history={bumn.trend} escalating={false} className="h-40 w-full" label="Tren Sentimen" />

            {/* Sentiment split */}
            <SentimentSplit pos={bumn.posMentions} neg={bumn.negMentions} total={bumn.mentions} variant="full" />

            {/* Related issues */}
            {sortedIssues.length > 0 && (
              <div>
                <div className="mb-2 text-lg font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Isu Terkait
                </div>
                <div className="space-y-1.5">
                  {sortedIssues.map((issue) => {
                    const isTop = issue.id === bumn.topIssueId;
                    const badge = STATUS_BADGE[issue.status];
                    return (
                      <button
                        key={issue.id}
                        type="button"
                        data-testid={`related-issue-${issue.id}`}
                        onClick={() => onNavigate({ type: "issue", id: issue.id })}
                        className="flex w-full items-center gap-2 rounded border border-border/50 bg-background/20 px-3 py-2.5 text-left text-lg hover:bg-card/80"
                      >
                        {isTop && (
                          <span className="shrink-0 rounded border border-primary/40 bg-primary/10 px-1 py-px text-base font-bold uppercase tracking-wider text-primary">
                            Isu Utama
                          </span>
                        )}
                        <span className="min-w-0 flex-1 truncate font-medium">{issue.title}</span>
                        {badge.label && (
                          <span
                            className={`shrink-0 rounded border px-1.5 py-px text-base font-bold tracking-wider ${badge.cls}`}
                          >
                            {badge.label}
                          </span>
                        )}
                        <span className="shrink-0 font-mono text-base tabular-nums text-muted-foreground">
                          {(issue.reach / 1_000_000).toFixed(1)} jt
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
