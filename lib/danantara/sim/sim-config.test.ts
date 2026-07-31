import { describe, expect, it } from "vitest";
import { fallbackConsoleWorld } from "./console-fallback";
import { HOURS_PER_ROUND, activationPlan, agentEntityType, simConfig } from "./sim-config";

/**
 * Env setup renders five cards; three of them are driven entirely by this module. The
 * numbers are shown to a client as run parameters, so they have to be internally
 * consistent and stable across rehearsals.
 */

const WORLD = fallbackConsoleWorld(
  `Danantara Indonesia resmi dilibatkan dalam rapat Komite Stabilitas Sistem Keuangan atas arahan Presiden.
   Menteri Keuangan menegaskan Danantara tidak memiliki hak suara dan hanya berperan sebagai pemberi masukan.
   Sejumlah ekonom mempertanyakan potensi konflik kepentingan yang muncul dari keterlibatan tersebut.`,
);

describe("simConfig", () => {
  it("is deterministic — the same world reports the same run parameters", () => {
    expect(simConfig(WORLD)).toEqual(simConfig(WORLD));
  });

  it("derives the timeline from the world's own rounds", () => {
    const c = simConfig(WORLD);
    expect(c.totalRounds).toBe(WORLD.rounds.length);
    expect(c.durationHours).toBe(WORLD.rounds.length * HOURS_PER_ROUND);
    expect(c.roundMinutes).toBe(HOURS_PER_ROUND * 60);
  });

  it("configures every agent, within ranges the UI can render", () => {
    const c = simConfig(WORLD);
    expect(c.agents).toHaveLength(WORLD.agents.length);

    for (const a of c.agents) {
      expect(a.activeHours).toHaveLength(24);
      for (const v of a.activeHours) expect(v).toBeGreaterThanOrEqual(0);
      for (const v of a.activeHours) expect(v).toBeLessThanOrEqual(1);
      expect(a.activityLevel).toBeGreaterThanOrEqual(0);
      expect(a.activityLevel).toBeLessThanOrEqual(100);
      expect(a.postsPerHour).toBeGreaterThan(0);
      expect(a.commentsPerHour).toBeGreaterThan(0);
      expect(Math.abs(a.sentimentBias)).toBeLessThanOrEqual(1);
      expect(a.influenceWeight).toBeGreaterThan(0);
      expect(a.influenceWeight).toBeLessThanOrEqual(3);
      expect(a.responseDelay).toMatch(/\d+–\d+min/);
    }
  });

  it("never reports zero agents awake — a flatlined hour reads as a broken simulation", () => {
    const [min, max] = simConfig(WORLD).activePerHour;
    // Every agent sharing one diurnal curve made off-peak multiply the whole population
    // to nothing, so the card showed "0" as the floor.
    expect(min).toBeGreaterThan(0);
    expect(max).toBeGreaterThanOrEqual(min);
    expect(max).toBeLessThanOrEqual(WORLD.agents.length);
  });

  it("sentiment bias follows stance rather than being random", () => {
    const c = simConfig(WORLD);
    const bias = (id: string) => c.agents.find((a) => a.agentId === id)!.sentimentBias;
    for (const a of WORLD.agents) {
      if (a.stance === "hostile") expect(bias(a.id)).toBeLessThan(0);
      if (a.stance === "supportive") expect(bias(a.id)).toBeGreaterThan(0);
      if (a.stance === "neutral") expect(bias(a.id)).toBe(0);
    }
  });
});

describe("agentEntityType", () => {
  it("classifies each persona family, and matches what the graph drew", () => {
    expect(agentEntityType({ id: "media_daring_nasional_peliput_310" })).toBe("Journalist");
    expect(agentEntityType({ id: "jurnalis_data_ekonomi_733" })).toBe("Journalist");
    expect(agentEntityType({ id: "unit_kepatuhan_jubir_769" })).toBe("Analyst");
    expect(agentEntityType({ id: "warga_pemantau_anggaran_871" })).toBe("Citizen");

    // The graph node for an agent must carry the same type the config table shows.
    const labelType = new Map(WORLD.ontology.nodes.map((n) => [n.label, n.type]));
    for (const a of WORLD.agents) {
      const drawn = labelType.get(a.displayName);
      if (drawn) expect(drawn).toBe(agentEntityType(a));
    }
  });
});

describe("activationPlan", () => {
  it("seeds the run from the opening round and the world's own topics", () => {
    const plan = activationPlan(WORLD);

    expect(plan.narrative).toBe(WORLD.report.abstract);
    expect(plan.hotTopics.length).toBeGreaterThan(0);
    for (const t of plan.hotTopics) expect(t.startsWith("#")).toBe(true);
    expect(new Set(plan.hotTopics).size).toBe(plan.hotTopics.length);

    expect(plan.sequence.length).toBeGreaterThan(0);
    expect(plan.sequence.length).toBeLessThanOrEqual(4);
    const ids = new Set(WORLD.agents.map((a) => a.id));
    for (const s of plan.sequence) {
      expect(ids.has(s.agentId)).toBe(true);
      expect(s.text.length).toBeGreaterThan(20);
      expect(s.index).toBeGreaterThanOrEqual(0);
      // The opening sequence is round 0 — nothing here may be a reaction to a later round.
      expect(WORLD.rounds[0].posts.some((p) => p.agentId === s.agentId)).toBe(true);
    }
  });
});
