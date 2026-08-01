import { crisisIndex, type CrisisReading } from "./crisis";
import { REACH_PER_POST, splitPosts, topNegativeByReach, type ResponseTier } from "./counter-narrative";
import { TIER_MULTIPLIER } from "./counter-noise";
import { negativeBaselineFromIssue } from "./counter-noise";
import type { CeoIssue } from "./types";
import type { TopicsSummary } from "./topics-source";

export interface BoardThreatResponsePlan {
  tier: ResponseTier;
  reading: CrisisReading;
  threatIndex: number;
  multiplier: number;
  volumeAnchor: number;
  totalActions: number;
  channelSplit: {
    kol: number;
    clipper: number;
    grassroots: number;
  };
  projectedReach: number;
  postResponseThreatIndex: number;
  topics: CeoIssue[];
}

function isNegative(issue: CeoIssue): boolean {
  return issue.negMentions >= issue.posMentions;
}

function threatMultiplier(score: number): number {
  if (score >= 65) return 2.5;
  if (score >= 45) return 2.0;
  if (score >= 25) return 1.5;
  return 1.0;
}

function clampInt(value: number): number {
  return Math.max(0, Math.round(value));
}

/**
 * Board-level Threat Index response plan.
 *
 * The threat score is a control signal; the volume anchor comes from the full set of
 * negative topics, and the tier multiplies the response intensity on top.
 */
export function boardThreatResponsePlan(
  issues: CeoIssue[],
  summary: TopicsSummary | null | undefined,
  tier: ResponseTier = "professional",
): BoardThreatResponsePlan {
  const reading = crisisIndex(issues, summary ?? null);
  const negativeTopics = issues.filter(isNegative);
  const topics = topNegativeByReach(issues, 3);
  const volumeAnchor = negativeTopics.reduce((sum, issue) => sum + negativeBaselineFromIssue(issue), 0);
  const multiplier = threatMultiplier(reading.score) * TIER_MULTIPLIER[tier];
  const totalActions = volumeAnchor === 0 ? 0 : Math.max(1, clampInt(volumeAnchor * multiplier));
  const split = splitPosts(totalActions);
  const projectedReach =
    split.kol * REACH_PER_POST.kol + split.clipper * REACH_PER_POST.clipper + split.homeless * REACH_PER_POST.homeless;
  const reduction = volumeAnchor === 0 ? 0 : clampInt(multiplier * 4);
  const postResponseThreatIndex = Math.max(0, reading.score - reduction);

  return {
    tier,
    reading,
    threatIndex: reading.score,
    multiplier,
    volumeAnchor,
    totalActions,
    channelSplit: {
      kol: split.kol,
      clipper: split.clipper,
      grassroots: split.homeless,
    },
    projectedReach,
    postResponseThreatIndex,
    topics,
  };
}
