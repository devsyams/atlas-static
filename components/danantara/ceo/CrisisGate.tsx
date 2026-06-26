"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, CalendarRange, RefreshCw } from "lucide-react";
import type { CeoIssue } from "@/lib/danantara/ceo/types";
import type { MediaActor } from "@/lib/danantara/types";
import type { TopicsSummary } from "@/lib/danantara/ceo/topics-source";
import { biggestThreat, crisisIndex, CRISIS_LEVEL_LABEL, type CrisisLevel } from "@/lib/danantara/ceo/crisis";
import { groupIssuesBySentiment } from "@/lib/danantara/ceo/engine";
import { actorsDrivingThreat } from "@/lib/danantara/ceo/threat-actors";
import { withAlpha } from "@/lib/danantara/ui";
import { CrisisGauge } from "./CrisisGauge";
import { ThreatTopics } from "./ThreatTopics";
import { ThreatActors } from "./ThreatActors";

type Live = "loading" | "live" | "offline";

/** Ambient-glow intensity per band — the screen breathes harder as it worsens. */
const FEAR: Record<CrisisLevel, { glow: number; breathe: boolean }> = {
  Low: { glow: 0.1, breathe: false },
  Guarded: { glow: 0.18, breathe: false },
  Elevated: { glow: 0.3, breathe: true },
  Severe: { glow: 0.46, breathe: true },
};

/** The client this board belongs to — shown as the brand line at the top. */
const CLIENT_BRAND = "Danantara";

/**
 * Date-range presets for the dashboard window. Selection is UI-only for now (the
 * data wiring follows): the default is "Hari ini" so the board reads the issue as it
 * stands **now**, not a trailing 7-day average.
 */
const DATE_RANGES = [
  { key: "today", label: "Hari ini" },
  { key: "7d", label: "7 hari" },
  { key: "30d", label: "30 hari" },
] as const;
type RangeKey = (typeof DATE_RANGES)[number]["key"];

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
 * Crisis Gate (A10 v4.0) — the fear-first Danantara landing, now a three-column
 * command read: **left** the 0–100 Crisis Index meter (high = danger), **middle**
 * the single biggest threat and the topics feeding it, **right** the real
 * social-media actors most responsible for that threat's topic. It still answers
 * "how bad is it, what is it, and who's causing it" in one glance; the full wall is
 * one click away on /danantara.
 */
