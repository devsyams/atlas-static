/**
 * Who is driving the top threat (A10 v4.0) — pure, deterministic, no I/O.
 *
 * The Crisis Gate names the single biggest threat (`biggestThreat`); this answers
 * the next question a CEO asks — *who is causing it?* It ranks the real Danantara
 * media/social actors by how much each is driving **this** threat's topic, blending:
 *   • topic relevance — does the actor push this `IssueCategory` (`drives`)?
 *   • stance — a negative voice *causes* a negative threat; a neutral one amplifies
 *     it; a positive (official/defender) voice barely raises it at all.
 *   • clout — influence × reach (log-damped so a 3M outlet doesn't swamp everything).
 *
 * Only real actor fields are used — no invented engagement. The result feeds the
 * right rail "Aktor Penggerak" column.
 */

import type { MediaActor } from "@/lib/danantara/types";
import type { CeoIssue, IssueCategory } from "./types";

/** Indonesian labels for the issue taxonomy (the threat's topic chip/header). */
export const CATEGORY_LABEL: Record<IssueCategory, string> = {
  "tata-kelola": "Tata Kelola",
  investasi: "Investasi",
  kebijakan: "Kebijakan",
  pasar: "Pasar",
  sosial: "Sosial",
};

/** Role of an actor relative to a *negative* threat, by stance. */
export type ActorRole = "Penggerak" | "Amplifier" | "Pembela";

export interface ThreatActor {
  actor: MediaActor;
  /** Raw drive score (unbounded) — the sort key. */
  score: number;
  /** Drive normalized to 0..1 against the strongest in the set (for the UI bar). */
  drive: number;
  /** Penggerak (negative), Amplifier (neutral), Pembela (positive). */
  role: ActorRole;
  /** Whether the actor explicitly pushes this threat's category. */
  onTopic: boolean;
}

/** How much a stance *causes* (vs. merely rides or rebuts) a negative threat. */
const STANCE_WEIGHT: Record<MediaActor["stance"], number> = {
  negative: 1, // drives the negative narrative
  neutral: 0.55, // amplifies whatever is trending
  positive: 0.12, // defends — barely raises the threat
};

const ROLE: Record<MediaActor["stance"], ActorRole> = {
  negative: "Penggerak",
  neutral: "Amplifier",
  positive: "Pembela",
};

/** Relevance multiplier: full weight on-topic, a small floor for cross-topic spillover. */
function relevance(actor: MediaActor, category: IssueCategory): number {
  return actor.drives?.includes(category) ? 1 : 0.3;
}

/** Clout: influence (0..1) × log-damped reach, so reach lifts but never dominates. */
function clout(actor: MediaActor): number {
  return (actor.influence / 10) * Math.log10(Math.max(10, actor.reach));
}

/**
 * Rank the actors most responsible for the given top threat, strongest first.
 * Returns `[]` when there is no threat or no actors. `drive` is normalized so the
 * leader is 1; ties keep input order (stable sort).
 */
export function actorsDrivingThreat(
  actors: MediaActor[],
  threat: Pick<CeoIssue, "category"> | null | undefined,
  limit = 5,
): ThreatActor[] {
  if (!threat || actors.length === 0) return [];
  const category = threat.category;

  const scored: ThreatActor[] = actors.map((actor) => ({
    actor,
    score: relevance(actor, category) * STANCE_WEIGHT[actor.stance] * clout(actor),
    drive: 0,
    role: ROLE[actor.stance],
    onTopic: actor.drives?.includes(category) ?? false,
  }));

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, Math.max(0, limit));
  const max = top[0]?.score ?? 0;
  return top.map((t) => ({ ...t, drive: max > 0 ? t.score / max : 0 }));
}
