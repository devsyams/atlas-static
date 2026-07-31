"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Swords } from "lucide-react";
import { TIER_LABEL, TIER_MULTIPLIER } from "@/lib/danantara/ceo/counter-noise";
import { aggregateWarRoom, counterNarrativePlan, type ResponseTier } from "@/lib/danantara/ceo/counter-narrative";
import { CounterTopicCard } from "./CounterTopicCard";
import { ShareOfVoiceBar } from "./ShareOfVoiceBar";
import { useCounterNarrative } from "./useCounterNarrative";

const TIERS: ResponseTier[] = ["basic", "professional", "enterprise"];

/** Terminal pacing. The last line is *held* while the model is still working. */
const LINE_MS = 420;
/** Floor so a warm cache hit doesn't flash the terminal for 40ms. */
const MIN_SHOW_MS = 2_400;
/**
 * Ceiling: past this the fallback is revealed regardless — the section never hangs.
 * Measured against the live model, a cold 3-topic call lands in ~25 s, so a tighter
 * ceiling made every cold load flash `Simulated` before upgrading. The terminal is
 * honest about what it's doing, so waiting it out reads better than the flip; a warm
 * cache (6 h) returns in milliseconds and never reaches this.
 */
const MAX_WAIT_MS = 30_000;

const BOOT_LINES = [
  "nexorus-ai counter --topic danantara --mode war-room",
  "locking top 3 negative topics by negative reach",
  "computing hostile reach · share of voice",
  "drafting counter-narrative angles",
  "generating KOL / clipper / grassroots drafts (id-ID)",
  "validating drafts · no fabricated figures",
];

/** True once `ref` scrolls into view (true where IntersectionObserver is absent — jsdom/SSR). */
function useInView<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(typeof IntersectionObserver === "undefined");
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold: 0, rootMargin: "0px 0px -8% 0px" },
    );
    obs.observe(el);
    // AppShell's <main> is the scroller, not the window — keep A9's safety net.
    const fallback = setTimeout(() => setInView(true), 2500);
    return () => {
      obs.disconnect();
      clearTimeout(fallback);
    };
  }, []);
  return { ref, inView };
}

/**
 * Counter-Narrative War Room (A14 v1.0) — the third section of `/danantara/command`,
 * answering the question the other two don't: **"so what do we post?"**
 *
 * For the top 3 negative topics by *negative reach*: the attack as its authors frame
 * it, our counter angle, and three ready-to-post Indonesian drafts (disclosed KOL,
 * owned-channel clipper, employee/community advocate) — plus the reach math for how
 * many posts it takes to win the share of voice, all recomputed client-side when the
 * tier changes.
 *
 * The Nexorus terminal here is an **honest** loading state, unlike A9's fixed script:
 * it narrates the work actually in flight and holds its last line while the model is
 * still answering, so a slow call reads as a blinking cursor rather than a spinner.
 * A `MAX_WAIT_MS` ceiling reveals the deterministic fallback regardless, and a late
 * answer upgrades in place.
 */
