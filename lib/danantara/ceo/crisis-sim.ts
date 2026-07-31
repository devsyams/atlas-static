/**
 * Crisis Simulation Room — the propagation model (A15 v1.0). Pure, deterministic.
 *
 * **What this is, precisely.** An *authored* agent-propagation model that projects how
 * a hostile narrative might spread through a population, and how a counter-narrative
 * might contain it. The **seed topic is real** (the live `/topics` feed); the spread
 * is **our model, not a measurement** and **not a third-party simulation run**. The UI
 * says so permanently (AC8). If a real swarm engine is adopted later it replaces this
 * module behind the same panel.
 *
 * **The model.** Agents sit in persona clusters on an influence graph. Each round, a
 * neutral agent turns hostile with a probability driven by how many of its neighbours
 * are already hostile, its own susceptibility, and the topic's real negative share.
 * From `DEPLOY_ROUND` the counter scenario also converts agents to `swayed`, at a
 * strength taken from **A14's counter-narrative plan** — so the tier the client picks
 * in the war room visibly changes what happens here (AC5).
 *
 * Deliberately simple and conservative: the numbers are a *shape*, not a forecast, and
 * the room never quotes a precision the model doesn't have. Everything is seeded
 * (`mulberry32`) so a rehearsed demo replays identically on stage (AC2).
 */

import { counterNarrativePlan, type ResponseTier } from "./counter-narrative";
import { mulberry32 } from "./engine";
import type { CeoIssue } from "./types";

/** Population size. Capped for canvas performance — one draw call per agent per frame. */
export const AGENT_COUNT = 900;

/** Rounds played, including round 0 (the seed state). */
export const ROUND_COUNT = 6;

/** The round the counter-narrative goes live. Before it, both scenarios are identical. */
export const DEPLOY_ROUND = 2;

/**
 * Size of the origin cluster. A narrative does not start with one person — it starts
 * inside a community that was already primed for it, which is also the only way six
 * rounds can plausibly reach the whole population.
 */
export const ORIGIN_SEEDS = 12;

/** Persona clusters — the swarm's visible structure. */
export const CLUSTERS = [
  { key: "kritikus", label: "Kritikus & aktivis" },
  { key: "media", label: "Media & jurnalis" },
  { key: "karyawan", label: "Karyawan BUMN" },
  { key: "publik", label: "Publik umum" },
  { key: "investor", label: "Investor & analis" },
] as const;

export type ClusterKey = (typeof CLUSTERS)[number]["key"];
export type AgentState = "neutral" | "hostile" | "swayed";
export type Scenario = "none" | "counter";

export interface Agent {
  /** Unit-box position (0..1) — the canvas scales these to pixels. */
  x: number;
  y: number;
  cluster: ClusterKey;
  /** How easily this agent adopts the hostile narrative, 0..1. */
  susceptibility: number;
  /** How easily the counter-narrative reaches it, 0..1. */
  receptiveness: number;
}

export interface Swarm {
  agents: Agent[];
  /** Influence edges as index pairs. Bounded — they are redrawn every frame. */
  edges: [number, number][];
  /** The origin cluster — where the narrative catches first. */
  origins: number[];
  /** Per-agent neighbour lists, derived from `edges`. */
  neighbours: number[][];
}

export interface SimRound {
  round: number;
  states: AgentState[];
  hostile: number;
  neutral: number;
  swayed: number;
}

export interface SimOptions {
  scenario: Scenario;
  /** A14 tier — drives how hard the counter-narrative lands. Ignored when `none`. */
  tier?: ResponseTier;
}

/** Cluster-centre ring radius and per-blob scatter, in unit-box terms. */
const CLUSTER_RING = 0.32;
const CLUSTER_SPREAD = 0.13;

/** Max edges per agent. Keeps the graph (and the per-frame draw) bounded. */
const EDGES_PER_AGENT = 3;

/**
 * Mainstream pickup. Once a narrative is visibly large it stops needing a personal
 * connection to spread — it arrives via media and algorithmic feeds. Without this the
 * model is pure neighbour-to-neighbour contagion, which from a single origin can only
 * ever reach a small fraction in six rounds and never produces the S-curve (or the
 * turning point) that a crisis actually has.
 */
const AMPLIFICATION = 0.55;

/** FNV-1a — a stable numeric seed, so the same input always builds the same swarm. */
export function seedFromString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A stable numeric seed for a topic, so the same topic always builds the same swarm. */
export function seedFromTopic(topic: Pick<CeoIssue, "id" | "title">): number {
  return seedFromString(`${topic.id}:${topic.title}`);
}

/**
 * Lay out the population in persona clusters around the canvas and wire an influence
 * graph. Purely a function of the seed, so the picture is identical every replay.
 */
