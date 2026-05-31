import { Flame, Hash, Heart } from "lucide-react";
import type { SocialPulse as SocialPulseData } from "@/lib/jasamarga/types";
import { loadColor } from "@/lib/jasamarga/ui";
import { cn } from "@/lib/utils";

function toneClass(s?: string): string {
  return s === "negative" ? "text-destructive" : s === "positive" ? "text-success" : "text-muted-foreground";
}

/** Public-sentiment pulse from social monitoring (X). The MBG-style OSINT core. */
export function SocialPulse({ data }: { data: SocialPulseData }) {
  const negColor = loadColor(data.negativity);
  const negPct = Math.round(data.negativity * 10);
  const trend = [...data.trend].sort((a, b) => b.count - a.count);

  return (
    <div className="flex h-full flex-col gap-2">
      {/* headline metrics */}
      <div className="grid shrink-0 grid-cols-2 gap-2">
        <div className="rounded-lg border border-border/50 bg-background/40 px-2.5 py-1.5">
          <div className="text-[9px] uppercase tracking-wide text-muted-foreground">Sebutan 24 jam</div>
          <div className="text-lg font-extrabold leading-tight">{data.mentions_24h.toLocaleString("id-ID")}</div>
        </div>
        <div className="rounded-lg border border-border/50 bg-background/40 px-2.5 py-1.5">
          <div className="text-[9px] uppercase tracking-wide text-muted-foreground">Sentimen negatif</div>
          <div className="text-lg font-extrabold leading-tight" style={{ color: negColor }}>
            {negPct}%
          </div>
        </div>
      </div>

      {/* trending */}
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

      {/* top posts */}
      <div className="min-h-0 flex-1 space-y-1.5 overflow-auto scrollbar-thin pr-1">
        {data.top_posts.map((p, i) => (
          <div key={i} className="rounded-lg border border-border/50 bg-background/40 px-2.5 py-1.5">
            <div className="flex items-center justify-between text-[10px]">
              <span className={cn("font-bold", toneClass(p.sentiment))}>{p.handle}</span>
              <span className="text-muted-foreground">{p.time}</span>
            </div>
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-foreground/80">{p.text}</p>
            <div className="mt-0.5 flex items-center gap-1 text-[9px] text-muted-foreground">
              <Heart className="h-2.5 w-2.5" /> {p.engagement.toLocaleString("id-ID")} · {p.platform}
            </div>
          </div>
        ))}
      </div>

      <div className="shrink-0 border-t border-border/40 pt-1.5 text-center text-[10px] text-muted-foreground">
        <Flame className="mr-1 inline h-3 w-3 text-warning" /> Dipantau real-time dari X / media sosial
      </div>
    </div>
  );
}
