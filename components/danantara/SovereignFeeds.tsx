import {
  AtSign,
  BadgeCheck,
  Banknote,
  Globe,
  LineChart,
  Newspaper,
  Landmark,
  type LucideIcon,
} from "lucide-react";
import type {
  DividendContributor,
  FinSourceType,
  NewsArticle,
  OfficialPost,
  SocialPulse,
  SourceFeed,
} from "@/lib/danantara/types";
import { fmtT, SECTOR_COLOR } from "@/lib/danantara/ui";
import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------- Sources */

const SRC_ICON: Record<FinSourceType, LucideIcon> = {
  bursa: LineChart,
  valas: Globe,
  komoditas: Banknote,
  medsos: AtSign,
  berita: Newspaper,
  resmi: BadgeCheck,
  makro: Landmark,
};

const SRC_DOT: Record<SourceFeed["status"], string> = {
  live: "bg-success",
  delay: "bg-warning",
  down: "bg-destructive",
  demo: "bg-muted-foreground/50",
};

const SRC_LABEL: Record<SourceFeed["status"], string> = {
  live: "live",
  delay: "tertunda",
  down: "mati",
  demo: "demo",
};

export function SourceStrip({ sources }: { sources: SourceFeed[] }) {
  const live = sources.filter((s) => s.status === "live").length;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        Sumber Data
        <span className="rounded-full border border-success/40 bg-success/10 px-1.5 py-0.5 text-[9px] text-success">
          {live}/{sources.length} aktif
        </span>
      </span>
      <div className="flex flex-1 flex-wrap items-center gap-1.5">
        {sources.map((s) => {
          const Icon = SRC_ICON[s.type];
          return (
            <span
              key={s.name}
              title={`${s.items_24h.toLocaleString("id-ID")} sinyal / 24 jam · sinkron ${s.last_sync}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/40 px-2 py-1 text-[10px]"
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", SRC_DOT[s.status], s.status === "live" && "animate-pulse")} />
              <Icon className="h-3 w-3 text-foreground/70" />
              <span className="font-semibold">{s.name}</span>
              <span className="text-muted-foreground/70">· {SRC_LABEL[s.status]}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- Dividends */

export function DividendBoard({ dividends, ytd }: { dividends: DividendContributor[]; ytd: number }) {
  const max = Math.max(...dividends.map((d) => d.amount_t), 1);
  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex shrink-0 items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Setoran ke induk dana</span>
        <span className="text-[12px] font-extrabold text-success">{fmtT(ytd)} YTD</span>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-auto scrollbar-thin">
        {dividends.map((d) => (
          <div key={d.name}>
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: SECTOR_COLOR[d.sector] }} />
                <span className="truncate font-semibold">{d.name.split("(")[0].trim()}</span>
              </span>
              <span className="shrink-0 font-bold tabular-nums">{fmtT(d.amount_t)}</span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-background/60">
                <div
                  className="h-full rounded-full transition-[width] duration-700"
                  style={{ width: `${(d.amount_t / max) * 100}%`, background: SECTOR_COLOR[d.sector] }}
                />
              </div>
              <span className="w-12 shrink-0 text-right text-[9px] text-muted-foreground">yield {d.yield_pct}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- Social */

const SENT_COLOR: Record<"negative" | "neutral" | "positive", string> = {
  negative: "text-destructive",
  neutral: "text-muted-foreground",
  positive: "text-success",
};

export function SocialPulsePanel({ data }: { data: SocialPulse }) {
  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex shrink-0 items-center justify-between rounded-md border border-border/50 bg-background/40 px-2.5 py-1.5">
        <div>
          <div className="text-[9px] uppercase tracking-wide text-muted-foreground">Sebutan 24 jam</div>
          <div className="text-[15px] font-extrabold tabular-nums">{data.mentions_24h.toLocaleString("id-ID")}</div>
        </div>
        <div className="text-right">
          <div className="text-[9px] uppercase tracking-wide text-muted-foreground">Sentimen positif</div>
          <div className="text-[15px] font-extrabold text-success">{Math.round(data.positivity * 10)}%</div>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap gap-1">
        {data.trend.slice(0, 6).map((t) => (
          <span
            key={t.keyword}
            className={cn(
              "rounded-full border border-border/50 bg-background/40 px-2 py-0.5 text-[10px] font-semibold",
              SENT_COLOR[t.sentiment ?? "neutral"],
            )}
          >
            {t.keyword}
          </span>
        ))}
      </div>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-auto scrollbar-thin">
        {data.top_posts.map((p) => (
          <div key={p.handle + p.time} className="rounded-md border border-border/40 bg-background/30 px-2.5 py-1.5">
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-bold text-primary">{p.handle}</span>
              <span className="text-muted-foreground">{p.time}</span>
            </div>
            <p className="mt-0.5 text-[11px] leading-snug text-foreground/85">{p.text}</p>
            <div className="mt-1 text-[9px] text-muted-foreground">
              {p.platform} · {p.engagement.toLocaleString("id-ID")} interaksi
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- News */

export function NewsCoverage({ articles }: { articles: NewsArticle[] }) {
  return (
    <div className="space-y-2">
      {articles.map((a) => {
        const neg = a.sentiment >= 6;
        return (
          <div key={a.title} className="rounded-md border border-border/40 bg-background/30 px-2.5 py-2">
            <div className="flex items-start gap-2">
              <span
                className={cn(
                  "mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full",
                  neg ? "bg-destructive" : a.sentiment >= 4 ? "bg-warning" : "bg-success",
                )}
              />
              <div className="min-w-0">
                <div className="text-[12px] font-semibold leading-snug">{a.title}</div>
                <p className="mt-0.5 text-[10.5px] leading-snug text-muted-foreground">{a.summary}</p>
                <div className="mt-1 text-[9px] text-muted-foreground/70">
                  {a.source} · {a.time}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------------- Official */

export function OfficialFeed({ posts }: { posts: OfficialPost[] }) {
  return (
    <div className="space-y-2">
      {posts.map((o) => (
        <div key={o.title} className="rounded-md border border-border/40 bg-background/30 px-2.5 py-2">
          <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wide">
            <BadgeCheck className="h-3 w-3 text-primary" />
            <span className="text-primary">{o.category}</span>
            <span className="text-muted-foreground/70">· {o.time}</span>
          </div>
          <div className="mt-1 text-[12px] font-semibold leading-snug">{o.title}</div>
          <p className="mt-0.5 text-[10.5px] leading-snug text-muted-foreground">{o.body}</p>
        </div>
      ))}
    </div>
  );
}
