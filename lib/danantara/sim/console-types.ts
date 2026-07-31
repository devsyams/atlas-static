/**
 * Console world model (A15 v3.0) — the data behind the five-step simulation console.
 *
 * v2.0's world was enough for a feed and a short report. The console needs more: a
 * knowledge graph to draw, the ontology's *type system* (entity types and relation
 * types, which is what a GraphRAG build actually produces), agent profiles with roles
 * and topic coverage, two platforms with different dynamics, and a long-form report
 * that arrives section by section.
 *
 * Types live apart from the prompt module so the UI can import them without pulling in
 * the schema strings.
 */

/** The two simulated platforms — a fast open timeline and a slower threaded board. */
export type PlatformKey = "plaza" | "community";

export type Stance = "hostile" | "skeptical" | "neutral" | "supportive";

export interface GraphNode {
  id: string;
  label: string;
  /** Must be one of `ontology.entityTypes` — the legend is built from those. */
  type: string;
}

export interface GraphEdge {
  s: string;
  t: string;
  /** Screaming-snake relation, e.g. `CRITICIZES`, `REPORTS_ON`. */
  label: string;
}

export interface ConsoleOntology {
  summary: string;
  /** The generated type system — drives the chips and the graph legend. */
  entityTypes: string[];
  relationTypes: string[];
  tensions: string[];
  anchors: string[];
  /** 0–100; drives the swarm and the reported risk level. */
  volatility: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface AgentProfile {
  /** Snake-case identifier, e.g. `jurnalis_investigasi_ekonomi_412`. */
  id: string;
  displayName: string;
  role: string;
  bio: string;
  topics: string[];
  stance: Stance;
  followers: number;
}

export interface ConsolePost {
  agentId: string;
  platform: PlatformKey;
  text: string;
  engagement: number;
  stance: Stance;
  /** Agent id this replies to — renders the "Replied to @x" quote line. */
  replyTo?: string;
}

export interface ConsoleRound {
  round: number;
  headline: string;
  posts: ConsolePost[];
}

export interface ReportSection {
  heading: string;
  subheading: string;
  paragraphs: string[];
  /** Optional pull-quote, rendered italic with a left rule. */
  quote?: string;
}

export interface ConsoleReport {
  title: string;
  abstract: string;
  sections: ReportSection[];
  /** Short evidence lines the workbench shows as the agent's "active memories". */
  memories: string[];
}

export interface ConsoleWorld {
  ontology: ConsoleOntology;
  agents: AgentProfile[];
  rounds: ConsoleRound[];
  report: ConsoleReport;
}

export const CONSOLE_ROUNDS = 6;
/** A short world still tells the story; the console plays whatever rounds it gets. */
export const MIN_ROUNDS = 4;
/** Posts generated per round. Raised from 4 in v5.0 — the feed reads thin below this. */
export const POSTS_PER_ROUND = 6;

/**
 * Parser bounds. Deliberately wider than what the prompt asks for: the prompt requests
 * a tidy shape, but rejecting a *usable* world because it came back with 5 agents
 * instead of 6 just drops a good demo to the deterministic fallback for no benefit. The
 * bounds that protect people — invented identities, posts only from agents that exist —
 * are enforced strictly and are not part of this trade.
 */
export const MIN_AGENTS = 4;
export const MAX_AGENTS = 14;
export const MIN_SECTIONS = 2;
export const MAX_SECTIONS = 5;

export const PLATFORMS: { key: PlatformKey; label: string }[] = [
  { key: "plaza", label: "Info Plaza" },
  { key: "community", label: "Topic Community" },
];
