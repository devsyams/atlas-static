import { describe, expect, it } from "vitest";
import {
  AGENT_COUNT,
  DEPLOY_ROUND,
  ORIGIN_SEEDS,
  ROUND_COUNT,
  buildSwarm,
  runSimulation,
  seedFromTopic,
  turningPoint,
} from "./crisis-sim";
import type { CeoIssue } from "./types";

function mkIssue(over: Partial<CeoIssue> & Pick<CeoIssue, "id" | "title">): CeoIssue {
  return {
    category: "kebijakan",
    relatedBumn: [],
    mentions: 2_000,
    reach: 40_000_000,
    sentiment: -60,
    history: [],
    headlines: [],
    aiLine: "Konteks singkat.",
    velocity: 0,
    status: "normal",
    rankHistory: [],
    rankDelta: 0,
    posMentions: 200,
    negMentions: 1_600,
    ...over,
  };
}

const TOPIC = mkIssue({ id: "t0", title: "Investasi Hilirisasi Nikel" });
const OTHER = mkIssue({ id: "t1", title: "Divestasi Aset BUMN", reach: 22_000_000, negMentions: 1_200 });

const noResponse = (t = TOPIC) => runSimulation(t, { scenario: "none" });
const withResponse = (t = TOPIC, tier: "basic" | "professional" | "enterprise" = "professional") =>
  runSimulation(t, { scenario: "counter", tier });

describe("crisis-sim — determinism (A15 AC2)", () => {
  it("produces byte-identical rounds for the same seed and scenario (T1)", () => {
    expect(runSimulation(TOPIC, { scenario: "none" })).toEqual(runSimulation(TOPIC, { scenario: "none" }));
    expect(withResponse()).toEqual(withResponse());
    // The swarm layout is seeded too — a rehearsed demo must never shift on stage.
    expect(buildSwarm(seedFromTopic(TOPIC))).toEqual(buildSwarm(seedFromTopic(TOPIC)));
  });

  it("gives different topics genuinely different swarms (T2)", () => {
    expect(seedFromTopic(TOPIC)).not.toBe(seedFromTopic(OTHER));
    const a = buildSwarm(seedFromTopic(TOPIC));
    const b = buildSwarm(seedFromTopic(OTHER));
    expect(a.agents.map((n) => n.x)).not.toEqual(b.agents.map((n) => n.x));
    expect(noResponse(TOPIC).at(-1)!.hostile).not.toBe(noResponse(OTHER).at(-1)!.hostile);
  });
});

describe("crisis-sim — propagation (A15 AC3/AC6)", () => {
  it("runs the full round set and starts from the origin cluster (T3)", () => {
    const rounds = noResponse();
    expect(rounds).toHaveLength(ROUND_COUNT);
    expect(rounds[0].round).toBe(0);
    expect(rounds[0].hostile).toBe(ORIGIN_SEEDS);
    expect(rounds[0].swayed).toBe(0);

    // The spark sits with the critics — a narrative starts where it lands best.
    const swarm = buildSwarm(seedFromTopic(TOPIC));
    expect(swarm.origins).toHaveLength(ORIGIN_SEEDS);
    for (const o of swarm.origins) expect(swarm.agents[o].cluster).toBe("kritikus");
  });

  it("never un-infects an agent in the no-response scenario (T4)", () => {
    const rounds = noResponse();
    for (let i = 1; i < rounds.length; i++) {
      expect(rounds[i].hostile).toBeGreaterThanOrEqual(rounds[i - 1].hostile);
    }
    // and it genuinely spreads — a flat line would be a broken model, not a calm one
    expect(rounds.at(-1)!.hostile).toBeGreaterThan(rounds[0].hostile * 10);
  });

  it("conserves the population in every round — no agent lost or double-counted (T8)", () => {
    for (const rounds of [noResponse(), withResponse()]) {
      for (const r of rounds) {
        expect(r.hostile + r.neutral + r.swayed).toBe(AGENT_COUNT);
        expect(r.states).toHaveLength(AGENT_COUNT);
      }
    }
  });

  it("reports the turning point, and null when the crisis never takes hold (T9)", () => {
    const rounds = noResponse();
    const tp = turningPoint(rounds);
    expect(tp).not.toBeNull();
    expect(rounds[tp!].hostile).toBeGreaterThan(AGENT_COUNT / 2);
    // the round before it must NOT already be majority-hostile — it's the crossing
    expect(rounds[tp! - 1].hostile).toBeLessThanOrEqual(AGENT_COUNT / 2);

    const calm = rounds.map((r) => ({ ...r, hostile: 1 }));
    expect(turningPoint(calm)).toBeNull();
  });
});

describe("crisis-sim — the counterfactual (A15 AC4/AC5)", () => {
  it("contains the crisis when the counter-narrative is deployed (T5)", () => {
    const none = noResponse().at(-1)!;
    const counter = withResponse().at(-1)!;
    expect(counter.hostile).toBeLessThan(none.hostile);
    expect(counter.swayed).toBeGreaterThan(none.swayed);
  });

  it("changes nothing before the deploy round — the divergence is the product (T6)", () => {
    const none = noResponse();
    const counter = withResponse();
    for (let i = 0; i < DEPLOY_ROUND; i++) {
      expect(counter[i]).toEqual(none[i]);
    }
    expect(counter[DEPLOY_ROUND]).not.toEqual(none[DEPLOY_ROUND]);
  });

  it("lets the A14 tier drive how hard the response lands (T7)", () => {
    const basic = withResponse(TOPIC, "basic").at(-1)!.swayed;
    const pro = withResponse(TOPIC, "professional").at(-1)!.swayed;
    const ent = withResponse(TOPIC, "enterprise").at(-1)!.swayed;
    expect(pro).toBeGreaterThan(basic);
    expect(ent).toBeGreaterThan(pro);
    // and more persuasion means fewer hostiles left standing
    expect(withResponse(TOPIC, "enterprise").at(-1)!.hostile).toBeLessThan(
      withResponse(TOPIC, "basic").at(-1)!.hostile,
    );
  });
});

describe("crisis-sim — layout for the canvas (A15 AC7)", () => {
  it("keeps every agent inside the unit box and the edge count bounded (T10)", () => {
    const swarm = buildSwarm(seedFromTopic(TOPIC));
    expect(swarm.agents).toHaveLength(AGENT_COUNT);
    for (const a of swarm.agents) {
      expect(a.x).toBeGreaterThanOrEqual(0);
      expect(a.x).toBeLessThanOrEqual(1);
      expect(a.y).toBeGreaterThanOrEqual(0);
      expect(a.y).toBeLessThanOrEqual(1);
    }
    // Edges are drawn every frame — an unbounded graph would tank the canvas.
    expect(swarm.edges.length).toBeGreaterThan(0);
    expect(swarm.edges.length).toBeLessThanOrEqual(AGENT_COUNT * 4);
    for (const [a, b] of swarm.edges) {
      expect(a).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(AGENT_COUNT);
      expect(a).not.toBe(b); // no self-loops
    }
  });
});
