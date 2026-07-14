import { Flame, Hash, Heart, Radio } from "lucide-react";
import type { SocialPulse as SocialPulseData } from "@/lib/jasamarga/types";
import { loadColor } from "@/lib/jasamarga/ui";
import { cn } from "@/lib/utils";

function toneClass(s?: string): string {
  return s === "negative" ? "text-destructive" : s === "positive" ? "text-success" : "text-muted-foreground";
}

/** -100..100 → the same tone vocabulary the keyword chips use. */
function sentimentTone(n: number): string {
  return n <= -20 ? "text-destructive" : n >= 20 ? "text-success" : "text-muted-foreground";
}

const fmt = (n: number) => n.toLocaleString("id-ID");

/**
 * Public-sentiment pulse. Live mode (A12 v2.0) is driven by the client's real
 * media-intelligence feed (`danantara_jasamarga` — the same topics behind
 * /bumn-v2/jasamarga): real impressions, real reach, the real sentiment split
 * and the real conversation topics. Demo mode keeps the synthetic pulse.
 */
export function SocialPulse({ data }: { data: SocialPulseData }) {
  const live = data.source === "live";
  const negColor = loadColor(data.negativity);
  const negPct = live && data.sentiment_pct ? data.sentiment_pct.negative : Math.round(data.negativity * 10);
  const trend = [...data.trend].sort((a, b) => b.count - a.count);
  const topics = data.topics ?? [];

  return (
    <div className="flex h-full flex-col gap-2">
      {/* headline metrics — real volume in live mode, synthetic mentions otherwise */}
      <div className="grid shrink-0 grid-cols-2 gap-2">
        <div className="rounded-lg border border-border/50 bg-background/40 px-2.5 py-1.5">
          <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
            {live ? "Impresi" : "Sebutan 24 jam"}
          </div>
          <div className="text-lg font-extrabold leading-tight">
            {fmt(live ? (data.impressions ?? data.mentions_24h) : data.mentions_24h)}
          </div>
          {live && data.reach != null && (
            <div className="text-[9px] text-muted-foreground">Jangkauan {fmt(data.reach)}</div>
          )}
        </div>
        <div className="rounded-lg border border-border/50 bg-background/40 px-2.5 py-1.5">
          <div className="text-[9px] uppercase tracking-wide text-muted-foreground">Sentimen negatif</div>
          <div className="text-lg font-extrabold leading-tight" style={{ color: negColor }}>
            {negPct}%
          </div>
          {live && data.sentiment_pct && (
            <div className="text-[9px] text-muted-foreground">
              <span className="text-success">{data.sentiment_pct.positive}% positif</span> ·{" "}
              {data.sentiment_pct.neutral}% netral
            </div>
          )}
        </div>
      </div>

      {/* trending keywords — synthetic pulse only; the live feed exposes topics, not keywords */}
      {!live && trend.length > 0 && (
        <div className="shrink-0">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            <Hash className="h-3 w-3 text-primary" /> Tren
          </div>
          <div className="flex flex-wrap gap-1.5">
            {trend.slice(0, 6).map((k) => (
              <span key={k.keyword} className={cn("rounded-full border border-border/60 bg-background/40 px-2 py-0.5 text-[10px] font-semibold", toneClass(k.sentiment))}>
                {k.keyword} <span className="text-muted-foreground/70">{k.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {live && (
        <div className="shrink-0 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          <Hash className="h-3 w-3 text-primary" /> Topik Teratas
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-1.5 overflow-auto scrollbar-thin pr-1">
        {live
          ? topics.map((t) => (
              <div key={t.title} className="rounded-lg border border-border/50 bg-background/40 px-2.5 py-1.5">
                <div className="flex items-start justify-between gap-2 text-[10px]">
                  <span className="line-clamp-2 font-bold leading-snug text-foreground/90">{t.title}</span>
                  <span className={cn("shrink-0 font-bold", sentimentTone(t.sentiment))}>{t.sentiment}</span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">{t.aiLine}</p>
                <div className="mt-0.5 flex items-center gap-1 text-[9px] text-muted-foreground">
                  <Radio className="h-2.5 w-2.5" /> jangkauan {fmt(t.reach)} · impresi {fmt(t.impressions)}
                </div>
              </div>
            ))
          : data.top_posts.map((p, i) => (
              <div key={i} className="rounded-lg border border-border/50 bg-background/40 px-2.5 py-1.5">
                <div className="flex items-center justify-between text-[10px]">
                  <span className={cn("font-bold", toneClass(p.sentiment))}>{p.handle}</span>
                  <span className="text-muted-foreground">{p.time}</span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-foreground/80">{p.text}</p>
                <div className="mt-0.5 flex items-center gap-1 text-[9px] text-muted-foreground">
                  <Heart className="h-2.5 w-2.5" /> {fmt(p.engagement)} · {p.platform}
                </div>
              </div>
            ))}
      </div>

      <div className="shrink-0 border-t border-border/40 pt-1.5 text-center text-[10px] text-muted-foreground">
        {live ? (
          <>
            <Radio className="mr-1 inline h-3 w-3 text-success" />
            <span className="font-semibold text-success">Live</span> · media intelligence Nexorus (topik JasaMarga)
          </>
        ) : (
          <>
            <Flame className="mr-1 inline h-3 w-3 text-warning" /> Simulasi · X / media sosial
          </>
        )}
      </div>
    </div>
  );
}
