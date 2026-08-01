"use client";

import { useState } from "react";
import { Bot, ShieldAlert, UserRound, Users } from "lucide-react";
import type { ThreatDriver } from "@/lib/danantara/ceo/threats-source";
import { cn } from "@/lib/utils";

/** Risk chip per level — how dangerous this account is to the narrative. */
const RISK_META: Record<string, { label: string; cls: string; dot: string }> = {
  high: { label: "Risiko tinggi", cls: "border-destructive/40 bg-destructive/10 text-destructive", dot: "bg-destructive" },
  medium: { label: "Risiko sedang", cls: "border-warning/40 bg-warning/10 text-warning", dot: "bg-warning" },
  low: { label: "Risiko rendah", cls: "border-border bg-muted/30 text-muted-foreground", dot: "bg-muted-foreground" },
};

function initials(handle: string) {
  return handle.replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase() || "?";
}

/** Compact Indonesian audience size: 3.1 jt · 880 rb. */
function fmtFollowers(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} jt`;
  if (n >= 1e3) return `${Math.round(n / 1e3)} rb`;
  return String(n);
}

/** Avatar — the roster fallback carries a real (base64) image; `/threats` posts don't,
 *  so it falls back to a coloured initials tile (also on image load error). */
function Avatar({ handle, avatarUrl }: { handle: string; avatarUrl?: string }) {
  const [failed, setFailed] = useState(false);
  if (avatarUrl && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- base64 data-URI avatar; next/image adds no value
      <img
        src={avatarUrl}
        alt={handle}
        loading="lazy"
        onError={() => setFailed(true)}
        className="h-12 w-12 shrink-0 rounded-lg object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-sm font-extrabold text-white"
      style={{ backgroundColor: "oklch(0.52 0.19 264)" }}
    >
      {initials(handle)}
    </span>
  );
}

/** One compact driver card — used in both the Human and Bot bands. */
function DriverCard({ d }: { d: ThreatDriver }) {
  const rm = RISK_META[d.riskLevel] ?? RISK_META.low;
  return (
    <div className={cn("rounded-2xl border bg-background/40 p-3.5", d.bot ? "border-warning/40" : "border-border/50")}>
      <div className="flex items-start gap-3">
        <Avatar handle={d.handle} avatarUrl={d.avatarUrl} />
        <div className="min-w-0 flex-1">
          {/* Long usernames wrap to a new line rather than truncating with an ellipsis. */}
          <span className="block break-words text-lg font-bold leading-tight text-foreground">@{d.handle}</span>
          {d.platform && <div className="truncate text-sm capitalize text-muted-foreground">{d.platform}</div>}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm font-medium">
        <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1", rm.cls)}>
          <span className={cn("h-2 w-2 rounded-full", rm.dot)} />
          {rm.label}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/30 px-2.5 py-1 text-muted-foreground">
          <ShieldAlert className="h-4 w-4" /> Kredibilitas {d.credibility}/10
        </span>
      </div>

      <div className="mt-2.5 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Users className="h-4 w-4 shrink-0" />
        <span className="font-semibold tabular-nums text-foreground/80">{fmtFollowers(d.followers)}</span>
        <span>pengikut</span>
      </div>

      {d.note && <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{d.note}</p>}

      {d.bot && (
        <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-warning/40 bg-warning/10 px-2.5 py-1 text-sm font-semibold text-warning">
          <Bot className="h-4 w-4" /> Provokator / bot
        </div>
      )}
    </div>
  );
}

function SectionLabel({ icon: Icon, label, count, tone }: { icon: typeof UserRound; label: string; count: number; tone: "muted" | "warning" }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 text-sm font-bold uppercase tracking-wide",
        tone === "warning" ? "text-warning" : "text-muted-foreground",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
      <span className="opacity-70">({count})</span>
    </div>
  );
}

function EmptyState({ children }: { children: string }) {
  return <p className="text-sm text-muted-foreground/70">{children}</p>;
}

/**
 * Right column of the Crisis Gate (A10 v5.0, v5.2) — the accounts to watch. When a
 * threat is detected, these are its **real drivers** (from `/threats`); in calm periods
 * they fall back to the always-populated **`/actor-intelligence` roster** (A10 v5.2), so
 * the column never goes blank. Either way the roster is split **top = human/org accounts,
 * bottom = coordinated provocateur/bot accounts** (by classification).
 * The `caption` says which read it is.
 */
export function ThreatActors({
  drivers,
  caption,
  loading,
}: {
  drivers: ThreatDriver[];
  caption: string;
  loading?: boolean;
}) {
  // Show the two strongest of each kind — a balanced 2 human + 2 bot read.
  const humans = drivers.filter((d) => !d.bot).slice(0, 2);
  const bots = drivers.filter((d) => d.bot).slice(0, 2);
  const shown = humans.length + bots.length;

  return (
    // On lg the three columns share one auto-sized grid row, so a tall column stretches
    // the whole row and drags the vertically-centred Crisis meter down with it. The inner
    // wrapper goes `absolute inset-0` at lg, so this panel contributes **zero** height to
    // the row (its height comes purely from the sibling columns via align-items: stretch)
    // and the roster scrolls inside instead. Below lg the columns stack, so it stays in
    // normal flow and grows with its content (the page scrolls, A13).
    <div className="panel relative flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col p-5 lg:absolute lg:inset-0">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="flex items-center gap-2.5 text-[clamp(1.45rem,2.9vh,2.35rem)] font-bold text-foreground">
            <UserRound className="h-[1.1em] w-[1.1em] text-muted-foreground" />
            Aktor Penggerak
          </h2>
          {!loading && shown > 0 && (
            <span className="shrink-0 rounded-full border border-border/60 bg-muted/20 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {shown} akun
            </span>
          )}
        </div>
        <p className="mt-1 text-[11px] uppercase tracking-[0.24em] text-muted-foreground/70">{caption}</p>

        {loading ? (
          <p className="mt-4 text-sm text-muted-foreground">Memuat aktor…</p>
        ) : drivers.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Belum ada aktor penggerak teridentifikasi.</p>
        ) : (
          <div className="mt-4 min-h-0 flex-1 overflow-auto scrollbar-thin pr-1">
            <div className="overflow-hidden rounded-3xl border border-border/60 bg-background/20 shadow-sm">
              <section className="border-b border-border/60 px-4 py-4 md:px-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <SectionLabel icon={UserRound} label="Human Actor" count={humans.length} tone="muted" />
                </div>
                <div className="space-y-3.5">
                  {humans.length === 0 ? (
                    <EmptyState>—</EmptyState>
                  ) : (
                    humans.map((d) => <DriverCard key={d.handle} d={d} />)
                  )}
                </div>
              </section>

              <section className="px-4 py-4 md:px-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <SectionLabel icon={Bot} label="Bot Actor" count={bots.length} tone="warning" />
                </div>
                <div className="space-y-3.5">
                  {bots.length === 0 ? (
                    <EmptyState>Tidak ada akun terindikasi.</EmptyState>
                  ) : (
                    bots.map((d) => <DriverCard key={d.handle} d={d} />)
                  )}
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
