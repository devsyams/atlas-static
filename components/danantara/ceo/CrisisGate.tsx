"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, RefreshCw } from "lucide-react";
import type { CeoIssue } from "@/lib/danantara/ceo/types";
import type { TopicsSummary } from "@/lib/danantara/ceo/topics-source";
import { biggestThreat, crisisIndex, type CrisisLevel } from "@/lib/danantara/ceo/crisis";
import { withAlpha } from "@/lib/danantara/ui";
import { CrisisGauge } from "./CrisisGauge";

type Live = "loading" | "live" | "offline";

/** Ambient-glow intensity per band — the screen breathes harder as it worsens. */
const FEAR: Record<CrisisLevel, { glow: number; breathe: boolean }> = {
  Low: { glow: 0.1, breathe: false },
  Guarded: { glow: 0.18, breathe: false },
  Elevated: { glow: 0.3, breathe: true },
  Severe: { glow: 0.46, breathe: true },
};

const reducedMotion = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Count 0 → target while `run` (eased); settles instantly under reduced motion. */
function useCountUp(target: number, run: boolean, duration = 1100): number {
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
 * Crisis Gate (A10) — the fear-first Danantara landing. One dominant 0–100
 * **Crisis Index** (high = danger) over the live topics feed, a huge glowing
 * status word that siren-pulses at Krisis, and the single biggest threat named
 * beneath. Deliberately stark: it answers "how bad is it right now" in one glance,
 * and everything else is one click away on the full /danantara wall.
 */
export function CrisisGate() {
  const [issues, setIssues] = useState<CeoIssue[]>([]);
  const [summary, setSummary] = useState<TopicsSummary | null>(null);
  const [live, setLive] = useState<Live>("loading");
  const [refreshing, setRefreshing] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback((fresh = false) => {
    fetch(`/api/v1/danantara/topics${fresh ? "?fresh=1" : ""}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j: { issues?: CeoIssue[]; summary?: TopicsSummary }) => {
        if (!mountedRef.current) return;
        setIssues(Array.isArray(j.issues) ? j.issues : []);
        setSummary(j.summary ?? null);
        setLive("live");
      })
      .catch(() => {
        if (mountedRef.current) setLive("offline");
      })
      .finally(() => {
        if (mountedRef.current) setRefreshing(false);
      });
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  const reading = crisisIndex(issues, summary);
  const threat = biggestThreat(issues);

  // Only animate once we actually have live data — a loading/offline gate sits at 0.
  const shown = useCountUp(reading.score, live === "live");
  const fear = FEAR[reading.level];

  return (
    <section
      data-testid="crisis-gate"
      className="relative flex h-[calc(100dvh-7.75rem)] min-h-[28rem] flex-col items-center justify-center gap-[1.6vh] overflow-hidden text-center"
    >
      {/* Ambient threat glow — washes the screen in the band colour, breathing
          harder as the level worsens. The walk-by hook. */}
      {live === "live" && (
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-0 -z-10 ${fear.breathe ? "crisis-breathe" : ""}`}
          style={{
            background: `radial-gradient(62% 56% at 50% 40%, ${withAlpha(reading.color, fear.glow)}, transparent 72%)`,
          }}
        />
      )}

      {/* One line of context — what this is, plus the live pulse */}
      <h1 className="flex items-center gap-3 text-[clamp(1rem,2.4vh,1.9rem)] font-semibold uppercase tracking-[0.34em] text-muted-foreground">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/70" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
        </span>
        Danantara Threat Index
      </h1>

      {live === "offline" ? (
        <div
          data-testid="crisis-offline"
          className="flex flex-col items-center gap-2 rounded-2xl border border-border/40 px-12 py-8"
        >
          <span className="font-mono text-[clamp(3rem,10vh,4.5rem)] leading-none text-muted-foreground">—</span>
          <span className="text-lg text-muted-foreground">Data unavailable</span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-[1vh]">
          <CrisisGauge score={live === "live" ? shown : 0} color={reading.color} live={live === "live"} />

          {live === "loading" ? (
            <span data-testid="crisis-score" className="font-mono text-5xl text-muted-foreground">
              ··
            </span>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <span
                data-testid="crisis-band"
                className={`rounded-2xl border px-[1em] py-[0.12em] text-[clamp(2.6rem,8vh,5.5rem)] font-extrabold uppercase leading-none tracking-[0.12em] ${
                  reading.siren ? "ceo-siren" : ""
                }`}
                style={{
                  color: reading.color,
                  borderColor: withAlpha(reading.color, 0.45),
                  background: withAlpha(reading.color, 0.12),
                  textShadow: `0 0 36px ${withAlpha(reading.color, 0.6)}`,
                }}
              >
                {reading.level}
              </span>
              <div className="flex items-baseline gap-2 font-mono">
                <span
                  data-testid="crisis-score"
                  className="text-[clamp(2.25rem,5.5vh,4rem)] font-bold tabular-nums leading-none"
                  style={{ color: reading.color }}
                >
                  {shown}
                </span>
                <span className="text-[clamp(1rem,2.4vh,1.75rem)] text-muted-foreground">/ 100</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* The single biggest threat — one line, the concrete "what" */}
      {live === "live" && threat && (
        <p data-testid="crisis-threat" className="max-w-3xl text-[clamp(1rem,2.2vh,1.5rem)] leading-snug">
          <span className="font-semibold uppercase tracking-[0.24em] text-destructive/90">Top&nbsp;Threat&nbsp;·&nbsp;</span>
          <span className="font-semibold text-foreground">{threat.title}</span>
        </p>
      )}

      {/* Drill-down + refresh — the only two actions */}
      <div className="flex items-center gap-3">
        <Link
          href="/danantara/brief"
          data-testid="crisis-detail-link"
          className="group inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-6 py-3 text-base font-medium text-foreground transition-colors hover:border-primary/50 hover:text-primary"
        >
          View briefing
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
        <button
          type="button"
          onClick={() => {
            setRefreshing(true);
            load(true);
          }}
          aria-label="Refresh"
          title="Refresh"
          className="inline-flex items-center justify-center rounded-full border border-border bg-card/50 p-3 text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>
    </section>
  );
}
