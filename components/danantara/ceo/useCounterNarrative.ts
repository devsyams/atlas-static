"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { isAiEnabled, useAiEnabled } from "@/lib/ai-settings";
import { feedQuery } from "@/lib/danantara/feed-query";
import { topNegativeByReach } from "@/lib/danantara/ceo/counter-narrative";
import { fallbackCounterNarrative, type CounterNarrativeAi } from "@/lib/danantara/ceo/counter-narrative-ai";
import type { CeoIssue } from "@/lib/danantara/ceo/types";
import type { TopicsSummary } from "@/lib/danantara/ceo/topics-source";

export type FeedState = "loading" | "live" | "offline";

export interface CounterNarrativeState {
  /** The 3 topics the war room is countering (top negative by negative reach). */
  topics: CeoIssue[];
  /** The live feed issues, used by the board-level simulator. */
  issues: CeoIssue[];
  /** The full topics summary needed for the board-level simulator. */
  summary: TopicsSummary | null;
  /** Always renderable: the LLM answer when it lands, the deterministic fallback until then. */
  data: CounterNarrativeAi;
  source: "llm" | "scripted";
  feed: FeedState;
  /** True while a model call is genuinely in flight — drives the honest terminal. */
  pending: boolean;
}

/** How many topics the section shows. Mirrors the route's own `TOPIC_COUNT`. */
const TOPIC_COUNT = 3;

/**
 * A14 — the war room's data. Two independent fetches:
 *
 * 1. `/topics` (the same 6 h-cached feed the board above reads) → the issues.
 * 2. `/counter-narrative` (the LLM) → the drafts, POSTing the issues we just read
 *    so the model can never counter a different topic set than we're rendering.
 *
 * `data` is **never null**: `fallbackCounterNarrative` renders synchronously the
 * instant topics land, and a live answer upgrades it in place. Any AI failure —
 * no key, kill switch off, model down, refusal, bad payload — simply leaves the
 * fallback standing with an honest `scripted` badge.
 */
export function useCounterNarrative(
  refreshNonce?: number,
  opts: { mock?: boolean; windowDays?: number; bgn?: boolean } = {},
): CounterNarrativeState {
  const { mock = false, windowDays, bgn = false } = opts;
  const [issues, setIssues] = useState<CeoIssue[]>([]);
  const [summary, setSummary] = useState<TopicsSummary | null>(null);
  const [feed, setFeed] = useState<FeedState>("loading");
  const [ai, setAi] = useState<{ data: CounterNarrativeAi; for: string } | null>(null);
  const [pending, setPending] = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadTopics = useCallback(
    (fresh = false) => {
      // A13 v5.0: follow the page's selected window so the drafts always counter
      // the same topic set the boards above are rendering.
      fetch(`/api/v1/danantara/topics${feedQuery({ fresh, mock, days: windowDays, bgn })}`)
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then((j: { issues?: CeoIssue[]; summary?: TopicsSummary }) => {
          if (!mountedRef.current) return;
          setIssues(Array.isArray(j.issues) ? j.issues : []);
          setSummary(j.summary ?? null);
          setFeed("live");
        })
        .catch(() => {
          if (mountedRef.current) setFeed("offline");
        });
    },
    [mock, windowDays, bgn],
  );

  useEffect(() => {
    loadTopics(false);
  }, [loadTopics]);

  // Parent-driven refresh: fires only when the nonce *changes*, so mounting with a
  // nonce already present never double-fetches the initial load.
  const nonceRef = useRef(refreshNonce);
  useEffect(() => {
    if (refreshNonce === undefined || nonceRef.current === refreshNonce) return;
    nonceRef.current = refreshNonce;
    loadTopics(true);
  }, [refreshNonce, loadTopics]);

  const topics = useMemo(() => topNegativeByReach(issues, TOPIC_COUNT), [issues]);
  // Stable identity for the effect below — never key on the array object.
  const topicKey = useMemo(() => topics.map((t) => t.id).join("|"), [topics]);

  const fallback = useMemo(() => fallbackCounterNarrative(topics), [topics]);

  const aiEnabled = useAiEnabled();
  const fetchedFor = useRef<string | null>(null);
  const latest = useRef<CeoIssue[]>(issues);
  useEffect(() => {
    latest.current = issues;
  }, [issues]);

  useEffect(() => {
    // Kill switch: don't even call the route — an off switch must cost zero tokens.
    // Read storage directly rather than trusting `aiEnabled`, which starts
    // optimistically `true` so SSR and the first client render agree; it stays in
    // the deps purely so a flip re-runs this effect.
    if (!isAiEnabled()) {
      fetchedFor.current = null;
      return;
    }
    if (!topicKey) return;

    const key = `${topicKey}#${refreshNonce ?? 0}`;
    if (fetchedFor.current === key) return;
    fetchedFor.current = key;

    let cancelled = false;
    setPending(true);
    // A slow model call must not be torn down by a refresh, so the payload is read
    // from a ref at fetch time rather than captured from the render closure.
    fetch(`/api/v1/danantara/counter-narrative${refreshNonce ? "?fresh=1" : ""}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ issues: latest.current }),
    })
      .then((r) => r.json())
      .then((payload: CounterNarrativeAi & { source: "llm" | "scripted" }) => {
        if (cancelled || !mountedRef.current) return;
        // Ignore anything but a live answer — the fallback already stands.
        if (payload.source === "llm" && Array.isArray(payload.topics)) {
          setAi({ data: { topics: payload.topics }, for: topicKey });
        }
      })
      .catch(() => {
        /* fallback stays — graceful degradation */
      })
      .finally(() => {
        if (!cancelled && mountedRef.current) setPending(false);
      });

    return () => {
      cancelled = true;
    };
  }, [topicKey, refreshNonce, aiEnabled]);

  // Derived, not reset-in-effect: a held answer only counts if it describes the
  // topics on screen and the switch is on.
  const live = aiEnabled && ai?.for === topicKey ? ai : null;

  return {
    topics,
    issues,
    summary,
    data: live ? live.data : fallback,
    source: live ? "llm" : "scripted",
    feed,
    pending: pending && !live,
  };
}
