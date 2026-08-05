import { describe, expect, it } from "vitest";

import { getBumn } from "@/lib/bumn/registry";
import { topicsForBumn } from "@/lib/danantara/ceo/engine";
import { isBotAccountType } from "@/lib/danantara/ceo/threats-source";
import { MOCK_TOPICS } from "@/lib/bgn/mock/fixtures";
import { MOCK_DANANTARA_ACTORS, MOCK_DANANTARA_BUMN, MOCK_DANANTARA_THREATS, MOCK_DANANTARA_TOPICS } from "./fixtures";

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

/**
 * `/danantara/krisis` demo fixtures (A10 v11.2) — the Crisis Gate's middle
 * ("Ancaman Utama") + right ("Aktor Penggerak") columns while the opengate key is
 * renewed. Built through the live `mapThreatsResponse` / `mapActorRoster`, so they
 * match a real `/threats` / `/actor-intelligence` route response.
 */
describe("MOCK_DANANTARA_THREATS", () => {
  it("carries one detected Danantara threat with severity + stats", () => {
    const { threat, stats } = MOCK_DANANTARA_THREATS;
    expect(threat).not.toBeNull();
    expect(threat!.title.trim()).not.toBe("");
    expect(threat!.severity).toBeGreaterThan(0);
    expect(threat!.severity).toBeLessThanOrEqual(10);
    expect(["high", "medium", "low"]).toContain(threat!.severityClass);
    expect(threat!.growthRate.trim()).not.toBe("");
    expect(threat!.trendingKeywords.length).toBeGreaterThan(0);
    expect(stats.total_threats).toBeGreaterThanOrEqual(1);
  });

  it("is Danantara context, not the BGN/MBG fixture", () => {
    expect(MOCK_DANANTARA_THREATS.threat!.title).not.toBe(MOCK_TOPICS.issues[0].title);
    expect(/mbg|keracunan/i.test(MOCK_DANANTARA_THREATS.threat!.title)).toBe(false);
    expect(/danantara|bumn|apbn|keuangan/i.test(MOCK_DANANTARA_THREATS.threat!.title)).toBe(true);
  });
});

describe("MOCK_DANANTARA_ACTORS", () => {
  const { actors } = MOCK_DANANTARA_ACTORS;

  it("gives EVERY actor a full intel payload so the demo gate renders the grouped, clickable popup (like /bgn/command, T31)", () => {
    // ThreatActors renders the grouped, clickable static-roster layout only when
    // `drivers.every(d => d.intel)`; a single intel-less actor drops it back to the
    // plain non-clickable Human/Bot bands — so every card must carry intel.
    expect(actors.length).toBeGreaterThanOrEqual(5);
    for (const a of actors) {
      expect(a.handle.trim()).not.toBe("");
      expect(a.handle.startsWith("@")).toBe(false); // handle is bare (the card prefixes @)
      expect(a.intel, `@${a.handle} intel`).toBeTruthy();
      // the popup needs real analysis to show, not an empty object
      expect(a.intel!.riskAssessment || a.intel!.influenceAnalysis, `@${a.handle} analysis`).toBeTruthy();
      expect(a.intel!.classification, `@${a.handle} classification`).toBeTruthy();
    }
  });

  it("spans the actor-type groups (Influencer / News Media / Real Person) and keeps ≥2 coordinated provocateur/buzzer accounts", () => {
    const classes = actors.map((a) => a.accountType.toLowerCase());
    expect(classes.some((c) => c.includes("influencer"))).toBe(true);
    expect(classes.some((c) => c.includes("media"))).toBe(true);
    expect(classes.some((c) => c.includes("real person"))).toBe(true);
    // the transparency threat is provocateur-driven — keep the coordinated amplifiers
    expect(actors.filter((a) => isBotAccountType(a.accountType)).length).toBeGreaterThanOrEqual(2);
  });

  it("never shows a photo on a provocateur/buzzer account (no real face under that label); real-face actors keep their bundled photo", () => {
    for (const a of actors) {
      if (isBotAccountType(a.accountType)) expect(a.avatarUrl, `@${a.handle}`).toBeUndefined();
    }
    // the real-face actors keep their bundled photos
    expect(actors.filter((a) => a.avatarUrl).length).toBeGreaterThanOrEqual(3);
  });

  it("serves avatars as same-origin /public assets, never an external CDN (prod egress is selective)", () => {
    // An external host (randomuser.me, etc.) is silently dropped in prod, so the <img>
    // hangs without firing onError and not even the initials fallback shows. A bundled
    // same-origin path is always reachable — lock that in.
    for (const a of actors) {
      if (!a.avatarUrl) continue;
      expect(a.avatarUrl.startsWith("/")).toBe(true);
      expect(/^https?:/i.test(a.avatarUrl)).toBe(false);
    }
  });

  it("is Danantara transparency-crisis context (matches 'Ancaman Utama'), not the BGN/MBG roster", () => {
    const handles = actors.map((a) => a.handle);
    expect(handles).not.toContain("warga_peduli_gizi"); // a BGN live-mock handle
    expect(handles).not.toContain("LambeSahamjja"); // a BGN captured-roster handle
    // the analysis ties to the transparency threat named in the middle column
    const intelBlob = actors
      .flatMap((a) => Object.values(a.intel ?? {}))
      .filter((v): v is string => typeof v === "string")
      .join(" ")
      .toLowerCase();
    expect(/laporan keuangan|apbn|transparan|dana kelolaan/.test(intelBlob)).toBe(true);
    expect(/mbg|keracunan|gizi/.test(intelBlob)).toBe(false);
  });
});
