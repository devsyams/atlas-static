import { describe, expect, it } from "vitest";

import { MOCK_ACTORS, MOCK_THREATS, MOCK_TOPICS } from "./fixtures";

/**
 * The BGN Command Center is fully mocked (A13 v4.0) because the garudaperkasa
 * upstream is dead. These fixtures must read as ONE coherent situation across the
 * three panes: the Crisis Gate (topics + threat + actors), the Issues board
 * (topics), and the War Room (top negative topics). This test guards that
 * cross-consistency so the panes can never silently drift apart.
 */

/** The board's negative set — the wall's rule: ties (neg === pos) count as negative. */
const negativeIssues = MOCK_TOPICS.issues.filter((i) => i.negMentions >= i.posMentions);

describe("BGN mock fixtures", () => {
  it("MOCK_TOPICS is a mapped feed with both negative and positive BGN topics", () => {
    expect(MOCK_TOPICS.issues.length).toBeGreaterThanOrEqual(4);
    expect(negativeIssues.length).toBeGreaterThanOrEqual(3); // the War Room wants a top-3
    expect(MOCK_TOPICS.issues.some((i) => i.posMentions > i.negMentions)).toBe(true); // ≥1 positive
    expect(MOCK_TOPICS.summary.percentage.negative).toBeGreaterThan(0);
  });

  it("names the top detected threat as one of the board's negative topics", () => {
    // The gate's middle column headline (/threats) must be a topic the board (topics)
    // is actually showing as negative — otherwise the gate contradicts the board.
    expect(MOCK_THREATS.threat).not.toBeNull();
    const negativeTitles = negativeIssues.map((i) => i.title);
    expect(negativeTitles).toContain(MOCK_THREATS.threat?.title);
  });

  it("drives the threat with accounts that also appear in the actor roster", () => {
    // The gate's right column (/actor-intelligence roster) and the threat's own
    // drivers must be the same people, so "who's driving it" agrees across panes.
    const rosterHandles = new Set(MOCK_ACTORS.actors.map((a) => a.handle));
    expect(MOCK_ACTORS.actors.length).toBeGreaterThan(0);
    expect(MOCK_THREATS.threat?.drivers.length ?? 0).toBeGreaterThan(0);
    for (const d of MOCK_THREATS.threat?.drivers ?? []) {
      expect(rosterHandles).toContain(d.handle);
    }
  });

  it("carries threat stats consistent with a live incident", () => {
    expect(MOCK_THREATS.stats.total_threats).toBeGreaterThanOrEqual(1);
    expect(MOCK_THREATS.threat?.severity ?? 0).toBeGreaterThan(0);
  });
});
