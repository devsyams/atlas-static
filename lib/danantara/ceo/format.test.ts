import { describe, expect, it } from "vitest";
import { fmtCount, pieTotals } from "./format";

describe("pieTotals", () => {
  it("derives the split from the mention counts when the topic has volume", () => {
    expect(pieTotals({ mentions: 1000, posMentions: 230, negMentions: 460 })).toEqual({
      pos: 230,
      neg: 460,
      neu: 310,
      total: 1000,
    });
  });

  it("falls back to the upstream percentages when the topic has zero volume", () => {
    // TrawlDeck reports sentiment for news/facebook-only topics that carry no
    // impressions (sentiment is source-independent upstream) — the split must
    // survive instead of collapsing to 0/0/0.
    expect(
      pieTotals({
        mentions: 0,
        posMentions: 0,
        negMentions: 0,
        sentimentPct: { positive: 65, neutral: 22, negative: 12 },
      }),
    ).toEqual({ pos: 65, neg: 12, neu: 22, total: 99 });
  });

  it("still reports an empty split when a zero-volume topic has no percentages", () => {
    expect(pieTotals({ mentions: 0, posMentions: 0, negMentions: 0 })).toEqual({
      pos: 0,
      neg: 0,
      neu: 0,
      total: 0,
    });
  });
});

describe("fmtCount", () => {
  it("keeps small numbers as-is", () => {
    expect(fmtCount(890)).toBe("890");
  });
  it("formats thousands as 'K'", () => {
    expect(fmtCount(4_200)).toBe("4.2K");
    expect(fmtCount(12_400)).toBe("12.4K");
  });
  it("formats millions as 'M'", () => {
    expect(fmtCount(1_240_000)).toBe("1.2M");
    expect(fmtCount(52_000_000)).toBe("52M");
  });
  it("never shows a trailing .0", () => {
    expect(fmtCount(5_000)).toBe("5K");
    expect(fmtCount(2_000_000)).toBe("2M");
  });
});
