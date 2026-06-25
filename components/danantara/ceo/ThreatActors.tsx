import { Building2, Megaphone, UserRound, LineChart, BadgeCheck } from "lucide-react";
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

/** Role accent by stance — driver (negative) is the alarming one. */
const ROLE_META: Record<MediaActor["stance"], { cls: string; bar: string }> = {
  negative: { cls: "text-destructive", bar: "bg-destructive" },
  neutral: { cls: "text-muted-foreground", bar: "bg-muted-foreground" },
  positive: { cls: "text-success", bar: "bg-success" },
};

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

/**
 * Right column of the Crisis Gate — the social-media actors most responsible for the
 * current top threat's topic, ranked by `actorsDrivingThreat`. Each card reads as
 * "who is driving this and how hard": identity (avatar · handle · type), the drive
 * bar labelled with the actor's role, and their one-line stance note as a pull quote.
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
  return (
    <div className="panel flex h-full flex-col overflow-hidden p-4">
      <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
        <UserRound className="h-3.5 w-3.5" />
        Aktor Penggerak
      </h2>
      <p className="mt-1 text-[10px] text-muted-foreground/70">
        {category ? `Penyebab topik · ${CATEGORY_LABEL[category]}` : "Penyebab topik ancaman utama"}
      </p>

      <div className="mt-3 flex-1 space-y-2.5 overflow-auto scrollbar-thin pr-1">
        {loading ? (
          <p className="text-xs text-muted-foreground/70">Memuat aktor…</p>
        ) : items.length === 0 ? (
          <p className="text-xs text-muted-foreground/70">Belum ada aktor penggerak teridentifikasi.</p>
        ) : (
          items.map(({ actor, role, drive }) => {
            const tm = TYPE_META[actor.type];
            const rm = ROLE_META[actor.stance];
            return (
              <div key={actor.handle} className="flex flex-col rounded-2xl border border-border/50 bg-background/40 p-3">
                <div className="flex items-center gap-2.5">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-extrabold text-white"
                    style={{ backgroundColor: "oklch(0.52 0.19 264)" }}
                  >
                    {initials(actor.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[13px] font-bold">@{actor.handle}</span>
                      <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-border/60 bg-muted/30 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-muted-foreground">
                        <tm.Icon className="h-2.5 w-2.5" /> {tm.label}
                      </span>
                    </div>
                    <div className="truncate text-[10px] text-muted-foreground">{actor.name} • {actor.platform}</div>
                  </div>
                </div>

                {/* Drive bar — how hard this actor is pushing THIS threat (0..1),
                    labelled with their role; colour tracks stance (red = driver). */}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[8px] font-semibold uppercase tracking-wide">
                    <span className="text-muted-foreground/70">Dorongan</span>
                    <span className={rm.cls}>{role}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted/40">
                    <div
                      className={cn("h-full rounded-full", rm.bar)}
                      style={{ width: `${Math.max(4, Math.round(drive * 100))}%` }}
                    />
                  </div>
                </div>

                <p className="mt-2.5 text-[10.5px] italic leading-snug text-muted-foreground">“{actor.note}”</p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
