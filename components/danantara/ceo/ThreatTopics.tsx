import type { CeoIssue } from "@/lib/danantara/ceo/types";
import type { DetectedThreat } from "@/lib/danantara/ceo/threats-source";
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
 * Middle column of the Crisis Gate — the single biggest **detected threat** (A10 v5.0,
 * from the OpenGate `/threats` feed), named with its severity/growth, plus the top
 * negative **topics** feeding the conversation (A10 v5.1, from the `/topics` feed —
 * each with reach + negative share). Answers "what is the threat, and what topics are
 * driving it". The severity chip + threat headline carry the live crisis colour.
 */
export function ThreatTopics({
  threat,
  related,
  loading,
  accent,
}: {
  threat: DetectedThreat | null;
  related: CeoIssue[];
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

          {/* The top negative topics feeding the conversation — title · reach · neg share.
              Type is sized up for the 40+ CEO audience — this is the scan-the-room read. */}
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
                  {/* Full title — wraps to as many lines as it needs; never truncated. */}
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
