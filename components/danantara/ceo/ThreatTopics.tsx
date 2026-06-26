import type { CeoIssue } from "@/lib/danantara/ceo/types";
import { CATEGORY_LABEL } from "@/lib/danantara/ceo/threat-actors";
import { withAlpha } from "@/lib/danantara/ui";

/** Compact Indonesian reach: 1.9 jt · 880 rb. Mirrors ActorMap's formatter. */
function fmtReach(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} jt`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)} rb`;
  return String(n);
}

function negPct(i: CeoIssue): number {
  return i.mentions > 0 ? Math.round((i.negMentions / i.mentions) * 100) : 0;
}

/** Default amber accent when the crisis colour isn't supplied (matches the "watch" band). */
const DEFAULT_ACCENT = "oklch(0.72 0.17 55)";

/**
 * Middle column of the Crisis Gate — the single biggest threat, named, plus the
 * related negative topics feeding it. Answers "what is the threat, and what topics
 * make it up". The category chip + threat headline carry the live crisis colour.
 */
export function ThreatTopics({
  threat,
  related,
  accent,
}: {
  threat: CeoIssue | null;
  related: CeoIssue[];
  accent?: string;
}) {
  const accentColor = accent ?? DEFAULT_ACCENT;

  return (
    <div className="panel flex h-full flex-col overflow-hidden p-4">
      <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
        <span className="h-2 w-2 rounded-full bg-destructive" />
        Ancaman Utama
      </h2>

      {!threat ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Tidak ada ancaman menonjol.
        </div>
      ) : (
        <>
          {/* The headline threat — the concrete "what". */}
          <div className="mt-3">
            <span
              className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide"
              style={{ color: accentColor, borderColor: withAlpha(accentColor, 0.45), background: withAlpha(accentColor, 0.1) }}
            >
              {CATEGORY_LABEL[threat.category]}
            </span>
            <p
              data-testid="crisis-threat"
              className="mt-2.5 text-[clamp(1.35rem,3vh,2rem)] font-bold leading-tight text-foreground"
            >
              {threat.title}
            </p>
          </div>

          {/* The topics that constitute the threat landscape. Type is sized up for
              the 40+ CEO audience — this is the scan-the-room reading. */}
          <h3 className="mt-5 text-sm font-bold uppercase tracking-[0.18em] text-muted-foreground">Topik pendorong</h3>
          <div className="mt-3 flex-1 space-y-2.5 overflow-auto scrollbar-thin pr-1">
            {related.length === 0 ? (
              <p className="text-sm text-muted-foreground/70">Tidak ada topik negatif lain.</p>
            ) : (
              related.map((t, i) => (
                <div
                  key={t.id}
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
