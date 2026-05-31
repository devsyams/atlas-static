import type { VoiceShare } from "@/lib/danantara/types";
import { toneColor } from "@/lib/danantara/ui";

function fmtReach(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} jt`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)} rb`;
  return String(n);
}

function Spark({ points, color }: { points: number[]; color: string }) {
  const w = 48;
  const hh = 16;
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${((i / (points.length - 1)) * w).toFixed(1)},${(hh - ((p - min) / span) * hh).toFixed(1)}`)
    .join(" ");
  return (
    <svg width={w} height={hh} className="shrink-0" aria-hidden>
      <path d={d} fill="none" stroke={color} strokeWidth={1.4} strokeLinejoin="round" />
    </svg>
  );
}

/** Share-of-voice across the fund & portfolio, colored by media tone. */
export function ShareOfVoice({ voice }: { voice: VoiceShare[] }) {
  const max = Math.max(...voice.map((v) => v.share_pct), 1);
  return (
    <div className="space-y-2">
      {voice.map((v) => {
        const col = toneColor(v.sentiment);
        return (
          <div key={v.short}>
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: col }} />
                <span className="truncate font-semibold">{v.short}</span>
                <span className="truncate text-[9px] text-muted-foreground">{v.name}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <Spark points={v.spark} color={col} />
                <span className="w-10 text-right font-bold tabular-nums">{v.share_pct}%</span>
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-background/60">
                <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${(v.share_pct / max) * 100}%`, background: col }} />
              </div>
              <span className="w-14 shrink-0 text-right text-[9px] text-muted-foreground">{fmtReach(v.mentions)} sebut</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