export function CounterNarrativeWarRoom({ refreshNonce }: { refreshNonce?: number } = {}) {
  const [tier, setTier] = useState<ResponseTier>("professional");
  const { topics, data, source, feed, pending } = useCounterNarrative(refreshNonce);
  const { ref, inView } = useInView<HTMLElement>();

  // The terminal runs once the section is seen and there is something to narrate.
  const armed = inView && feed !== "loading" && topics.length > 0;
  const [lineIdx, setLineIdx] = useState(0);
  const [elapsed, setElapsed] = useState(false); // MIN_SHOW_MS passed
  const [expired, setExpired] = useState(false); // MAX_WAIT_MS passed
  const started = useRef(false);

  useEffect(() => {
    if (!armed || started.current) return;
    started.current = true;
    const timers = BOOT_LINES.map((_, i) => setTimeout(() => setLineIdx(i + 1), i * LINE_MS));
    const floor = setTimeout(() => setElapsed(true), MIN_SHOW_MS);
    const ceiling = setTimeout(() => setExpired(true), MAX_WAIT_MS);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(floor);
      clearTimeout(ceiling);
    };
  }, [armed]);

  // Reveal when the answer has landed (past the floor) or we've waited long enough.
  // Latched with a ref rather than state-in-an-effect: a later refresh flips
  // `pending` back on, and without the latch the section would collapse to the
  // terminal again mid-read. A late answer must upgrade in place, never re-boot.
  const revealed = armed && ((!pending && elapsed) || expired);
  const [reveal, setReveal] = useState(false);
  if (revealed && !reveal) setReveal(true); // adjust-during-render, not in an effect

  const plans = useMemo(() => topics.map((t) => counterNarrativePlan(t, tier)), [topics, tier]);
  const totals = useMemo(() => aggregateWarRoom(plans), [plans]);

  return (
    <section ref={ref} data-testid="counter-war-room" className={`panel relative flex flex-col overflow-hidden ${reveal ? "" : "cn-analyzing"}`}>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2.5">
        <Swords className="h-5 w-5 shrink-0 text-primary" />
        <span className="text-xl font-semibold uppercase tracking-[0.18em]">Counter-Narrative War Room</span>

        <span
          data-testid="war-room-source"
          className={`text-base uppercase tracking-widest ${source === "llm" ? "text-primary" : "text-muted-foreground"}`}
        >
          {source === "llm" ? "● Nexorus AI · LLM" : "Simulated"}
        </span>

        <div className="ml-auto flex rounded-lg border border-border/60 bg-background/40 p-0.5">
          {TIERS.map((t) => (
            <button
              key={t}
              type="button"
              data-testid={`war-tier-${t}`}
              onClick={() => setTier(t)}
              title={`${TIER_LABEL[t]} — ×${TIER_MULTIPLIER[t]} share-of-voice target`}
              className={`rounded-md px-2.5 py-1 text-base font-semibold transition-colors ${
                tier === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {TIER_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 p-3">
        {feed === "offline" ? (
          <p data-testid="war-room-offline" className="py-6 text-center text-base text-muted-foreground">
            Topic feed unavailable — counter-narratives will return with the feed.
          </p>
        ) : feed === "loading" ? (
          <WarRoomSkeleton />
        ) : topics.length === 0 ? (
          <p data-testid="war-room-empty" className="py-6 text-center text-base text-muted-foreground">
            No negative topics in the current window — nothing to counter.
          </p>
        ) : !reveal ? (
          <BootTerminal lineIdx={lineIdx} pending={pending} />
        ) : (
          <>
            <ShareOfVoiceBar totals={totals} tier={tier} animate={reveal} />

            <ol data-testid="war-room-topics" className="grid grid-cols-1 items-stretch gap-3 xl:grid-cols-3">
              {data.topics.map((t, i) => (
                <CounterTopicCard key={t.topicId} rank={i + 1} topic={t} plan={plans[i]} />
              ))}
            </ol>

            <p className="text-base leading-snug text-muted-foreground/80">
              Drafts are talking points for <strong className="font-semibold">disclosed</strong> paid partners, the
              client&apos;s own channels, and employee/community advocates — not for undisclosed or automated posting.
              Hostile reach is an estimate (total reach × negative impression share).
            </p>
          </>
        )}
      </div>
    </section>
  );
}

/** The honest terminal: narrates the work in flight, holds its last line while pending. */
function BootTerminal({ lineIdx, pending }: { lineIdx: number; pending: boolean }) {
  const shown = Math.max(1, Math.min(lineIdx, BOOT_LINES.length));
  return (
    <div data-testid="war-room-analyzing" className="overflow-hidden rounded-lg border border-primary/30 bg-background/80 font-mono">
      <div className="flex items-center gap-1.5 border-b border-border/50 bg-card/50 px-3 py-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
        <span className="ml-2 text-base text-muted-foreground">nexorus-ai — counter-narrative</span>
        {pending && <span className="cn-blip ml-auto h-2 w-2 rounded-full bg-primary" aria-hidden />}
      </div>
      <div className="min-h-[9rem] space-y-1 px-3 py-2.5 text-base leading-relaxed">
        {BOOT_LINES.slice(0, shown).map((line, i) => {
          const active = i === shown - 1;
          const isCmd = i === 0;
          return (
            <div key={i} className="cn-line flex items-start gap-2">
              <span className={isCmd ? "text-primary" : "text-success"}>{isCmd ? "$" : "›"}</span>
              <span className="min-w-0 flex-1 break-words text-foreground/90">
                {line}
                {active && <span className="cn-cursor ml-1 inline-block text-primary">▋</span>}
              </span>
              {!isCmd && !active && <span className="shrink-0 text-success">[ok]</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Shimmer placeholders mirroring the real geometry, so nothing jumps on arrival. */
function WarRoomSkeleton() {
  return (
    <div data-testid="war-room-skeleton" aria-busy className="flex flex-col gap-3">
      <div className="skeleton h-20 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="panel space-y-2.5 p-3">
            <div className="skeleton h-6 w-[80%]" />
            <div className="skeleton h-4 w-[60%]" />
            <div className="skeleton h-16 w-full rounded-lg" />
            <div className="skeleton h-16 w-full rounded-lg" />
            <div className="skeleton h-16 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
