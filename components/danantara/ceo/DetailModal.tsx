"use client";

import { useEffect } from "react";
import { AlertTriangle, Building2, FileText, X } from "lucide-react";
import { fmtCount, pieTotals } from "@/lib/danantara/ceo/format";
import type { CeoState } from "@/lib/danantara/ceo/types";
import { SECTOR_LABEL } from "@/lib/danantara/ui";
import { RankBadge } from "./RankBadge";
import { SentimentPie } from "./SentimentPie";

export type DetailSelection = { type: "issue"; id: string } | { type: "bumn"; id: string };

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  normal: { label: "", cls: "" },
  rising: { label: "RISING", cls: "bg-warning/15 text-warning border-warning/40" },
  escalating: {
    label: "ESCALATING",
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
            {/* Header — full title (wraps, never truncated) */}
            <div className="flex shrink-0 items-start gap-2 border-b border-border px-4 py-3">
              <AlertTriangle className="mt-1 h-4 w-4 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 text-2xl font-semibold leading-snug text-balance">{issue.title}</span>
              {badge.label && (
                <span
                  className={`mt-1 shrink-0 rounded border px-2 py-0.5 text-base font-bold tracking-wider ${badge.cls}`}
                >
                  {badge.label}
                </span>
              )}
              <span className="mt-1 shrink-0">
                <RankBadge delta={issue.rankDelta} />
              </span>
              <button
                type="button"
                data-testid="ceo-detail-close"
                aria-label="Close"
                onClick={onClose}
                className="shrink-0 rounded p-1 text-muted-foreground hover:bg-white/5 hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
              {/* Key metrics, each with a plain-language hint */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Metric label="Impressions" value={fmtCount(issue.mentions)} hint="Total views across all posts in this topic" />
                <Metric label="Reach" value={fmtCount(issue.reach)} hint="Number of users exposed to this topic" />
              </div>

              {/* Sentiment breakdown (pie, with neutral share) */}
              <div>
                <div className="text-lg font-semibold uppercase tracking-[0.18em] text-muted-foreground">Sentiment</div>
                <p className="mb-2 mt-0.5 text-base leading-snug text-muted-foreground">
                  Breakdown of emotional tone (Positive / Negative / Neutral %)
                </p>
                <SentimentPie totals={pieTotals(issue)} variant="full" />
              </div>

              {/* Description (AI read of the topic — the feed's penjelasan) */}
              {issue.aiLine && (
                <div>
                  <div className="mb-2 flex items-center gap-1.5 text-lg font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    <FileText className="h-4 w-4" /> Description
                  </div>
                  <p data-testid="issue-description" className="text-lg leading-relaxed text-foreground/90">
                    {issue.aiLine}
                  </p>
                </div>
              )}

              {/* Related BUMN chips */}
              {relatedBumn.length > 0 && (
                <div>
                  <div className="mb-2 text-lg font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Related BUMN
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
              aria-label="Close"
              onClick={onClose}
              className="ml-1 shrink-0 rounded p-1 text-muted-foreground hover:bg-white/5 hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Scrollable body — same shape as the Danantara topic detail. */}
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            {/* Key metric with a plain-language hint. */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Metric label="Impressions" value={fmtCount(bumn.mentions)} hint="Total views across all posts about this BUMN" />
            </div>

            {/* Sentiment breakdown (pie, with neutral share). */}
            <div>
              <div className="text-lg font-semibold uppercase tracking-[0.18em] text-muted-foreground">Sentiment</div>
              <p className="mb-2 mt-0.5 text-base leading-snug text-muted-foreground">
                Breakdown of emotional tone (Positive / Negative / Neutral %)
              </p>
              <SentimentPie totals={pieTotals(bumn)} variant="full" />
            </div>

            {/* Topics for this BUMN. */}
            {sortedIssues.length > 0 && (
              <div>
                <div className="mb-2 text-lg font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Topics
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
                            Top Issue
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
                          {fmtCount(issue.reach)}
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

/** A labeled key metric with a one-line plain-language hint (CEO readability). */
function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/30 px-3 py-2.5">
      <div className="text-base font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-mono text-2xl font-bold tabular-nums text-foreground">{value}</div>
      <p className="mt-1 text-base leading-snug text-muted-foreground">{hint}</p>
    </div>
  );
}
