import { describe, expect, it } from "vitest";
import { isBotAccountType, mapThreatsResponse, parseCount, type ThreatsApiResponse } from "./threats-source";

/** One high-severity threat whose top-impact posts include a duplicate handle
 *  (YudhaShanny2 ×2), a comma-formatted follower count, and both a genuine
 *  (`real_person`) and a coordinated (`propaganda_provocator`) account. */
const SAMPLE: ThreatsApiResponse = {
  success: true,
  status_code: 200,
  meta: { topic: "danantara_main" },
  data: {
    stats: { total_threats: 1, high_severity: 1, medium_severity: 0, low_severity: 0 },
    threats: [
      {
        id: "threat_1",
        severity_class: "high",
        severity: 8,
        title: "Tuduhan Manipulasi Keuangan dan Korupsi Terkait Danantara",
        intelligence: "beberapa postingan menuduh…",
        impact: "merusak reputasi…",
        threat_type: "internal_negative",
        posts_count: 8,
        growth_rate: "+15%",
        total_engagement: 1383,
        platforms: ["twitter"],
        trending_keywords: ["Danantara", "manipulasi keuangan", "korupsi"],
        time_to_viral: 24,
        recommended_actions: ["klarifikasi", "bantah"],
        top_impact_posts: [
          { username: "nocturnalforsa1", text: "…", engagement: 1361, followers: "29", actor_intelligence: { username: "nocturnalforsa1", account_type: "real_person", credibility_score: 2, risk_level: "low", follower_count: "31", analysis: "akun pengikut rendah, seorang complainer" } },
          { username: "YudhaShanny2", text: "…", engagement: 4, followers: "13794", actor_intelligence: { username: "YudhaShanny2", account_type: "propaganda_provocator", credibility_score: 3, risk_level: "high", follower_count: "13,793", analysis: "menyebar sentimen negatif provokatif" } },
          { username: "YudhaShanny2", text: "…", engagement: 3, followers: "13794", actor_intelligence: { username: "YudhaShanny2", account_type: "propaganda_provocator", credibility_score: 3, risk_level: "high", follower_count: "13,793", analysis: "menyebar sentimen negatif provokatif" } },
          { username: "mas_T4keda", text: "…", engagement: 10, followers: "47", actor_intelligence: { username: "mas_T4keda", account_type: "real_person", credibility_score: 2, risk_level: "low", follower_count: "47", analysis: "postingan tunggal, pengaruh kecil" } },
        ],
      },
    ],
  },
};

describe("threats-source mapper (A10 v5.0 — T10/T11/T12)", () => {
  it("maps the payload to a DetectedThreat with deduped, engagement-ranked drivers (T10)", () => {
    const { stats, threats } = mapThreatsResponse(SAMPLE);
    expect(stats.total_threats).toBe(1);
    expect(threats).toHaveLength(1);

    const t = threats[0];
    expect(t.title).toBe("Tuduhan Manipulasi Keuangan dan Korupsi Terkait Danantara");
    expect(t.severity).toBe(8);
    expect(t.severityClass).toBe("high");
    expect(t.growthRate).toBe("+15%");
    expect(t.trendingKeywords).toContain("korupsi");

    // Dedup: YudhaShanny2 appears twice → a single driver, keeping the higher-engagement (4) post.
    const yudha = t.drivers.filter((d) => d.handle === "YudhaShanny2");
    expect(yudha).toHaveLength(1);
    expect(yudha[0].engagement).toBe(4);
    // Comma-formatted follower count parsed.
    expect(yudha[0].followers).toBe(13793);

    // Ranked by engagement desc.
    expect(t.drivers.map((d) => d.handle)).toEqual(["nocturnalforsa1", "mas_T4keda", "YudhaShanny2"]);
  });

  it("flags coordinated/amplifier account types as bot, genuine ones as human (T11)", () => {
    const byHandle = Object.fromEntries(mapThreatsResponse(SAMPLE).threats[0].drivers.map((d) => [d.handle, d]));
    expect(byHandle["YudhaShanny2"].bot).toBe(true); // propaganda_provocator
    expect(byHandle["nocturnalforsa1"].bot).toBe(false); // real_person
    expect(isBotAccountType("buzzer")).toBe(true);
    expect(isBotAccountType("bot")).toBe(true);
    expect(isBotAccountType("real_person")).toBe(false);
    expect(isBotAccountType("")).toBe(false);
  });

  it("returns no threat and no drivers on an empty payload, without throwing (T12)", () => {
    const empty: ThreatsApiResponse = {
      success: true,
      status_code: 200,
      meta: { topic: "danantara_main" },
      data: { stats: { total_threats: 0, high_severity: 0, medium_severity: 0, low_severity: 0 }, threats: [] },
    };
    expect(mapThreatsResponse(empty).threats).toEqual([]);
  });

  it("sorts threats by severity so threats[0] is the #1 detected threat", () => {
    const two: ThreatsApiResponse = {
      ...SAMPLE,
      data: {
        ...SAMPLE.data,
        threats: [
          { ...SAMPLE.data.threats[0], id: "low", severity: 3, title: "Minor" },
          { ...SAMPLE.data.threats[0], id: "high", severity: 9, title: "Major" },
        ],
      },
    };
    expect(mapThreatsResponse(two).threats.map((t) => t.title)).toEqual(["Major", "Minor"]);
  });

  it("parses formatted follower counts defensively", () => {
    expect(parseCount("13,793")).toBe(13793);
    expect(parseCount("29")).toBe(29);
    expect(parseCount(31)).toBe(31);
    expect(parseCount("")).toBe(0);
    expect(parseCount(undefined)).toBe(0);
  });
});
