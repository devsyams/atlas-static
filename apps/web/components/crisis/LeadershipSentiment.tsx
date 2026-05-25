"use client";

import Image from "next/image";
import { useState } from "react";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { Leader, LeadershipSentiment as LeadershipSentimentData } from "@/lib/mbg/types";
import { CRISIS_COLORS } from "@/lib/mbg/colors";
import { cn } from "@/lib/utils";

const SENT_MAX = 5;

/** Color for a 0–5 sentiment score (higher = more positive). */
function sentColor(score: number): string {
  const p = score / SENT_MAX;
  if (p >= 0.7) return CRISIS_COLORS.safe;
  if (p >= 0.45) return CRISIS_COLORS.watch;
  return CRISIS_COLORS.crisis;
}

function trendMeta(trend: string) {
  const t = (trend || "").toLowerCase();
  if (/improv|naik|membaik|up|rising/.test(t))
    return { label: "Membaik", Icon: TrendingUp, cls: "border-success/40 bg-success/10 text-success" };
  if (/declin|memburuk|turun|down|falling/.test(t))
    return {
      label: "Memburuk",
      Icon: TrendingDown,
      cls: "border-destructive/40 bg-destructive/10 text-destructive",
    };
  return { label: "Stabil", Icon: Minus, cls: "border-border bg-background/40 text-muted-foreground" };
}

/** Leader portrait from the photo field, falling back to initials on failure. */
function LeaderAvatar({ leader }: { leader: Leader }) {
  const initials = leader.name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const src = leader.photo && leader.photo.trim() ? leader.photo : null;
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-accent text-[11px] font-extrabold text-primary-foreground">
        {initials}
      </span>
    );
  }
  return (
    <Image
      src={src}
      alt={leader.name}
      width={36}
      height={36}
      unoptimized
      onError={() => setFailed(true)}
      className="h-9 w-9 shrink-0 rounded-full bg-gradient-accent object-cover"
    />
  );
}

function LeaderCard({ leader }: { leader: Leader }) {
  const { sentiment: s, prediction: p } = leader;
  const col = sentColor(s.score);
  const trend = trendMeta(s.trend);

  return (
    <div className="rounded-lg border border-border/50 bg-background/40 p-3">
      <div className="flex items-center gap-2.5">
        <LeaderAvatar leader={leader} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-bold">{leader.name}</div>
          <div className="truncate text-[10px] text-muted-foreground">
            {leader.position} · {leader.organization}
          </div>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold",
            trend.cls,
          )}
        >
          <trend.Icon className="h-2.5 w-2.5" />
          {trend.label}
        </span>
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-extrabold leading-none" style={{ color: col }}>
            {s.score.toFixed(1)}
          </span>
          <span className="text-xs text-muted-foreground">/ {SENT_MAX}</span>
        </div>
        <span className="text-[10px] text-muted-foreground">sentimen · {s.article_count} artikel</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted/40">
        <div className="h-full rounded-full" style={{ width: `${(s.score / SENT_MAX) * 100}%`, background: col }} />
      </div>

      <p className="mt-2.5 text-[11px] leading-snug text-muted-foreground">{leader.insight}</p>

      <div className="mt-2.5 rounded-md border border-border/50 bg-card/50 p-2">
        <div className="text-[10px] leading-snug text-foreground/80">{p.question}</div>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-lg font-extrabold text-primary">{p.probability}%</span>
          <span className="rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-bold text-success">
            {p.answer_label}
          </span>
        </div>
        <div className="mt-1 text-[10px] leading-snug text-muted-foreground">{p.reasoning}</div>
      </div>

      {leader.recent_articles.length > 0 && (
        <div className="mt-2.5">
          <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Liputan terbaru
          </div>
          <div className="flex flex-col gap-1.5">
            {leader.recent_articles.slice(0, 3).map((a, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <span
                  className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: sentColor(a.sentiment) }}
                />
                <div className="min-w-0">
                  <div className="truncate text-[11px] leading-snug text-foreground/85">{a.title}</div>
                  <div className="text-[9px] text-muted-foreground">
                    {a.source} · {(a.date || "").slice(0, 16)}
                    {a.crisis_score > 0 && (
                      <span className="ml-1 rounded bg-destructive/15 px-1 font-bold text-destructive">
                        krisis {a.crisis_score}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function LeadershipSentiment({ data }: { data: LeadershipSentimentData | null }) {
  if (!data || !data.leaders.length) {
    return (
      <div className="py-6 text-center text-[13px] text-muted-foreground">
        Belum ada data sentimen kepemimpinan.
      </div>
    );
  }

  const avg =
    data.leaders.reduce((sum, l) => sum + l.sentiment.score, 0) / data.leaders.length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-primary">
          ● Sentimen Kepemimpinan
        </span>
        <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {data.leaders.length} figur · rata-rata{" "}
          <span style={{ color: sentColor(avg) }} className="font-bold">
            {avg.toFixed(1)}/{SENT_MAX}
          </span>
        </span>
      </div>

      <div
        className="grid items-start gap-2"
        style={{ gridTemplateColumns: `repeat(${Math.min(data.leaders.length, 2)}, minmax(0, 1fr))` }}
      >
        {data.leaders.map((l) => (
          <LeaderCard key={l.id} leader={l} />
        ))}
      </div>
    </div>
  );
}
