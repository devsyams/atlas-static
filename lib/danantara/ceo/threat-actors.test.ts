import { describe, expect, it } from "vitest";
import { DANANTARA_ACTORS } from "@/lib/danantara/actors";
import type { IssueCategory } from "./types";
import { actorsDrivingThreat, CATEGORY_LABEL } from "./threat-actors";

const threat = (category: IssueCategory) => ({ category });

describe("actorsDrivingThreat", () => {
  it("puts the on-topic negative driver first for a tata-kelola threat", () => {
    const out = actorsDrivingThreat(DANANTARA_ACTORS, threat("tata-kelola"));
    expect(out[0].actor.handle).toBe("ekonom_kritis"); // the negative governance driver
    expect(out[0].role).toBe("Penggerak");
    expect(out[0].onTopic).toBe(true);
    expect(out[0].drive).toBe(1); // normalized leader
  });

  it("ranks an on-topic positive defender below the on-topic negative driver", () => {
    const out = actorsDrivingThreat(DANANTARA_ACTORS, threat("tata-kelola"));
    const driver = out.findIndex((a) => a.actor.handle === "ekonom_kritis");
    const defender = out.findIndex((a) => a.actor.handle === "danantara_id");
    expect(driver).toBeGreaterThanOrEqual(0);
    expect(defender).toBeGreaterThan(driver);
  });

  it("returns scores sorted descending with drive normalized into [0,1]", () => {
    const out = actorsDrivingThreat(DANANTARA_ACTORS, threat("pasar"));
    for (let i = 1; i < out.length; i++) {
      expect(out[i - 1].score).toBeGreaterThanOrEqual(out[i].score);
    }
    for (const a of out) {
      expect(a.drive).toBeGreaterThanOrEqual(0);
      expect(a.drive).toBeLessThanOrEqual(1);
    }
  });

  it("defaults to the top 5 and respects an explicit limit", () => {
    expect(actorsDrivingThreat(DANANTARA_ACTORS, threat("tata-kelola"))).toHaveLength(5);
    expect(actorsDrivingThreat(DANANTARA_ACTORS, threat("tata-kelola"), 2)).toHaveLength(2);
  });

  it("maps stance to a role label", () => {
    const out = actorsDrivingThreat(DANANTARA_ACTORS, threat("investasi"));
    const roles = new Set(out.map((a) => a.role));
    expect([...roles].every((r) => r === "Penggerak" || r === "Amplifier" || r === "Pembela")).toBe(true);
  });

  it("returns an empty list when there is no threat", () => {
    expect(actorsDrivingThreat(DANANTARA_ACTORS, null)).toEqual([]);
    expect(actorsDrivingThreat([], threat("pasar"))).toEqual([]);
  });

  it("labels every issue category", () => {
    const cats: IssueCategory[] = ["tata-kelola", "investasi", "kebijakan", "pasar", "sosial"];
    for (const c of cats) expect(CATEGORY_LABEL[c]).toBeTruthy();
  });
});
