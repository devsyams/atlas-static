import { describe, expect, it } from "vitest";
import { buildTopicsUrl, mapTopicsResponse, type TopicsApiResponse } from "./topics-source";

/** Trimmed real-shape payload from api.garudaperkasa.io/api-nexorus/topics. */
const SAMPLE: TopicsApiResponse = {
  success: true,
  status_code: 200,
  meta: { topic: "danantara_main", startdate: "2026-05-10", enddate: "2026-06-07" },
  data: {
    topics: [
      {
        topik: "Kontroversi Ketidaktransparanan Laporan Keuangan Danantara",
        impressions: 1000,
        reach: 800,
        sentiment: "negative",
        stats_sentiment: { positive: 5, negative: 85, neutral: 10 },
        penjelasan: "Publik mengkritisi keterbukaan laporan keuangan.",
      },
      {
        topik: "Kunjungan Presiden Prabowo ke Wisma Danantara",
        impressions: 2000,
        reach: 1500,
        sentiment: "positive",
        stats_sentiment: { positive: 70, negative: 10, neutral: 20 },
        penjelasan: "Kunjungan kerja disambut positif.",
      },
    ],
    summary: {
      total_impressions: 3000,
      total_reach: 2300,
      percentage: { positive: 24.8, negative: 52.22, neutral: 22.98 },
    },
    intent: [
      { intent: "Kritik Kebijakan", deskripsi: "...", impressions: 16015280, share_of_voice: 61 },
    ],
  },
};

describe("buildTopicsUrl (T19 / AC19, amended v42.0)", () => {
  it("injects only the topic code and api_key — no startdate/enddate (upstream defaults to 7d)", () => {
    const url = buildTopicsUrl("https://api.example.io/topics", "danantara_main", "SECRET-KEY");
    expect(url).toContain("https://api.example.io/topics?");
    expect(url).toContain("topic=danantara_main");
    expect(url).toContain("api_key=SECRET-KEY");
    expect(url).not.toContain("startdate");
    expect(url).not.toContain("enddate");
  });
});

describe("mapTopicsResponse (T18 / AC19)", () => {
  const { issues, summary, intent } = mapTopicsResponse(SAMPLE);

  it("maps every upstream topic to a CeoIssue", () => {
    expect(issues).toHaveLength(2);
  });

  it("ranks issues by reach, biggest first", () => {
    expect(issues[0].title).toBe("Kunjungan Presiden Prabowo ke Wisma Danantara");
  });

  it("maps fields: topik→title, impressions→mentions, reach→reach, penjelasan→aiLine", () => {
    const neg = issues.find((i) => i.title.startsWith("Kontroversi"))!;
    expect(neg.mentions).toBe(1000);
    expect(neg.reach).toBe(800);
    expect(neg.aiLine).toBe("Publik mengkritisi keterbukaan laporan keuangan.");
  });

  it("derives pos/neg counts from stats_sentiment, summing to mentions", () => {
    const neg = issues.find((i) => i.title.startsWith("Kontroversi"))!;
    expect(neg.posMentions).toBe(50); // 1000 × 5%
    expect(neg.negMentions).toBe(850); // 1000 × 85%
    const neu = neg.mentions - neg.posMentions - neg.negMentions;
    expect(neu).toBe(100); // 1000 × 10%
  });

  it("derives net sentiment as positive% − negative%", () => {
    const neg = issues.find((i) => i.title.startsWith("Kontroversi"))!;
    expect(neg.sentiment).toBe(-80); // 5 − 85
  });

  it("leaves headlines and relatedBumn empty (not in the feed)", () => {
    expect(issues[0].headlines).toEqual([]);
    expect(issues[0].relatedBumn).toEqual([]);
  });

  it("infers a category from the title keywords", () => {
    const neg = issues.find((i) => i.title.startsWith("Kontroversi"))!;
    expect(neg.category).toBe("tata-kelola"); // "Laporan Keuangan" → governance
  });

  it("starts flat (velocity 0, status normal) so a snapshot never fake-escalates", () => {
    for (const i of issues) {
      expect(i.velocity).toBe(0);
      expect(i.status).toBe("normal");
      expect(i.rankDelta).toBe(0);
    }
  });

  it("passes summary and intent through unchanged", () => {
    expect(summary.total_impressions).toBe(3000);
    expect(intent[0].share_of_voice).toBe(61);
  });
});
