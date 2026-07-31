/**
 * Simulation runtime configuration (A15 v6.0).
 *
 * Env setup is not one step but five: create the instance, profile the agents, generate
 * the run config, orchestrate the opening posts, then declare ready. We were rendering
 * only the profile card, so the step looked like it stopped a third of the way through.
 *
 * Everything here is *derived* from the world — stance, reach and position in the roster —
 * rather than invented per render, so the same document always produces the same run
 * parameters. That matters for the same reason the layout is seeded: a rehearsed demo
 * must not show different numbers on stage than it did in the rehearsal.
 */

import { mulberry32 } from "@/lib/danantara/ceo/engine";
import { seedFromString } from "@/lib/danantara/ceo/crisis-sim";
import type { AgentProfile, ConsoleWorld, Stance } from "./console-types";

/** Hours of simulated time each round represents. */
export const HOURS_PER_ROUND = 12;

/** How each part of the day scales activity. Mirrors a real diurnal posting curve. */
export const ACTIVITY_WINDOWS: { label: string; window: string; factor: number; hours: number[] }[] = [
  { label: "Peak Hours", window: "19:00–22:00", factor: 1.5, hours: [19, 20, 21, 22] },
  { label: "Work Hours", window: "09:00–18:00", factor: 0.7, hours: [9, 10, 11, 12, 13, 14, 15, 16, 17, 18] },
  { label: "Morning Hours", window: "06:00–08:00", factor: 0.4, hours: [6, 7, 8] },
  { label: "Off-Peak Hours", window: "00:00–05:00", factor: 0.05, hours: [0, 1, 2, 3, 4, 5] },
];

/** Sentiment bias by stance — the number the run actually uses to skew generation. */
const STANCE_BIAS: Record<Stance, number> = { hostile: -0.6, skeptical: -0.25, neutral: 0, supportive: 0.5 };

export interface AgentRuntimeConfig {
  index: number;
  agentId: string;
  displayName: string;
  entityType: string;
  stance: Stance;
  postsPerHour: number;
  commentsPerHour: number;
  responseDelay: string;
  /** 0–100. */
  activityLevel: number;
  /** −1..1, signed for display. */
  sentimentBias: number;
  influenceWeight: number;
  /** 24 values, 0..1 — the per-hour activity sparkline. */
  activeHours: number[];
}

export interface SimConfig {
  durationHours: number;
  roundMinutes: number;
  totalRounds: number;
  /** Min–max agents active in any given hour. */
  activePerHour: [number, number];
  agents: AgentRuntimeConfig[];
}

/**
 * Classify an agent into one of the graph's person-like entity types.
 *
 * Shared with the graph builder so a persona is the same kind of thing in the config
 * table as it is in the knowledge graph — a journalist that shows up as a Citizen in one
 * view and a Journalist in the other reads as a bug.
 */
export function agentEntityType(a: Pick<AgentProfile, "id">): string {
  if (/jurnalis|peliput/i.test(a.id)) return "Journalist";
  if (/analis|ekonom|akademisi|pengamat|jubir/i.test(a.id)) return "Analyst";
  return "Citizen";
}

function delayFor(stance: Stance, activity: number): string {
  if (activity > 75) return "1–15min";
  if (stance === "hostile") return "5–30min";
  if (stance === "supportive") return "15–45min";
  return activity > 55 ? "10–40min" : "60–120min";
}