export function CrisisGate() {
  const [issues, setIssues] = useState<CeoIssue[]>([]);
  const [summary, setSummary] = useState<TopicsSummary | null>(null);
  const [actors, setActors] = useState<MediaActor[]>([]);
  const [actorsLoading, setActorsLoading] = useState(true);
  const [range, setRange] = useState<RangeKey>("today");
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

  // The actor roster is static (public-source) — fetch once; the right column
  // degrades to an empty state if it ever fails.
  useEffect(() => {
    fetch("/api/v1/danantara/actors")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j: { actors?: MediaActor[] }) => {
        if (!mountedRef.current) return;
        setActors(Array.isArray(j.actors) ? j.actors : []);
      })
      .catch(() => {})
      .finally(() => {
        if (mountedRef.current) setActorsLoading(false);
      });
  }, []);

  const reading = crisisIndex(issues, summary);
  const threat = biggestThreat(issues);
  const negatives = groupIssuesBySentiment(issues).negative;
  const related = (threat ? negatives.filter((i) => i.id !== threat.id) : negatives).slice(0, 6);
  const threatActors = actorsDrivingThreat(actors, threat, 5);

  // Only animate once we actually have live data — a loading/offline gate sits at 0.
  const shown = useCountUp(reading.score, live === "live");
  const fear = FEAR[reading.level];

  return (
    <section
      data-testid="crisis-gate"
      className="relative flex min-h-[calc(100dvh-7.75rem)] flex-col gap-4 overflow-hidden lg:h-[calc(100dvh-7.75rem)] lg:min-h-[28rem]"
    >
      {/* Ambient threat glow — washes the screen in the band colour, breathing
          harder as the level worsens. The walk-by hook. */}
      {live === "live" && (
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-0 -z-10 ${fear.breathe ? "crisis-breathe" : ""}`}
          style={{
            background: `radial-gradient(60% 50% at 25% 35%, ${withAlpha(reading.color, fear.glow)}, transparent 70%)`,
          }}
        />
      )}

      {/* Header strip — the client brand, what this is + live pulse, the date-range
          window, and the two actions. */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex items-center gap-3">
          <span className="relative mt-1 flex h-2.5 w-2.5 self-start">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/70" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
          </span>
          <div>
            <h1 className="text-[clamp(1.35rem,3vh,2rem)] font-extrabold leading-none tracking-tight text-foreground">
              {CLIENT_BRAND}
            </h1>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Threat Index · Crisis Monitor
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Date-range window — default "Hari ini" (issue as it stands now). UI-only
              for now; data wiring follows. */}
          <div
            className="inline-flex items-center gap-0.5 rounded-full border border-border bg-card/50 p-0.5"
            role="group"
            aria-label="Rentang tanggal"
          >
            <CalendarRange className="ml-2 mr-0.5 h-4 w-4 text-muted-foreground" />
            {DATE_RANGES.map((r) => {
              const active = range === r.key;
              return (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setRange(r.key)}
                  aria-pressed={active}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {r.label}
                </button>
              );
            })}
          </div>

          <Link
            href="/danantara/brief"
            data-testid="crisis-detail-link"
            className="group inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/50 hover:text-primary"
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
            className="inline-flex items-center justify-center rounded-full border border-border bg-card/50 p-2.5 text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      {/* Three-column command read: meter · threat+topics · actors. */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left — the Crisis Index meter. Anchored top→bottom to fill the column.
            Carries a live, glowing outline in the band colour (red when dangerous)
            so the index reads as "lit up" the worse it gets. */}
        <div
          className="panel flex h-full flex-col p-5 text-center transition-shadow duration-500"
          style={
            live === "live"
              ? {
                  borderColor: withAlpha(reading.color, 0.75),
                  boxShadow: `0 0 0 1px ${withAlpha(reading.color, 0.5)}, 0 0 32px ${withAlpha(
                    reading.color,
                    0.38,
                  )}, inset 0 0 26px ${withAlpha(reading.color, 0.1)}`,
                }
              : undefined
          }
        >
          {live === "offline" ? (
            <div className="flex flex-1 items-center justify-center">
              <div
                data-testid="crisis-offline"
                className="flex flex-col items-center gap-2 rounded-2xl border border-border/40 px-10 py-8"
              >
                <span className="font-mono text-[clamp(2.5rem,8vh,4rem)] leading-none text-muted-foreground">—</span>
                <span className="text-base text-muted-foreground">Data unavailable</span>
              </div>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-bold text-foreground">Indeks Ancaman</h2>

              {/* The gauge + reading fill the middle, growing into the column. */}
              <div className="flex flex-1 flex-col items-center justify-center gap-[3vh]">
                <CrisisGauge
                  score={live === "live" ? shown : 0}
                  color={reading.color}
                  live={live === "live"}
                  className="w-full max-w-[36rem]"
                />

                {live === "loading" ? (
                  <span data-testid="crisis-score" className="font-mono text-6xl text-muted-foreground">
                    ··
                  </span>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <span
                      data-testid="crisis-band"
                      className={`max-w-full whitespace-nowrap rounded-2xl border px-[0.55em] py-[0.16em] text-[clamp(2.25rem,6vh,4.75rem)] font-extrabold uppercase leading-none tracking-[0.06em] ${
                        reading.siren ? "ceo-siren" : ""
                      }`}
                      style={{
                        color: reading.color,
                        borderColor: withAlpha(reading.color, 0.45),
                        background: withAlpha(reading.color, 0.12),
                        textShadow: `0 0 44px ${withAlpha(reading.color, 0.6)}`,
                      }}
                    >
                      {CRISIS_LEVEL_LABEL[reading.level]}
                    </span>
                    <div className="flex items-baseline gap-2 font-mono">
                      <span
                        data-testid="crisis-score"
                        className="text-[clamp(3rem,8vh,5.5rem)] font-bold tabular-nums leading-none"
                        style={{ color: reading.color }}
                      >
                        {shown}
                      </span>
                      <span className="text-[clamp(1.25rem,3.5vh,2.5rem)] text-muted-foreground">/ 100</span>
                    </div>
                  </div>
                )}
              </div>

              <p className="text-[11px] uppercase tracking-[0.26em] text-muted-foreground/70">
                Indeks 0–100 · tinggi = bahaya
              </p>
            </>
          )}
        </div>

        {/* Middle — the biggest threat and the topics feeding it. */}
        <ThreatTopics
          threat={live === "live" ? threat : null}
          related={live === "live" ? related : []}
          accent={reading.color}
        />

        {/* Right — who is driving that threat's topic. */}
        <ThreatActors
          items={live === "live" ? threatActors : []}
          category={live === "live" && threat ? threat.category : null}
          loading={live === "loading" || (live === "live" && actorsLoading)}
        />
      </div>
    </section>
  );
}
