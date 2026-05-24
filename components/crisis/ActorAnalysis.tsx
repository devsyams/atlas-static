"use client";

import Image from "next/image";
import { useState } from "react";
import type { ActorThreadAnalysis, SocialActor } from "@/lib/mbg/types";
import { cn } from "@/lib/utils";

const RISK_RANK: Record<string, number> = { critical: 3, high: 2, moderate: 1, low: 0 };
const RISK_CHIP: Record<string, string> = {
  critical: "border-destructive/50 bg-destructive/15 text-destructive",
  high: "border-destructive/40 bg-destructive/10 text-destructive",
  moderate: "border-warning/40 bg-warning/10 text-warning",
  low: "border-success/40 bg-success/10 text-success",
};
const RISK_LABEL: Record<string, string> = {
  critical: "Risiko Kritis",
  high: "Risiko Tinggi",
  moderate: "Risiko Sedang",
  low: "Risiko Rendah",
};

function fmt(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K`;
  return String(n);
}

function sentimentMeta(s: number) {
  if (s < -0.1) return { label: "Negatif", cls: "text-destructive", dot: "bg-destructive" };
  if (s > 0.1) return { label: "Positif", cls: "text-success", dot: "bg-success" };
  return { label: "Netral", cls: "text-muted-foreground", dot: "bg-muted-foreground" };
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/40 bg-background/40 px-2 py-1.5 text-center">
      <div className="text-[15px] font-bold tabular-nums">{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

/** Profile picture via the unavatar proxy, falling back to initials on failure. */
function Avatar({ a }: { a: SocialActor }) {
  const initials = (a.name || a.handle).slice(0, 2).toUpperCase();
  const src = a.avatar && a.avatar.trim() ? a.avatar : null;
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-accent text-sm font-extrabold text-primary-foreground">
        {initials}
      </span>
    );
  }
  return (
    <Image
      src={src}
      alt={`@${a.handle}`}
      width={48}
      height={48}
      unoptimized
      onError={() => setFailed(true)}
      className="h-12 w-12 shrink-0 rounded-full bg-gradient-accent object-cover"
    />
  );
}

function ActorCard({ a }: { a: SocialActor }) {
  const risk = (a.risk_level || "low").toLowerCase();
  const sent = sentimentMeta(a.sentiment);
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border/50 bg-background/40 p-3.5">
      <div className="flex shrink-0 items-center gap-2.5">
        <Avatar a={a} />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-bold">@{a.handle}</span>
            <span className="shrink-0 rounded-full border border-border bg-background/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
              {a.platform}
            </span>
          </div>
          <div className="truncate text-[11px] text-muted-foreground">{a.name}</div>
        </div>
        <span
          className={cn(
            "ml-auto shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold",
            RISK_CHIP[risk] ?? RISK_CHIP.low,
          )}
        >
          {RISK_LABEL[risk] ?? risk}
        </span>
      </div>

      <div className="mt-3 grid shrink-0 grid-cols-4 gap-2">
        <Metric label="Pengikut" value={fmt(a.followers)} />
        <Metric label="Influence" value={`${a.influence}/10`} />
        <Metric label="Kredibilitas" value={`${a.credibility}/10`} />
        <Metric label="Engage" value={fmt(a.total_engagement)} />
      </div>

      <div className="mt-3 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className={cn("flex items-center gap-1 font-bold", sent.cls)}>
          <span className={cn("h-1.5 w-1.5 rounded-full", sent.dot)} />
          {sent.label} ({a.sentiment.toFixed(1)})
        </span>
        <span>{a.posts_7d} post/7h</span>
        <span>{a.brand_mentions} sebut MBG</span>
      </div>

      {a.themes.length > 0 && (
        <div className="mt-3 flex shrink-0 flex-wrap gap-1.5">
          {a.themes.slice(0, 4).map((t) => (
            <span
              key={t}
              className="rounded-full border border-border bg-background/40 px-2 py-0.5 text-[10px] text-muted-foreground"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      <p className="mt-3 line-clamp-3 text-[12px] leading-relaxed text-foreground/80">
        {a.influence_analysis || a.brand_summary}
      </p>

      {a.recommended_actions && (
        <div className="mt-auto shrink-0 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-2 text-[11px] leading-snug text-primary">
          <strong>Tindakan:</strong> {a.recommended_actions}
        </div>
      )}
    </div>
  );
}

export function ActorAnalysis({ data }: { data: ActorThreadAnalysis | null }) {
  if (!data || !data.actors.length) {
    return (
      <div className="py-6 text-center text-[13px] text-muted-foreground">
        Belum ada aktor yang dipantau.
      </div>
    );
  }

  const actors = [...data.actors].sort(
    (x, y) =>
      (RISK_RANK[(y.risk_level || "low").toLowerCase()] ?? 0) -
        (RISK_RANK[(x.risk_level || "low").toLowerCase()] ?? 0) ||
      x.sentiment - y.sentiment ||
      y.influence - x.influence,
  );
  // Derive the tally from the actors actually shown (data.summary can be stale).
  const r: Record<string, number> = { critical: 0, high: 0, moderate: 0, low: 0 };
  const byPlatform: Record<string, number> = {};
  for (const a of actors) {
    const rk = (a.risk_level || "low").toLowerCase();
    r[rk] = (r[rk] ?? 0) + 1;
    byPlatform[a.platform] = (byPlatform[a.platform] ?? 0) + 1;
  }
  const platforms = Object.entries(byPlatform)
    .map(([p, n]) => `${n} ${p}`)
    .join(" · ");

  const cols = Math.min(actors.length, 3);
  const rows = Math.ceil(actors.length / cols);

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-primary">
            ● Aktor &amp; Sentimen
          </span>
          <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            {actors.length} aktor dipantau{platforms ? ` · ${platforms}` : ""}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
          <RiskTally label="Kritis" n={r.critical ?? 0} cls="text-destructive" />
          <RiskTally label="Tinggi" n={r.high ?? 0} cls="text-destructive" />
          <RiskTally label="Sedang" n={r.moderate ?? 0} cls="text-warning" />
          <RiskTally label="Rendah" n={r.low ?? 0} cls="text-success" />
        </div>
      </div>

      <div
        className="grid min-h-0 flex-1 gap-3"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
        }}
      >
        {actors.map((a) => (
          <ActorCard key={a.handle} a={a} />
        ))}
      </div>
    </div>
  );
}

function RiskTally({ label, n, cls }: { label: string; n: number; cls: string }) {
  return (
    <span className="rounded-full border border-border/60 bg-background/40 px-2 py-0.5 text-muted-foreground">
      <span className={cn("font-bold tabular-nums", cls)}>{n}</span> {label}
    </span>
  );
}
