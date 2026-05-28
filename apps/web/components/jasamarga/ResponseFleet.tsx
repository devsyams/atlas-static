import { Ambulance, ShieldCheck, Truck, LifeBuoy, type LucideIcon } from "lucide-react";
import type { FleetUnit } from "@/lib/jasamarga/types";
import { cn } from "@/lib/utils";

const ICON: Record<string, LucideIcon> = {
  Derek: Truck,
  Ambulans: Ambulance,
  PJR: ShieldCheck,
  Rescue: LifeBuoy,
};

const STATUS_CLASS: Record<FleetUnit["status"], string> = {
  "Di lokasi": "border-destructive/40 bg-destructive/10 text-destructive",
  Bergerak: "border-warning/40 bg-warning/10 text-warning",
  Kembali: "border-primary/40 bg-primary/10 text-primary",
  Standby: "border-success/40 bg-success/10 text-success",
};

/** Response fleet status — derek / ambulans / PJR / rescue, deployed vs standby. */
export function ResponseFleet({ fleet }: { fleet: FleetUnit[] }) {
  const deployed = fleet.filter((f) => f.status !== "Standby").length;

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex shrink-0 items-center justify-between text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        <span>Armada Respons</span>
        <span className="text-primary/80">
          {deployed}/{fleet.length} dikerahkan
        </span>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-1.5 overflow-auto scrollbar-thin pr-1 sm:grid-cols-3">
        {fleet.map((u) => {
          const Icon = ICON[u.type] ?? Truck;
          return (
            <div key={u.id} className="flex flex-col gap-1 rounded-lg border border-border/50 bg-background/40 px-2 py-1.5">
              <div className="flex items-center justify-between">
                <Icon className="h-3.5 w-3.5 text-foreground/70" />
                <span className={cn("rounded-full border px-1.5 py-0 text-[8.5px] font-bold", STATUS_CLASS[u.status])}>
                  {u.status}
                </span>
              </div>
              <div className="text-[11px] font-bold leading-tight">{u.call}</div>
              <div className="text-[9px] text-muted-foreground">
                KM {u.location_km}
                {u.response_min != null && ` · ${u.response_min} mnt`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
