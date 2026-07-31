"use client";

import { useEffect, useRef } from "react";
import { CLUSTERS, type AgentState, type SimRound, type Swarm } from "@/lib/danantara/ceo/crisis-sim";

/** Tone per state — mirrors the board's `TONE` palette so the two read as one system. */
const DOT: Record<AgentState, string> = {
  neutral: "oklch(0.66 0.03 260)",
  hostile: "oklch(0.62 0.22 25)",
  swayed: "oklch(0.72 0.17 150)",
};

const RADIUS: Record<AgentState, number> = { neutral: 1.7, hostile: 2.6, swayed: 2.4 };

/**
 * The swarm map (A15 AC7). Draws ~900 agents and their influence edges to **one**
 * `<canvas>` — as DOM nodes this would be ~3,600 elements re-styled every round and
 * would stutter on the boardroom display. Purely a renderer: it owns no simulation
 * state and computes nothing, it just paints the round it is handed.
 *
 * Redraws only when the round changes (not on a rAF loop), so an idle or paused room
 * costs nothing; the eased colour transition lives in the parent's round cadence.
 */
export function SwarmCanvas({ swarm, round, className = "" }: { swarm: Swarm; round: SimRound; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return; // jsdom and very old browsers — the counters still tell the story

    const dpr = Math.min(2, typeof window === "undefined" ? 1 : window.devicePixelRatio || 1);
    const { clientWidth: w, clientHeight: h } = canvas;
    if (w === 0 || h === 0) return;

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // Map the unit box to a **centred square**, not to the canvas rectangle: stretching
    // it to a wide viewport turned the cluster ring into an ellipse and smeared the five
    // communities into one mass.
    const pad = 16;
    const size = Math.max(0, Math.min(w, h) - pad * 2);
    const ox = (w - size) / 2;
    const oy = (h - size) / 2;
    const px = (v: number) => ox + v * size;
    const py = (v: number) => oy + v * size;

    // Edges first, faint — they read as texture, not as data.
    ctx.lineWidth = 0.5;
    for (const [a, b] of swarm.edges) {
      const sa = round.states[a];
      const sb = round.states[b];
      const hot = sa === "hostile" && sb === "hostile";
      const won = sa === "swayed" || sb === "swayed";
      ctx.strokeStyle = hot
        ? "oklch(0.62 0.22 25 / 0.22)"
        : won
          ? "oklch(0.72 0.17 150 / 0.14)"
          : "oklch(0.66 0.03 260 / 0.07)";
      ctx.beginPath();
      ctx.moveTo(px(swarm.agents[a].x), py(swarm.agents[a].y));
      ctx.lineTo(px(swarm.agents[b].x), py(swarm.agents[b].y));
      ctx.stroke();
    }

    // Agents, neutral first so the lit ones sit on top.
    const order: AgentState[] = ["neutral", "swayed", "hostile"];
    for (const state of order) {
      ctx.fillStyle = DOT[state];
      for (let i = 0; i < swarm.agents.length; i++) {
        if (round.states[i] !== state) continue;
        const a = swarm.agents[i];
        ctx.beginPath();
        ctx.arc(px(a.x), py(a.y), RADIUS[state], 0, Math.PI * 2);
        ctx.fill();
      }
      // A single glow pass per lit state rather than per agent — 900 shadowed arcs
      // is what actually costs frames.
      if (state !== "neutral") {
        ctx.save();
        ctx.globalAlpha = 0.16;
        ctx.filter = "blur(6px)";
        for (let i = 0; i < swarm.agents.length; i++) {
          if (round.states[i] !== state) continue;
          const a = swarm.agents[i];
          ctx.beginPath();
          ctx.arc(px(a.x), py(a.y), RADIUS[state] * 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    // Cluster labels anchored to their own blob — a legend in the corner told you five
    // communities existed but never which was which. Each also carries how far it has
    // turned, so the presenter can say "the critics went first, the public followed".
    ctx.font = "600 13px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "center";
    for (const c of CLUSTERS) {
      let sx = 0;
      let sy = 0;
      let n = 0;
      let hostile = 0;
      for (let i = 0; i < swarm.agents.length; i++) {
        if (swarm.agents[i].cluster !== c.key) continue;
        sx += swarm.agents[i].x;
        sy += swarm.agents[i].y;
        n++;
        if (round.states[i] === "hostile") hostile++;
      }
      if (n === 0) continue;
      const share = Math.round((hostile / n) * 100);
      const lx = px(sx / n);
      // Clear of the blob itself (scatter radius ~0.13 of the square) so the label
      // never sits on top of the agents it describes.
      const ly = py(sy / n) - size * 0.175;

      ctx.fillStyle = "oklch(0.86 0.02 260 / 0.92)";
      ctx.fillText(c.label, lx, ly);
      ctx.fillStyle = share > 50 ? "oklch(0.62 0.22 25 / 0.95)" : "oklch(0.66 0.03 260 / 0.75)";
      ctx.fillText(`${share}% hostile`, lx, ly + 15);
    }
  }, [swarm, round]);

  return (
    <canvas
      ref={ref}
      data-testid="swarm-canvas"
      role="img"
      aria-label={`Simulated population at round ${round.round}: ${round.hostile} hostile, ${round.neutral} neutral, ${round.swayed} swayed`}
      className={`block h-full w-full ${className}`}
    />
  );
}
