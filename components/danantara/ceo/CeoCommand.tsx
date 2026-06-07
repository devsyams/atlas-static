"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { rankBumn } from "@/lib/danantara/ceo/engine";
import type { BumnSentiment, CeoIssue, CeoState } from "@/lib/danantara/ceo/types";
import { AiBriefTicker } from "./AiBriefTicker";
import { BumnHeatboard } from "./BumnHeatboard";
import { DetailModal, type DetailSelection } from "./DetailModal";
import { HeaderStrip } from "./HeaderStrip";
import { IssueBoard } from "./IssueBoard";

type Live = "loading" | "live" | "offline";

/**
 * Zero-click CEO sentiment wall (v37.0) — 100% live data. The left column shows
 * the Danantara-wide topics (`/api/v1/danantara/topics`); the right column shows
 * the 7 BUMN, each from its own feed, fetched in **one** request to the
 * aggregation BFF (`/api/v1/danantara/bumn-board`). No mock seeds, no simulation:
 * on upstream failure the boards show a graceful offline state. Clicking any
 * row/tile is optional drill-down (AC10); a header Refresh forces a fresh pull.
 */
export function CeoCommand() {
  const [issues, setIssues] = useState<CeoIssue[]>([]); // Danantara-wide topics
  const [bumn, setBumn] = useState<BumnSentiment[]>([]); // BUMN board rows
  const [bumnIssues, setBumnIssues] = useState<CeoIssue[]>([]); // per-BUMN topics
  const [issuesLive, setIssuesLive] = useState<Live>("loading");
  const [, setBumnLive] = useState<Live>("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState<DetailSelection | null>(null);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback((fresh = false) => {
    const q = fresh ? "?fresh=1" : "";
    const topics = fetch(`/api/v1/danantara/topics${q}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j: { issues?: CeoIssue[] }) => {
        if (!mountedRef.current) return;
        setIssues(Array.isArray(j.issues) ? j.issues : []);
        setIssuesLive("live");
      })
      .catch(() => {
        if (mountedRef.current) setIssuesLive("offline");
      });

    const board = fetch(`/api/v1/danantara/bumn-board${q}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j: { bumn?: BumnSentiment[]; issues?: CeoIssue[] }) => {
        if (!mountedRef.current) return;
        setBumn(Array.isArray(j.bumn) ? j.bumn : []);
        setBumnIssues(Array.isArray(j.issues) ? j.issues : []);
        setBumnLive("live");
      })
      .catch(() => {
        if (mountedRef.current) setBumnLive("offline");
      });

    Promise.allSettled([topics, board]).finally(() => {
      if (mountedRef.current) setRefreshing(false);
    });
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  const rankedBumn = useMemo(() => rankBumn(bumn), [bumn]);
  const headerState = useMemo<CeoState>(() => ({ tickCount: 0, issues, bumn: rankedBumn }), [issues, rankedBumn]);
  // The detail modal can show any topic — Danantara-wide or a BUMN's — so it sees
  // both topic sets (ids are unique). The BUMN logo links straight to its dashboard.
  const detailState = useMemo<CeoState>(
    () => ({ tickCount: 0, issues: [...issues, ...bumnIssues], bumn: rankedBumn }),
    [issues, bumnIssues, rankedBumn],
  );

  return (
    <div className="flex h-full flex-col gap-3">
      <HeaderStrip
        state={headerState}
        source={issuesLive}
        onRefresh={() => {
          setRefreshing(true);
          load(true);
        }}
        refreshing={refreshing}
      />

      {/* Running narration sits broadcast-style at the top, right under the headline numbers. */}
      <AiBriefTicker state={headerState} />

      <div data-testid="ceo-wall" className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-2">
        {/* Phone order matches AC7: header → ticker → issues → BUMN. */}
        <div className="min-h-0">
          <IssueBoard issues={issues} onSelect={(id) => setDetail({ type: "issue", id })} />
        </div>
        <div className="min-h-0">
          <BumnHeatboard rows={rankedBumn} issues={bumnIssues} onSelectTopic={(id) => setDetail({ type: "issue", id })} />
        </div>
      </div>

      {detail && (
        <DetailModal
          selection={detail}
          state={detailState}
          onClose={() => setDetail(null)}
          onNavigate={setDetail}
        />
      )}
    </div>
  );
}
