"use client";

import { useEffect, useState } from "react";
import { Flame, Megaphone } from "lucide-react";
import { fmtCount } from "@/lib/danantara/ceo/format";
import { TIER_LABEL, TIER_MULTIPLIER } from "@/lib/danantara/ceo/counter-noise";
import type { ResponseTier, WarRoomTotals } from "@/lib/danantara/ceo/counter-narrative";

const reducedMotion = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Count 0 → target while `run` (eased); settles instantly under reduced motion. */
function useCountUp(target: number, run: boolean, duration = 900): number {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!run) return;
    if (reducedMotion() || typeof requestAnimationFrame === "undefined") {
      const id = setTimeout(() => setVal(target), 0);
      return () => clearTimeout(id);
    }
    let raf = 0;
    let start = 0;
    const tick = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min(1, (ts - start) / duration);
      setVal(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run, duration]);
  return run ? val : 0;
}

/**
 * The hero of the war room (A14 AC9): the reach fight, in one bar. Hostile reach on
 * the left in destructive red, the reach this response plan buys on the right in
 * primary — the counter side grows out on reveal via `.cn-bar` (A9's `cn-fill`
 * keyframe, written then never used; reduced-motion is already handled there).
 *
 * The headline % is the share of voice the plan projects; the tier picks the target
 * (×1 parity, ×3 → 75%, ×5 → ~83%).
 */
export function ShareOfVoiceBar({
  totals,
  tier,
  animate,
}: {
  totals: WarRoomTotals;
  tier: ResponseTier;
  /** Run the count-up/grow-in — driven by the section's reveal, not by mount. */
  animate: boolean;
}) {
  const sov = useCountUp(totals.shareOfVoicePct, animate);
  const shown = animate ? sov : totals.shareOfVoicePct;

  return (
    <div data-testid="sov-bar" className="rounded-xl border border-border/60 bg-card/40 p-3">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1.5">
        <div>
          <div className="text-base font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Projected share of voice
          </div>
          <div className="mt-0.5 flex items-baseline gap-2">
            <span data-testid="sov-pct" className="font-mono text-3xl font-extrabold tabular-nums text-primary sm:text-4xl">
              {shown}%
            </span>
            <span className="text-base text-muted-foreground">
              after {totals.totalPosts.toLocaleString("en-US")} posts · {TIER_LABEL[tier]} (×{TIER_MULTIPLIER[tier]})
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-base">
          <span className="flex items-center gap-1.5 text-destructive" title="Estimated hostile reach">
            <Flame className="h-4 w-4 shrink-0" />
            <span className="font-mono font-bold tabular-nums">{fmtCount(totals.hostileReach)}</span> hostile
          </span>
          <span className="flex items-center gap-1.5 text-primary" title="Reach this response plan buys">
            <Megaphone className="h-4 w-4 shrink-0" />
            <span className="font-mono font-bold tabular-nums">{fmtCount(totals.projectedReach)}</span> counter
          </span>
        </div>
      </div>

      <div className="mt-2.5 flex h-7 overflow-hidden rounded-full bg-muted/25" role="img" aria-label={`Projected share of voice ${totals.shareOfVoicePct}%`}>
        <div
          data-testid="sov-hostile"
          className="h-full bg-destructive/80 transition-[width] duration-500"
          style={{ width: `${totals.hostileSharePct}%` }}
        />
        <div
          data-testid="sov-counter"
          className="h-full overflow-hidden transition-[width] duration-500"
          style={{ width: `${totals.shareOfVoicePct}%` }}
        >
          <div className={`h-full w-full bg-primary ${animate ? "cn-bar" : ""}`} />
        </div>
      </div>
    </div>
  );
}
