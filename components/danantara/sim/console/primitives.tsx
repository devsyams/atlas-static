"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

/**
 * Shared console primitives (A15 v3.0).
 *
 * This route runs a **light theme**, deliberately unlike the rest of ATLAS: it mirrors
 * the visual language the simulation-engine category has settled on — white paper, thin
 * rules, monospace for anything technical, serif for the report document. The theme is
 * scoped to the console's own wrapper so nothing leaks into the dark dashboards.
 */

/** Monospace label, e.g. `01 / Reality Seeds`. */
export function MonoLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`font-mono text-[13px] tracking-tight text-black/45 ${className}`}>{children}</span>;
}

/** A numbered step card. `state` drives the badge and the border emphasis. */
export function StepCard({
  index,
  title,
  endpoint,
  description,
  state,
  badge,
  children,
}: {
  index: string;
  title: string;
  endpoint?: string;
  description?: string;
  state: "done" | "active" | "pending";
  badge?: string;
  children?: ReactNode;
}) {
  const active = state === "active";
  return (
    <section
      data-testid={`step-card-${index}`}
      // `transition-[...] duration-300` is what makes the state change itself read as a
      // step rather than a jump-cut — without it, a card flipping pending → active
      // (border, shadow, and opacity all at once) had no transition at all.
      className={`rounded-lg border bg-white p-5 transition-[opacity,box-shadow,border-color] duration-300 ${
        active ? "border-[#e8622a] shadow-[0_0_0_1px_rgba(232,98,42,0.25)]" : "border-black/10"
      } ${state === "pending" ? "opacity-45" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-[22px] font-bold leading-none tracking-tight text-black">{index}</span>
        <h3 className="text-[17px] font-semibold text-black">{title}</h3>
        {badge && (
          <span
            className={`ml-auto rounded px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider ${
              state === "done" ? "bg-[#e6f4ec] text-[#1f7a4d]" : "bg-[#e8622a] text-white"
            }`}
          >
            {badge}
          </span>
        )}
      </div>

      {endpoint && (
        <p className="mt-3 font-mono text-[12px] text-black/45">
          <span className="text-black/70">POST</span> {endpoint}
        </p>
      )}
      {description && <p className="mt-2 text-[14px] leading-relaxed text-black/70">{description}</p>}
      {children && <div className="mt-4">{children}</div>}
    </section>
  );
}

/**
 * Tour-guide auto-scroll: as the process moves from card to card within a step, carry
 * the viewer's eye there instead of leaving them to notice a badge changed somewhere
 * below the fold. `activeIndex` is the `index` prop of the card that is *currently*
 * "active" — pass `null` when nothing should be spotlighted (e.g. the whole step is
 * already done and settled).
 *
 * Two corrections on top of the obvious "scroll to it" version:
 *
 * - **Skips the very first card of a step.** Card 01 is always instant (ontology
 *   generation, instance init) — by the time this hook runs, the *next* card is already
 *   "active", so scrolling on mount immediately shoved card 01 (and, in the graph-build
 *   step, the generated entity/relation type list) out of view before anyone saw it. A
 *   step's opening state should be read top-down, undisturbed; the tour only starts once
 *   something has genuinely advanced.
 * - **`block: "nearest"`, not `"center"`.** Centering re-scrolls even a card that's
 *   already fully visible, which reads as restless. Nearest only moves the viewport
 *   enough to bring a card that's actually off-screen into view.
 *
 * Scoped to `data-testid`, not a ref, because `StepCard` is a plain presentational
 * component reused across five different card lists — adding a ref prop to every call
 * site would be far more invasive than querying the id `StepCard` already renders.
 */
export function useSpotlightCard(activeIndex: string | null) {
  // Tracks the last index actually processed, not just a "have we started" boolean —
  // React 18 Strict Mode double-invokes effects in dev (mount → cleanup → mount again,
  // synchronously). A boolean flag flips true on the first of those two calls, so the
  // second sees "already started" and reads its own unchanged value as a genuine
  // transition — which is exactly what scrolled away from card 01 on every mount.
  // Comparing against the last-seen *value* makes a same-value re-invocation a no-op
  // instead of a false transition.
  const state = useRef<{ started: boolean; last: string | null }>({ started: false, last: null });
  useEffect(() => {
    if (!activeIndex) return;
    if (!state.current.started) {
      state.current = { started: true, last: activeIndex };
      return;
    }
    if (activeIndex === state.current.last) return;
    state.current.last = activeIndex;
    const el = document.querySelector(`[data-testid="step-card-${activeIndex}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeIndex]);
}

/** An uppercase section caption inside a step card. */
export function CardCaption({ children }: { children: ReactNode }) {
  return <div className="font-mono text-[11px] font-semibold uppercase tracking-wider text-black/40">{children}</div>;
}

/** Chip row, e.g. the generated entity/relation types. */
export function Chips({ items, testid }: { items: string[]; testid?: string }) {
  return (
    <div data-testid={testid} className="mt-2 flex flex-wrap gap-2">
      {items.map((t) => (
        <span key={t} className="rounded border border-black/12 bg-white px-2.5 py-1 font-mono text-[12px] text-black/75">
          {t}
        </span>
      ))}
    </div>
  );
}

/** The three-up stat strip used by the build and prepare steps. */
export function StatRow({ stats }: { stats: { value: string; label: string }[] }) {
  return (
    <div className="grid grid-cols-3 gap-2 rounded-lg bg-black/[0.03] px-4 py-5">
      {stats.map((s) => (
        <div key={s.label} className="text-center">
          <div className="font-mono text-[26px] font-bold leading-none text-black">{s.value}</div>
          <div className="mt-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-black/40">
            {s.label}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * The black terminal strip. Auto-scrolls to the newest line, which is what makes it
 * read as a live process rather than a static block of text.
 */
export function Terminal({ title, id, lines }: { title: string; id: string; lines: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  return (
    /* `h-full` is load-bearing: without it this box grows to fit every log line, so at
       24 lines it stood 596px tall inside its 208px slot and covered the step content
       behind it. Bounded height is also what lets the inner scroller actually scroll,
       which is what makes the auto-scroll-to-newest below do anything. */
    <div data-testid="console-terminal" className="sim-terminal flex h-full min-h-0 flex-col bg-[#0d0f12]">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-2.5">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-white/50">{title}</span>
        <span className="font-mono text-[11px] text-white/30">{id}</span>
      </div>
      <div ref={ref} className="min-h-0 flex-1 overflow-y-auto px-5 py-2.5">
        {lines.map((l, i) => (
          <div key={i} className="font-mono text-[12px] leading-6 text-white/75">
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The floating "…in real-time" pill over the graph.
 *
 * The dot was a flat `animate-pulse` opacity fade — a solid circle dimming in place. The
 * reference console instead runs an expanding ring that fades as it grows, which reads
 * more like something actively broadcasting. Reuses `.threat-pulse` (already used for the
 * map hotspot markers) rather than adding a parallel keyframe for the same effect.
 */
export function LivePill({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#3f4650] px-4 py-2 text-[13px] font-medium text-white shadow-lg">
      <span className="threat-pulse" style={{ "--c": "#7ee0a8" } as CSSProperties} aria-hidden>
        <span className="ring" />
        <span className="dot" />
      </span>
      {children}
    </div>
  );
}
