"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { buildInitialState, DEMO_ARCS, SPOTLIGHT_MS, TAKEOVER_MS, TICK_MS } from "@/lib/danantara/ceo/data";
import { mulberry32, REACH_FLOOR, spotlightQueue, tick } from "@/lib/danantara/ceo/engine";
import type { CeoIssue, CeoState, EscalationArc } from "@/lib/danantara/ceo/types";
import { AiBriefTicker } from "./AiBriefTicker";
import { BreakingTakeover } from "./BreakingTakeover";
import { BumnHeatboard } from "./BumnHeatboard";
import { DetailModal, type DetailSelection } from "./DetailModal";
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
 * Keeping `pendingTakeovers` and `takeoverId` inside the reducer means escalation
 * events are recorded at the tick they occur and survive through the remaining
 * batched ticks unchanged. The component sees them in the single rendered output
 * without needing setState inside effects.
 *
 * Queue-based takeover design:
 * - TICK finds ALL issues that newly transitioned to "escalating" and appends
 *   their ids to `pendingTakeovers` (FIFO). None are silently dropped.
 * - Two effects handle the lifecycle with honest deps (no eslint-disable):
 *   Effect 1 — when the queue is non-empty and no overlay is showing, dispatches
 *   SHOW_TAKEOVER for the head of the queue (which also dequeues it).
 *   Effect 2 — when an overlay is showing, schedules its HIDE_TAKEOVER after
 *   TAKEOVER_MS. After dismissal, Effect 1 re-runs and shows the next queued id.
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
  /** FIFO queue of issue ids waiting to show the takeover overlay. */
  pendingTakeovers: readonly string[];
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
      // Detect ALL issues that NEWLY transition to "escalating" this tick.
      const newlyEscalating = next.issues.filter(
        (i) => i.status === "escalating" && !state.seenEscalating.has(i.id),
      );
      if (newlyEscalating.length > 0) {
        const seen = new Set(state.seenEscalating);
        for (const issue of newlyEscalating) seen.add(issue.id);
        return {
          sim: next,
          takeoverId: state.takeoverId,
          // Append all newly-escalating ids to the FIFO queue.
          pendingTakeovers: [...state.pendingTakeovers, ...newlyEscalating.map((i) => i.id)],
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
        pendingTakeovers: state.pendingTakeovers,
        seenEscalating: cooled,
      };
    }
    case "SHOW_TAKEOVER":
      return {
        ...state,
        takeoverId: action.id,
        // Dequeue the head of the queue (the id we are now showing).
        pendingTakeovers: state.pendingTakeovers.filter((id) => id !== action.id),
      };
    case "HIDE_TAKEOVER":
      return {
        ...state,
        takeoverId: state.takeoverId === action.id ? null : state.takeoverId,
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
    pendingTakeovers: [] as readonly string[],
    seenEscalating: new Set<string>(),
  }));
  const [spotIdx, setSpotIdx] = useState(0);
  const [detail, setDetail] = useState<DetailSelection | null>(null);
  // Presenter-triggered arcs (hotkey E) are appended at runtime.
  const arcsRef = useRef<EscalationArc[]>([...DEMO_ARCS]);
  const randRef = useRef(mulberry32(20260602));
  // Ref so the hotkey listener can read current sim without re-subscribing.
  const simRef = useRef(wall.sim);
  // Sync inside an effect so we don't mutate during render (react-hooks/refs).
  useEffect(() => {
    simRef.current = wall.sim;
  });

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
  // Subscribed once ([] deps); reads current sim through simRef to avoid
  // re-subscribing on every tick.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "e" || e.metaKey || e.ctrlKey || e.altKey) return;
      const sim = simRef.current;
      // Exclude issues that already have a pending arc so each E press targets a different issue.
      const arcedIds = new Set(arcsRef.current.map((a) => a.issueId));
      const target =
        sim.issues.find((i) => i.status === "normal" && i.reach >= REACH_FLOOR && !arcedIds.has(i.id)) ??
        sim.issues[0];
      arcsRef.current = [
        ...arcsRef.current,
        { issueId: target.id, atTick: sim.tickCount, rampTicks: 6, growthPerTick: 0.5 },
      ];
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Takeover lifecycle — two effects with honest deps, no eslint-disable needed.
  //
  // Effect 1: when the queue is non-empty and no overlay is active, show the next one.
  useEffect(() => {
    if (wall.takeoverId === null && wall.pendingTakeovers.length > 0) {
      dispatch({ type: "SHOW_TAKEOVER", id: wall.pendingTakeovers[0] });
    }
  }, [wall.takeoverId, wall.pendingTakeovers]);

  // Effect 2: while an overlay is showing, schedule its dismissal after TAKEOVER_MS.
  // When takeoverId goes null, Effect 1 re-runs and shows the next queued id (if any).
  useEffect(() => {
    if (wall.takeoverId === null) return;
    const id = wall.takeoverId;
    const timer = setTimeout(() => dispatch({ type: "HIDE_TAKEOVER", id }), TAKEOVER_MS);
    return () => clearTimeout(timer);
  }, [wall.takeoverId]);

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

      {/* Running narration sits broadcast-style at the top, right under the headline numbers. */}
      <AiBriefTicker state={state} />

      <div
        data-testid="ceo-wall"
        className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[1.2fr_1.6fr_1fr]"
      >
        {/* Phone order: spotlight hero first, then issues, then BUMN (AC7). */}
        <div className="order-2 min-h-0 xl:order-1">
          <IssueBoard issues={state.issues} onSelect={(id) => setDetail({ type: "issue", id })} />
        </div>
        <div className="order-1 min-h-0 xl:order-2"><Spotlight issue={spotlightIssue} bumn={state.bumn} /></div>
        <div className="order-3 min-h-0">
          <BumnHeatboard rows={state.bumn} onSelect={(id) => setDetail({ type: "bumn", id })} />
        </div>
      </div>

      {takeoverIssue && <BreakingTakeover issue={takeoverIssue} />}
      {detail && (
        <DetailModal
          selection={detail}
          state={state}
          onClose={() => setDetail(null)}
          onNavigate={setDetail}
        />
      )}
    </div>
  );
}
