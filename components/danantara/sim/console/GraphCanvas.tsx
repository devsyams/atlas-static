"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { drag as d3drag } from "d3-drag";
import { select } from "d3-selection";
import { zoom as d3zoom, zoomIdentity, type ZoomTransform } from "d3-zoom";
import type { ConsoleOntology } from "@/lib/danantara/sim/console-types";
import { buildGraph, createSimulation, nodeRadius, typeColor, type SimNode } from "@/lib/danantara/sim/graph-layout";

/**
 * Two different tolerances, deliberately.
 *
 * `PICK` is forgiving — a click near a dot should select it, because dots are small and
 * missing by 3px is annoying. `GRAB` is tight, and is what decides whether a press starts
 * a *node drag* or a *canvas pan*. Using one forgiving radius for both is what made
 * panning feel broken: at 54 nodes, a 16px blocking halo around every dot covers much of
 * the canvas, so "drag to move" kept grabbing a node instead of moving the view.
 */
const PICK_RADIUS = 16;
const GRAB_PADDING = 3;
/** Pointer travel (px) past which a press counts as a pan/drag rather than a click. */
const CLICK_SLOP = 4;

/**
 * Knowledge-graph visualisation (A15 v5.0) — d3-force physics on a single `<canvas>`.
 *
 * Canvas rather than SVG because the v5.0 world is ~70 nodes and ~200 edges with an edge
 * label on each: as DOM that's several hundred elements re-laid-out on every tick of a
 * live simulation. Everything is drawn in *screen* space (points transformed by hand
 * rather than via `ctx.scale`) so that zooming magnifies the graph without also
 * magnifying label text and line weights into a blurry mess.
 *
 * `revealed` is the fraction of the graph to show (0..1) so the build step can grow the
 * graph as the "GraphRAG build" progresses, which is what the log claims is happening.
 */
