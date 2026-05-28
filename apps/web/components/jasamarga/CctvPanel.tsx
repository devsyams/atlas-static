import { Video } from "lucide-react";
import type { CctvFeed } from "@/lib/jasamarga/types";
import { FLOW_COLORS, FLOW_LABEL } from "@/lib/jasamarga/ui";

/**
 * Public CCTV vantages (Travoy / Jasa Marga live cameras). Demo renders stylized
 * frames in lieu of real video, tinted by the flow state at each camera.
 */
export function CctvPanel({ feeds }: { feeds: CctvFeed[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {feeds.map((c) => {
        const color = FLOW_COLORS[c.status];
        return (
          <div key={c.km} className="overflow-hidden rounded-lg border border-border/60 bg-black/40">
            {/* faux camera frame */}
            <div
              className="relative flex h-20 items-end p-1.5"
              style={{
                background: `linear-gradient(180deg, oklch(0.22 0.03 265) 0%, ${color} 320%)`,
              }}
            >
              {/* perspective road lines */}
              <div className="pointer-events-none absolute inset-0 opacity-30" style={{ background: "repeating-linear-gradient(115deg, transparent 0 10px, oklch(1 0 0 / 0.08) 10px 11px)" }} />
              <span className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded bg-black/50 px-1 py-0.5 text-[8px] font-bold text-destructive">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-destructive" /> LIVE
              </span>
              <span className="absolute left-1.5 top-1.5 flex items-center gap-1 text-[9px] font-bold text-white/80">
                <Video className="h-2.5 w-2.5" /> KM {c.km}
              </span>
              <span className="relative rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide" style={{ background: "oklch(0 0 0 / 0.45)", color }}>
                {FLOW_LABEL[c.status]}
              </span>
            </div>
            <div className="px-2 py-1.5">
              <div className="truncate text-[10px] font-semibold">{c.name}</div>
              <div className="truncate text-[9px] text-muted-foreground">{c.note}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
