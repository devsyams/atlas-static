"use client";

import { useEffect, useRef, useState } from "react";

import { isAiEnabled, useAiEnabled } from "@/lib/ai-settings";
import type { OpsAi } from "@/lib/jasamarga/ai-insight";
import type { OpsSnapshot } from "@/lib/jasamarga/types";

export interface OpsAiState {
  insight: OpsAi["insight"] | null;
  predictions: OpsAi["predictions"] | null;
  source: "llm" | "scripted";
}

const IDLE: OpsAiState = { insight: null, predictions: null, source: "scripted" };

/** The analysis, tagged with the corridor it describes. */
type Held = OpsAiState & { for: string | null };

/**
 * A12 — fetch the LLM-authored insight + predictions for the snapshot on screen.
 *
 * Off the critical path on purpose: the dashboard renders the deterministic
 * snapshot immediately and this upgrades it in place a beat later. Any failure
 * (switch off, no key, model down, bad payload) leaves `source: "scripted"` and
 * the caller keeps the values it already had — the board never blanks.
 *
 * The effect keys on the **corridor**, not on the snapshot object. The dashboard
 * re-polls every 60 s and hands us a fresh `data` object each time; keying on
 * that would tear down the effect mid-flight, and the cleanup would discard a
 * model answer that hadn't landed yet — while the `fetchedFor` guard blocked any
 * retry. A model call can easily outlive one poll, so the snapshot is read from
 * a ref at fetch time instead.
 */
export function useOpsAi(data: OpsSnapshot | null): OpsAiState {
  const [state, setState] = useState<Held>({ ...IDLE, for: null });
  const fetchedFor = useRef<string | null>(null);
  const latest = useRef<OpsSnapshot | null>(data);
  const aiEnabled = useAiEnabled();
  const corridor = data?.corridor;

  // Declared first so `latest` is current before the fetch effect below runs.
  useEffect(() => {
    latest.current = data;
  }, [data]);

  useEffect(() => {
    // Kill switch (AC9): don't even call the route — an off switch must cost zero.
    //
    // Read storage directly rather than trusting `aiEnabled`: that state starts
    // optimistically `true` to keep SSR and the first client render in agreement,
    // so relying on it would fire one fetch before the switch is known. `aiEnabled`
    // stays in the dep list purely so a flip re-runs this effect.
    if (!isAiEnabled()) {
      fetchedFor.current = null;
      return;
    }
    if (!corridor || !latest.current) return;
    if (fetchedFor.current === corridor) return;
    fetchedFor.current = corridor;

    let cancelled = false;
    fetch("/api/v1/jasamarga-ai", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(latest.current),
    })
      .then((res) => res.json())
      .then((payload: OpsAi & { source: "llm" | "scripted" }) => {
        if (cancelled || payload.source !== "llm") return;
        setState({
          insight: payload.insight,
          predictions: payload.predictions,
          source: "llm",
          for: corridor,
        });
      })
      .catch(() => {
        /* deterministic values stay — graceful degradation (AC4) */
      });

    return () => {
      cancelled = true;
    };
  }, [corridor, aiEnabled]);

  // Derived, not reset-in-effect: the held analysis only counts if it describes
  // the corridor on screen (so switching roads never shows a stale read) and the
  // switch is on (so an off switch always reports scripted).
  return aiEnabled && state.for === corridor ? state : IDLE;
}
