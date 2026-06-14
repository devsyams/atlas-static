"use client";

import { useEffect, type CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight, BarChart3, Building2, ExternalLink, Eye, LayoutDashboard, Sparkles, X } from "lucide-react";
import { fmtCount, pieTotals } from "@/lib/danantara/ceo/format";
import type { CeoState } from "@/lib/danantara/ceo/types";
import { SECTOR_LABEL } from "@/lib/danantara/ui";
import { CounterNoisePanel } from "./CounterNoisePanel";
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

/** Dominant tone (label + %, colors) of a positive/neutral/negative split. */
function dominantTone(t: { pos: number; neg: number; neu: number; total: number }) {
  const total = t.total || 1;
  const pct = (v: number) => Math.round((v / total) * 100);
  if (t.neg >= t.pos && t.neg >= t.neu)
    return { label: "Negative", pct: pct(t.neg), tone: "oklch(0.62 0.22 25)", pill: "border-destructive/50 bg-destructive/15 text-destructive" };
  if (t.pos >= t.neu)
    return { label: "Positive", pct: pct(t.pos), tone: "oklch(0.72 0.17 150)", pill: "border-success/50 bg-success/15 text-success" };
  return { label: "Neutral", pct: pct(t.neu), tone: "oklch(0.66 0.03 260)", pill: "border-border bg-muted/25 text-muted-foreground" };
}

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
    const totals = pieTotals(issue);
    const tone = dominantTone(totals);
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
          className="panel detail-pop relative flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden"
          style={{ "--tone": tone.tone } as CSSProperties}
        >
          <span className="topic-spine" aria-hidden />
          <div data-testid="ceo-detail-issue" className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {/* Hero header — sentiment verdict + full title over a tone wash. */}
            <div className="detail-hero relative flex shrink-0 items-start gap-3 border-b border-border px-5 py-4 pl-6">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-base font-bold uppercase tracking-wide ${tone.pill}`}>
                    {tone.label} {tone.pct}%
                  </span>
                  {badge.label && (
                    <span className={`rounded border px-2 py-0.5 text-base font-bold tracking-wider ${badge.cls}`}>{badge.label}</span>
                  )}
                  <RankBadge delta={issue.rankDelta} />
                </div>
                <h2 className="mt-2 text-2xl font-bold leading-snug text-balance sm:text-[26px]">{issue.title}</h2>
              </div>
              <button
                type="button"
                data-testid="ceo-detail-close"
                aria-label="Close"
                onClick={onClose}
                className="-mr-1 shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-white/10 hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
              {/* Key metric tiles, each with a plain-language hint */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Metric icon={BarChart3} label="Impressions" value={fmtCount(issue.mentions)} hint="Total views across all posts in this topic" />
                <Metric icon={Eye} label="Reach" value={fmtCount(issue.reach)} hint="Number of users exposed to this topic" />
              </div>

              {/* Sentiment breakdown (pie, with neutral share) */}
              <section className="rounded-xl border border-border/60 bg-card/40 p-4">
                <div className="text-lg font-semibold uppercase tracking-[0.18em] text-muted-foreground">Sentiment</div>
                <p className="mb-3 mt-0.5 text-base leading-snug text-muted-foreground">
                  Breakdown of emotional tone (Positive / Negative / Neutral %)
                </p>
                <SentimentPie totals={totals} variant="full" size={40} />
              </section>

              {/* AI read of the topic (the feed's penjelasan) */}
              {issue.aiLine && (
                <section className="detail-ai-card relative overflow-hidden rounded-xl border p-4">
                  <div className="flex items-center gap-1.5 text-base font-bold uppercase tracking-[0.18em] text-primary">
                    <Sparkles className="h-4 w-4" /> Nexorus AI · Analysis
                  </div>
                  <p data-testid="issue-description" className="mt-2 text-lg leading-relaxed text-foreground/90">
                    {issue.aiLine}
                  </p>
                </section>
              )}

              {/* Counter-Noise — below the penjelasan; only for a negative topic. */}
              {tone.label === "Negative" && <CounterNoisePanel issue={issue} />}

              {/* Open this same topic in the Nexorus dashboard (deep link via the
                  session-gated autologin BFF). Only when the feed carries an idQuery. */}
              {issue.idQuery && (
                <div>
                  <div className="mb-2 flex items-center gap-1.5 text-lg font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    <ExternalLink className="h-4 w-4" /> Nexorus Dashboard
                  </div>
                  <a
                    data-testid="nexorus-deeplink"
                    href={`/api/v1/nexorus/topic?idquery=${encodeURIComponent(issue.idQuery)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-4 py-2 text-base font-semibold text-primary transition-colors hover:bg-primary/20"
                  >
                    View in Nexorus <ArrowRight className="h-4 w-4" />
                  </a>
                </div>
              )}

              {/* Jump to the related BUMN's own dashboard. */}
              {relatedBumn.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center gap-1.5 text-lg font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    <LayoutDashboard className="h-4 w-4" /> BUMN Dashboard
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {relatedBumn.map((b) => (
                      <Link
                        key={b.id}
                        href={`/bumn/${b.id}`}
                        data-testid={`related-bumn-${b.id}`}
                        className="inline-flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-4 py-2 text-base font-semibold text-primary transition-colors hover:bg-primary/20"
                      >
                        Open {b.name} dashboard <ArrowRight className="h-4 w-4" />
                      </Link>
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
              <Metric icon={BarChart3} label="Impressions" value={fmtCount(bumn.mentions)} hint="Total views across all posts about this BUMN" />
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

/** A labeled key metric with an icon + a one-line plain-language hint (CEO readability). */
function Metric({ icon: Icon, label, value, hint }: { icon?: typeof BarChart3; label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 px-4 py-3.5">
      <div className="flex items-center gap-2 text-base font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {Icon ? <Icon className="h-4 w-4 text-primary/70" /> : null} {label}
      </div>
      <div className="mt-1 font-mono text-3xl font-bold tabular-nums text-foreground">{value}</div>
      <p className="mt-1 text-base leading-snug text-muted-foreground">{hint}</p>
    </div>
  );
}
