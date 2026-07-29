import type { CeoIssue } from "@/lib/danantara/ceo/types";
import type { DetectedThreat } from "@/lib/danantara/ceo/threats-source";
import { CATEGORY_LABEL } from "@/lib/danantara/ceo/threat-actors";
import { withAlpha } from "@/lib/danantara/ui";

/** Default amber accent when the crisis colour isn't supplied (matches the "watch" band). */
const DEFAULT_ACCENT = "oklch(0.72 0.17 55)";

/** Indonesian label for the upstream severity class. */
const SEVERITY_LABEL: Record<string, string> = { high: "Tinggi", medium: "Sedang", low: "Rendah" };

/** Compact Indonesian reach: 1.9 jt · 880 rb. Mirrors ActorMap's formatter. */
function fmtReach(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} jt`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)} rb`;
  return String(n);
}

/** A topic's negative share, as a whole percent. */
function negPct(i: CeoIssue): number {
  return i.mentions > 0 ? Math.round((i.negMentions / i.mentions) * 100) : 0;
}

/**
 * Middle column of the Crisis Gate — the biggest threat + the top negative topics
 * feeding the conversation.
 *
 * Headline (A10 v5.2, resilient): prefer the `/threats` **detected threat** (with its
 * severity/growth); when there's no live incident, fall back to the `/topics`
 * **`biggestThreat`** (a category-tagged topic) so the panel stays populated. Beneath
 * it, the top-3 negative topics ("Topik pendorong", from `/topics`) always render —
 * each with its reach + negative share — regardless of which headline is shown.
 */
export function ThreatTopics({
  threat,
  fallbackThreat,
  related,
  loading,
  accent,
}: {
  threat: DetectedThreat | null;
  fallbackThreat: CeoIssue | null;
  related: CeoIssue[];
  loading?: boolean;
  accent?: string;
}) {
  const accentColor = accent ?? DEFAULT_ACCENT;
  const fallback = threat ? null : fallbackThreat; // fallback only when no detected threat
  const hasHeadline = !!threat || !!fallback;

  return (
    <div className="panel flex h-full flex-col overflow-hidden p-4">
      <h2 className="flex items-center gap-2.5 text-[clamp(1.5rem,3vh,2.5rem)] font-bold text-foreground">
        <span className="h-[0.4em] w-[0.4em] rounded-full bg-destructive" />
        Ancaman Utama
      </h2>

      {loading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Memuat ancaman…</div>
      ) : !hasHeadline ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Tidak ada ancaman menonjol.
        </div>
      ) : (
        <>
          {/* Headline meta — severity/growth for a detected incident, else the topic category. */}
          {threat ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span
                data-testid="crisis-threat-severity"
                className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide"
                style={{ color: accentColor, borderColor: withAlpha(accentColor, 0.45), background: withAlpha(accentColor, 0.1) }}
              >
                Severitas {threat.severity}/10 · {SEVERITY_LABEL[threat.severityClass] ?? threat.severityClass}
              </span>
              {threat.growthRate && (
                <span className="inline-flex items-center rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-destructive">
                  {threat.growthRate}
                </span>
              )}
            </div>
          ) : (
            fallback && (
              <div className="mt-3">
                <span
                  className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide"
                  style={{ color: accentColor, borderColor: withAlpha(accentColor, 0.45), background: withAlpha(accentColor, 0.1) }}
                >
                  {CATEGORY_LABEL[fallback.category]} · Topik teratas
                </span>
              </div>
            )
          )}

          {/* The headline threat — the concrete "what". */}
          <p
            data-testid="crisis-threat"
            className="mt-2.5 text-[clamp(1.35rem,3vh,2rem)] font-bold leading-tight text-foreground"
          >
            {threat ? threat.title : fallback?.title}
          </p>

          {/* The top negative topics feeding the conversation — title · reach · neg share. */}
          <h3 className="mt-5 text-sm font-bold uppercase tracking-[0.18em] text-muted-foreground">Topik pendorong</h3>
          <div className="mt-3 flex-1 space-y-2.5 overflow-auto scrollbar-thin pr-1">
            {related.length === 0 ? (
              <p className="text-sm text-muted-foreground/70">Tidak ada topik negatif lain.</p>
            ) : (
              related.map((t, i) => (
                <div
                  key={t.id}
                  data-testid="crisis-topic"
                  className="flex items-start gap-3 rounded-xl border border-border/50 bg-background/40 px-3.5 py-3"
                >
                  <span className="w-6 shrink-0 text-center text-base font-bold leading-snug tabular-nums text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 text-base font-medium leading-snug text-foreground">{t.title}</span>
                  <span className="shrink-0 text-right leading-tight">
                    <span className="block text-sm tabular-nums text-muted-foreground">{fmtReach(t.reach)}</span>
                    <span className="block text-sm font-bold tabular-nums text-destructive">{negPct(t)}% neg</span>
                  </span>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