export function buildSwarm(seed: number): Swarm {
  const rand = mulberry32(seed);
  const agents: Agent[] = [];

  for (let i = 0; i < AGENT_COUNT; i++) {
    const ci = i % CLUSTERS.length;
    // Clusters sit evenly around a ring; agents scatter inside their own blob.
    // Cluster centres sit on a fixed ring; only the scatter inside a blob is random,
    // so the five communities stay visually separable instead of merging into one mass.
    const angle = (ci / CLUSTERS.length) * Math.PI * 2 - Math.PI / 2;
    const cx = 0.5 + Math.cos(angle) * CLUSTER_RING;
    const cy = 0.5 + Math.sin(angle) * CLUSTER_RING;
    const spread = CLUSTER_SPREAD * Math.sqrt(rand());
    const a = rand() * Math.PI * 2;

    agents.push({
      x: clamp01(cx + Math.cos(a) * spread),
      y: clamp01(cy + Math.sin(a) * spread),
      cluster: CLUSTERS[ci].key,
      susceptibility: 0.25 + rand() * 0.7,
      receptiveness: 0.2 + rand() * 0.75,
    });
  }

  // Each agent wires to a couple of others — mostly inside its own cluster (homophily),
  // occasionally across it, which is what lets a narrative jump communities.
  const edges: [number, number][] = [];
  const neighbours: number[][] = agents.map(() => []);
  for (let i = 0; i < AGENT_COUNT; i++) {
    for (let e = 0; e < EDGES_PER_AGENT; e++) {
      const sameCluster = rand() < 0.75;
      let j = sameCluster
        ? (i + CLUSTERS.length * (1 + Math.floor(rand() * 24))) % AGENT_COUNT
        : Math.floor(rand() * AGENT_COUNT);
      if (j === i) j = (i + 1) % AGENT_COUNT;
      edges.push([i, j]);
      neighbours[i].push(j);
      neighbours[j].push(i);
    }
  }

  // The narrative catches among the most susceptible critics — it starts where it
  // lands best, not at a random point.
  const origins = agents
    .map((a, i) => ({ i, a }))
    .filter(({ a }) => a.cluster === "kritikus")
    .sort((p, q) => q.a.susceptibility - p.a.susceptibility)
    .slice(0, ORIGIN_SEEDS)
    .map(({ i }) => i)
    .sort((p, q) => p - q);

  return { agents, edges, origins, neighbours };
}

/**
 * Play the crisis forward. Returns every round including round 0, so the transport
 * can scrub freely without recomputing.
 */
export function runSimulation(topic: CeoIssue, opts: SimOptions): SimRound[] {
  // A hotter topic (more negative share) spreads faster — the real feed drives this.
  const negShare = topic.mentions > 0 ? Math.min(1, Math.max(0, topic.negMentions / topic.mentions)) : 0;

  // The counter-narrative's strength is A14's own plan at the chosen tier.
  const power =
    opts.scenario === "counter"
      ? counterNarrativePlan(topic, opts.tier ?? "professional").shareOfVoicePct / 100
      : 0;

  return runSimulationFromSeed(seedFromTopic(topic), negShare, power);
}

/**
 * The core run, decoupled from `CeoIssue` (A15 v2.0). The world builder seeds from
 * **arbitrary pasted text** and takes its heat from the model's own volatility read,
 * so the swarm can't depend on the topic feed's shape.
 *
 * @param negShare  0..1 — how hostile the material is; drives spread rate.
 * @param power     0..1 — counter-narrative strength; 0 disables the response entirely.
 */
export function runSimulationFromSeed(seed: number, negShare: number, power = 0): SimRound[] {
  const swarm = buildSwarm(seed);
  const virality = 0.18 + Math.min(1, Math.max(0, negShare)) * 0.5;

  const states: AgentState[] = new Array(AGENT_COUNT).fill("neutral");
  for (const o of swarm.origins) states[o] = "hostile";

  // A separate stream from the layout's, so changing scenario never reshuffles the map.
  const rand = mulberry32(seed ^ 0x9e3779b9);
  const rounds: SimRound[] = [snapshot(0, states)];

  for (let r = 1; r < ROUND_COUNT; r++) {
    const next = [...states];
    // How loud the narrative already is — drives the mainstream-pickup term below.
    const hostileShare = states.reduce((n, s) => n + (s === "hostile" ? 1 : 0), 0) / AGENT_COUNT;

    for (let i = 0; i < AGENT_COUNT; i++) {
      const hostileNeighbours = swarm.neighbours[i].filter((n) => states[n] === "hostile").length;

      if (states[i] === "neutral") {
        const local = 1 - Math.pow(1 - virality * swarm.agents[i].susceptibility, hostileNeighbours);
        const broadcast = hostileShare * AMPLIFICATION * swarm.agents[i].susceptibility;
        const pressure = Math.min(0.85, local + broadcast);
        if (pressure > 0 && rand() < pressure) next[i] = "hostile";
      }

      // The counter-narrative works on the undecided first and the committed second —
      // which is also how real comms works.
      if (power > 0 && r >= DEPLOY_ROUND) {
        const reach = power * swarm.agents[i].receptiveness;
        if (states[i] === "neutral" && rand() < reach * 0.55) next[i] = "swayed";
        else if (states[i] === "hostile" && rand() < reach * 0.22) next[i] = "swayed";
      }
    }

    states.splice(0, states.length, ...next);
    rounds.push(snapshot(r, states));
  }

  return rounds;
}

/** The first round where the hostile camp takes the majority; `null` if it never does. */
export function turningPoint(rounds: SimRound[]): number | null {
  const majority = AGENT_COUNT / 2;
  for (const r of rounds) if (r.hostile > majority) return r.round;
  return null;
}

function snapshot(round: number, states: AgentState[]): SimRound {
  let hostile = 0;
  let swayed = 0;
  for (const s of states) {
    if (s === "hostile") hostile++;
    else if (s === "swayed") swayed++;
  }
  return { round, states: [...states], hostile, swayed, neutral: AGENT_COUNT - hostile - swayed };
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}
