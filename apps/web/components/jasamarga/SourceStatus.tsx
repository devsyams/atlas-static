import {
  AtSign,
  BadgeCheck,
  CloudRain,
  Navigation,
  Newspaper,
  TriangleAlert,
  Video,
  type LucideIcon,
} from "lucide-react";
import type { SourceFeed, SourceType } from "@/lib/jasamarga/types";
import { cn } from "@/lib/utils";

const ICON: Record<SourceType, LucideIcon> = {
  traffic: Navigation,
  waze: TriangleAlert,
  medsos: AtSign,
  berita: Newspaper,
  cctv: Video,
  cuaca: CloudRain,
  resmi: BadgeCheck,
};

const DOT: Record<SourceFeed["status"], string> = {
  live: "bg-success",
  delay: "bg-warning",
  down: "bg-destructive",
};

const STATUS_LABEL: Record<SourceFeed["status"], string> = {
  live: "live",
  delay: "tertunda",
  down: "mati",
};

/**
 * "Sumber Data" — the connected public/online feeds. Makes data provenance
 * explicit on screen: everything here is scraped/ingested from open sources.
 */
export function SourceStatus({ sources }: { sources: SourceFeed[] }) {
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
          const Icon = ICON[s.type];
          return (
            <span
              key={s.name}
              title={`${s.items_24h.toLocaleString("id-ID")} sinyal / 24 jam · sinkron ${s.last_sync}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/40 px-2 py-1 text-[10px]"
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", DOT[s.status], s.status === "live" && "animate-pulse")} />
              <Icon className="h-3 w-3 text-foreground/70" />
              <span className="font-semibold">{s.name}</span>
              <span className="text-muted-foreground/70">· {STATUS_LABEL[s.status]}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
