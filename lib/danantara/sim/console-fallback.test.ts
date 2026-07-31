import { describe, expect, it } from "vitest";
import { fallbackConsoleWorld } from "./console-fallback";
import { CONSOLE_ROUNDS, POSTS_PER_ROUND } from "./console-types";
import { namesRealIdentity } from "./real-identities";

/**
 * The deterministic world became the **primary** path in v5.0 — the live model is off by
 * default, so everything the console shows on stage comes from this module. That moves it
 * from "acceptable degradation" to "the product", and it gets tested accordingly.
 */

const DOC = `Danantara Indonesia resmi dilibatkan dalam rapat Komite Stabilitas Sistem Keuangan.
Menteri Keuangan menegaskan Danantara tidak memiliki hak suara dan hanya berperan sebagai pemberi masukan.
Sejumlah ekonom mempertanyakan potensi konflik kepentingan yang muncul dari keterlibatan tersebut.
Otoritas Jasa Keuangan menyatakan akan menelaah dampaknya terhadap tata kelola pasar modal.`;

describe("fallbackConsoleWorld (A15 v5.0 — primary deterministic world)", () => {
  it("is deterministic — the same paste draws the same world every rehearsal", () => {
    expect(fallbackConsoleWorld(DOC)).toEqual(fallbackConsoleWorld(DOC));
  });

  it("actually reads the document — a different paste is a different world", () => {
    const other = fallbackConsoleWorld(
      `Rencana kenaikan tarif angkutan umum diumumkan pekan depan oleh Dinas Perhubungan.
       Serikat pengemudi menolak karena dinilai memberatkan penumpang harian.
       Pemerintah daerah menyatakan tarif baru sudah melalui kajian menyeluruh.`,
    );
    const base = fallbackConsoleWorld(DOC);

    expect(other.ontology.summary).not.toBe(base.ontology.summary);
    expect(other.report.title).not.toBe(base.report.title);
    // The graph is built from the document's own phrases, so the labels must differ too.
    expect(other.ontology.nodes.map((n) => n.label)).not.toEqual(base.ontology.nodes.map((n) => n.label));
  });

  it("builds a graph dense enough to be worth zooming into", () => {
    const { ontology } = fallbackConsoleWorld(DOC);

    // v4.0 capped at 18 nodes and drew as a star. The v5.0 target is a graph with real
    // clusters — the number below is the floor that keeps it from regressing to that.
    expect(ontology.nodes.length).toBeGreaterThanOrEqual(50);
    expect(ontology.edges.length).toBeGreaterThanOrEqual(120);
    // Average degree well above 2 is what separates a network from a tree.
    expect((ontology.edges.length * 2) / ontology.nodes.length).toBeGreaterThan(3);
  });

  it("produces a structurally valid graph — no dangling edges, no self-loops, no unknown types", () => {
    const { ontology } = fallbackConsoleWorld(DOC);
    const ids = new Set(ontology.nodes.map((n) => n.id));
    const types = new Set(ontology.entityTypes);

    expect(new Set(ids).size).toBe(ontology.nodes.length); // ids are unique
    for (const e of ontology.edges) {
      expect(ids.has(e.s)).toBe(true);
      expect(ids.has(e.t)).toBe(true);
      expect(e.s).not.toBe(e.t);
      expect(ontology.relationTypes).toContain(e.label);
    }
    // Every node's type must be in the legend, or it draws with a colour nothing explains.
    for (const n of ontology.nodes) expect(types.has(n.type)).toBe(true);
  });

  it("fills every round with posts from agents that exist", () => {
    const world = fallbackConsoleWorld(DOC);
    const ids = new Set(world.agents.map((a) => a.id));

    expect(world.rounds).toHaveLength(CONSOLE_ROUNDS);
    for (const r of world.rounds) {
      expect(r.posts).toHaveLength(POSTS_PER_ROUND);
      for (const p of r.posts) {
        expect(ids.has(p.agentId)).toBe(true);
        if (p.replyTo) expect(ids.has(p.replyTo)).toBe(true);
        expect(p.text.trim().length).toBeGreaterThan(20);
      }
    }
  });

  it("gives every organisation in the world a human voice, so the cast scales with it", () => {
    const world = fallbackConsoleWorld(DOC);
    const roles = world.agents.map((a) => a.role);

    // A fixed roster made the same faces repeat every round. Agents are now derived from
    // entities too — a newsroom gets a reporter, a community an organiser, an institution
    // a spokesperson — which is the rule the reference console uses.
    expect(world.agents.length).toBeGreaterThanOrEqual(30);
    expect(roles.some((r) => r.startsWith("Jurnalis "))).toBe(true);
    expect(roles.some((r) => r.startsWith("Penggerak "))).toBe(true);
    expect(roles.some((r) => r.startsWith("Juru Bicara "))).toBe(true);

    // Ids must stay unique — they key the feed, the graph nodes and the interview panel.
    expect(new Set(world.agents.map((a) => a.id)).size).toBe(world.agents.length);

    // Topics blend the archetype's own beats with phrases lifted from the document, which
    // is what makes "Related Topics" scale instead of sitting at 2x the agent count.
    for (const a of world.agents) {
      expect(a.topics.length).toBeGreaterThanOrEqual(2);
      expect(a.topics.length).toBeLessThanOrEqual(5);
      expect(new Set(a.topics).size).toBe(a.topics.length);
    }
    expect(world.agents.reduce((n, a) => n + a.topics.length, 0)).toBeGreaterThanOrEqual(120);
  });

  it("never invents a persona that could be read as a real person", () => {
    const world = fallbackConsoleWorld(DOC);
    for (const a of world.agents) {
      expect(namesRealIdentity(a.id)).toBe(false);
      expect(namesRealIdentity(a.displayName)).toBe(false);
    }
    // Media are described by category, never by masthead — an invented outlet name that
    // happened to match a real one would be a defamation problem, not a design nit.
    for (const n of world.ontology.nodes.filter((x) => x.type === "MediaOutlet")) {
      expect(namesRealIdentity(n.label)).toBe(false);
    }
  });

  it("still completes all five steps from a near-empty paste", () => {
    // A dead step mid-pitch is worse than a plain world, so the thinnest possible input
    // must still yield something drawable and reportable.
    for (const input of ["", "   ", "tarif naik"]) {
      const world = fallbackConsoleWorld(input);
      expect(world.ontology.nodes.length).toBeGreaterThanOrEqual(30);
      expect(world.ontology.edges.length).toBeGreaterThan(0);
      expect(world.agents.length).toBeGreaterThanOrEqual(8);
      expect(world.rounds).toHaveLength(CONSOLE_ROUNDS);
      expect(world.report.sections.length).toBeGreaterThanOrEqual(3);
      expect(world.report.memories.length).toBeGreaterThan(0);
    }
  });
});
