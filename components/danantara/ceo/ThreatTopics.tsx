import type { CeoIssue } from "@/lib/danantara/ceo/types";
import { CATEGORY_LABEL } from "@/lib/danantara/ceo/threat-actors";
import { fallbackPoints } from "@/lib/danantara/ceo/threat-summary";
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
 * Middle column of the Crisis Gate — the single biggest threat, named and explained,
 * plus the related negative topics feeding it. Answers "what is the threat, and what
 * topics make it up". The AI read is framed as an Executive Summary whose accent
 * tracks the live crisis colour. `summaryPoints` are the server's AI-condensed
 * points; absent them, we fall back to deterministic short points from `aiLine`.
 */
export function ThreatTopics({
  threat,
  related,
  accent,
  summaryPoints,
}: {
  threat: CeoIssue | null;
  related: CeoIssue[];
  accent?: string;
  summaryPoints?: string[];
}) {
  const accentColor = accent ?? DEFAULT_ACCENT;
  const points =
    summaryPoints && summaryPoints.length > 0
      ? summaryPoints
      : threat?.aiLine
        ? fallbackPoints(threat.aiLine)
        : [];

  return (
    <div className="panel flex h-full flex-col overflow-hidden p-4">
      <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
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
            <span className="inline-flex items-center rounded-full border border-border/60 bg-muted/30 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
              {CATEGORY_LABEL[threat.category]}
            </span>
            <p
              data-testid="crisis-threat"
              className="mt-2 text-[clamp(1.25rem,2.8vh,1.9rem)] font-bold leading-tight text-foreground"
            >
              {threat.title}
            </p>
          </div>

          {/* Executive summary — short AI-condensed points, accented by the live crisis colour. */}
          {points.length > 0 && (
            <div
              className="mt-3 rounded-xl bg-background/40 p-3.5"
              style={{ borderLeft: `3px solid ${accentColor}`, background: withAlpha(accentColor, 0.06) }}
            >
              <h3 className="text-[9px] font-semibold uppercase tracking-[0.26em] text-muted-foreground">
                Executive Summary
              </h3>
              <ul className="mt-2 space-y-1.5">
                {points.map((pt, i) => (
                  <li key={i} className="flex gap-2 text-[12.5px] leading-snug text-muted-foreground">
                    <span
                      aria-hidden
                      className="mt-[0.45em] h-1 w-1 shrink-0 rounded-full"
                      style={{ background: accentColor }}
                    />
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* The topics that constitute the threat landscape. Type is sized up for
              the 40+ CEO audience — this is the scan-the-room reading. */}
          <h3 className="mt-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Topik pendorong
          </h3>
          <div className="mt-2.5 flex-1 space-y-2 overflow-auto scrollbar-thin pr-1">
            {related.length === 0 ? (
              <p className="text-sm text-muted-foreground/70">Tidak ada topik negatif lain.</p>
            ) : (
              related.map((t, i) => (
                <div
                  key={t.id}
                  className="flex items-start gap-3 rounded-lg border border-border/50 bg-background/40 px-3 py-2.5"
                >
                  <span className="w-5 shrink-0 text-center text-[14px] font-bold leading-snug tabular-nums text-muted-foreground">
                    {i + 1}
                  </span>
                  {/* Full title — wraps to as many lines as it needs; never truncated. */}
                  <span className="min-w-0 flex-1 text-[15px] font-medium leading-snug text-foreground">{t.title}</span>
                  <span className="shrink-0 text-right text-[12px] leading-tight text-muted-foreground">
                    <span className="block tabular-nums">{fmtReach(t.reach)}</span>
                    <span className="block font-semibold text-destructive/90 tabular-nums">{negPct(t)}% neg</span>
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
