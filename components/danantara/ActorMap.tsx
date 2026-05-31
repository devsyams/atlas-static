import { Building2, Megaphone, UserRound, LineChart, BadgeCheck } from "lucide-react";
import type { MediaActor } from "@/lib/danantara/types";
import { cn } from "@/lib/utils";

const TYPE_META: Record<MediaActor["type"], { label: string; Icon: typeof Building2 }> = {
  media: { label: "Media", Icon: Building2 },
  influencer: { label: "Influencer", Icon: Megaphone },
  analis: { label: "Analis", Icon: LineChart },
  resmi: { label: "Resmi", Icon: BadgeCheck },
};

const STANCE: Record<MediaActor["stance"], { label: string; cls: string; dot: string }> = {
  positive: { label: "Positif", cls: "text-success", dot: "bg-success" },
  neutral: { label: "Netral", cls: "text-muted-foreground", dot: "bg-muted-foreground" },
  negative: { label: "Negatif", cls: "text-destructive", dot: "bg-destructive" },
};

function fmtReach(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} jt`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)} rb`;
  return String(n);
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

/** Key actors shaping the Danantara/BUMN narrative — reach, influence, stance. */
export function ActorMap({ actors }: { actors: MediaActor[] }) {
  const sorted = [...actors].sort((a, b) => b.influence - a.influence);
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {sorted.map((a) => {
        const tm = TYPE_META[a.type];
        const st = STANCE[a.stance];
        return (
          <div key={a.handle} className="flex flex-col rounded-lg border border-border/50 bg-background/40 p-2.5">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-accent text-[11px] font-extrabold text-primary-foreground">
                {initials(a.name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[12px] font-bold">@{a.handle}</span>
                  <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-border/60 bg-muted/30 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-muted-foreground">
                    <tm.Icon className="h-2.5 w-2.5" /> {tm.label}
                  </span>
                </div>
                <div className="truncate text-[10px] text-muted-foreground">{a.name} · {a.platform}</div>
              </div>
              <span className={cn("flex shrink-0 items-center gap-1 text-[10px] font-bold", st.cls)}>
                <span className={cn("h-1.5 w-1.5 rounded-full", st.dot)} /> {st.label}
              </span>
            </div>

            <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
              <Metric label="Jangkauan" value={fmtReach(a.reach)} />
              <Metric label="Influence" value={`${a.influence}/10`} />
              <Metric label="Kredibilitas" value={`${a.credibility}/10`} />
            </div>

            <p className="mt-2 text-[10.5px] leading-snug text-muted-foreground">{a.note}</p>
            <div className="mt-1 text-[9px] text-muted-foreground/70">{a.posts_7d} post/7h · {a.mentions} sebut Danantara</div>
          </div>
        );
      })}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/40 bg-background/40 py-1">
      <div className="text-[13px] font-bold leading-none tabular-nums">{value}</div>
      <div className="mt-0.5 text-[8px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}
