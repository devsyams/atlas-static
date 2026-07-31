import { describe, expect, it } from "vitest";
import { fallbackConsoleWorld } from "./console-fallback";
import { buildGraph, createSimulation, nodeRadius, typeColor, TYPE_COLORS } from "./graph-layout";
import type { GraphEdge, GraphNode } from "./console-types";

/**
 * v5.0 swapped a hand-rolled relaxation loop for d3-force. The two properties worth
 * protecting through that change: the layout stays **deterministic** (a rehearsed demo
 * must not rearrange on stage) and it never produces NaN coordinates (which silently
 * blank the canvas rather than erroring).
 */

const WORLD = fallbackConsoleWorld(
  `Danantara Indonesia dilibatkan dalam rapat Komite Stabilitas Sistem Keuangan.
   Menteri Keuangan menegaskan Danantara tidak memiliki hak suara.
   Sejumlah ekonom mempertanyakan potensi konflik kepentingan.`,
);

const positions = (seed: string) => {
  const model = buildGraph(WORLD.ontology.nodes, WORLD.ontology.edges, WORLD.ontology.entityTypes, seed);
  const sim = createSimulation(model, seed);
  sim.stop(); // never let a live rAF timer escape into the test run
  sim.tick(180);
  return model.nodes.map((n) => [Math.round((n.x ?? 0) * 1e6), Math.round((n.y ?? 0) * 1e6)]);
};

