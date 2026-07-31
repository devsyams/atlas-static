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
export function CeoCommand({
  showHeader = true,
  showBumn = true,
  refreshNonce,
}: {
  /** A13 embeds this wall under the Crisis Gate's header — pass `false` to drop ours. */
  showHeader?: boolean;
  /**
   * A13 v2.0 wants the Danantara topics only — pass `false` to drop the BUMN
   * heatboard. The `/bumn-board` feed is then never fetched, and the issue board
   * takes the full width.
   */
  showBumn?: boolean;
  /** Parent-driven refresh: refetch when this value *changes* (never on mount). */
  refreshNonce?: number;
} = {}) {
  const [issues, setIssues] = useState<CeoIssue[]>([]); // Danantara-wide topics
  const [bumn, setBumn] = useState<BumnSentiment[]>([]); // BUMN board rows
  const [bumnIssues, setBumnIssues] = useState<CeoIssue[]>([]); // per-BUMN topics
  const [issuesLive, setIssuesLive] = useState<Live>("loading");
  const [bumnLive, setBumnLive] = useState<Live>("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState<DetailSelection | null>(null);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(
    (fresh = false) => {
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

      // Nothing on the page reads the BUMN board when it isn't rendered (A13 v2.0),
      // so skip the call entirely rather than paying for a discarded response.
      const board = showBumn
        ? fetch(`/api/v1/danantara/bumn-board${q}`)
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
            })
        : Promise.resolve();

      Promise.allSettled([topics, board]).finally(() => {
        if (mountedRef.current) setRefreshing(false);
      });
    },
    [showBumn],
  );

  useEffect(() => {
    load(false);
  }, [load]);

  // A13: parent-driven refresh. Fires only when the nonce *changes*, so mounting
  // with a nonce already present never double-fetches the initial load.
  const nonceRef = useRef(refreshNonce);
  useEffect(() => {
    if (refreshNonce === undefined || nonceRef.current === refreshNonce) return;
    nonceRef.current = refreshNonce;
    setRefreshing(true);
    load(true);
  }, [refreshNonce, load]);

  const rankedBumn = useMemo(() => rankBumn(bumn), [bumn]);
  const headerState = useMemo<CeoState>(() => ({ tickCount: 0, issues, bumn: rankedBumn }), [issues, rankedBumn]);
  // The detail modal can show any topic — Danantara-wide or a BUMN's — so it sees
  // both topic sets (ids are unique). The BUMN logo links straight to its dashboard.
  const detailState = useMemo<CeoState>(
    () => ({ tickCount: 0, issues: [...issues, ...bumnIssues], bumn: rankedBumn }),
    [issues, bumnIssues, rankedBumn],
  );

  return (
    <div className="flex flex-col gap-3 xl:h-full">
      {showHeader && (
        <HeaderStrip
          state={headerState}
          source={issuesLive}
          onRefresh={() => {
            setRefreshing(true);
            load(true);
          }}
          refreshing={refreshing}
        />
      )}

      {/* Running narration sits broadcast-style at the top, right under the headline numbers. */}
      <AiBriefTicker state={headerState} />

      <div
        data-testid="ceo-wall"
        className={`grid grid-cols-1 gap-3 xl:min-h-0 xl:flex-1 ${showBumn ? "xl:grid-cols-2" : ""}`}
      >
        {/* Phone order matches AC7: header → ticker → issues → BUMN. */}
        <div className="min-h-0">
          <IssueBoard issues={issues} loading={issuesLive === "loading"} onSelect={(id) => setDetail({ type: "issue", id })} />
        </div>
        {showBumn && (
          <div className="min-h-0">
            <BumnHeatboard
              rows={rankedBumn}
              issues={bumnIssues}
              loading={bumnLive === "loading"}
              onSelectTopic={(id) => setDetail({ type: "issue", id })}
            />
          </div>
        )}
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
