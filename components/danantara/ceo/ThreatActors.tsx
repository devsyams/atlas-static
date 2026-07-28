"use client";

import { Bot, ShieldAlert, ShieldCheck, UserRound, Users } from "lucide-react";
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

/** The `/threats` payload carries no avatar → a coloured initials tile. */
function Avatar({ handle }: { handle: string }) {
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

/** One compact driver card — used in both the Manusia and Provokator/Bot columns. */
function DriverCard({ d }: { d: ThreatDriver }) {
  const rm = RISK_META[d.riskLevel] ?? RISK_META.low;
  return (
    <div className={cn("rounded-2xl border bg-background/40 p-3.5", d.bot ? "border-warning/40" : "border-border/50")}>
      <div className="flex items-center gap-3">
        <Avatar handle={d.handle} />
        <div className="min-w-0 flex-1">
          <span className="block truncate text-lg font-bold text-foreground">@{d.handle}</span>
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

      {d.note && <p className="mt-2 line-clamp-2 text-xs leading-snug text-muted-foreground/80">{d.note}</p>}

      {d.bot && (
        <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-warning/40 bg-warning/10 px-2.5 py-1 text-sm font-semibold text-warning">
          <Bot className="h-4 w-4" /> Provokator / bot
        </div>
      )}
    </div>
  );
}

/** A labelled column header — "Manusia (N)" / "Provokator/Bot (N)". */
function ColumnHeader({ icon: Icon, label, count, tone }: { icon: typeof Bot; label: string; count: number; tone: "muted" | "warning" }) {
  return (
    <div
      className={cn(
        "mb-2.5 flex items-center gap-2 text-sm font-bold uppercase tracking-wide",
        tone === "warning" ? "text-warning" : "text-muted-foreground",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
      <span className="opacity-70">({count})</span>
    </div>
  );
}

/** Truncate a long threat title for the subheader. */
function short(title: string, max = 48): string {
  return title.length > max ? `${title.slice(0, max - 1).trimEnd()}…` : title;
}

/**
 * Right column of the Crisis Gate (A10 v5.0) — the **real accounts driving the top
 * detected threat**, from the OpenGate `/threats` feed (`top_impact_posts` →
 * `actor_intelligence`). The roster is split **left = genuine human/org accounts,
 * right = coordinated provocateur/bot accounts** (by `account_type`), so the
 * human-vs-amplifier distinction is the layout itself. Each card reads who they are
 * (@handle · platform · followers), their risk + credibility, and a one-line AI read.
 */
export function ThreatActors({
  drivers,
  threatTitle,
  loading,
}: {
  drivers: ThreatDriver[];
  threatTitle: string | null;
  loading?: boolean;
}) {
  // Show the two strongest of each kind — a balanced 2 human + 2 bot read.
  const humans = drivers.filter((d) => !d.bot).slice(0, 2);
  const bots = drivers.filter((d) => d.bot).slice(0, 2);
  const shown = humans.length + bots.length;

  return (
    <div className="panel flex h-full flex-col overflow-hidden p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2.5 text-[clamp(1.5rem,3vh,2.5rem)] font-bold text-foreground">
          <UserRound className="h-[1.1em] w-[1.1em] text-muted-foreground" />
          Aktor Penggerak
        </h2>
        {!loading && shown > 0 && (
          <span className="shrink-0 text-sm font-medium text-muted-foreground">{shown} akun</span>
        )}
      </div>
      <p className="mt-0.5 truncate text-sm text-muted-foreground">
        {threatTitle ? `Penggerak · ${short(threatTitle)}` : "Penggerak ancaman utama"}
      </p>

      {loading ? (
        <p className="mt-3 text-sm text-muted-foreground">Memuat aktor…</p>
      ) : drivers.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Belum ada aktor penggerak teridentifikasi.</p>
      ) : (
        <div className="mt-3 flex-1 overflow-auto scrollbar-thin pr-1">
          <div className="grid grid-cols-2 gap-3">
            {/* Left — genuine human / organisation accounts. */}
            <div>
              <ColumnHeader icon={ShieldCheck} label="Manusia" count={humans.length} tone="muted" />
              <div className="space-y-3">
                {humans.length === 0 ? (
                  <p className="text-sm text-muted-foreground/70">—</p>
                ) : (
                  humans.map((d) => <DriverCard key={d.handle} d={d} />)
                )}
              </div>
            </div>

            {/* Right — coordinated provocateur / bot accounts. */}
            <div>
              <ColumnHeader icon={Bot} label="Provokator/Bot" count={bots.length} tone="warning" />
              <div className="space-y-3">
                {bots.length === 0 ? (
                  <p className="text-sm text-muted-foreground/70">Tidak ada akun terindikasi.</p>
                ) : (
                  bots.map((d) => <DriverCard key={d.handle} d={d} />)
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
