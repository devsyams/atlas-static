/**
 * Danantara actor roster (A10 v5.2) — pure mapping helpers (no I/O).
 *
 * The Crisis Gate's right column ("Aktor Penggerak") is normally driven by the
 * accounts behind the #1 `/threats` incident. But `/threats` is event-driven and
 * often empty (calm periods) or transiently hollow — so when there's no detected
 * threat, the column falls back to this **always-populated** `/actor-intelligence`
 * roster: the key accounts in the conversation, mapped to the same `ThreatDriver`
 * shape, deduped, and ranked negative-leaning + influential first ("who to watch").
 *
 * Keep this file side-effect free (fully unit-testable); the feed/BFF owns network + secrets.
 */

import { isBotAccountType, parseCount, type ThreatDriver } from "./threats-source";

/* ----------------------------- upstream DTOs ----------------------------- */

export interface RawRosterActor {
  username: string;
  platform: string;
  follower_count: string | number;
  influence_score: number;
  credibility_score: number;
  sentiment_score: number; // −10..10; may be a float (e.g. −7.5)
  risk_level: string;
  account_classification: string; // "Complainer" | "Propaganda/Provocator" | "Negative Critic" | …
  content_themes?: string;
  influence_analysis?: string;
  profile_picture?: string; // base64 data-URI
}

export interface ActorRosterApiResponse {
  success: boolean;
  status_code: number;
  meta: { topic: string };
  data: RawRosterActor[];
}

/* ------------------------------- ranking -------------------------------- */

/**
 * How much an account reads as a *driver* of the (negative) narrative, 0..1:
 * negative sentiment weighs most, lifted by influence. A positive/neutral account
 * scores on influence alone. Used to order the roster so the loudest negative
 * voices surface first.
 */
function driveScore(a: RawRosterActor): number {
  const s = typeof a.sentiment_score === "number" ? a.sentiment_score : 0;
  const negativity = s < 0 ? Math.min(1, -s / 10) : 0;
  const influence = Math.min(1, Math.max(0, (a.influence_score ?? 0) / 10));
  return 0.6 * negativity + 0.4 * influence;
}

/** One roster actor → a driver card. */
function toRosterDriver(a: RawRosterActor): ThreatDriver {
  const accountType = a.account_classification ?? "";
  const pic = typeof a.profile_picture === "string" && a.profile_picture.startsWith("data:image") ? a.profile_picture : undefined;
  return {
    handle: (a.username ?? "").replace(/^@/, ""),
    platform: a.platform ?? "",
    followers: parseCount(a.follower_count),
    credibility: typeof a.credibility_score === "number" ? a.credibility_score : 0,
    riskLevel: a.risk_level ?? "low",
    accountType,
    bot: isBotAccountType(accountType),
    engagement: 0, // the roster ranks on driveScore, not post engagement
    note: a.content_themes || a.influence_analysis || "",
    avatarUrl: pic,
  };
}

/**
 * Map the `/actor-intelligence` roster → `ThreatDriver[]`, **deduped by handle**
 * (the endpoint repeats accounts — keep the higher-scoring copy) and **ranked
 * negative-leaning + influential first**. Returns up to `perGroup` humans + `perGroup`
 * bots (ranked within each group) so the two-column split always has candidates.
 */
export function mapActorRoster(json: ActorRosterApiResponse, perGroup = 4): ThreatDriver[] {
  const byHandle = new Map<string, { driver: ThreatDriver; score: number }>();
  for (const a of json.data ?? []) {
    const handle = (a.username ?? "").replace(/^@/, "");
    if (!handle) continue;
    const score = driveScore(a);
    const prev = byHandle.get(handle);
    if (!prev || score > prev.score) byHandle.set(handle, { driver: toRosterDriver(a), score });
  }
  const ranked = [...byHandle.values()].sort((x, y) => y.score - x.score).map((v) => v.driver);
  const humans = ranked.filter((d) => !d.bot).slice(0, perGroup);
  const bots = ranked.filter((d) => d.bot).slice(0, perGroup);
  return [...humans, ...bots];
}
