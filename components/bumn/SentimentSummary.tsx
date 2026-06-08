import { BarChart3, Eye, Minus, ThumbsDown, ThumbsUp } from "lucide-react";
import { fmtCount } from "@/lib/danantara/ceo/format";

interface Pct {
  positive: number;
  negative: number;
  neutral: number;
}

type Tone = "positive" | "negative" | "neutral";

const TONE = {
  positive: { label: "Positive", text: "text-success", bar: "bg-success", soft: "border-success/40 bg-success/10", Icon: ThumbsUp },
  neutral: { label: "Neutral", text: "text-muted-foreground", bar: "bg-muted-foreground/45", soft: "border-border bg-muted/10", Icon: Minus },
  negative: { label: "Negative", text: "text-destructive", bar: "bg-destructive", soft: "border-destructive/40 bg-destructive/10", Icon: ThumbsDown },
} as const;

export interface Driver {
  title: string;
  reach: number;
}

/**
 * Sentiment summary (A8 v2.2) — a CEO-glanceable read that replaces the 3-slice
 * donut: a hero band pairing the dominant-sentiment verdict with the feed's
 * total impressions/reach as bold KPI tiles (scale reads next to feeling), a
 * segmented bar + legend, then a **Key Drivers** block naming the loudest
 * negative and positive topic — the "why" behind the verdict. Readable type for
 * 40–60 y/o (≥16px).
 */
export function SentimentSummary({
  percentage,
  totalImpressions,
  totalReach,
  drivers,
}: {
  percentage: Pct;
  totalImpressions: number;
  totalReach: number;
  drivers?: { negative?: Driver; positive?: Driver };
}) {
  const rows: { tone: Tone; pct: number }[] = [
    { tone: "positive", pct: percentage.positive },
    { tone: "neutral", pct: percentage.neutral },
    { tone: "negative", pct: percentage.negative },
  ];
  const dominant = [...rows].sort((a, b) => b.pct - a.pct)[0];
  const dom = TONE[dominant.tone];
  const DomIcon = dom.Icon;

  return (
    <div data-testid="sentiment-summary" className="space-y-4">
      {/* Hero band: dominant verdict (feeling) + scale KPIs to its right. */}
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-stretch">
        <div data-testid="sentiment-verdict" className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${dom.soft}`}>
          <DomIcon className={`h-8 w-8 shrink-0 ${dom.text}`} />
          <div className="leading-tight">
            <div className={`text-3xl font-extrabold ${dom.text}`}>
              {dom.label} <span className="tabular-nums">{Math.round(dominant.pct)}%</span>
            </div>
            <div className="text-base text-muted-foreground">Overall public sentiment</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:w-[19rem]">
          <Kpi icon={BarChart3} label="Impressions" value={fmtCount(totalImpressions)} title="Total views across all posts in this window" />
          <Kpi icon={Eye} label="Reach" value={fmtCount(totalReach)} title="Unique users exposed in this window" />
        </div>
      </div>

      {/* Segmented bar. */}
      <div className="flex h-5 w-full overflow-hidden rounded-full bg-muted/30">
        {rows.map((r) => (
          <span key={r.tone} className={`h-full ${TONE[r.tone].bar}`} style={{ width: `${r.pct}%` }} />
        ))}
      </div>

      {/* Legend. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-lg">
        {rows.map((r) => {
          const t = TONE[r.tone];
          return (
            <span key={r.tone} className={`flex items-center gap-1.5 font-semibold tabular-nums ${t.text}`}>
              <span className={`h-3 w-3 rounded-full ${t.bar}`} /> {t.label} {Math.round(r.pct)}%
            </span>
          );
        })}
      </div>

      {/* Key drivers — the loudest story behind the verdict (the "why"). */}
      {(drivers?.negative || drivers?.positive) && (
        <div data-testid="sentiment-drivers" className="space-y-2.5 border-t border-border/50 pt-3.5">
          <div className="text-base font-semibold uppercase tracking-[0.14em] text-muted-foreground">Key Drivers</div>
          {drivers.negative && <DriverRow tone="negative" label="Top negative" driver={drivers.negative} />}
          {drivers.positive && <DriverRow tone="positive" label="Top positive" driver={drivers.positive} />}
        </div>
      )}
    </div>
  );
}

/** One key-driver row: tone icon, the topic title, and its reach. */
function DriverRow({ tone, label, driver }: { tone: "negative" | "positive"; label: string; driver: Driver }) {
  const t = TONE[tone];
  const Icon = t.Icon;
  return (
    <div data-testid={`driver-${tone}`} className="flex items-start gap-2.5">
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${t.text}`} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-base font-semibold text-foreground" title={driver.title}>
          {driver.title}
        </div>
        <div className="text-base text-muted-foreground">
          {label} · <span className="font-mono tabular-nums">{fmtCount(driver.reach)}</span> reach
        </div>
      </div>
    </div>
  );
}

/** A highlighted scale metric — bordered tile, big mono number, captioned. */
function Kpi({
  icon: Icon,
  label,
  value,
  title,
}: {
  icon: typeof BarChart3;
  label: string;
  value: string;
  title: string;
}) {
  return (
    <div
      title={title}
      className="flex flex-col justify-center rounded-lg border border-border/70 bg-card/40 px-4 py-3"
    >
      <div className="flex items-center gap-1.5 text-base font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-4 w-4 shrink-0 text-primary/70" /> {label}
      </div>
      <div className="mt-0.5 font-mono text-3xl font-extrabold tabular-nums text-foreground">{value}</div>
    </div>
  );
}