export function simConfig(world: ConsoleWorld): SimConfig {
  const totalRounds = world.rounds.length;
  const agents: AgentRuntimeConfig[] = world.agents.map((a, i) => {
    const rand = mulberry32(seedFromString(a.id));
    const activityLevel = 35 + Math.floor(rand() * 55);
    const postsPerHour = 1 + Math.floor((activityLevel / 100) * 6);
    const influenceWeight = Math.min(3, +(0.5 + a.followers / 18_000).toFixed(1));

    // Diurnal curve × this agent's own level, with a little seeded variation so the
    // sparklines don't all draw the same silhouette.
    //
    // Roughly a fifth of agents run on a shifted clock. Without them every agent shares
    // one curve, off-peak multiplies the whole population to nothing, and the config
    // reports "0 agents active per hour" — which reads as a simulation that flatlines
    // overnight rather than one that quietens down.
    const nightOwl = rand() < 0.22;
    const activeHours = Array.from({ length: 24 }, (_, h) => {
      const local = nightOwl ? (h + 12) % 24 : h;
      const win = ACTIVITY_WINDOWS.find((w) => w.hours.includes(local));
      const base = win ? win.factor : 1;
      return Math.max(0, Math.min(1, base * (activityLevel / 100) * (0.75 + rand() * 0.5)));
    });

    return {
      index: i,
      agentId: a.id,
      displayName: a.displayName,
      entityType: agentEntityType(a),
      stance: a.stance,
      postsPerHour,
      commentsPerHour: postsPerHour * 2 + (i % 3),
      responseDelay: delayFor(a.stance, activityLevel),
      activityLevel,
      sentimentBias: STANCE_BIAS[a.stance],
      influenceWeight,
      activeHours,
    };
  });

  // How many agents are actually awake in the quietest and busiest hour of the day.
  const AWAKE = 0.2;
  let min = agents.length;
  let max = 0;
  for (let h = 0; h < 24; h++) {
    const n = agents.filter((a) => a.activeHours[h] > AWAKE).length;
    min = Math.min(min, n);
    max = Math.max(max, n);
  }

  return {
    durationHours: totalRounds * HOURS_PER_ROUND,
    roundMinutes: HOURS_PER_ROUND * 60,
    totalRounds,
    activePerHour: [min, max],
    agents,
  };
}

export interface ActivationEntry {
  entityType: string;
  index: number;
  agentId: string;
  text: string;
}

export interface ActivationPlan {
  /** The direction the run is seeded with — what the world is expected to argue about. */
  narrative: string;
  hotTopics: string[];
  sequence: ActivationEntry[];
}

/**
 * Turn a label into a hashtag: `Tata Kelola` → `#TataKelola`.
 *
 * Node labels are clipped for the graph, so a label can arrive as
 * `Komite Stabilitas Siste…`. Stripping punctuation alone would emit
 * `#KomiteStabilitasSiste` — the ellipsis is the signal that the last word is a fragment,
 * so drop it rather than shipping half a word as a hashtag.
 */
function hashtag(s: string): string {
  const truncated = /[…]|\.\.\./.test(s);
  const words = s
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (truncated && words.length > 1) words.pop();
  const t = words.map((w) => w[0].toUpperCase() + w.slice(1)).join("");
  return t ? `#${t}` : "";
}

export function activationPlan(world: ConsoleWorld): ActivationPlan {
  const indexOf = new Map(world.agents.map((a, i) => [a.id, i]));

  const hotTopics = [
    ...world.ontology.nodes.filter((n) => n.type === "Topic").map((n) => hashtag(n.label)),
    ...world.ontology.tensions.map((t) => hashtag(t.split(" ").slice(0, 3).join(" "))),
  ]
    .filter(Boolean)
    .filter((t, i, all) => all.indexOf(t) === i)
    .slice(0, 6);

  return {
    narrative: world.report.abstract,
    hotTopics,
    // The opening round *is* the activation sequence — these are the posts that exist
    // before any agent has reacted to anything.
    sequence: (world.rounds[0]?.posts ?? []).slice(0, 4).map((p) => {
      const a = world.agents.find((x) => x.id === p.agentId);
      return {
        entityType: a ? agentEntityType(a).toUpperCase() : "AGENT",
        index: indexOf.get(p.agentId) ?? 0,
        agentId: p.agentId,
        text: p.text,
      };
    }),
  };
}
