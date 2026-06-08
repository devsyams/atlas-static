"use client";

import { useEffect, useRef, useState } from "react";
import { Calculator, Clapperboard, Megaphone, MessageCircle, Users } from "lucide-react";
import {
  TIER_LABEL,
  TIER_MULTIPLIER,
  negativeBaselineFromIssue,
  responseCalculator,
  type ResponseTier,
} from "@/lib/danantara/ceo/counter-noise";
import { buildResponseBrief, whatsappResponseLink } from "@/lib/danantara/ceo/response-dispatch";

type Topic = {
  title: string;
  reach: number;
  mentions: number;
  posMentions: number;
  negMentions: number;
  aiLine?: string;
};

/** War-room WhatsApp number for response dispatch — set via env, demo fallback. */
const WA_NUMBER = process.env.NEXT_PUBLIC_RESPONSE_WHATSAPP || "6287701701717";

const TIERS: ResponseTier[] = ["basic", "professional", "enterprise"];

const CHANNELS = [
  { key: "clipper", label: "Clipper clips", pct: "50%", Icon: Clapperboard },
  { key: "kol", label: "KOL posts", pct: "30%", Icon: Megaphone },
  { key: "homeless", label: "Homeless posts", pct: "20%", Icon: Users },
] as const;

const LINE_MS = 460; // per terminal line — longer, deliberate "analysis"

/** True once `ref` scrolls into view (falls back to true where IntersectionObserver is absent — jsdom/SSR). */
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
    const fallback = setTimeout(() => setInView(true), 2500); // safety net for odd scroll containers
    return () => {
      obs.disconnect();
      clearTimeout(fallback);
    };
  }, []);
  return { ref, inView };
}

