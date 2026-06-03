"use client";

import { useEffect, useRef, useState } from "react";
import { buildInitialState, DEMO_ARCS, TICK_MS } from "@/lib/danantara/ceo/data";
import { mulberry32, tick } from "@/lib/danantara/ceo/engine";
import { AiBriefTicker } from "./AiBriefTicker";
import { BumnHeatboard } from "./BumnHeatboard";
import { DetailModal, type DetailSelection } from "./DetailModal";
import { HeaderStrip } from "./HeaderStrip";
import { IssueBoard } from "./IssueBoard";

/**
 * Zero-click CEO sentiment wall (v4.0). Two columns — Danantara topics grouped
 * by sentiment on the left, BUMN grouped by sentiment on the right — driven by
 * one shared tick. Sentiment is the organizing principle: each panel splits
 * into a positive and a negative section headed by an aggregate pie.
 *
 * The CEO never has to click anything; clicking any row/tile is optional
 * drill-down into the detail modal (AC10). The v3.0 spotlight, breaking-news
 * takeover and presenter hotkey are gone (AC11) — escalations now surface as
 * board badges only. Scripted demo arcs still run so badges fire reliably.
 */
export function CeoCommand() {
  const [state, setState] = useState(buildInitialState);
  const [detail, setDetail] = useState<DetailSelection | null>(null);
  const randRef = useRef(mulberry32(20260602));

  // Simulation clock — the single tick that animates everything.
  useEffect(() => {
    const id = setInterval(() => {
      setState((s) => tick(s, randRef.current, DEMO_ARCS));
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex h-full flex-col gap-3">
      <HeaderStrip state={state} />

      {/* Running narration sits broadcast-style at the top, right under the headline numbers. */}
      <AiBriefTicker state={state} />

      <div
        data-testid="ceo-wall"
        className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-2"
      >
        {/* Phone order matches AC7: header → ticker → issues → BUMN. */}
        <div className="min-h-0">
          <IssueBoard issues={state.issues} onSelect={(id) => setDetail({ type: "issue", id })} />
        </div>
        <div className="min-h-0">
          <BumnHeatboard rows={state.bumn} issues={state.issues} onSelect={(id) => setDetail({ type: "bumn", id })} />
        </div>
      </div>

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
