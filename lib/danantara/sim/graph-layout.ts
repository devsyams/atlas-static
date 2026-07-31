/**
 * Knowledge-graph layout (A15 v5.0) — **d3-force**, the same engine MiroFish's console
 * uses (their frontend is Vue 3 + `d3` ^7.9.0; we're React, so we take the same modules
 * rather than the same components).
 *
 * v4.0 hand-rolled a relaxation loop: fine at 18 nodes, but it is O(n²) per iteration and
 * the v5.0 world is ~70 nodes with ~200 edges. d3-force uses a Barnes–Hut quadtree for the
 * repulsion term, and — the reason that matters here — it ticks *incrementally*, so the
 * graph can be drawn while it settles. That settling motion is most of what makes the
 * build step look like a live process instead of a picture fading in.
 *
 * Determinism survives the switch: d3 only reaches for randomness when seeding initial
 * positions and jittering coincident nodes, and `simulation.randomSource()` lets us hand
 * it our own seeded PRNG. Same paste → same picture, every rehearsal.
 */

import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import { mulberry32 } from "@/lib/danantara/ceo/engine";
import { seedFromString } from "@/lib/danantara/ceo/crisis-sim";
import type { GraphEdge, GraphNode } from "./console-types";

export interface SimNode extends SimulationNodeDatum, GraphNode {
  /** Edge count — drives dot size, so hubs read as hubs. */
  degree: number;
}

export interface SimLink extends SimulationLinkDatum<SimNode> {
  source: string | SimNode;
  target: string | SimNode;
  label: string;
  /**
   * Perpendicular bow as a fraction of the link's length. `0` draws straight; a non-zero
   * value bends the edge into a quadratic curve. Reference: MiroFish's console renders
   * every single edge straight and only bends edges when more than one relation connects
   * the same two nodes — otherwise two overlapping straight lines read as one, and
   * whichever label was drawn last silently hides the other.
   */
  curve: number;
}

export interface GraphModel {
  nodes: SimNode[];
  links: SimLink[];
  /** Stable index for colouring; entity type → palette slot. */
  typeIndex: Map<string, number>;
}

/** Virtual simulation space. The canvas fits this to the viewport, so units are arbitrary. */
const SPREAD = 520;

/** Dot radius for a node — also the collision radius, so labels have room to breathe. */
export function nodeRadius(degree: number): number {
  return 4.5 + Math.min(7, degree * 0.55);
}

/**
 * Build the force-graph model: nodes and links with seeded starting positions.
 *
 * Nodes start on a jittered ring rather than d3's default phyllotaxis spiral — with a
 * graph this clustered, a ring untangles into readable communities noticeably faster.
 */
export function buildGraph(
  nodes: GraphNode[],
  edges: GraphEdge[],
  entityTypes: string[],
  seedKey: string,
): GraphModel {
  const rand = mulberry32(seedFromString(seedKey) ^ 0x5bf03635);

  const degree = new Map<string, number>();
  for (const e of edges) {
    degree.set(e.s, (degree.get(e.s) ?? 0) + 1);
    degree.set(e.t, (degree.get(e.t) ?? 0) + 1);
  }

  const n = Math.max(1, nodes.length);
  const simNodes: SimNode[] = nodes.map((node, i) => {
    const a = (i / n) * Math.PI * 2 + rand() * 0.4;
    const r = SPREAD * (0.55 + rand() * 0.35);
    return { ...node, degree: degree.get(node.id) ?? 0, x: Math.cos(a) * r, y: Math.sin(a) * r };
  });

  // Drop edges whose endpoints didn't survive — d3-force throws on an unresolvable id.
  const known = new Set(nodes.map((node) => node.id));
  const survivors = edges.filter((e) => known.has(e.s) && known.has(e.t) && e.s !== e.t);
  const links: SimLink[] = assignCurves(survivors);

  return { nodes: simNodes, links, typeIndex: new Map(entityTypes.map((t, i) => [t, i])) };
}

/** How far a bowed edge bulges, as a fraction of its length, per step away from straight. */
const CURVE_STEP = 0.22;

/**
 * Give every edge its bend.
 *
 * Edges are grouped by their unordered node pair. A pair with exactly one edge stays
 * straight. A pair with several — an agent that both `CRITICIZES` and `CITES` the same
 * claim, say — fans out symmetrically around the straight line, alternating sides, so no
 * two edges of the same pair ever trace the same pixels.
 *
 * The fan is computed relative to a **canonical** direction (the alphabetically smaller
 * id first), and flipped for edges stored in the opposite direction — otherwise `A→B` and
 * `B→A` between the same pair would both bow to what looks like the same side rather than
 * mirroring each other.
 */
function assignCurves(edges: GraphEdge[]): SimLink[] {
  const groups = new Map<string, GraphEdge[]>();
  for (const e of edges) {
    const key = e.s < e.t ? `${e.s}|${e.t}` : `${e.t}|${e.s}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(e);
  }

  const links: SimLink[] = [];
  for (const group of groups.values()) {
    const n = group.length;
    group.forEach((e, i) => {
      // Symmetric fan: n=1 → [0]; n=2 → [-1,+1]; n=3 → [-1,0,+1]; etc.
      const slot = i - (n - 1) / 2;
      const canonical = e.s < e.t;
      links.push({ source: e.s, target: e.t, label: e.label, curve: n === 1 ? 0 : (canonical ? 1 : -1) * slot * CURVE_STEP });
    });
  }
  return links;
}

/**
 * Configure the simulation. Left **running** — the caller attaches a tick handler and is
 * responsible for stopping it on unmount.
 *
 * Link distance scales down with degree so hubs pull their satellites in tight; without
 * it a node with fifteen edges pushes everything to the rim and the middle goes empty.
 */
export function createSimulation(model: GraphModel, seedKey: string): Simulation<SimNode, SimLink> {
  const rand = mulberry32(seedFromString(seedKey) ^ 0x2f6a88c1);

  return forceSimulation<SimNode, SimLink>(model.nodes)
    .randomSource(rand)
    .force(
      "link",
      forceLink<SimNode, SimLink>(model.links)
        .id((d) => d.id)
        .distance((l) => {
          const s = l.source as SimNode;
          const t = l.target as SimNode;
          return 34 + 46 / (1 + Math.min(s.degree, t.degree) * 0.35);
        })
        .strength(0.35),
    )
    .force("charge", forceManyBody<SimNode>().strength(-165).distanceMax(SPREAD * 1.6))
    .force("collide", forceCollide<SimNode>().radius((d) => nodeRadius(d.degree) + 9).strength(0.85))
    // forceX/forceY rather than forceCenter: centering hard-recentres every tick, which
    // fights the drag handler and makes a dragged node snap back.
    .force("x", forceX<SimNode>(0).strength(0.045))
    .force("y", forceY<SimNode>(0).strength(0.06))
    .alpha(1)
    .alphaDecay(0.022);
}

/** Palette for entity types — light-theme dots, matched to the console's look. */
export const TYPE_COLORS = [
  "#e8622a",
  "#1f4e79",
  "#7b3fb5",
  "#1f9d6b",
  "#c62b45",
  "#3b7fd4",
  "#d4941f",
  "#8a6a4f",
  "#2f9fb0",
  "#a03fa0",
  "#5b6bbf",
  "#0f7a5a",
] as const;

export function typeColor(typeIndex: Map<string, number>, type: string): string {
  return TYPE_COLORS[(typeIndex.get(type) ?? 0) % TYPE_COLORS.length];
}
