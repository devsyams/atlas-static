import type { DetectedThreat } from "@/lib/danantara/ceo/threats-source";
import { withAlpha } from "@/lib/danantara/ui";

/** Default amber accent when the crisis colour isn't supplied (matches the "watch" band). */
const DEFAULT_ACCENT = "oklch(0.72 0.17 55)";

/** Indonesian label for the upstream severity class. */
const SEVERITY_LABEL: Record<string, string> = { high: "Tinggi", medium: "Sedang", low: "Rendah" };

/**
 * Middle column of the Crisis Gate — the single biggest **detected threat** (A10 v5.0,
 * from the OpenGate `/threats` feed), named, with its severity/growth, why it matters,
 * and the keywords driving it. Answers "what is the threat, and what's fuelling it".
 * The severity chip + threat headline carry the live crisis colour.
 */
export function ThreatTopics({
  threat,
  loading,
  accent,
}: {
  threat: DetectedThreat | null;
  loading?: boolean;
  accent?: string;
}) {
  const accentColor = accent ?? DEFAULT_ACCENT;

  return (
    <div className="panel flex h-full flex-col overflow-hidden p-4">
      <h2 className="flex items-center gap-2.5 text-[clamp(1.5rem,3vh,2.5rem)] font-bold text-foreground">
        <span className="h-[0.4em] w-[0.4em] rounded-full bg-destructive" />
        Ancaman Utama
      </h2>

      {loading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Memuat ancaman…</div>
      ) : !threat ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Tidak ada ancaman menonjol.
        </div>
      ) : (
        <>
          {/* Severity + growth — the "how bad / how fast" meta for the headline threat. */}
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

          {/* The headline threat — the concrete "what". */}
          <p
            data-testid="crisis-threat"
            className="mt-2.5 text-[clamp(1.35rem,3vh,2rem)] font-bold leading-tight text-foreground"
          >
            {threat.title}
          </p>

          {/* Why it matters — the one-line impact read (kept short so the gate stays glanceable). */}
          {threat.impact && (
            <p className="mt-2 line-clamp-3 text-sm leading-snug text-muted-foreground">{threat.impact}</p>
          )}

          {/* The keywords fuelling the threat. */}
          <h3 className="mt-5 text-sm font-bold uppercase tracking-[0.18em] text-muted-foreground">Topik pendorong</h3>
          <div className="mt-3 flex-1 overflow-auto scrollbar-thin pr-1">
            {threat.trendingKeywords.length === 0 ? (
              <p className="text-sm text-muted-foreground/70">Tidak ada kata kunci menonjol.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {threat.trendingKeywords.map((k) => (
                  <span
                    key={k}
                    className="inline-flex items-center rounded-lg border border-border/50 bg-background/40 px-3 py-1.5 text-sm font-medium text-foreground"
                  >
                    {k}
                  </span>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
