import { describe, expect, it } from "vitest";
import { getPoldaBriefing, POLDA_TOPICS, POLRI_ISSUES, POLRI_POLDAS, POLRI_TOPICS, POLRI_WEEKLY_STATE } from "./mock";

describe("Polri mock intelligence fixture", () => {
  it("contains national positive and negative sentiment topics", () => {
    const positive = POLRI_TOPICS.filter((topic) => topic.posMentions > topic.negMentions);
    const negative = POLRI_TOPICS.filter((topic) => topic.negMentions >= topic.posMentions);

    expect(positive.length).toBeGreaterThanOrEqual(3);
    expect(negative.length).toBeGreaterThanOrEqual(3);
    expect(POLRI_TOPICS.every((topic) => topic.sentimentPct)).toBe(true);
  });

  it("contains the requested polda rows with one positive and one negative topic each", () => {
    expect(POLRI_POLDAS.map((polda) => polda.name)).toEqual([
      "Polda Metro Jaya",
      "Polda Jabar",
      "Polda Jateng",
      "Polda Jatim",
      "Polda Bali",
    ]);

    for (const polda of POLRI_POLDAS) {
      const related = POLRI_TOPICS.filter((topic) => topic.relatedBumn.includes(polda.id));
      expect(related.some((topic) => topic.posMentions > topic.negMentions), `${polda.name} positive topic`).toBe(true);
      expect(related.some((topic) => topic.negMentions >= topic.posMentions), `${polda.name} negative topic`).toBe(true);
    }
  });

  it("orders the weekly state by highest-reach public topics and polda negative pressure", () => {
    expect(POLRI_WEEKLY_STATE.issues[0].reach).toBeGreaterThanOrEqual(POLRI_WEEKLY_STATE.issues[1].reach);
    expect(POLRI_WEEKLY_STATE.bumn[0].negReach).toBeGreaterThanOrEqual(POLRI_WEEKLY_STATE.bumn[1].negReach);
  });

  it("keeps the left Polri board national-only and Polda topics separate", () => {
    expect(POLRI_ISSUES.length).toBeGreaterThanOrEqual(4);
    expect(POLDA_TOPICS.length).toBeGreaterThanOrEqual(POLRI_POLDAS.length * 2);
    expect(POLRI_ISSUES.every((topic) => topic.relatedBumn.length === 0)).toBe(true);
    expect(POLDA_TOPICS.every((topic) => topic.relatedBumn.length === 1)).toBe(true);
    expect(POLRI_WEEKLY_STATE.issues).toEqual(POLRI_ISSUES);
  });

  it("explains each topic as analysis without section labels", () => {
    for (const topic of POLRI_TOPICS) {
      expect(topic.aiLine, topic.id).not.toContain("Ringkasan:");
      expect(topic.aiLine, topic.id).not.toContain("Mengapa dibicarakan:");
      expect(topic.aiLine, topic.id).toMatch(/publik|warga|warganet|percakapan/i);
      expect(topic.aiLine.length, topic.id).toBeGreaterThan(180);
    }
  });

  it("builds a scoped executive briefing for a selected Polda", () => {
    const briefing = getPoldaBriefing("metro-jaya");

    expect(briefing?.polda.name).toBe("Polda Metro Jaya");
    expect(briefing?.topics.every((topic) => topic.relatedBumn.includes("metro-jaya"))).toBe(true);
    expect(briefing?.topics.length).toBeGreaterThanOrEqual(4);
    expect(briefing?.positive?.relatedBumn).toEqual(["metro-jaya"]);
    expect(briefing?.negative?.relatedBumn).toEqual(["metro-jaya"]);
    expect(briefing?.recommendations.length).toBeGreaterThanOrEqual(3);
    expect(briefing?.intent.length).toBeGreaterThanOrEqual(3);
    expect(briefing?.intent[0].share_of_voice).toBeGreaterThanOrEqual(briefing?.intent[1].share_of_voice ?? 0);
  });

  it("gives every Polda a multi-topic executive briefing", () => {
    for (const polda of POLRI_POLDAS) {
      const briefing = getPoldaBriefing(polda.id);
      expect(briefing?.topics.length, polda.id).toBeGreaterThanOrEqual(4);
      expect(briefing?.topics.every((topic) => topic.relatedBumn.length === 1 && topic.relatedBumn[0] === polda.id), polda.id).toBe(true);
    }
  });
});
