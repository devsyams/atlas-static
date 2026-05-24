import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { ActorThreadAnalysis, CrisisActor } from "@/lib/mbg/types";
import { cn } from "@/lib/utils";

const STANCE: Record<string, string> = {
  Kritis: "border-destructive/40 bg-destructive/10 text-destructive",
  Mendukung: "border-success/40 bg-success/10 text-success",
  Netral: "border-border bg-background/40 text-muted-foreground",
};

function TrendIcon({ trend }: { trend: CrisisActor["trend"] }) {
  if (trend === "up") return <TrendingUp className="h-3 w-3 text-destructive" />;
  if (trend === "down") return <TrendingDown className="h-3 w-3 text-success" />;
  return <Minus className="h-3 w-3 text-muted-foreground" />;
}

export function ActorAnalysis({ data }: { data: ActorThreadAnalysis | null }) {
  if (!data) {
    return (
      <div className="py-6 text-center text-[13px] text-muted-foreground">
        Analisis aktor belum tersedia.
      </div>
    );
  }

  const postureHot = /tinggi|kritis|krisis|elevated|high/i.test(data.posture);

  return (
    <div className="flex h-full flex-col gap-3">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.14em]",
              postureHot
                ? "border-destructive/40 bg-destructive/10 text-destructive"
                : "border-warning/40 bg-warning/10 text-warning",
            )}
          >
            ▲ {data.posture}
          </span>
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Analisis Aktor &amp; Narasi
          </span>
        </div>
        <div className="mt-2 text-sm font-extrabold leading-snug">{data.headline}</div>
        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{data.summary}</p>
      </div>

      <div className="grid gap-2 lg:grid-cols-2">
        {data.actors.map((a, i) => (
          <div key={a.name} className="rounded-lg border border-border/50 bg-background/40 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-extrabold text-primary">
                  {i + 1}
                </span>
                <span className="truncate text-xs font-bold">{a.name}</span>
                <span className="shrink-0 rounded-full border border-border bg-background/40 px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">
                  {a.type}
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold",
                    STANCE[a.stance] ?? STANCE.Netral,
                  )}
                >
                  {a.stance}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <TrendIcon trend={a.trend} />
                <span className="text-[10px] tabular-nums text-muted-foreground">{a.mentions}×</span>
              </div>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted/40">
                <div
                  className="h-full rounded-full bg-gradient-accent"
                  style={{ width: `${a.influence}%` }}
                />
              </div>
              <span className="w-[5.5rem] shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
                infl {a.influence} · {a.share}%
              </span>
            </div>

            <div className="mt-2 text-[11px] font-medium leading-snug text-foreground/85">
              {a.narrative}
            </div>
            <div className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
              ↳ {a.implication}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-[11px] leading-relaxed text-primary">
        <strong>Rekomendasi:</strong> {data.recommendation}
      </div>
    </div>
  );
}
