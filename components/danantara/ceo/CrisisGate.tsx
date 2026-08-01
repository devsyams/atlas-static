"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, CalendarRange, RefreshCw } from "lucide-react";
import type { CeoIssue } from "@/lib/danantara/ceo/types";
import type { TopicsSummary } from "@/lib/danantara/ceo/topics-source";
import type { DetectedThreat, ThreatDriver } from "@/lib/danantara/ceo/threats-source";
import { biggestThreat, crisisIndex, CRISIS_LEVEL_LABEL, type CrisisLevel } from "@/lib/danantara/ceo/crisis";
import { feedQuery } from "@/lib/danantara/feed-query";
import { groupIssuesBySentiment } from "@/lib/danantara/ceo/engine";
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

/** Default client brand + logo — overridable via props for the BGN rebrand (A10 v5.6). */
const DEFAULT_BRAND = "Danantara";
const DEFAULT_LOGO = "/danantara.png";

/**
 * Date-range presets for the dashboard window (A10 v7.0 — functional): each preset
 * maps to the topics BFF's allowlisted `?days=` (1 = today only). Default **7 hari**
 * (v8.0, client request; was 30). The threats + actor feeds are not date-range
 * based, so the picker drives the `/topics` fetch only.
 */
const DATE_RANGES = [
  { key: "today", label: "Hari ini", days: 1 },
  { key: "7d", label: "7 hari", days: 7 },
  { key: "30d", label: "30 hari", days: 30 },
] as const;
type RangeKey = (typeof DATE_RANGES)[number]["key"];
const DEFAULT_RANGE: RangeKey = "7d";
const DEFAULT_DAYS = 7;

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
 * Crisis Gate (A10 v5.0) — the fear-first Danantara landing, a three-column command
 * read: **left** the 0–100 Crisis Index meter (high = danger, from the `/topics`
 * feed), **middle** the single biggest **detected threat** and the keywords fuelling
 * it, **right** the real accounts driving it — both from the OpenGate `/threats`
 * feed. It answers "how bad is it, what is it, and who's causing it" in one glance;
 * the full briefing is one click away on /danantara/brief.
 */
