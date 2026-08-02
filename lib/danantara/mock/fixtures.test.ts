import { describe, expect, it } from "vitest";

import { getBumn } from "@/lib/bumn/registry";
import { topicsForBumn } from "@/lib/danantara/ceo/engine";
import { MOCK_DANANTARA_BUMN, MOCK_DANANTARA_TOPICS } from "./fixtures";

/** The top-8 BUMN the demo board shows (A7 v50.3). */
const TOP8 = ["mandiri", "pertamina", "pln", "telkom", "bri", "bni", "garudaindonesia", "jasamarga"];

/**
 * `/danantara` demo fixtures (A7 v50.1) — the production-safe stand-in for the live
 * Danantara topics feed while the opengate key is renewed. Built from the client's
 * topics run through the real `mapTopicsResponse`, so it matches a live route response.
 */
describe("MOCK_DANANTARA_TOPICS", () => {
  const { issues } = MOCK_DANANTARA_TOPICS;

  it("maps the client's Danantara topics to the board model", () => {
    expect(issues.length).toBe(10);
    for (const i of issues) {
      expect(i.title.trim()).not.toBe("");
      expect(i.aiLine.trim()).not.toBe(""); // the AI line renders under each topic
      // every topic lands in a valid CeoIssue category (inferred from the title)
      expect(["tata-kelola", "investasi", "kebijakan", "pasar", "sosial"]).toContain(i.category);
    }
  });

  it("carries a mix of negative and positive topics so both board columns fill", () => {
    const negative = issues.filter((i) => i.negMentions >= i.posMentions);
    const positive = issues.filter((i) => i.posMentions > i.negMentions);
    expect(negative.length).toBeGreaterThan(0);
    expect(positive.length).toBeGreaterThan(0);
  });

  it("derives pos/neg counts from the sentiment split (faithful to the mapper)", () => {
    // The corruption-allegation topic is authored 85% negative → negMentions ≈ 85% of mentions.
    const corruption = issues.find((i) => /korupsi/i.test(i.title));
    expect(corruption).toBeDefined();
    expect(corruption!.negMentions / corruption!.mentions).toBeCloseTo(0.85, 1);
    expect(corruption!.sentiment).toBeLessThan(0);
  });

  it("ranks issues by reach (top row = the biggest-reach topic)", () => {
    const maxReach = Math.max(...issues.map((i) => i.reach));
    expect(issues[0].reach).toBe(maxReach);
  });

  it("carries a summary + intent block (passed through for the brief)", () => {
    expect(MOCK_DANANTARA_TOPICS.summary).toBeTruthy();
    expect(Array.isArray(MOCK_DANANTARA_TOPICS.intent)).toBe(true);
    expect(MOCK_DANANTARA_TOPICS.meta.topic).toBeTruthy();
  });
});

describe("MOCK_DANANTARA_BUMN", () => {
  it("has exactly the top 8 BUMN (id = slug → /bumn/{id}.png logo)", () => {
    expect(MOCK_DANANTARA_BUMN.bumn.length).toBe(8);
    expect(MOCK_DANANTARA_BUMN.bumn.map((r) => r.id).sort()).toEqual([...TOP8].sort());
    for (const row of MOCK_DANANTARA_BUMN.bumn) {
      expect(getBumn(row.id), `${row.id} registered`).toBeTruthy(); // real logo/name/sector
      expect(row.short.trim()).not.toBe("");
      expect(row.reach).toBeGreaterThan(0);
    }
  });

  it("gives each BUMN a leading positive AND negative topic so both cells fill", () => {
    for (const slug of TOP8) {
      const { positive, negative } = topicsForBumn(slug, MOCK_DANANTARA_BUMN.issues);
      expect(positive, `${slug} positive`).toBeTruthy();
      expect(negative, `${slug} negative`).toBeTruthy();
    }
  });

  it("carries a spread of net sentiment so the board isn't monotone", () => {
    const sents = MOCK_DANANTARA_BUMN.bumn.map((r) => r.sentiment);
    expect(Math.max(...sents)).toBeGreaterThan(0); // some net-positive BUMN (Mandiri/BRI/BNI)
    expect(Math.min(...sents)).toBeLessThan(0); // some net-negative BUMN (Pertamina/PLN/…)
  });
});
