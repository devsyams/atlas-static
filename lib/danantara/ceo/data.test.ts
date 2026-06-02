import { describe, expect, it } from "vitest";
import { REACH_FLOOR, VELOCITY_WINDOW } from "./engine";
import { buildInitialState, DEMO_ARCS, SPOTLIGHT_MS, TAKEOVER_MS, TICK_MS } from "./data";

describe("CEO board data", () => {
  const state = buildInitialState();

  it("has exactly 20 issues (AC1)", () => {
    expect(state.issues).toHaveLength(20);
  });

  it("has exactly 20 BUMN (AC3)", () => {
    expect(state.bumn).toHaveLength(20);
  });

  it("issues are pre-ranked by reach desc", () => {
    for (let i = 1; i < state.issues.length; i++) {
      expect(state.issues[i - 1].reach).toBeGreaterThanOrEqual(state.issues[i].reach);
    }
  });

  it("bumn are pre-ranked most-negative first", () => {
    for (let i = 1; i < state.bumn.length; i++) {
      expect(state.bumn[i - 1].sentiment).toBeLessThanOrEqual(state.bumn[i].sentiment);
    }
  });

  it("every issue has full display content", () => {
    for (const issue of state.issues) {
      expect(issue.title.length).toBeGreaterThan(0);
      expect(issue.headlines.length).toBeGreaterThanOrEqual(2);
      expect(issue.aiLine.length).toBeGreaterThan(0);
      expect(issue.history.length).toBeGreaterThanOrEqual(VELOCITY_WINDOW);
      expect(issue.relatedBumn.length).toBeGreaterThan(0);
    }
  });

  it("every issue starts calm (no escalation at load)", () => {
    for (const issue of state.issues) {
      expect(issue.status).toBe("normal");
      expect(issue.velocity).toBe(0);
    }
  });

  it("pins the spec-mandated timing constants", () => {
    expect(TICK_MS).toBe(4_000);
    expect(SPOTLIGHT_MS).toBe(10_000);
    expect(TAKEOVER_MS).toBe(5_000);
  });

  it("BUMN sentiment values are within -100..100", () => {
    for (const row of state.bumn) {
      expect(row.sentiment).toBeGreaterThanOrEqual(-100);
      expect(row.sentiment).toBeLessThanOrEqual(100);
    }
  });

  it("issue relatedBumn ids all resolve to real BUMN", () => {
    const ids = new Set(state.bumn.map((b) => b.id));
    for (const issue of state.issues) {
      for (const ref of issue.relatedBumn) {
        expect(ids.has(ref)).toBe(true);
      }
    }
  });

  it("issue ids are unique and BUMN ids are unique", () => {
    expect(new Set(state.issues.map((i) => i.id)).size).toBe(20);
    expect(new Set(state.bumn.map((b) => b.id)).size).toBe(20);
  });

  it("every BUMN topIssueId resolves to a real issue", () => {
    const issueIds = new Set(state.issues.map((i) => i.id));
    for (const row of state.bumn) {
      if (row.topIssueId) {
        expect(issueIds.has(row.topIssueId), `${row.id} -> ${row.topIssueId}`).toBe(true);
      }
    }
  });

  it("demo arcs reference real issues with enough reach to escalate (AC5)", () => {
    const byId = new Map(state.issues.map((i) => [i.id, i]));
    expect(DEMO_ARCS.length).toBeGreaterThanOrEqual(2);
    for (const arc of DEMO_ARCS) {
      const issue = byId.get(arc.issueId);
      expect(issue).toBeDefined();
      expect(issue!.reach).toBeGreaterThanOrEqual(REACH_FLOOR);
    }
    // first arc fires ~60 s in: tick 15 at 4 s/tick
    expect(DEMO_ARCS[0].atTick * TICK_MS).toBeGreaterThanOrEqual(40_000);
    expect(DEMO_ARCS[0].atTick * TICK_MS).toBeLessThanOrEqual(80_000);
  });
});
