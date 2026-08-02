"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  ClipboardList,
  Clock,
  Flame,
  Handshake,
  Heart,
  IdCard,
  Lightbulb,
  ListChecks,
  MessageSquareQuote,
  ShieldAlert,
  Signal,
  Tags,
  TrendingUp,
  Trophy,
  Users,
  X,
} from "lucide-react";
import type { ThreatDriver } from "@/lib/danantara/ceo/threats-source";
import { cn } from "@/lib/utils";

/** Risk badge styling per level (mirrors ThreatActors' RISK_META tones). */
const RISK_BADGE: Record<string, string> = {
  high: "border-destructive/50 bg-destructive/15 text-destructive",
  medium: "border-warning/50 bg-warning/15 text-warning",
  low: "border-border bg-muted/25 text-muted-foreground",
};

/** Captured priority tier → the header eyebrow. */
const TIER_EYEBROW: Record<string, string> = {
  urgent: "Perlu Perhatian Segera",
  high: "Prioritas Tinggi",
  medium: "Prioritas Menengah",
  low: "Prioritas Rendah",
};

/** "2/10" → 0.2 (null when unparsable) — drives the collaboration meter. */
function parseTenth(v: string | undefined): number | null {
  const m = v?.match(/^(\d+(?:\.\d+)?)\s*\/\s*10$/);
  return m ? Math.min(1, parseFloat(m[1]) / 10) : null;
}

function fmtFollowers(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} jt`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, "")} rb`;
  return String(n);
}

function Metric({
  label,
  value,
  tone,
  pct,
  barCls,
  boxCls,
}: {
  label: string;
  value: string;
  tone?: string;
  /** 0..1 — renders a mini bar under the number so the score reads at a glance. */
  pct?: number;
  barCls?: string;
  boxCls?: string;
}) {
  return (
    <div className={cn("rounded-xl border px-3 py-2 text-center", boxCls ?? "border-border/60 bg-muted/20")}>
      <div className={cn("text-lg font-bold tabular-nums", tone ?? "text-foreground")}>{value}</div>
      {typeof pct === "number" && (
        <div className="mx-auto mt-1 h-1 w-full max-w-16 overflow-hidden rounded-full bg-muted/40">
          <div className={cn("h-full rounded-full", barCls ?? "bg-primary")} style={{ width: `${Math.min(100, pct * 100)}%` }} />
        </div>
      )}
      <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
    </div>
  );
}

function Section({ icon: Icon, title, tone, children }: { icon: typeof Flame; title: string; tone?: string; children: string }) {
  return (
    <section>
      <h4 className={cn("mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em]", tone ?? "text-muted-foreground")}>
        <Icon className="h-3.5 w-3.5 shrink-0" />
        {title}
      </h4>
      <p className="text-sm leading-relaxed text-foreground/90">{children}</p>
    </section>
  );
}

/**
 * The actor detail popup (A10 v10.0 / AC13) — opened by clicking an Aktor Penggerak
 * card that carries captured `intel`. Shows the full OpenGate analysis: metrics,
 * 30-day activity, and every captured analysis paragraph. Esc / overlay / × close.
 */
