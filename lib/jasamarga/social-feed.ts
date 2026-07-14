import type { FeedResult } from "@/lib/danantara/topics-feed";

import type { SocialPulse, SocialTopic } from "./types";

/**
 * A12 v2.0 — map the client's real JasaMarga media-intelligence feed
 * (`danantara_jasamarga`, the same topic set behind /bumn-v2/jasamarga) onto the
 * Ops dashboard's Sentimen Publik pulse.
 *
 * Pure. Returns null when the feed carries nothing usable, so the caller keeps
 * the synthetic pulse rather than rendering an empty widget (AC10).
 *
 * Note we deliberately leave `top_posts` empty: the upstream exposes topics, not
 * individual posts, and the widget used to fill that space with invented
 * `@handle` tweets. Real topics go in `topics` instead — no fabricated authors.
 */
export function mapTopicsToSocial(feed: FeedResult): SocialPulse | null {
  const issues = feed?.issues;
  const summary = feed?.summary;
  if (!Array.isArray(issues) || issues.length === 0) return null;
  if (!summary?.percentage) return null;

  const pct = summary.percentage;
  const topics: SocialTopic[] = [...issues]
    .sort((a, b) => b.reach - a.reach)
    .map((i) => ({
      title: i.title,
      aiLine: i.aiLine,
      impressions: i.mentions,
      reach: i.reach,
      sentiment: i.sentiment,
    }));

  return {
    // The upstream counts impressions, not "mentions in the last 24h" — the UI
    // relabels accordingly in live mode so the number isn't misread.
    mentions_24h: summary.total_impressions,
    impressions: summary.total_impressions,
    reach: summary.total_reach,
    negativity: +(pct.negative / 10).toFixed(1), // % → the widget's 0–10 scale
    sentiment_pct: pct,
    trend: [],
    top_posts: [],
    topics,
    source: "live",
  };
}
