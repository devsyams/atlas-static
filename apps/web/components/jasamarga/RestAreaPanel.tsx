import { Coffee } from "lucide-react";
import type { RestArea } from "@/lib/jasamarga/types";
import { FLOW_COLORS } from "@/lib/jasamarga/ui";

/** Rest area (TIP) live saturation — overflow (>100%) flagged. */
export function RestAreaPanel({ areas }: { areas: RestArea[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      {areas.map((r) => {
        const ratio = r.occupancy / r.capacity;
        const pct = Math.round(ratio * 100);
        const color = FLOW_COLORS[r.status];
        const overflow = pct > 100;
        return (
          <div key={r.km} className="rounded-lg border border-border/50 bg-background/40 px-2.5 py-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold">
                <Coffee className="h-3 w-3" style={{ color }} />
                KM {r.km} <span className="text-[9px] font-normal text-muted-foreground">Tipe {r.type}</span>
              </span>
              <span className="text-[11px] font-extrabold tabular-nums" style={{ color: overflow ? "var(--destructive)" : undefined }}>
                {pct}%{overflow && " · PENUH"}
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full transition-[width]" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