export function CrisisGate({
  embedded = false,
  refreshNonce,
  onRefresh,
  onRangeChange,
  mediaIntelligenceHref,
  brand = DEFAULT_BRAND,
  brandLogo = DEFAULT_LOGO,
  mock = false,
}: {
  /** Sit inside a scrolling page (A13) instead of locking to one screen. */
  embedded?: boolean;
  /** Parent-driven refresh: refetch when this value *changes* (never on mount). */
  refreshNonce?: number;
  /** When provided, the header Refresh delegates to the parent instead of fetching itself. */
  onRefresh?: () => void;
  /** A13 (v7.0): notified with the new `days` when the date-range preset changes. */
  onRangeChange?: (days: number) => void;
  /** Optional OpenGate-only shortcut shown before "View briefing". */
  mediaIntelligenceHref?: string;
  /** Client brand shown as the gate title; non-default hides the Danantara briefing link (A10 v5.6). */
  brand?: string;
  /** Logo asset for the brand. */
  brandLogo?: string;
  /** Append ?mock=1 to the feed fetches — the scoped BGN demo mock (A10 v5.6). */
  mock?: boolean;
} = {}) {

  const [issues, setIssues] = useState<CeoIssue[]>([]);
  const [summary, setSummary] = useState<TopicsSummary | null>(null);
  const [threat, setThreat] = useState<DetectedThreat | null>(null);
  const [threatLoading, setThreatLoading] = useState(true);
  const [drivers, setDrivers] = useState<ThreatDriver[]>([]);
  const [rosterLoading, setRosterLoading] = useState(true);
  const [range, setRange] = useState<RangeKey>(DEFAULT_RANGE);
  const [live, setLive] = useState<Live>("loading");
  const [refreshing, setRefreshing] = useState(false);
  const mountedRef = useRef(true);
  // The selected window in days — read by every topics fetch (incl. Refresh/nonce
  // paths) without re-creating the callbacks on a preset switch.
  const daysRef = useRef<number>(DEFAULT_DAYS);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadTopics = useCallback((fresh = false) => {
    fetch(`/api/v1/danantara/topics${feedQuery({ fresh, mock, days: daysRef.current })}`)
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
  }, [mock]);

  // The #1 detected threat (OpenGate `/threats`) powers the middle column's headline.
  // Independent of the topics feed; the middle column falls back to the /topics biggest
  // threat client-side when there's no incident.
  const loadThreats = useCallback((fresh = false) => {
    fetch(`/api/v1/danantara/threats${feedQuery({ fresh, mock })}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j: { threat?: DetectedThreat | null }) => {
        if (mountedRef.current) setThreat(j.threat ?? null);
      })
      .catch(() => {
        if (mountedRef.current) setThreat(null);
      })
      .finally(() => {
        if (mountedRef.current) setThreatLoading(false);
      });
  }, [mock]);

  // The right "Aktor Penggerak" column always reads the /actor-intelligence roster
  // (v5.3) — it carries real profile pictures, so the actors stay consistent whether or
  // not a threat is live. Degrades to an empty list if the roster ever fails.
  const loadRoster = useCallback((fresh = false) => {
    fetch(`/api/v1/danantara/actor-intelligence${feedQuery({ fresh, mock })}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j: { actors?: ThreatDriver[] }) => {
        if (mountedRef.current) setDrivers(Array.isArray(j.actors) ? j.actors : []);
      })
      .catch(() => {
        if (mountedRef.current) setDrivers([]);
      })
      .finally(() => {
        if (mountedRef.current) setRosterLoading(false);
      });
  }, [mock]);

  useEffect(() => {
    loadTopics(false);
    loadThreats(false);
    loadRoster(false);
  }, [loadTopics, loadThreats, loadRoster]);

  // A13: parent-driven refresh. Fires only when the nonce *changes*, so mounting
  // with a nonce already present never double-fetches the initial load.
  const nonceRef = useRef(refreshNonce);
  useEffect(() => {
    if (refreshNonce === undefined || nonceRef.current === refreshNonce) return;
    nonceRef.current = refreshNonce;
    setRefreshing(true);
    loadTopics(true);
    loadThreats(true);
    loadRoster(true);
  }, [refreshNonce, loadTopics, loadThreats, loadRoster]);

  const reading = crisisIndex(issues, summary);
  // Panel 2 headline falls back to the /topics biggest threat when /threats has no
  // detected incident (v5.2). The top-3 "Topik pendorong" always show (from /topics),
  // excluding the fallback headline topic so it isn't listed twice.
  const fallbackThreat = threat ? null : biggestThreat(issues);
  const negatives = groupIssuesBySentiment(issues).negative;
  const related = (fallbackThreat ? negatives.filter((i) => i.id !== fallbackThreat.id) : negatives).slice(0, 3);

  // Only animate once we actually have live data — a loading/offline gate sits at 0.
  const shown = useCountUp(reading.score, live === "live");
  const fear = FEAR[reading.level];

  return (
    <section
      data-testid="crisis-gate"
      className={
        embedded
          ? // Fill the first screen at every breakpoint (A13: the gate owns screen one,
            // the page scrolls to the next section below it). No lg cap — the standalone's
            // `lg:min-h-[28rem]` was only a floor beneath its lg:h lock, which embedded
            // drops; carrying it over collapsed the section to 28rem on desktop and
            // squeezed the vh-sized gauge.
            "relative flex min-h-[calc(100dvh-9rem)] flex-col gap-4 overflow-hidden"
          : "relative flex min-h-[calc(100dvh-7.75rem)] flex-col gap-4 overflow-hidden lg:h-[calc(100dvh-7.75rem)] lg:min-h-[28rem]"
      }
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
        <div className="flex items-center gap-3.5">
          {/* Brand logo — white backdrop so a dark mark reads on the dark board
              (mirrors HeaderStrip). Scales with viewport for TV legibility. */}
          <span className="flex h-[clamp(2.75rem,6vh,4.25rem)] w-[clamp(2.75rem,6vh,4.25rem)] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/95 p-1.5 shadow-sm">
            <Image src={brandLogo} alt={brand} width={68} height={68} priority className="h-full w-full object-contain" />
          </span>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-[clamp(1.7rem,3.8vh,3rem)] font-extrabold leading-none tracking-tight text-foreground">
                {brand}
              </h1>
              {/* Live pulse — sits beside the brand name. */}
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/70" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
              </span>
            </div>
            <p className="mt-1.5 text-[clamp(0.7rem,1.5vh,0.95rem)] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Threat Index · Crisis Monitor
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Date-range window — default "30 hari"; drives the /topics `days=` window
              (v7.0). The threats/actor feeds are not date-range based. */}
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
                  onClick={() => {
                    if (range === r.key) return;
                    setRange(r.key);
                    daysRef.current = r.days;
                    onRangeChange?.(r.days);
                    loadTopics(false); // re-window the topics feed only
                  }}
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

          {mediaIntelligenceHref && (
            <a
              href={mediaIntelligenceHref}
              className="group inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/50 hover:text-primary"
            >
              Media Intelligence
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </a>
          )}
          {/* The briefing lives on a Danantara page (/danantara/brief); hide it when the
              gate is rebranded (e.g. BGN) so the page never links off-brand (A10 v5.6). */}
          {brand === DEFAULT_BRAND && (
            <Link
              href="/danantara/brief"
              data-testid="crisis-detail-link"
              className="group inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/50 hover:text-primary"
            >
              View briefing
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}
          <button
            type="button"
            onClick={() => {
              // A13: when a parent owns refresh, bumping its nonce drives the refetch —
              // firing both paths would fetch every feed twice.
              if (onRefresh) {
                onRefresh();
                return;
              }
              setRefreshing(true);
              loadTopics(true);
              loadThreats(true);
              loadRoster(true);
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
              <h2 className="text-[clamp(1.5rem,3vh,2.5rem)] font-bold text-foreground">Indeks Ancaman</h2>

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

        {/* Middle — the biggest detected threat and the keywords fuelling it. */}
        <ThreatTopics
          threat={live === "live" ? threat : null}
          fallbackThreat={live === "live" ? fallbackThreat : null}
          related={live === "live" ? related : []}
          loading={live === "loading" || (live === "live" && threatLoading)}
          accent={reading.color}
        />

        {/* Right — the key actors in the conversation (always the /actor-intelligence
            roster, so real profile pictures render whether or not a threat is live). */}
        <ThreatActors
          drivers={live === "live" ? drivers : []}
          caption="Aktor kunci dalam percakapan"
          loading={live === "loading" || (live === "live" && rosterLoading)}
        />
      </div>
    </section>
  );
}
