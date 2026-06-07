import { describe, expect, it } from "vitest";
import type { Bumn } from "@/lib/bumn/registry";
import type { FeedResult } from "../topics-feed";
import { buildBumnRow } from "./bumn-board";

const PLN: Bumn = { slug: "pln", name: "PLN", short: "PLN", sector: "energi", topicCode: "danantara_pln" };

const feed = (issues: number): FeedResult => ({
  issues: Array.from({ length: issues }, (_, i) => ({
    id: `topic-${i}`,
    title: `Topik ${i}`,
    category: "kebijakan",
    relatedBumn: [],
    mentions: 1000,
    reach: (issues - i) * 1_000_000, // descending reach
    sentiment: -40,
    history: [],
    headlines: [],
    aiLine: "",
    velocity: 0,
    status: "normal",
    rankHistory: [],
    rankDelta: 0,
    posMentions: 200,
    negMentions: 700,
  })),
  summary: { total_impressions: 1000, total_reach: 9_000_000, percentage: { positive: 7, negative: 76, neutral: 17 } },
  intent: [],
  meta: { topic: "danantara_pln", startdate: "2026-05-31", enddate: "2026-06-07" },
});

describe("buildBumnRow (T-A20 / AC20)", () => {
  it("derives net sentiment (positive − negative) and mention counts from the summary", () => {
    const { row } = buildBumnRow(PLN, feed(3));
    expect(row.sentiment).toBe(-69); // 7 − 76
    expect(row.mentions).toBe(1000);
    expect(row.posMentions).toBe(70); // 1000 × 7%
    expect(row.negMentions).toBe(760); // 1000 × 76%
    expect(row.id).toBe("pln");
    expect(row.short).toBe("PLN");
  });

  it("re-tags each topic to the BUMN with a unique id", () => {
    const { issues } = buildBumnRow(PLN, feed(2));
    expect(issues).toHaveLength(2);
    expect(issues[0].id).toBe("pln-topic-0");
    expect(issues[0].relatedBumn).toEqual(["pln"]);
  });

  it("points topIssueId at the highest-reach topic", () => {
    const { row } = buildBumnRow(PLN, feed(3));
    expect(row.topIssueId).toBe("pln-topic-0"); // highest reach
  });

  it("degrades to an empty, neutral row when the feed failed (null)", () => {
    const { row, issues } = buildBumnRow(PLN, null);
    expect(issues).toEqual([]);
    expect(row.sentiment).toBe(0);
    expect(row.mentions).toBe(0);
    expect(row.id).toBe("pln");
  });
});
