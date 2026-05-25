import type { Kysely } from "kysely";

import type { DB } from "./db/types.gen";
import type {
  ActorThreadAnalysis,
  Article,
  CityMapPoint,
  DashboardData,
  Keyword,
  Leader,
  LeadershipSentiment,
  MarketTickerItem,
  Prediction,
  SocialActor,
  TopCity,
} from "./mbg/types";

const LEVEL_EMOJI: Record<string, string> = {
  AMAN: "🟢",
  WASPADA: "🟡",
  SIAGA: "🟠",
  KRISIS: "🔴",
  DARURAT: "🔴",
};

/** pg returns NUMERIC/BIGINT as strings; coerce to number (null → 0). */
function num(v: unknown): number {
  return v == null ? 0 : Number(v);
}

function rfc(d: Date | string | null): string {
  return d ? new Date(d).toUTCString() : "";
}

/**
 * Assemble the full `DashboardData` from Postgres (replaces the static
 * `buildDashboard()` JSON path). Read-only; the BFF route wraps this with caching.
 */
export async function getDashboard(db: Kysely<DB>): Promise<DashboardData> {
  const snap = await db
    .selectFrom("crisis_snapshots")
    .selectAll()
    .orderBy("captured_at", "desc")
    .limit(1)
    .executeTakeFirst();

  const insightRow = await db
    .selectFrom("insights")
    .selectAll()
    .orderBy("captured_at", "desc")
    .limit(1)
    .executeTakeFirst();

  const predRows = await db.selectFrom("predictions").selectAll().orderBy("id").execute();
  const tickerRows = await db.selectFrom("market_ticker").selectAll().orderBy("id").execute();
  const kwRows = await db.selectFrom("keywords").selectAll().orderBy("count", "desc").execute();

  const cityRows = await db
    .selectFrom("city_metrics as m")
    .innerJoin("cities as c", "c.city_key", "m.city_key")
    .select([
      "c.city_key as city_key",
      "c.city as city",
      "c.province as province",
      "c.lat as lat",
      "c.lng as lng",
      "m.heat as heat",
      "m.severity_sum as severity_sum",
      "m.article_count as article_count",
      "m.dominant_issue as dominant_issue",
    ])
    .orderBy("m.severity_sum", "desc")
    .execute();

  const artRows = await db
    .selectFrom("articles as a")
    .leftJoin("article_enrichment as e", "e.article_id", "a.id")
    .leftJoin("sources as s", "s.id", "a.source_id")
    .select([
      "a.url as url",
      "a.title as title",
      "a.published_at as published_at",
      "s.name as source",
      "e.score as score",
      "e.dominant_issue as dominant_issue",
      "e.city as city",
      "e.province as province",
    ])
    .orderBy("e.score", "desc")
    .execute();

  const actorRows = await db
    .selectFrom("social_actors")
    .selectAll()
    .orderBy("influence", "desc")
    .execute();
  const postRows = await db.selectFrom("actor_posts").selectAll().execute();

  const leaderRows = await db.selectFrom("leaders").selectAll().orderBy("id").execute();
  const sentRows = await db.selectFrom("leader_sentiment").selectAll().execute();
  const leaderArtRows = await db.selectFrom("leader_articles").selectAll().execute();

  const level = snap?.level ?? "AMAN";

  const cities: (CityMapPoint & TopCity)[] = cityRows.map((c) => ({
    city_key: c.city_key,
    city: c.city ?? "",
    province: c.province ?? "",
    lat: num(c.lat),
    lng: num(c.lng),
    heat: num(c.heat),
    severity_sum: num(c.severity_sum),
    article_count: num(c.article_count),
    dominant_issue: c.dominant_issue ?? "",
  }));

  const articles: Article[] = artRows.map((a) => ({
    title: a.title ?? "",
    source: a.source ?? "",
    score: num(a.score),
    date: rfc(a.published_at),
    link: a.url,
    location: a.city && a.province ? { city: a.city, province: a.province } : null,
    dominant_issue: a.dominant_issue ?? null,
  }));

  const postsByActor = new Map<number, typeof postRows>();
  for (const p of postRows) {
    const arr = postsByActor.get(p.actor_id) ?? [];
    arr.push(p);
    postsByActor.set(p.actor_id, arr);
  }
  const actors: SocialActor[] = actorRows.map((a) => ({
    handle: a.handle,
    name: a.name ?? "",
    platform: a.platform ?? "",
    status: a.status ?? "",
    followers: num(a.followers),
    influence: num(a.influence),
    credibility: num(a.credibility),
    sentiment: num(a.sentiment),
    risk_level: a.risk_level ?? "low",
    posts_7d: num(a.posts_7d),
    brand_mentions: num(a.brand_mentions),
    avg_engagement: num(a.avg_engagement),
    total_engagement: num(a.total_engagement),
    avatar: a.avatar ?? "",
    themes: (a.themes as unknown as string[] | null) ?? [],
    brand_summary: a.brand_summary ?? "",
    influence_analysis: a.influence_analysis ?? "",
    collab_opportunity: a.collab_opportunity ?? "",
    recommended_actions: a.recommended_actions ?? "",
    top_posts: (postsByActor.get(a.id) ?? []).map((p) => ({
      text: p.text ?? "",
      likes: num(p.likes),
      comments: num(p.comments),
      views: num(p.views),
    })),
  }));

  const by_platform: Record<string, number> = {};
  const by_risk: Record<string, number> = {};
  for (const a of actors) {
    by_platform[a.platform] = (by_platform[a.platform] ?? 0) + 1;
    by_risk[a.risk_level] = (by_risk[a.risk_level] ?? 0) + 1;
  }
  const actor_thread_analysis: ActorThreadAnalysis | null = actors.length
    ? {
        actors,
        summary: { total: actors.length, by_platform, by_risk },
        updated_at: actorRows[0]?.updated_at ? new Date(actorRows[0].updated_at).toISOString() : "",
      }
    : null;

  const sentByLeader = new Map(sentRows.map((s) => [s.leader_id, s]));
  const artsByLeader = new Map<number, typeof leaderArtRows>();
  for (const a of leaderArtRows) {
    const arr = artsByLeader.get(a.leader_id) ?? [];
    arr.push(a);
    artsByLeader.set(a.leader_id, arr);
  }
  const leaders: Leader[] = leaderRows.map((l) => {
    const s = sentByLeader.get(l.id);
    const pred =
      (s?.prediction_jsonb as unknown as {
        question?: string;
        probability?: number;
        answer_label?: string;
        reasoning?: string;
      } | null) ?? {};
    return {
      id: l.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
      name: l.name,
      position: l.position ?? "",
      organization: l.organization ?? "",
      photo: l.photo_uri ?? "",
      sentiment: {
        score: num(s?.score),
        trend: s?.trend ?? "stable",
        article_count: num(s?.article_count),
      },
      insight: s?.insight ?? "",
      prediction: {
        question: pred.question ?? "",
        probability: num(pred.probability),
        answer_label: pred.answer_label ?? "",
        reasoning: pred.reasoning ?? "",
      },
      recent_articles: (artsByLeader.get(l.id) ?? []).map((a) => ({
        title: a.title ?? "",
        source: a.source ?? "",
        date: rfc(a.published_at),
        sentiment: num(a.sentiment),
        crisis_score: num(a.crisis_score),
      })),
    };
  });
  const leadership_sentiment: LeadershipSentiment | null = leaders.length
    ? { leaders, ai_available: true, updated_at: "" }
    : null;

  return {
    score: num(snap?.score),
    emoji: LEVEL_EMOJI[level] ?? "🟡",
    level,
    article_count: num(snap?.article_count),
    high_crisis_count: num(snap?.high_crisis_count),
    updated_at: snap?.captured_at ? new Date(snap.captured_at).toISOString() : "",
    ai_status: num(snap?.unmapped_count) > 0 ? "partial" : "ready",
    mapped_article_count: num(snap?.mapped_count),
    unmapped_article_count: num(snap?.unmapped_count),
    insight: insightRow
      ? {
          title: insightRow.title ?? "",
          text: insightRow.text ?? "",
          action: insightRow.action ?? undefined,
        }
      : null,
    predictions: predRows.map(
      (p): Prediction => ({
        question: p.question,
        probability: num(p.probability),
        answer_label: p.answer_label ?? "",
        reasoning: p.reasoning ?? "",
        timeframe: p.timeframe ?? undefined,
        tone: (p.tone as unknown as Prediction["tone"]) ?? undefined,
      }),
    ),
    market_ticker: tickerRows.map(
      (m): MarketTickerItem => ({
        label: m.label,
        value: m.value ?? "",
        delta: m.delta != null ? Number(m.delta) : undefined,
      }),
    ),
    top_keywords: kwRows.map(
      (k): Keyword => ({
        keyword: k.term,
        count: num(k.count),
        sentiment: (k.sentiment as unknown as Keyword["sentiment"]) ?? undefined,
      }),
    ),
    city_map_points: cities,
    top_cities: cities,
    articles,
    actor_thread_analysis,
    leadership_sentiment,
  };
}