const reducedMotion = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Count from 0 → target while `run` (eased). */
function useCountUp(target: number, run: boolean, duration = 800): number {
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
 * Counter-Noise · Response Calculator (A9 v2.2). The boss's model: counter-actions
 * = negative-post baseline × tier multiplier, split clipper 50% / kol 30% /
 * homeless 20%. On the **first** scroll-into-view, **Nexorus AI runs a terminal
 * analysis** (a fake console booting through fetch → parse → analyze → model →
 * synthesize) then reveals the counts with a count-up. The run happens **once**;
 * changing the service tier afterwards just recomputes the numbers instantly.
 */
export function CounterNoisePanel({ issue }: { issue: Topic }) {
  const [tier, setTier] = useState<ResponseTier>("professional");
  const { ref, inView } = useInView<HTMLDivElement>();

  const baseline = negativeBaselineFromIssue(issue);
  const plan = responseCalculator(baseline, tier);
  const planValue: Record<(typeof CHANNELS)[number]["key"], number> = {
    clipper: plan.clipper,
    kol: plan.kol,
    homeless: plan.homeless,
  };

  // The terminal boot lines (baseline interpolated). First line is the command.
  const lines = [
    "nexorus-ai analyze --topic danantara --mode comms-response",
    "establishing secure feed · garudaperkasa.io",
    "fetching negative-signal cluster",
    `parsing anti-client posts … ${baseline.toLocaleString("en-US")} flagged`,
    "analyzing narrative & sentiment vectors",
    "cross-referencing channel reach · kol/clipper/homeless",
    "modeling communication-response spread",
    "synthesizing response matrix",
  ];

  // Animation plays once (on first inView). jsdom/SSR jump straight to the result.
  const animatable = typeof IntersectionObserver !== "undefined";
  const [done, setDone] = useState(!animatable);
  const [lineIdx, setLineIdx] = useState(animatable ? 0 : lines.length);
  const [revealing, setRevealing] = useState(false);
  const [tierTouched, setTierTouched] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (!animatable || !inView || started.current) return;
    started.current = true;
    const timers = lines.map((_, i) => setTimeout(() => setLineIdx(i + 1), i * LINE_MS));
    const finish = setTimeout(() => {
      setDone(true);
      setRevealing(true);
    }, lines.length * LINE_MS);
    const revealEnd = setTimeout(() => setRevealing(false), lines.length * LINE_MS + 850);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(finish);
      clearTimeout(revealEnd);
    };
    // Intentionally NOT keyed on `tier` — the analysis runs once; tier changes recompute silently.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animatable, inView]);

  const animated: Record<(typeof CHANNELS)[number]["key"], number> = {
    clipper: useCountUp(plan.clipper, revealing),
    kol: useCountUp(plan.kol, revealing),
    homeless: useCountUp(plan.homeless, revealing),
  };

  return (
    <section
      ref={ref}
      data-testid="counter-noise"
      className={`relative overflow-hidden rounded-xl border border-primary/40 bg-primary/5 p-4 ${done ? "" : "cn-analyzing"}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-base font-bold uppercase tracking-[0.18em] text-primary">
          <Calculator className="h-4 w-4" /> Communication Response Calculator
        </div>
        <div className="ml-auto flex rounded-lg border border-border/60 bg-background/40 p-0.5">
          {TIERS.map((t) => (
            <button
              key={t}
              type="button"
              data-testid={`tier-${t}`}
              onClick={() => {
                setTier(t);
                setTierTouched(true);
              }}
              title={`${TIER_LABEL[t]} — ×${TIER_MULTIPLIER[t]} noise multiplier`}
              className={`rounded-md px-2.5 py-1 text-base font-semibold transition-colors ${
                tier === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {TIER_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      {done ? (
        <>
          <p className="mt-2 text-base leading-snug text-muted-foreground">
            Deploy{" "}
            <span className="font-bold tabular-nums text-foreground">{plan.counterActions.toLocaleString("en-US")}</span>{" "}
            counter-actions to keep the issue from escalating:
          </p>

          <div className="mt-3 grid grid-cols-3 gap-2.5">
            {CHANNELS.map(({ key, label, pct, Icon }) => (
              <div
                key={key}
                data-testid={`counter-${key}`}
                className="flex flex-col items-center rounded-lg border border-border/60 bg-card/40 px-2 py-3 text-center"
              >
                <Icon className="h-5 w-5 shrink-0 text-primary/80" />
                <div className="mt-1.5 font-mono text-3xl font-extrabold tabular-nums text-foreground sm:text-4xl">
                  {(revealing && !tierTouched ? animated[key] : planValue[key]).toLocaleString("en-US")}
                </div>
                <div className="mt-0.5 text-base leading-tight text-muted-foreground">
                  {label} <span className="text-muted-foreground/60">· {pct}</span>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-3 text-base text-muted-foreground">
            From <span className="font-semibold tabular-nums text-foreground">{baseline.toLocaleString("en-US")}</span>{" "}
            negative posts × {plan.noiseMultiplier} ({TIER_LABEL[tier]}).
          </p>

          {/* Dispatch the brief (topic + Nexorus AI penjelasan + this plan) to the war-room WhatsApp. */}
          <a
            href={whatsappResponseLink(WA_NUMBER, buildResponseBrief(issue, plan))}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="response-dispatch"
            title="Open WhatsApp with the response brief pre-filled"
            className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-2.5 text-base font-bold text-[#06251a] shadow-sm transition hover:brightness-105"
          >
            <MessageCircle className="h-5 w-5" /> Dispatch Response via WhatsApp
          </a>
        </>
      ) : (
        /* Nexorus AI terminal — the analysis "booting". */
        <div data-testid="counter-analyzing" className="mt-3 overflow-hidden rounded-lg border border-primary/30 bg-background/80 font-mono">
          <div className="flex items-center gap-1.5 border-b border-border/50 bg-card/50 px-3 py-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
            <span className="ml-2 text-base text-muted-foreground">nexorus-ai — comms-response</span>
          </div>
          <div className="min-h-[11rem] space-y-1 px-3 py-2.5 text-base leading-relaxed">
            {lines.slice(0, lineIdx).map((line, i) => {
              const active = i === lineIdx - 1;
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
      )}
    </section>
  );
}
