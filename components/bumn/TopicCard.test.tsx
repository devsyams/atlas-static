import { describe, expect, it } from "vitest";
import { topicTone } from "./TopicCard";
import type { CeoIssue } from "@/lib/danantara/ceo/types";

/** A topic carrying only the fields `topicTone` reads. */
function issue(partial: Partial<CeoIssue>): CeoIssue {
  return {
    id: "t1",
    title: "T",
    category: "kebijakan",
    relatedBumn: [],
    mentions: 0,
    reach: 0,
    sentiment: 0,
    history: [],
    headlines: [],
    aiLine: "",
    velocity: 0,
    status: "normal",
    rankHistory: [],
    rankDelta: 0,
    posMentions: 0,
    negMentions: 0,
    ...partial,
  } as CeoIssue;
}

describe("topicTone", () => {
  it("labels a topic by its dominant mention tone", () => {
    expect(topicTone(issue({ mentions: 1000, posMentions: 100, negMentions: 700 })).label).toBe("Negative");
    expect(topicTone(issue({ mentions: 1000, posMentions: 700, negMentions: 100 })).label).toBe("Positive");
    expect(topicTone(issue({ mentions: 1000, posMentions: 100, negMentions: 100 })).label).toBe("Neutral");
  });

  it("uses the upstream percentages when the topic has zero volume", () => {
    // Without this, all three counts are 0 and the neg>=pos && neg>=neu branch
    // mislabels every zero-volume topic "Negative" — dropping it into the
    // negative cluster on /bgn/command.
    expect(
      topicTone(issue({ mentions: 0, sentimentPct: { positive: 65, neutral: 22, negative: 12 } })).label,
    ).toBe("Positive");
    expect(
      topicTone(issue({ mentions: 0, sentimentPct: { positive: 18, neutral: 64, negative: 18 } })).label,
    ).toBe("Neutral");
  });
});
