import { describe, expect, it } from "vitest";

import { buildSnapshot } from "./data";
import { mapTopicsToSocial } from "./social-feed";
import type { FeedResult } from "@/lib/danantara/topics-feed";
import type { CeoIssue } from "@/lib/danantara/ceo/types";

/** Shaped after the real `danantara_jasamarga` payload. */
function issue(over: Partial<CeoIssue>): CeoIssue {
  return {
    id: "topic-0",
    title: "Kemacetan Panjang di Rest Area KM 19 Tol Jakarta-Cikampek",
    category: "kebijakan",
    relatedBumn: [],
    mentions: 207681,
    reach: 138454,
    sentiment: -80,
    history: [],
    headlines: [],
    aiLine: "Keluhan pengguna jalan soal antrian truk di Rest Area KM 19.",
    velocity: 0,
    status: "normal",
    rankHistory: [],
    rankDelta: 0,
    posMentions: 0,
    negMentions: 0,
    ...over,
  } as CeoIssue;
}

function feed(over: Partial<FeedResult> = {}): FeedResult {
  return {
    issues: [
      issue({}),
      issue({
        id: "topic-2",
        title: "Kecelakaan dan Gangguan Lalu Lintas di Tol Dalam Kota",
        mentions: 7968639,
        reach: 5312426,
        sentiment: -30,
      }),
    ],
    summary: {
      total_impressions: 8277074,
      total_reach: 5518049,
      percentage: { positive: 5.79, negative: 35.97, neutral: 58.24 },
    },
    intent: [],
    meta: {},
    ...over,
  } as FeedResult;
}

describe("mapTopicsToSocial (T10 / AC10)", () => {
  const s = mapTopicsToSocial(feed())!;

  it("carries the real headline volume from the feed summary", () => {
    expect(s.source).toBe("live");
    expect(s.impressions).toBe(8277074);
    expect(s.reach).toBe(5518049);
    expect(s.mentions_24h).toBe(8277074);
  });

  it("derives negativity 0–10 from the real negative share", () => {
    // 35.97% negative → 3.6 / 10
    expect(s.negativity).toBeCloseTo(3.6, 1);
    expect(s.sentiment_pct).toEqual({ positive: 5.79, negative: 35.97, neutral: 58.24 });
  });

  it("surfaces the real topics, loudest by reach first", () => {
    expect(s.topics).toHaveLength(2);
    expect(s.topics![0].title).toContain("Tol Dalam Kota"); // 5.31M reach
    expect(s.topics![1].title).toContain("Rest Area KM 19"); // 138k reach
    expect(s.topics![0].reach).toBe(5312426);
    expect(s.topics![1].aiLine).toContain("antrian truk");
  });

  it("does not fabricate social posts — the feed has none", () => {
    expect(s.top_posts).toEqual([]);
  });
});

describe("buildSnapshot social override (T12 / AC10)", () => {
  it("uses the live pulse when given one", () => {
    const live = mapTopicsToSocial(feed())!;
    const s = buildSnapshot("japek", undefined, undefined, live);
    expect(s.social.source).toBe("live");
    expect(s.social.impressions).toBe(8277074);
    expect(s.social.topics).toHaveLength(2);
  });

  it("falls back to the synthetic pulse when the feed is unavailable", () => {
    const s = buildSnapshot("japek", undefined, undefined, null);
    expect(s.social.source).toBe("demo");
    expect(s.social.topics).toBeUndefined();
    expect(s.social.top_posts.length).toBeGreaterThan(0); // legacy demo posts
  });
});

describe("mapTopicsToSocial — degrades (T11 / AC10)", () => {
  it("returns null when the feed carries no topics, so the caller keeps the synthetic pulse", () => {
    expect(mapTopicsToSocial(feed({ issues: [] }))).toBeNull();
  });

  it("returns null for a missing/!malformed feed", () => {
    // @ts-expect-error — deliberately malformed
    expect(mapTopicsToSocial(null)).toBeNull();
    // @ts-expect-error — deliberately malformed
    expect(mapTopicsToSocial({ issues: [issue({})] })).toBeNull(); // no summary
  });
});