export function GraphCanvas({
  ontology,
  seedKey,
  revealed = 1,
  showEdgeLabels = true,
  selected = null,
  onSelect,
  className = "",
}: {
  ontology: ConsoleOntology;
  seedKey: string;
  revealed?: number;
  showEdgeLabels?: boolean;
  /** Selected node id — highlighted, with everything unrelated dimmed. */
  selected?: string | null;
  onSelect?: (id: string | null) => void;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<string | null>(null);

  const model = useMemo(
    () => buildGraph(ontology.nodes, ontology.edges, ontology.entityTypes, seedKey),
    [ontology, seedKey],
  );

  /** User pan/zoom, on top of the auto-fit. */
  const tRef = useRef<ZoomTransform>(zoomIdentity);
  /** Auto-fit (graph bounds → viewport). Frozen once the user takes control. */
  const fitRef = useRef({ k: 1, tx: 0, ty: 0 });
  const userMovedRef = useRef(false);
  /**
   * Latest render inputs, so the tick loop doesn't need to be re-created on each change.
   * Written from an effect, not during render — the simulation reads it asynchronously.
   */
  const viewRef = useRef({ revealed, showEdgeLabels, selected, hover });

  /** Handles published by the simulation effect for prop-driven repaints. */
  const drawRef = useRef<(() => void) | null>(null);
  const zoomResetRef = useRef<(() => void) | null>(null);
  const prevRevealed = useRef(revealed);
  /** Kept in a ref so changing the callback doesn't tear down the simulation. */
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  const toScreen = useCallback((gx: number, gy: number) => {
    const t = tRef.current;
    const f = fitRef.current;
    return { x: t.k * (f.k * gx + f.tx) + t.x, y: t.k * (f.k * gy + f.ty) + t.y };
  }, []);

  /**
   * Nearest node to a pointer position.
   *
   * `mode: "pick"` uses the forgiving radius (clicking to select). `mode: "grab"` only
   * matches a press actually on the dot, scaled with the current zoom so the target grows
   * as you zoom in — everywhere else stays free for panning.
   */
  const hit = useCallback(
    (clientX: number, clientY: number, mode: "pick" | "grab" = "pick"): SimNode | null => {
      const canvas = ref.current;
      if (!canvas) return null;
      const r = canvas.getBoundingClientRect();
      const x = clientX - r.left;
      const y = clientY - r.top;
      const scale = tRef.current.k * fitRef.current.k;

      let best: SimNode | null = null;
      let bestD = Infinity;
      for (const n of model.nodes) {
        const p = toScreen(n.x ?? 0, n.y ?? 0);
        const dx = p.x - x;
        const dy = p.y - y;
        const d = dx * dx + dy * dy;
        const reach =
          mode === "pick" ? PICK_RADIUS : nodeRadius(n.degree) * Math.max(0.6, scale) + GRAB_PADDING;
        if (d < reach * reach && d < bestD) {
          bestD = d;
          best = n;
        }
      }
      return best;
    },
    [model, toScreen],
  );

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    // jsdom has no 2d context. Bail before starting the simulation — an unstoppable
    // rAF loop under a test's fake timers is a hang, and the step cards already carry
    // the same information in text.
    if (!ctx) return;

    const sim = createSimulation(model, seedKey);

    const draw = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const { clientWidth: w, clientHeight: h } = canvas;
      if (w === 0 || h === 0) return;

      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const { revealed: rev, showEdgeLabels: labels, selected: sel, hover: hov } = viewRef.current;

      // Auto-fit to the graph's current bounds until the user pans or zooms; after that
      // the view is theirs and must not creep as the simulation settles.
      if (!userMovedRef.current) {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (const n of model.nodes) {
          minX = Math.min(minX, n.x ?? 0);
          minY = Math.min(minY, n.y ?? 0);
          maxX = Math.max(maxX, n.x ?? 0);
          maxY = Math.max(maxY, n.y ?? 0);
        }
        if (Number.isFinite(minX)) {
          // Asymmetric padding: the entity-type legend floats over the top-left and the
          // "updating in real-time" pill over the bottom. Fitting to the raw box tucked
          // real nodes underneath them, so the fit reserves that space instead.
          const padX = 54;
          const padTop = 96;
          const padBottom = 56;
          const gw = Math.max(1, maxX - minX);
          const gh = Math.max(1, maxY - minY);
          const k = Math.min((w - padX * 2) / gw, Math.max(1, h - padTop - padBottom) / gh, 1.6);
          fitRef.current = {
            k,
            tx: w / 2 / k - (minX + maxX) / 2,
            ty: (padTop + (h - padBottom)) / 2 / k - (minY + maxY) / 2,
          };
        }
      }

      const shown = Math.max(2, Math.round(model.nodes.length * Math.min(1, Math.max(0, rev))));
      const visible = new Set(model.nodes.slice(0, shown).map((n) => n.id));

      // Selection: the focused node, everything it touches, and nothing else stays lit.
      const focus = sel ?? hov;
      const related = new Set<string>();
      if (focus) {
        related.add(focus);
        for (const l of model.links) {
          const s = (l.source as SimNode).id;
          const t = (l.target as SimNode).id;
          if (s === focus) related.add(t);
          if (t === focus) related.add(s);
        }
      }

      // Label placement is shared across edges and nodes: boxes already claimed here
      // block anything drawn later, and node labels get first claim (an entity name is
      // worth more on screen than a relation type).
      const taken: { x0: number; y0: number; x1: number; y1: number }[] = [];
      const collides = (b: { x0: number; y0: number; x1: number; y1: number }) =>
        taken.some((o) => b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0);
      const edgeLabels: { text: string; x: number; y: number; dim: boolean }[] = [];

      // Edges first — thin grey, with their relation label at the midpoint. A `curve`
      // of 0 draws a straight `lineTo`; a non-zero value bows through a quadratic control
      // point offset perpendicular to the line — see `assignCurves` for when that fires
      // (never for a lone edge, always when several relations share the same two nodes,
      // so overlapping edges never trace the same pixels and hide each other's label).
      ctx.font = "9px 'JetBrains Mono', ui-monospace, monospace";
      ctx.textAlign = "center";
      for (const l of model.links) {
        const a = l.source as SimNode;
        const b = l.target as SimNode;
        if (!visible.has(a.id) || !visible.has(b.id)) continue;
        const on = !focus || a.id === focus || b.id === focus;

        const p = toScreen(a.x ?? 0, a.y ?? 0);
        const q = toScreen(b.x ?? 0, b.y ?? 0);

        ctx.lineWidth = on && focus ? 1.6 : 0.8;
        ctx.strokeStyle = on ? (focus ? "rgba(0,0,0,0.45)" : "rgba(0,0,0,0.16)") : "rgba(0,0,0,0.04)";
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);

        let labelX = (p.x + q.x) / 2;
        let labelY = (p.y + q.y) / 2 - 3;

        if (l.curve === 0) {
          ctx.lineTo(q.x, q.y);
        } else {
          const dx = q.x - p.x;
          const dy = q.y - p.y;
          // Perpendicular to the p→q vector, scaled by the edge's own on-screen length so
          // the bow reads the same whether zoomed in or out.
          const cx = (p.x + q.x) / 2 - dy * l.curve;
          const cy = (p.y + q.y) / 2 + dx * l.curve;
          ctx.quadraticCurveTo(cx, cy, q.x, q.y);
          // The curve's true midpoint (De Casteljau at t=0.5), not the straight-line
          // midpoint — otherwise the label floats off to one side of its own edge.
          labelX = (p.x + 2 * cx + q.x) / 4;
          labelY = (p.y + 2 * cy + q.y) / 4 - 3;
        }
        ctx.stroke();

        // With a node focused, only its own relations are candidates — otherwise the
        // highlight is buried under the labels of everything it isn't connected to.
        if (labels && on) {
          edgeLabels.push({ text: l.label, x: labelX, y: labelY, dim: !focus });
        }
      }

      // Nodes — size by degree so hubs read as hubs. Dots first, labels second: a label
      // drawn in the first pass would be overpainted by a dot drawn in the second.
      ctx.textAlign = "left";
      for (const n of model.nodes) {
        if (!visible.has(n.id)) continue;
        const on = !focus || related.has(n.id);
        const isFocus = n.id === focus;
        const r = nodeRadius(n.degree) * (isFocus ? 1.5 : 1);
        const { x, y } = toScreen(n.x ?? 0, n.y ?? 0);

        ctx.globalAlpha = on ? 1 : 0.18;

        if (isFocus) {
          ctx.beginPath();
          ctx.arc(x, y, r + 5, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(0,0,0,0.07)";
          ctx.fill();
        }

        ctx.fillStyle = typeColor(model.typeIndex, n.type);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();

        if (isFocus) {
          ctx.lineWidth = 2;
          ctx.strokeStyle = "#000";
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      // Labels, collision-avoided. At 54 nodes a label per dot is unreadable mush, and a
      // fixed degree cutoff either hides too much when zoomed in or too little when
      // zoomed out. Placing them by priority and skipping any that would overlap one
      // already placed self-tunes: zooming in spreads the dots, boxes stop colliding,
      // and more labels appear — which is exactly the behaviour you want when exploring.
      const ordered = model.nodes
        .filter((n) => visible.has(n.id) && (!focus || related.has(n.id)))
        .sort((a, b) => Number(b.id === focus) - Number(a.id === focus) || b.degree - a.degree);

      for (const n of ordered) {
        const isFocus = n.id === focus;
        const r = nodeRadius(n.degree) * (isFocus ? 1.5 : 1);
        const { x, y } = toScreen(n.x ?? 0, n.y ?? 0);

        ctx.font = isFocus
          ? "700 12px ui-sans-serif, system-ui, sans-serif"
          : "600 11px ui-sans-serif, system-ui, sans-serif";
        const text = !isFocus && n.label.length > 16 ? `${n.label.slice(0, 15)}…` : n.label;
        const tw = ctx.measureText(text).width;
        const box = { x0: x + r + 4, y0: y - 7, x1: x + r + 8 + tw, y1: y + 7 };

        // The focused node always keeps its label — that one is an answer to a click.
        if (!isFocus && collides(box)) continue;
        taken.push(box);

        ctx.fillStyle = "rgba(0,0,0,0.82)";
        ctx.fillText(text, x + r + 4, y + 4);
      }

      // Relation types last, into whatever space the entity names left behind.
      ctx.font = "9px 'JetBrains Mono', ui-monospace, monospace";
      ctx.textAlign = "center";
      for (const e of edgeLabels) {
        const half = ctx.measureText(e.text).width / 2;
        const box = { x0: e.x - half - 2, y0: e.y - 6, x1: e.x + half + 2, y1: e.y + 5 };
        if (collides(box)) continue;
        taken.push(box);
        ctx.fillStyle = e.dim ? "rgba(0,0,0,0.34)" : "rgba(0,0,0,0.6)";
        ctx.fillText(e.text, e.x, e.y);
      }
    };

    // Coalesce repaints into one per animation frame. A wheel can fire several events
    // between frames and the simulation ticks on its own clock; without this they each
    // force a synchronous full redraw, so the work is done two or three times over for a
    // single visible frame.
    let raf = 0;
    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        draw();
      });
    };

    sim.on("tick", schedule);
    drawRef.current = schedule;

    // --- Interaction ------------------------------------------------------------
    const sel = select<HTMLCanvasElement, unknown>(canvas);
    const graphPoint = (ev: { clientX: number; clientY: number }) => {
      const r = canvas.getBoundingClientRect();
      const t = tRef.current;
      const f = fitRef.current;
      return {
        x: ((ev.clientX - r.left - t.x) / t.k - f.tx) / f.k,
        y: ((ev.clientY - r.top - t.y) / t.k - f.ty) / f.k,
      };
    };

    // Drag a node: pin it while held, release it back into the simulation after.
    const dragBehaviour = d3drag<HTMLCanvasElement, unknown>()
      .subject((ev) => hit(ev.sourceEvent.clientX, ev.sourceEvent.clientY, "grab") ?? undefined)
      .on("start", (ev) => {
        // 0.12 rather than 0.25: enough to let neighbours give way, low enough that the
        // rest of the graph doesn't visibly thrash around the node you're holding.
        if (!ev.active) sim.alphaTarget(0.12).restart();
        const n = ev.subject as SimNode;
        n.fx = n.x;
        n.fy = n.y;
      })
      .on("drag", (ev) => {
        const n = ev.subject as SimNode;
        const p = graphPoint(ev.sourceEvent);
        n.fx = p.x;
        n.fy = p.y;
      })
      .on("end", (ev) => {
        if (!ev.active) sim.alphaTarget(0);
        const n = ev.subject as SimNode;
        n.fx = null;
        n.fy = null;
      });

    const zoomBehaviour = d3zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.25, 6])
      // d3's default is ~0.002/px, which on a Windows mouse (deltaY ±100 per notch) is a
      // ~15% jump per click of the wheel — visibly steppy. Halving it trades one big jump
      // for two small ones, and trackpads get a genuinely continuous ramp.
      .wheelDelta((ev: WheelEvent) => -ev.deltaY * (ev.deltaMode === 1 ? 0.025 : ev.deltaMode ? 0.5 : 0.001))
      // Pan only from empty space — starting on a dot belongs to the drag behaviour.
      .filter((ev: Event) => {
        if (ev.type === "wheel") return true;
        const m = ev as MouseEvent;
        return hit(m.clientX, m.clientY, "grab") === null;
      })
      .on("start", (ev) => {
        // Only a pointer pan gets the grabbing cursor; a wheel-zoom is not a grab.
        if (ev.sourceEvent && ev.sourceEvent.type !== "wheel") canvas.style.cursor = "grabbing";
      })
      .on("zoom", (ev) => {
        tRef.current = ev.transform;
        // Freeze the auto-fit once the view is the user's — but do NOT treat this as a
        // click-cancelling gesture: a wheel-zoom is not a drag, and conflating the two
        // is what made every click after a scroll get swallowed.
        if (ev.sourceEvent) userMovedRef.current = true;
        schedule();
      })
      .on("end", () => {
        canvas.style.cursor = ""; // hand back to the class-driven cursor
      });

    sel.call(dragBehaviour).call(zoomBehaviour);

    // Selection and hover run on native listeners rather than React props. d3-zoom and
    // d3-drag both call `stopImmediatePropagation` on the pointer events they claim, and
    // React delegates from the root — so a React `onClick` here is at d3's mercy. Owning
    // the listeners keeps clicking a node working no matter what d3 did first.
    let downAt: { x: number; y: number } | null = null;
    const onPointerDown = (e: PointerEvent) => {
      downAt = { x: e.clientX, y: e.clientY };
    };
    const onClick = (e: MouseEvent) => {
      const from = downAt;
      downAt = null;
      // A click that ended a pan or a node drag must not also change the selection.
      if (from && Math.hypot(e.clientX - from.x, e.clientY - from.y) > CLICK_SLOP) return;
      onSelectRef.current?.(hit(e.clientX, e.clientY)?.id ?? null);
    };
    // "grab" so the pointer cursor and the highlight only appear where a press would
    // actually take the node — otherwise the graph lights up while you're trying to pan.
    const onMove = (e: MouseEvent) => setHover(hit(e.clientX, e.clientY, "grab")?.id ?? null);
    const onLeave = () => setHover(null);

    canvas.addEventListener("pointerdown", onPointerDown, true);
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseleave", onLeave);

    zoomResetRef.current = () => {
      userMovedRef.current = false;
      tRef.current = zoomIdentity;
      sel.call(zoomBehaviour.transform, zoomIdentity);
    };

    draw();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      sim.stop();
      sim.on("tick", null);
      sel.on(".zoom", null).on(".drag", null);
      canvas.removeEventListener("pointerdown", onPointerDown, true);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mouseleave", onLeave);
      drawRef.current = null;
      zoomResetRef.current = null;
    };
  }, [model, seedKey, hit, toScreen]);

  // Reveal / selection / label-toggle changes repaint without disturbing the physics.
  useEffect(() => {
    viewRef.current = { revealed, showEdgeLabels, selected, hover };
    drawRef.current?.();
  }, [revealed, showEdgeLabels, selected, hover]);

  // Replaying the build (the Refresh button walks `revealed` back to 0) should also
  // reset the camera and re-settle the graph, or the "rebuild" visibly doesn't rebuild.
  useEffect(() => {
    if (revealed < prevRevealed.current) zoomResetRef.current?.();
    prevRevealed.current = revealed;
  }, [revealed]);

  return (
    <canvas
      ref={ref}
      data-testid="graph-canvas"
      aria-label={`Knowledge graph: ${ontology.nodes.length} entities, ${ontology.edges.length} relations`}
      className={`block h-full w-full touch-none ${hover ? "cursor-pointer" : "cursor-grab"} ${className}`}
    />
  );
}
