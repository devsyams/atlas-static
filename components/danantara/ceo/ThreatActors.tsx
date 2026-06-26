"use client";

import { useState } from "react";
import { Building2, Megaphone, UserRound, LineChart, BadgeCheck, Bot, ShieldCheck, Users } from "lucide-react";
import type { MediaActor } from "@/lib/danantara/types";
import type { IssueCategory } from "@/lib/danantara/ceo/types";
import { CATEGORY_LABEL, type ThreatActor } from "@/lib/danantara/ceo/threat-actors";
import { cn } from "@/lib/utils";

const TYPE_META: Record<MediaActor["type"], { label: string; Icon: typeof Building2 }> = {
  media: { label: "Media", Icon: Building2 },
  influencer: { label: "Influencer", Icon: Megaphone },
  analis: { label: "Analis", Icon: LineChart },
  resmi: { label: "Resmi", Icon: BadgeCheck },
};

/** Sentiment chip per stance — the actor's tone toward the issue, read at a glance. */
const SENTIMENT_META: Record<MediaActor["stance"], { label: string; cls: string; dot: string }> = {
  negative: { label: "Negatif", cls: "border-destructive/40 bg-destructive/10 text-destructive", dot: "bg-destructive" },
  neutral: { label: "Netral", cls: "border-border bg-muted/30 text-muted-foreground", dot: "bg-muted-foreground" },
  positive: { label: "Positif", cls: "border-success/40 bg-success/10 text-success", dot: "bg-success" },
};

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

/** Compact Indonesian audience size: 3.1 jt · 880 rb. */
function fmtFollowers(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} jt`;
  if (n >= 1e3) return `${Math.round(n / 1e3)} rb`;
  return String(n);
}

/** Avatar with graceful fallback to initials if the (dummy) image fails to load. */
function Avatar({ actor }: { actor: MediaActor }) {
  const [failed, setFailed] = useState(false);
  if (actor.avatarUrl && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- dummy external avatar; next/image needs domain config
      <img
        src={actor.avatarUrl}
        alt={actor.name}
        loading="lazy"
        onError={() => setFailed(true)}
        className="h-10 w-10 shrink-0 rounded-lg object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-extrabold text-white"
      style={{ backgroundColor: "oklch(0.52 0.19 264)" }}
    >
      {initials(actor.name)}
    </span>
  );
}

/** One compact actor card — used in both the Manusia and Bot columns. */
function ActorCard({ actor }: { actor: MediaActor }) {
  const tm = TYPE_META[actor.type];
  const sm = SENTIMENT_META[actor.stance];
  return (
    <div className={cn("rounded-2xl border bg-background/40 p-3", actor.bot ? "border-warning/40" : "border-border/50")}>
      <div className="flex items-center gap-2.5">
        <Avatar actor={actor} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="truncate text-[13px] font-bold text-foreground">@{actor.handle}</span>
            {actor.verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-sky-400" aria-label="Akun terverifikasi" />}
          </div>
          <div className="truncate text-[11px] text-muted-foreground">
            {actor.name} · {actor.platform}
          </div>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px] font-medium">
        <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5", sm.cls)}>
          <span className={cn("h-1.5 w-1.5 rounded-full", sm.dot)} />
          {sm.label}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/30 px-2 py-0.5 text-muted-foreground">
          <tm.Icon className="h-3 w-3" /> {tm.label}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
        <Users className="h-3.5 w-3.5 shrink-0" />
        <span className="font-semibold tabular-nums text-foreground/80">{fmtFollowers(actor.reach)}</span>
        <span>pengikut</span>
      </div>

      {actor.bot && (
        <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[11px] font-semibold text-warning">
          <Bot className="h-3 w-3" /> Terindikasi bot
        </div>
      )}
    </div>
  );
}

/** A labelled column header — "Manusia (N)" / "Bot (N)". */
function ColumnHeader({ icon: Icon, label, count, tone }: { icon: typeof Bot; label: string; count: number; tone: "muted" | "warning" }) {
  return (
    <div
      className={cn(
        "mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide",
        tone === "warning" ? "text-warning" : "text-muted-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {label}
      <span className="opacity-70">({count})</span>
    </div>
  );
}

/**
 * Right column of the Crisis Gate — the social-media actors most responsible for the
 * current top threat's topic, ranked by `actorsDrivingThreat`. The roster is split
 * **left = genuine human/org accounts, right = bot-flagged accounts**, so the
 * human-vs-bot distinction is the layout itself. Each card reads who they are (avatar
 * · @username · verified check · followers), their tone (sentiment), and type.
 */
export function ThreatActors({
  items,
  category,
  loading,
}: {
  items: ThreatActor[];
  category: IssueCategory | null;
  loading?: boolean;
}) {
  const humans = items.filter(({ actor }) => !actor.bot);
  const bots = items.filter(({ actor }) => actor.bot);

  return (
    <div className="panel flex h-full flex-col overflow-hidden p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
          <UserRound className="h-5 w-5 text-muted-foreground" />
          Aktor Penggerak
        </h2>
        {!loading && items.length > 0 && (
          <span className="shrink-0 text-xs font-medium text-muted-foreground">{items.length} aktor</span>
        )}
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {category ? `Penyebab topik · ${CATEGORY_LABEL[category]}` : "Penyebab topik ancaman utama"}
      </p>

      {loading ? (
        <p className="mt-3 text-sm text-muted-foreground">Memuat aktor…</p>
      ) : items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Belum ada aktor penggerak teridentifikasi.</p>
      ) : (
        <div className="mt-3 flex-1 overflow-auto scrollbar-thin pr-1">
          <div className="grid grid-cols-2 gap-3">
            {/* Left — genuine human / organisation accounts. */}
            <div>
              <ColumnHeader icon={ShieldCheck} label="Manusia" count={humans.length} tone="muted" />
              <div className="space-y-2.5">
                {humans.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground/70">—</p>
                ) : (
                  humans.map(({ actor }) => <ActorCard key={actor.handle} actor={actor} />)
                )}
              </div>
            </div>

            {/* Right — bot-flagged accounts. */}
            <div>
              <ColumnHeader icon={Bot} label="Bot" count={bots.length} tone="warning" />
              <div className="space-y-2.5">
                {bots.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground/70">Tidak ada bot terdeteksi.</p>
                ) : (
                  bots.map(({ actor }) => <ActorCard key={actor.handle} actor={actor} />)
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
