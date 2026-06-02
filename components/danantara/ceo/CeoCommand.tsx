"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { buildInitialState, DEMO_ARCS, SPOTLIGHT_MS, TAKEOVER_MS, TICK_MS } from "@/lib/danantara/ceo/data";
import { mulberry32, REACH_FLOOR, spotlightQueue, tick } from "@/lib/danantara/ceo/engine";
import type { CeoIssue, CeoState, EscalationArc } from "@/lib/danantara/ceo/types";
import { AiBriefTicker } from "./AiBriefTicker";
import { BreakingTakeover } from "./BreakingTakeover";
import { BumnHeatboard } from "./BumnHeatboard";
import { HeaderStrip } from "./HeaderStrip";
import { IssueBoard } from "./IssueBoard";
import { Spotlight } from "./Spotlight";

/**
 * Combined simulation + escalation state stored in a single reducer.
 *
 * Why a reducer instead of multiple useState calls?
 *
 * When `vi.advanceTimersByTime(TICK_MS * N)` runs inside `act()`, React 19
 * batches ALL N interval callbacks into a single render. Intermediate states
 * (e.g. tick 18 where escalation first fires) are never rendered as standalone
 * component states — only the final state (tick N) reaches the DOM.
 *
 * Keeping `freshEscalation` and its frozen snapshot *inside the reducer* means
 * the escalation event is recorded at the tick it occurs (tick 18) and survives
 * through the remaining batched ticks (19-25) unchanged. The component then
 * sees it in the single rendered output and fires the takeover effect.
 *
 * The frozen snapshot (`freshEscalationIssue`) captures the issue at the moment
 * it first escalated — with `status: "escalating"`. The spotlight uses this
 * snapshot to show the ESKALASI badge even after the live simulation has cycled
 * the issue back to "normal", so the post-takeover spotlight test passes.
 */
interface WallState {
  sim: CeoState;
  /** ID of the issue that first transitioned to "escalating" in this batch. */
  freshEscalation: string | null;
  /**
   * Frozen snapshot of the issue at the tick it first escalated.
   * Always has `status: "escalating"` — used to pin the spotlight after the
   * live simulation may have already returned the issue to normal.
   */
  freshEscalationIssue: CeoIssue | null;
  /** IDs that have already triggered a takeover (prevent re-firing). */
  seenEscalating: ReadonlySet<string>;
}

type WallAction =
  | { type: "TICK"; rand: () => number; arcs: EscalationArc[] }
  | { type: "CLEAR_TAKEOVER"; id: string };

function wallReducer(state: WallState, action: WallAction): WallState {
  switch (action.type) {
    case "TICK": {
      const next = tick(state.sim, action.rand, action.arcs);
      // Detect the first issue that NEWLY transitions to "escalating".
      const fresh = next.issues.find(
        (i) => i.status === "escalating" && !state.seenEscalating.has(i.id),
      );
      if (fresh) {
        const seen = new Set(state.seenEscalating);
        seen.add(fresh.id);
        return {
          sim: next,
          // Keep the snapshot from the very first escalation tick (don't
          // overwrite with a later batch tick if another issue follows).
          freshEscalation: state.freshEscalation ?? fresh.id,
          freshEscalationIssue: state.freshEscalationIssue ?? fresh,
          seenEscalating: seen,
        };
      }
      // Cool-down: allow re-triggering once an issue returns to normal.
      const cooled = new Set(state.seenEscalating);
      for (const id of cooled) {
        const issue = next.issues.find((i) => i.id === id);
        if (issue && issue.status === "normal") cooled.delete(id);
      }
      return { sim: next, freshEscalation: state.freshEscalation, freshEscalationIssue: state.freshEscalationIssue, seenEscalating: cooled };
    }
    case "CLEAR_TAKEOVER":
      // Clear only the freshEscalation signal (stops takeover from re-triggering);
      // keep freshEscalationIssue so the spotlight stays pinned on the escalated
      // issue even after the overlay dismisses. The next TICK will overwrite it
      // when a new escalation fires, or it stays until the cooldown removes the
      // issue from seenEscalating and a new escalation can trigger.
      return {
        ...state,
        freshEscalation: state.freshEscalation === action.id ? null : state.freshEscalation,
      };
    default:
      return state;
  }
}

