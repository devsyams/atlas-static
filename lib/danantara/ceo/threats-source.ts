/**
 * Danantara threat-detection feed (A10 v5.0) — pure mapping helpers (no I/O).
 *
 * The upstream (`api.garudaperkasa.io/api-nexorus/threats`) returns the platform's
 * AI-detected threats for a topic code. Each threat carries a severity (0–10) + class,
 * an `intelligence`/`impact` read, `trending_keywords`, `recommended_actions`, and
 * `top_impact_posts` — the loudest posts driving it, each annotated with the account
 * behind it (`actor_intelligence`). These helpers flatten that into the Crisis Gate's
 * middle ("Ancaman Utama") + right ("Aktor Penggerak") columns: a `DetectedThreat`
 * whose `drivers` are the real accounts, deduped by handle and ranked by engagement.
 *
 * All network/secret handling lives in the feed/BFF that imports this — keep this
 * file side-effect free (fully unit-testable).
 */

/* ----------------------------- upstream DTOs ----------------------------- */

export interface RawActorIntelligence {
  username: string;
  account_type: string; // "real_person" | "propaganda_provocator" | …
  credibility_score: number; // 0..10
  risk_level: string; // "high" | "medium" | "low"
  follower_count: string | number; // may be a formatted string, e.g. "13,793"
  analysis: string; // one-line AI read of the account
}

export interface RawTopImpactPost {
  username: string;
  text: string;
  engagement: number;
  followers: string | number;
  actor_intelligence?: RawActorIntelligence;
}

export interface RawThreat {
  id: string;
  severity_class: string; // "high" | "medium" | "low"
  severity: number; // 0..10
  title: string;
  intelligence: string;
  impact: string;
  threat_type: string;
  posts_count: number;
  growth_rate: string; // "+15%"
  total_engagement: number;
  platforms: string[];
  trending_keywords: string[];
  time_to_viral: number;
  recommended_actions: string[];
  top_impact_posts: RawTopImpactPost[];
}

export interface ThreatsStats {
  total_threats: number;
  high_severity: number;
  medium_severity: number;
  low_severity: number;
}

export interface ThreatsApiResponse {
  success: boolean;
  status_code: number;
  meta: { topic: string };
  data: { stats: ThreatsStats; threats: RawThreat[] };
}

/* ------------------------------ board model ------------------------------ */

/** One account driving the top threat — the right-column "Aktor Penggerak" card. */
export interface ThreatDriver {
  handle: string;
  platform: string;
  followers: number;
  credibility: number; // 0..10
  riskLevel: string; // "high" | "medium" | "low"
  accountType: string; // raw upstream classification
  bot: boolean; // coordinated/automated amplifier vs a genuine account
  engagement: number; // this account's loudest post engagement (the ranking key)
  note: string; // AI one-line read of who they are
  avatarUrl?: string; // profile image (base64 data-URI) — present for the roster fallback, absent for /threats posts
  // v10.0 (captured static roster) — optional presentation extras; absent on the live feeds.
  displayName?: string;
  sentiment?: number; // −10..10
  reach?: string; // "62.0/100"
  intel?: import("./actor-intel").ActorIntel; // full analysis → card becomes clickable (popup)
}

/** The #1 detected threat — the middle-column "Ancaman Utama" read. */
export interface DetectedThreat {
  id: string;
  title: string;
  severityClass: string;
  severity: number; // 0..10
  intelligence: string;
  impact: string;
  threatType: string;
  postsCount: number;
  growthRate: string;
  totalEngagement: number;
  platforms: string[];
  trendingKeywords: string[];
  timeToViral: number;
  recommendedActions: string[];
  drivers: ThreatDriver[];
}

export interface MappedThreats {
  stats: ThreatsStats;
  threats: DetectedThreat[];
}

const EMPTY_STATS: ThreatsStats = { total_threats: 0, high_severity: 0, medium_severity: 0, low_severity: 0 };

/* ------------------------------- helpers -------------------------------- */

/** Parse an upstream count ("13,793" | "29" | 31) → a non-negative integer (0 on junk). */
export function parseCount(v: string | number | null | undefined): number {
  if (typeof v === "number") return Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0;
  if (!v) return 0;
  const n = parseInt(String(v).replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

/** Account types denoting coordinated/automated amplification (vs a genuine account). */
const BOT_ACCOUNT_TYPE = /propaganda|provocator|provokator|buzzer|\bbot\b|spam|automation/i;

export function isBotAccountType(accountType: string | null | undefined): boolean {
  return !!accountType && BOT_ACCOUNT_TYPE.test(accountType);
}

/** One top-impact post → a driver (prefers the analyzed `actor_intelligence`). */
function toDriver(post: RawTopImpactPost, platform: string): ThreatDriver {
  const ai = post.actor_intelligence;
  const accountType = ai?.account_type ?? "";
  return {
    handle: (ai?.username ?? post.username ?? "").replace(/^@/, ""),
    platform,
    followers: parseCount(ai?.follower_count ?? post.followers),
    credibility: typeof ai?.credibility_score === "number" ? ai.credibility_score : 0,
    riskLevel: ai?.risk_level ?? "low",
    accountType,
    bot: isBotAccountType(accountType),
    engagement: typeof post.engagement === "number" ? post.engagement : 0,
    note: ai?.analysis ?? "",
  };
}

/**
 * One raw threat → a `DetectedThreat`. Drivers are **deduped by handle** (a handle
 * can appear across several top-impact posts — keep its highest-engagement one) and
 * **ranked by engagement desc** (stable; ties keep first-seen order).
 */
export function toDetectedThreat(raw: RawThreat): DetectedThreat {
  const platform = raw.platforms?.[0] ?? "";
  const byHandle = new Map<string, ThreatDriver>();
  for (const post of raw.top_impact_posts ?? []) {
    const d = toDriver(post, platform);
    if (!d.handle) continue;
    const prev = byHandle.get(d.handle);
    if (!prev || d.engagement > prev.engagement) byHandle.set(d.handle, d);
  }
  const drivers = [...byHandle.values()].sort((a, b) => b.engagement - a.engagement);

  return {
    id: raw.id,
    title: raw.title,
    severityClass: raw.severity_class,
    severity: raw.severity,
    intelligence: raw.intelligence,
    impact: raw.impact,
    threatType: raw.threat_type,
    postsCount: raw.posts_count,
    growthRate: raw.growth_rate,
    totalEngagement: raw.total_engagement,
    platforms: raw.platforms ?? [],
    trendingKeywords: raw.trending_keywords ?? [],
    timeToViral: raw.time_to_viral,
    recommendedActions: raw.recommended_actions ?? [],
    drivers,
  };
}

/**
 * Map the upstream payload → the board model. Threats are sorted by severity desc so
 * `threats[0]` is the #1 detected threat (the one the gate names).
 */
export function mapThreatsResponse(json: ThreatsApiResponse): MappedThreats {
  const raw = json.data?.threats ?? [];
  const threats = raw.map(toDetectedThreat).sort((a, b) => b.severity - a.severity);
  return { stats: json.data?.stats ?? EMPTY_STATS, threats };
}