export function ActorDetailModal({ actor, onClose }: { actor: ThreatDriver; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const intel = actor.intel;
  if (!intel) return null;

  const sentiment = actor.sentiment ?? 0;
  const act = intel.activity30d;

  // Portalled to <body>: the panel ancestors carry backdrop-filter/transform, which
  // would otherwise turn this fixed overlay into a panel-local box.
  return createPortal(
    <div
      data-testid="actor-detail-overlay"
      // overflow-y-auto + the panel's m-auto (not items-center) so a modal taller than a
      // short viewport scrolls instead of clipping its header off the top.
      className="fixed inset-0 z-40 flex overflow-y-auto bg-background/80 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div data-testid="actor-detail" className="panel detail-pop relative m-auto flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden">
        {/* Risk-coloured accent — the modal wears the actor's risk level. */}
        <div
          aria-hidden
          className={cn(
            "h-1 w-full shrink-0",
            actor.riskLevel === "high" ? "bg-destructive" : actor.riskLevel === "medium" ? "bg-warning" : "bg-border",
          )}
        />
        <button
          type="button"
          aria-label="Tutup"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full border border-border/60 bg-muted/30 p-1.5 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="flex items-start gap-4 border-b border-border/60 p-5">
          {actor.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- captured avatar URL/data-URI; next/image adds no value
            <img src={actor.avatarUrl} alt={actor.handle} className="h-16 w-16 shrink-0 rounded-xl object-cover" />
          ) : (
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl text-lg font-extrabold text-white" style={{ backgroundColor: "oklch(0.52 0.19 264)" }}>
              {actor.handle.slice(0, 2).toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1">
            {intel.tier && TIER_EYEBROW[intel.tier] && (
              <div className={cn("mb-1 text-[10px] font-bold uppercase tracking-[0.24em]", intel.tier === "urgent" ? "text-destructive" : intel.tier === "high" ? "text-warning" : "text-muted-foreground")}>
                {TIER_EYEBROW[intel.tier]}
              </div>
            )}
            <h3 className="break-words text-xl font-bold text-foreground">@{actor.handle}</h3>
            {actor.displayName && <div className="text-sm text-muted-foreground">{actor.displayName}</div>}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold">
              {intel.classification && (
                <span className="rounded-full border border-border/60 bg-muted/25 px-2.5 py-1 uppercase tracking-wide text-muted-foreground">
                  {intel.classification}
                </span>
              )}
              <span className={cn("rounded-full border px-2.5 py-1 uppercase tracking-wide", RISK_BADGE[actor.riskLevel] ?? RISK_BADGE.low)}>
                <ShieldAlert className="mr-1 inline h-3.5 w-3.5" />
                {actor.riskLevel === "high" ? "Risiko tinggi" : actor.riskLevel === "medium" ? "Risiko sedang" : "Risiko rendah"}
              </span>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto scrollbar-thin p-5">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
            <Metric label="Followers" value={fmtFollowers(actor.followers)} />
            <Metric label="Influence" value={`${intel.influence ?? 0}/10`} pct={(intel.influence ?? 0) / 10} barCls="bg-warning" />
            <Metric label="Credibility" value={`${actor.credibility}/10`} pct={actor.credibility / 10} barCls="bg-success" />
            <Metric
              label="Sentiment"
              value={`${sentiment > 0 ? "+" : ""}${sentiment.toFixed(1)}`}
              tone={sentiment < 0 ? "text-destructive" : "text-success"}
              pct={Math.abs(sentiment) / 10}
              barCls={sentiment < 0 ? "bg-destructive" : "bg-success"}
              boxCls={sentiment < 0 ? "border-destructive/30 bg-destructive/[0.06]" : "border-success/30 bg-success/[0.06]"}
            />
            <Metric
              label="Reach"
              value={actor.reach ?? "—"}
              pct={actor.reach ? parseFloat(actor.reach) / 100 : undefined}
            />
          </div>

          {act && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-border/60 bg-muted/15 px-3.5 py-2.5 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5 font-bold uppercase tracking-wide text-xs"><Activity className="h-3.5 w-3.5" /> 30-Day Activity</span>
              {[act.posts, act.mentions, act.avgEngagement, act.totalEngagement].filter(Boolean).map((v) => (
                <span key={v} className="tabular-nums">{v}</span>
              ))}
            </div>
          )}

          {intel.bio && <Section icon={IdCard} title="Bio">{intel.bio}</Section>}
          {intel.brandMentions && <Section icon={MessageSquareQuote} title="What They Said About Your Brand">{intel.brandMentions}</Section>}
          {intel.sentimentPatterns && <Section icon={TrendingUp} title="Sentiment Patterns">{intel.sentimentPatterns}</Section>}

          {/* The four "who are they" reads sit side by side on wider screens. */}
          <div className="grid gap-5 sm:grid-cols-2">
            {intel.influenceAnalysis && <Section icon={Flame} title="Influence Analysis">{intel.influenceAnalysis}</Section>}
            {intel.contentThemes && <Section icon={Tags} title="Content Themes">{intel.contentThemes}</Section>}
            {intel.engagementTactics && <Section icon={Users} title="Engagement Tactics">{intel.engagementTactics}</Section>}
            {intel.sentimentAnalysis && <Section icon={Heart} title="Sentiment Analysis">{intel.sentimentAnalysis}</Section>}
          </div>

          {/* Collaboration read — one panel: verdict, meter, recommendation. */}
          {(intel.collaborationOpportunities || intel.collaborationPotential || intel.collaborationRecommendation) && (
            <div className="space-y-4 rounded-2xl border border-primary/25 bg-primary/[0.05] p-4">
              {intel.collaborationOpportunities && (
                <Section icon={Handshake} title="Collaboration Opportunities" tone="text-primary">{intel.collaborationOpportunities}</Section>
              )}
              {intel.collaborationPotential && (
                <div className="flex items-center gap-3 text-sm">
                  <span className="shrink-0 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Collaboration Potential</span>
                  {parseTenth(intel.collaborationPotential) !== null && (
                    <div className="h-1.5 max-w-40 flex-1 overflow-hidden rounded-full bg-muted/40">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${(parseTenth(intel.collaborationPotential) ?? 0) * 100}%` }}
                      />
                    </div>
                  )}
                  <span className="shrink-0 font-bold tabular-nums text-foreground">{intel.collaborationPotential}</span>
                </div>
              )}
              {intel.collaborationRecommendation && (
                <Section icon={Lightbulb} title="Collaboration Recommendation">{intel.collaborationRecommendation}</Section>
              )}
            </div>
          )}

          {/* The command-center payoff — risk + what to do about it — gets tinted callouts. */}
          {intel.riskAssessment && (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/[0.07] p-4">
              <Section icon={ShieldAlert} title="Risk Assessment" tone="text-destructive">{intel.riskAssessment}</Section>
            </div>
          )}
          {intel.recommendedActions && (
            <div className="rounded-2xl border border-warning/30 bg-warning/[0.07] p-4">
              <Section icon={ListChecks} title="Recommended Actions" tone="text-warning">{intel.recommendedActions}</Section>
            </div>
          )}
          {intel.recentActivitySummary && <Section icon={ClipboardList} title="Recent Activity Summary">{intel.recentActivitySummary}</Section>}
          {intel.topPerformingPost && (
            <div className="rounded-r-2xl border-l-2 border-primary/60 bg-muted/15 py-3 pl-4 pr-4">
              <Section icon={Trophy} title="Top Performing Post">{intel.topPerformingPost}</Section>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-border/60 px-5 py-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {intel.analyzed ? `Analyzed ${intel.analyzed}` : "Captured intelligence"}
          </span>
          {actor.reach && (
            <span className="flex items-center gap-1.5 tabular-nums">
              <Signal className="h-3.5 w-3.5" /> Reach: {actor.reach}
            </span>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