describe("graph-layout (A15 v5.0 — d3-force)", () => {
  it("settles to the same positions for the same seed", () => {
    expect(positions("seed-a")).toEqual(positions("seed-a"));
  });

  it("lays a different document out differently", () => {
    expect(positions("seed-a")).not.toEqual(positions("seed-b"));
  });

  it("never emits NaN coordinates", () => {
    for (const [x, y] of positions("seed-a")) {
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(y)).toBe(true);
    }
  });

  it("spreads nodes out rather than collapsing them onto each other", () => {
    const pts = positions("seed-a");
    const unique = new Set(pts.map(([x, y]) => `${x},${y}`));
    expect(unique.size).toBe(pts.length);

    const xs = pts.map(([x]) => x);
    const ys = pts.map(([, y]) => y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(100 * 1e6 * 0.001);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(100 * 1e6 * 0.001);
  });

  it("counts degree and drops edges d3-force would throw on", () => {
    const nodes: GraphNode[] = [
      { id: "a", label: "A", type: "Topic" },
      { id: "b", label: "B", type: "Topic" },
    ];
    const edges: GraphEdge[] = [
      { s: "a", t: "b", label: "RELATES_TO" },
      { s: "a", t: "ghost", label: "RELATES_TO" }, // endpoint doesn't exist
      { s: "a", t: "a", label: "RELATES_TO" }, // self-loop
    ];

    const model = buildGraph(nodes, edges, ["Topic"], "k");
    expect(model.links).toHaveLength(1);
    // Degree is counted over the *source* edge list, so a hub still reads as a hub even
    // where an endpoint was pruned.
    expect(model.nodes.find((n) => n.id === "a")?.degree).toBe(4);
  });

  it("draws a lone edge straight, and bows edges only when a pair is doubled up", () => {
    // Reference: MiroFish's console draws every single edge straight and only bends
    // edges when more than one relation connects the same two nodes — otherwise two
    // overlapping straight lines read as one and hide each other's label.
    const nodes: GraphNode[] = [
      { id: "a", label: "A", type: "Topic" },
      { id: "b", label: "B", type: "Topic" },
      { id: "c", label: "C", type: "Topic" },
    ];
    const edges: GraphEdge[] = [
      { s: "a", t: "b", label: "RELATES_TO" }, // the only edge between a-b
      { s: "a", t: "c", label: "CRITICIZES" }, // two edges between a-c...
      { s: "a", t: "c", label: "CITES" }, // ...must not overlap
    ];

    const model = buildGraph(nodes, edges, ["Topic"], "k");
    const ab = model.links.find((l) => l.label === "RELATES_TO")!;
    const ac = model.links.filter((l) => l.source === "a" && l.target === "c");

    expect(ab.curve).toBe(0);
    expect(ac).toHaveLength(2);
    expect(ac[0].curve).not.toBe(ac[1].curve);
    // Symmetric fan: the two curves bow to opposite sides of the straight line.
    expect(ac[0].curve).toBeCloseTo(-ac[1].curve, 10);
    expect(ac[0].curve).not.toBe(0);
    expect(ac[1].curve).not.toBe(0);
  });

  it("mirrors a reversed duplicate edge to the opposite physical side of its pair", () => {
    // A→B and B→A between the same two nodes are the same pair from the renderer's point
    // of view. The canvas offsets the control point perpendicular to each edge's own
    // draw direction — since B→A's direction is A→B's negated, an *equal* `curve` value
    // is what produces mirrored on-screen curves; naively opposing the values (as if
    // direction didn't matter) would make the two edges coincide instead of fanning
    // apart. Assert the actual on-screen geometry rather than the raw field, so this
    // stays correct even if the sign convention inside `assignCurves` changes.
    const nodes: GraphNode[] = [
      { id: "a", label: "A", type: "Topic" },
      { id: "b", label: "B", type: "Topic" },
    ];
    const edges: GraphEdge[] = [
      { s: "a", t: "b", label: "CRITICIZES" },
      { s: "b", t: "a", label: "RESPONDS_TO" }, // reversed direction, same pair
    ];

    const model = buildGraph(nodes, edges, ["Topic"], "k");
    expect(model.links).toHaveLength(2);

    // Mirror the perpendicular-offset math the canvas renderer uses (see GraphCanvas.tsx):
    // control point = midpoint(p, q) + curve * perp(q - p), perp(dx, dy) = (-dy, dx).
    const a = { x: 0, y: 0 };
    const b = { x: 10, y: 0 }; // any two distinct points — only the offset direction matters
    const bow = (l: (typeof model.links)[number]) => {
      const [p, q] = l.source === "a" ? [a, b] : [b, a];
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      return { x: -dy * l.curve, y: dx * l.curve }; // perpendicular offset from the straight line
    };

    const offsetAB = bow(model.links.find((l) => l.source === "a")!);
    const offsetBA = bow(model.links.find((l) => l.source === "b")!);
    expect(offsetAB.x).toBeCloseTo(-offsetBA.x, 10);
    expect(offsetAB.y).toBeCloseTo(-offsetBA.y, 10);
    expect(Math.hypot(offsetAB.x, offsetAB.y)).toBeGreaterThan(0); // and it's an actual bow, not two straight lines
  });

  it("fans three or more edges around the straight line, not off to one side", () => {
    const nodes: GraphNode[] = [
      { id: "a", label: "A", type: "Topic" },
      { id: "b", label: "B", type: "Topic" },
    ];
    const edges: GraphEdge[] = [
      { s: "a", t: "b", label: "R1" },
      { s: "a", t: "b", label: "R2" },
      { s: "a", t: "b", label: "R3" },
    ];

    const model = buildGraph(nodes, edges, ["Topic"], "k");
    const curves = model.links.map((l) => l.curve).sort((x, y) => x - y);
    expect(curves).toHaveLength(3);
    // Symmetric around 0 — the fan doesn't drift toward one side as the count grows.
    expect(curves[0]).toBeCloseTo(-curves[2], 10);
    expect(curves[1]).toBeCloseTo(0, 10); // the middle edge of an odd fan stays centred
    expect(new Set(curves).size).toBe(3); // no two edges of the same pair coincide
  });

  it("gives every type a stable colour and sizes hubs larger than leaves", () => {
    const index = new Map([["Topic", 0], ["Claim", 1]]);
    expect(typeColor(index, "Topic")).toBe(TYPE_COLORS[0]);
    expect(typeColor(index, "Claim")).toBe(TYPE_COLORS[1]);
    expect(typeColor(index, "Unknown")).toBe(TYPE_COLORS[0]); // falls back, never undefined

    expect(nodeRadius(12)).toBeGreaterThan(nodeRadius(1));
    expect(nodeRadius(999)).toBeLessThan(20); // capped, or a hub eats the viewport
  });
});
