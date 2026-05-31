import { ShieldX, ShieldAlert, ShieldQuestion } from "lucide-react";
import type { HoaxItem } from "@/lib/danantara/types";
import { cn } from "@/lib/utils";

const META: Record<HoaxItem["status"], { cls: string; Icon: typeof ShieldX }> = {
  Terbantahkan: { cls: "border-success/40 bg-success/10 text-success", Icon: ShieldX },
  Menyesatkan: { cls: "border-destructive/40 bg-destructive/10 text-destructive", Icon: ShieldAlert },
  "Dalam Verifikasi": { cls: "border-warning/40 bg-warning/10 text-warning", Icon: ShieldQuestion },
};

function fmtReach(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} jt`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)} rb`;
  return String(n);
}

/** Disinformation watch — flagged misleading claims + counter-narrative. */
export function HoaxWatch({ hoaxes }: { hoaxes: HoaxItem[] }) {
  return (
    <div className="space-y-2">
      {hoaxes.map((h) => {
        const m = META[h.status];
        return (
          <div key={h.claim} className="rounded-lg border border-border/50 bg-background/40 p-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-start gap-1.5">
                <m.Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", m.cls.split(" ").pop())} />
                <span className="text-[12px] font-semibold leading-snug">{h.claim}</span>
              </div>
              <span className={cn("shrink-0 rounded-full border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide", m.cls)}>{h.status}</span>
            </div>
            <div className="mt-1.5 rounded-md border border-border/40 bg-card/40 px-2 py-1.5">
              <span className="text-[9px] font-bold uppercase tracking-wide text-primary">Counter-narrative</span>
              <p className="mt-0.5 text-[10.5px] leading-snug text-foreground/85">{h.counter}</p>
            </div>
            <div className="mt-1 flex items-center gap-2 text-[9px] text-muted-foreground/80">
              <span>Jangkauan ~{fmtReach(h.reach)}</span>
              <span>·</span>
              <span>{h.platforms.join(", ")}</span>
              <span className="ml-auto">{h.time}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
