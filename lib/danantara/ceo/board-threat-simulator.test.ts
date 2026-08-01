import { describe, expect, it } from "vitest";
import { crisisIndex } from "./crisis";
import { boardThreatResponsePlan } from "./board-threat-simulator";
import { negativeBaselineFromIssue } from "./counter-noise";
import type { CeoIssue } from "./types";
import type { TopicsSummary } from "./topics-source";

function mkIssue(over: Partial<CeoIssue> & Pick<CeoIssue, "id" | "title">): CeoIssue {
  return {
    category: "kebijakan",
    relatedBumn: [],
    mentions: 1_000,
    reach: 10_000_000,
    sentiment: -40,
    history: Array.from({ length: 8 }, () => 1000),
    headlines: [],
    aiLine: "Konteks singkat topik ini.",
    velocity: 0,
    status: "normal",
    rankHistory: [1, 1, 1, 1, 1, 1, 1, 1],
    rankDelta: 0,
    posMentions: 100,
    negMentions: 700,
    ...over,
  };
}

const SUMMARY: TopicsSummary = {
  total_impressions: 2_500_000,
  total_reach: 150_000_000,
  percentage: { positive: 20, negative: 65, neutral: 15 },
};

const ISSUES: CeoIssue[] = [
  mkIssue({ id: "n1", title: "Topik Negatif 1", reach: 50_000_000, negMentions: 18_000, posMentions: 1_200 }),
  mkIssue({ id: "n2", title: "Topik Negatif 2", reach: 30_000_000, negMentions: 16_000, posMentions: 1_100 }),
  mkIssue({ id: "n3", title: "Topik Negatif 3", reach: 20_000_000, negMentions: 15_000, posMentions: 900 }),
  mkIssue({ id: "n4", title: "Topik Negatif 4", reach: 4_000_000, negMentions: 9_000, posMentions: 500 }),
  mkIssue({ id: "p1", title: "Topik Positif", reach: 90_000_000, posMentions: 800, negMentions: 50 }),
];

describe("boardThreatResponsePlan", () => {
  it("uses the live Crisis Index score as the board input and counts every negative topic in the volume anchor", () => {
    const plan = boardThreatResponsePlan(ISSUES, SUMMARY, "professional");
    const reading = crisisIndex(ISSUES, SUMMARY);

    expect(plan.threatIndex).toBe(reading.score);
    expect(plan.volumeAnchor).toBe(
      ISSUES.filter((issue) => issue.negMentions >= issue.posMentions).reduce(
        (sum, issue) => sum + negativeBaselineFromIssue(issue),
        0,
      ),
    );
    expect(plan.topics).toHaveLength(3);
    expect(plan.topics.map((topic) => topic.id)).toEqual(["n1", "n2", "n3"]);
  });

  it("scales intensity by threat and tier while keeping the channel split balanced", () => {
    const basic = boardThreatResponsePlan(ISSUES, SUMMARY, "basic");
    const professional = boardThreatResponsePlan(ISSUES, SUMMARY, "professional");
    const enterprise = boardThreatResponsePlan(ISSUES, SUMMARY, "enterprise");

    expect(basic.totalActions).toBeGreaterThan(0);
    expect(professional.totalActions).toBeGreaterThan(basic.totalActions);
    expect(enterprise.totalActions).toBeGreaterThan(professional.totalActions);

    for (const plan of [basic, professional, enterprise]) {
      expect(plan.channelSplit.kol + plan.channelSplit.clipper + plan.channelSplit.grassroots).toBe(plan.totalActions);
      expect(plan.postResponseThreatIndex).toBeGreaterThanOrEqual(0);
      expect(plan.postResponseThreatIndex).toBeLessThanOrEqual(plan.threatIndex);
    }

    expect(enterprise.postResponseThreatIndex).toBeLessThan(professional.postResponseThreatIndex);
    expect(professional.postResponseThreatIndex).toBeLessThanOrEqual(basic.postResponseThreatIndex);
  });

  it("keeps the full negative board anchor even when a topic would fall outside the top three", () => {
    const plan = boardThreatResponsePlan(ISSUES, SUMMARY, "professional");
    const allNegative = ISSUES.filter((issue) => issue.negMentions >= issue.posMentions);
    const topThree = allNegative.slice(0, 3);

    expect(allNegative).toHaveLength(4);
    expect(topThree).toHaveLength(3);
    expect(plan.volumeAnchor).toBeGreaterThan(
      topThree.reduce((sum, issue) => sum + negativeBaselineFromIssue(issue), 0),
    );
  });
});