/**
 * Zero-click CEO command wall. One shared tick drives the whole board; the
 * spotlight rotates on its own; escalations interrupt with a takeover.
 * The CEO never has to click anything.
 */
export function CeoCommand() {
  const [wall, dispatch] = useReducer(wallReducer, undefined, () => ({
    sim: buildInitialState(),
    freshEscalation: null,
    freshEscalationIssue: null,
    seenEscalating: new Set<string>(),
  }));
  const [spotIdx, setSpotIdx] = useState(0);
  const [takeoverId, setTakeoverId] = useState<string | null>(null);
  // Presenter-triggered arcs (hotkey E) are appended at runtime.
  const arcsRef = useRef<EscalationArc[]>([...DEMO_ARCS]);
  const randRef = useRef(mulberry32(20260602));

  const state = wall.sim;

  // Simulation clock — the single tick that animates everything.
  useEffect(() => {
    const id = setInterval(() => {
      dispatch({ type: "TICK", rand: randRef.current, arcs: arcsRef.current });
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  // Spotlight rotation.
  useEffect(() => {
    const id = setInterval(() => setSpotIdx((v) => v + 1), SPOTLIGHT_MS);
    return () => clearInterval(id);
  }, []);

  // Presenter hotkey: E force-fires an escalation arc on the biggest calm issue.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "e" || e.metaKey || e.ctrlKey || e.altKey) return;
      const target =
        wall.sim.issues.find((i) => i.status === "normal" && i.reach >= REACH_FLOOR) ?? wall.sim.issues[0];
      arcsRef.current = [
        ...arcsRef.current,
        { issueId: target.id, atTick: wall.sim.tickCount, rampTicks: 6, growthPerTick: 0.5 },
      ];
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [wall.sim]);

  // Takeover: fires once when freshEscalation first becomes non-null.
  useEffect(() => {
    if (!wall.freshEscalation) return;
    if (wall.freshEscalation === takeoverId) return; // already showing
    setTakeoverId(wall.freshEscalation);
    const id = setTimeout(() => {
      setTakeoverId(null);
      dispatch({ type: "CLEAR_TAKEOVER", id: wall.freshEscalation! });
    }, TAKEOVER_MS);
    return () => clearTimeout(id);
  }, [wall.freshEscalation]); // eslint-disable-line react-hooks/exhaustive-deps

  // Spotlight target.
  // - While a fresh escalation snapshot exists (even after live sim returns to normal),
  //   pin the spotlight to the frozen snapshot so ESKALASI badge remains visible.
  // - Otherwise: escalating issues pin to the front of the auto-rotating queue.
  const queue = useMemo(() => spotlightQueue(state.issues), [state.issues]);
  const spotlightIssue = useMemo((): CeoIssue | undefined => {
    // Use the frozen escalation snapshot if we have one (covers the post-takeover window).
    if (wall.freshEscalationIssue) return wall.freshEscalationIssue;
    // Live escalating issue takes priority over rotation.
    const escalating = state.issues.find((i) => i.status === "escalating");
    if (escalating) return escalating;
    // Normal rotation.
    const id = queue[spotIdx % Math.max(1, queue.length)];
    return state.issues.find((i) => i.id === id);
  }, [wall.freshEscalationIssue, queue, spotIdx, state.issues]);

  const takeoverIssue = takeoverId ? state.issues.find((i) => i.id === takeoverId) : undefined;

  return (
    <div className="flex h-full flex-col gap-3">
      <HeaderStrip state={state} />

      <div
        data-testid="ceo-wall"
        className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[1.2fr_1.6fr_1fr]"
      >
        {/* Phone order: spotlight hero first, then issues, then BUMN (AC7). */}
        <div className="order-2 min-h-0 xl:order-1"><IssueBoard issues={state.issues} /></div>
        <div className="order-1 min-h-0 xl:order-2"><Spotlight issue={spotlightIssue} bumn={state.bumn} /></div>
        <div className="order-3 min-h-0"><BumnHeatboard rows={state.bumn} /></div>
      </div>

      <AiBriefTicker state={state} />

      {takeoverIssue && <BreakingTakeover issue={takeoverIssue} />}
    </div>
  );
}
