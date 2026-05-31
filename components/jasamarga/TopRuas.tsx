import type { RuasLoad } from "@/lib/jasamarga/types";
import { loadColor } from "@/lib/jasamarga/ui";

/** Ranked list of the most-loaded stretches of the corridor. */
export function TopRuas({ ruas }: { ruas: RuasLoad[] }) {
  if (!ruas.length) {
    return <div className="py-6 text-center text-[12px] text-muted-foreground">Belum ada data ruas.</div>;
  }
  const sorted = [...ruas].sort((a, b) => b.load - a.load);

  return (
    <div className="flex flex-col gap-2">
      {sorted.map((r, i) => {
        const color = loadColor(r.load);
        return (
          <div key={r.name} className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/40 px-2.5 py-2">
            <span className="text-sm font-extrabold tabular-nums text-muted-foreground/60">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-bold">{r.name}</div>
              <div className="text-[10px] text-muted-foreground">
                {r.km_range} · {r.speed} km/j · {r.dominant}
              </div>
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full" style={{ width: `${r.load * 10}%`, background: color }} />
              </div>
            </div>
            <span className="text-sm font-extrabold tabular-nums" style={{ color }}>
              {r.load.toFixed(1)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
