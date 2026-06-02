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
 * Combined simulation + escalation/takeover state stored in a single reducer.
 *
 * Why a reducer instead of multiple useState calls?
 *
 * When `vi.advanceTimersByTime(TICK_MS * N)` runs inside `act()`, React 19
 * batches ALL N interval callbacks into a single render. Intermediate states
 * (e.g. tick 18 where escalation first fires) are never rendered as standalone
 * component states — only the final state (tick N) reaches the DOM.
 *
 * Keeping `freshEscalation` and `takeoverId` inside the reducer means escalation
 * events are recorded at the tick they occur and survive through the remaining
 * batched ticks unchanged. The component sees them in the single rendered output
 * without needing setState inside effects.
 *
 * The spotlight uses LIVE issue state: it pins to any issue whose engine status
 * is currently "escalating", and clears naturally when the engine cools the issue
 * below the hysteresis threshold (velocity < RISING_THRESHOLD = 80%). No frozen
 * snapshot is stored — that would violate AC4 by keeping the badge visible after
 * cooldown and preventing rotation from resuming.
 */
interface WallState {
  sim: CeoState;
  /** ID of the issue currently showing in the takeover overlay (null = no overlay). */
  takeoverId: string | null;
  /** ID of the issue that first transitioned to "escalating" in this batch. */
  freshEscalation: string | null;
  /** IDs that have already triggered a takeover (prevent re-firing). */
  seenEscalating: ReadonlySet<string>;
}

type WallAction =
  | { type: "TICK"; rand: () => number; arcs: EscalationArc[] }
  | { type: "SHOW_TAKEOVER"; id: string }
  | { type: "HIDE_TAKEOVER"; id: string };

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
          takeoverId: state.takeoverId,
          // Keep the first escalation signal (don't overwrite if another follows in the same batch).
          freshEscalation: state.freshEscalation ?? fresh.id,
          seenEscalating: seen,
        };
      }
      // Cool-down: allow re-triggering once an issue returns to normal.
      const cooled = new Set(state.seenEscalating);
      for (const id of cooled) {
        const issue = next.issues.find((i) => i.id === id);
        if (issue && issue.status === "normal") cooled.delete(id);
      }
      return {
        sim: next,
        takeoverId: state.takeoverId,
        freshEscalation: state.freshEscalation,
        seenEscalating: cooled,
      };
    }
    case "SHOW_TAKEOVER":
      return { ...state, takeoverId: action.id };
    case "HIDE_TAKEOVER":
      return {
        ...state,
        takeoverId: state.takeoverId === action.id ? null : state.takeoverId,
        // Clear the freshEscalation signal so the takeover can't re-fire.
        freshEscalation:
          state.freshEscalation === action.id ? null : state.freshEscalation,
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
    takeoverId: null,
    freshEscalation: null,
    seenEscalating: new Set<string>(),
  }));
  const [spotIdx, setSpotIdx] = useState(0);
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

  // Takeover lifecycle: show the overlay when a fresh escalation lands, then
  // hide it after TAKEOVER_MS. Both transitions are dispatched as actions so
  // no setState is called directly inside the effect body.
  useEffect(() => {
    const { freshEscalation, takeoverId } = wall;
    if (!freshEscalation || freshEscalation === takeoverId) return;
    dispatch({ type: "SHOW_TAKEOVER", id: freshEscalation });
    const timer = setTimeout(() => {
      dispatch({ type: "HIDE_TAKEOVER", id: freshEscalation });
    }, TAKEOVER_MS);
    return () => clearTimeout(timer);
  }, [wall.freshEscalation]); // eslint-disable-line react-hooks/exhaustive-deps

  // Spotlight target.
  // - Pin to the LIVE escalating issue (clears automatically when the engine
  //   cools the issue below the hysteresis threshold — satisfies AC4).
  // - Falls back to the auto-rotating queue when no issue is escalating.
  const queue = useMemo(() => spotlightQueue(state.issues), [state.issues]);
  const spotlightIssue = useMemo((): CeoIssue | undefined => {
    const escalating = state.issues.find((i) => i.status === "escalating");
    if (escalating) return escalating; // live pin — clears when engine cools it
    const id = queue[spotIdx % Math.max(1, queue.length)];
    return state.issues.find((i) => i.id === id);
  }, [queue, spotIdx, state.issues]);

  const takeoverIssue = wall.takeoverId
    ? state.issues.find((i) => i.id === wall.takeoverId)
    : undefined;

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
