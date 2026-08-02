"use client";

import { useState } from "react";
import { CeoCommand } from "./CeoCommand";
import { CounterNarrativeWarRoom } from "./CounterNarrativeWarRoom";
import { CrisisGate } from "./CrisisGate";

/**
 * Danantara Command Center (A13) — the whole Danantara story on one continuously
 * scrolling page. The A10 **Crisis Gate** fills the first screen ("how bad is it,
 * what is it, who's driving it"); the A7 **CEO Command wall** scrolls in below it
 * (running narration + the Danantara topic board — negative vs positive; the BUMN
 * heatboard is dropped here per v2.0, and its feed is never fetched); then the A14
 * **Counter-Narrative War Room** answers "so what do we post?" (v3.0). One header,
 * one refresh, no route hop — so a boardroom display never blanks mid-read.
 *
 * Deliberately thin: it owns the refresh nonce and the scroll layout, nothing else.
 * All three blocks keep their own fetches and their own live/offline state, so one
 * feed failing degrades only its own block.
 */
export function DanantaraCommandCenter({
  mediaIntelligenceHref,
  brand = "Danantara",
  brandLogo = "/danantara.png",
  briefingHref,
  mock = false,
}: {
  mediaIntelligenceHref?: string;
  /** Client brand shown across the three panes (A13 v4.0; default Danantara, "BGN" on /bgn/command). */
  brand?: string;
  /** Brand logo asset for the gate (A13 v4.0). */
  brandLogo?: string;
  /** Gate "View briefing" target (A13 v6.2; /bgn/command passes /bgn/briefing). */
  briefingHref?: string;
  /** Serve every pane from the scoped BGN demo fixtures via `?mock=1` (A13 v4.0). */
  mock?: boolean;
} = {}) {
  // Bumped by the gate's header Refresh; both blocks refetch on the change. The gate
  // delegates rather than fetching directly, so each feed is pulled exactly once.
  const [refreshNonce, setRefreshNonce] = useState(0);
  // v5.0: the one header's date-range picker sets the topics window for every
  // topics-driven block — the gate fetches with it itself and reports changes
  // here; the wall + war room follow via `windowDays`. Default 7 hari (v6.0,
  // client request; must match the gate's DEFAULT_DAYS).
  const [windowDays, setWindowDays] = useState(7);

  return (
    <div data-testid="danantara-command-center" className="flex flex-col gap-6">
      <CrisisGate
        embedded
        refreshNonce={refreshNonce}
        onRefresh={() => setRefreshNonce((n) => n + 1)}
        onRangeChange={setWindowDays}
        mediaIntelligenceHref={mediaIntelligenceHref}
        brand={brand}
        brandLogo={brandLogo}
        briefingHref={briefingHref}
        mock={mock}
      />
      <CeoCommand
        showHeader={false}
        showBumn={false}
        refreshNonce={refreshNonce}
        brand={brand}
        mock={mock}
        windowDays={windowDays}
      />
      <CounterNarrativeWarRoom refreshNonce={refreshNonce} brand={brand} mock={mock} windowDays={windowDays} />
    </div>
  );
}
