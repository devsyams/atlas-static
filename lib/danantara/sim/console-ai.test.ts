import { describe, expect, it } from "vitest";
import {
  CONSOLE_SCHEMA,
  CONSOLE_SYSTEM,
  buildConsoleGrounding,
  parseConsoleWorld,
} from "./console-ai";
import { fallbackConsoleWorld } from "./console-fallback";
import { CONSOLE_ROUNDS, MAX_AGENTS, MIN_AGENTS, MIN_SECTIONS } from "./console-types";
import { namesRealIdentity } from "./real-identities";

const SEED = `Danantara Indonesia resmi dilibatkan dalam rapat Komite Stabilitas Sistem Keuangan.
Menteri Keuangan menegaskan Danantara tidak memiliki hak suara dan hanya berperan sebagai pemberi masukan.
Sejumlah ekonom mempertanyakan potensi konflik kepentingan karena Danantara adalah pengelola aset negara.
Publik meminta laporan keuangan yang telah diaudit segera dipublikasikan demi transparansi.`;

const AGENT_IDS = ["warga_a_1", "warga_b_2", "warga_c_3", "warga_d_4", "warga_e_5", "warga_f_6"];
const ENTITY_TYPES = ["Institution", "Regulator", "MediaOutlet", "Citizen"];
const RELATION_TYPES = ["RELATES_TO", "CRITICIZES", "REPORTS_ON"];

const nodes = Array.from({ length: 14 }, (_, i) => ({
  id: `n${i}`,
  label: `Entitas ${i}`,
  type: ENTITY_TYPES[i % ENTITY_TYPES.length],
}));
const edges = Array.from({ length: 13 }, (_, i) => ({
  s: "n0",
  t: `n${i + 1}`,
  label: RELATION_TYPES[i % RELATION_TYPES.length],
}));

function mkWorld(over: Record<string, unknown> = {}) {
  return {
    ontology: {
      summary: "Danantara dilibatkan dalam KSSK tanpa hak suara.",
      entityTypes: ENTITY_TYPES,
      relationTypes: RELATION_TYPES,
      tensions: ["Independensi vs investasi"],
      anchors: ["Tidak memiliki hak suara"],
      volatility: 71,
      nodes,
      edges,
    },
    agents: AGENT_IDS.map((id, i) => ({
      id,
      displayName: `Nama ${i}`,
      role: `Peran ${i}`,
      bio: "Ikut memantau isu ini.",
      topics: ["Tata Kelola"],
      stance: ["hostile", "skeptical", "neutral", "supportive"][i % 4],
      followers: 1000,
    })),
    rounds: Array.from({ length: CONSOLE_ROUNDS }, (_, r) => ({
      round: r,
      headline: `Ronde ${r}`,
      posts: [
        { agentId: AGENT_IDS[r % 6], platform: "plaza", text: `Post ${r}.`, engagement: 10, stance: "hostile", replyTo: "" },
        { agentId: AGENT_IDS[(r + 1) % 6], platform: "community", text: `Balas ${r}.`, engagement: 5, stance: "neutral", replyTo: AGENT_IDS[r % 6] },
      ],
    })),
    report: {
      title: "Proyeksi Opini Publik",
      abstract: "Ringkasan dua kalimat.",
      sections: Array.from({ length: MIN_SECTIONS }, (_, i) => ({
        heading: `Bagian ${i}`,
        subheading: `Sub ${i}`,
        paragraphs: [`Paragraf ${i}.`],
        quote: i === 0 ? "Kutipan." : "",
      })),
      memories: ["Bukti satu", "Bukti dua"],
    },
    ...over,
  };
}

describe("console-ai — prompt + grounding (A15 v3.0)", () => {
  it("grounds the model in the document and asks for every console stage", () => {
    const g = buildConsoleGrounding(SEED);
    expect(g).toContain("Komite Stabilitas Sistem Keuangan");
    for (const part of ["ontology", "agents", "rounds", "report", "nodes"]) expect(g).toMatch(new RegExp(part));
  });

  it("specifies the ontology type system and the dual platforms", () => {
    expect(CONSOLE_SYSTEM).toMatch(/entityTypes/);
    expect(CONSOLE_SYSTEM).toMatch(/relationTypes/);
    expect(CONSOLE_SYSTEM).toMatch(/SCREAMING_SNAKE_CASE/);
    expect(CONSOLE_SYSTEM).toMatch(/plaza/);
    expect(CONSOLE_SYSTEM).toMatch(/community/);
    // The identity rule survives the rewrite — this is the one that must never drop.
    expect(CONSOLE_SYSTEM).toMatch(/IDENTITAS WAJIB FIKTIF/);
    expect(CONSOLE_SYSTEM).toMatch(/DILARANG KERAS/);
    expect(CONSOLE_SYSTEM).toMatch(/BOLEH disebut/);
    expect(CONSOLE_SCHEMA.additionalProperties).toBe(false);
  });
});

describe("console-ai — parsing (A15 v3.0)", () => {
  it("parses a complete console world", () => {
    const w = parseConsoleWorld(mkWorld());
    expect(w).not.toBeNull();
    expect(w!.ontology.nodes).toHaveLength(nodes.length);
    expect(w!.ontology.edges.length).toBeGreaterThan(0);
    expect(w!.agents).toHaveLength(AGENT_IDS.length);
    expect(w!.rounds).toHaveLength(CONSOLE_ROUNDS);
    expect(w!.report.sections.length).toBeGreaterThanOrEqual(MIN_SECTIONS);
    // A resolvable replyTo is kept; the empty one is dropped rather than rendered.
    expect(w!.rounds[0].posts[1].replyTo).toBe(AGENT_IDS[0]);
    expect(w!.rounds[0].posts[0].replyTo).toBeUndefined();
    expect(w!.report.sections[1].quote).toBeUndefined();
  });

  it("rejects a half-built world rather than rendering a dead step", () => {
    expect(parseConsoleWorld(null)).toBeNull();
    expect(parseConsoleWorld({})).toBeNull();

    // Too few graph nodes to draw anything meaningful.
    expect(parseConsoleWorld(mkWorld({ ontology: { ...mkWorld().ontology, nodes: nodes.slice(0, 3) } }))).toBeNull();
    // Edges that reference nothing leave the graph unconnected.
    expect(parseConsoleWorld(mkWorld({ ontology: { ...mkWorld().ontology, edges: [{ s: "ghost", t: "n1", label: "X" }] } }))).toBeNull();
    // Agent-count bounds.
    expect(parseConsoleWorld(mkWorld({ agents: mkWorld().agents.slice(0, MIN_AGENTS - 1) }))).toBeNull();
    expect(
      parseConsoleWorld(
        mkWorld({ agents: Array.from({ length: MAX_AGENTS + 1 }, (_, i) => ({ ...mkWorld().agents[0], id: `a_${i}` })) }),
      ),
    ).toBeNull();
    // Wrong round count, and a post from an agent that doesn't exist.
    expect(parseConsoleWorld(mkWorld({ rounds: mkWorld().rounds.slice(0, 2) }))).toBeNull();
    const ghost = mkWorld();
    (ghost.rounds as { posts: { agentId: string }[] }[])[1].posts[0].agentId = "tidak_ada";
    expect(parseConsoleWorld(ghost)).toBeNull();
    // A report with too few sections.
    expect(parseConsoleWorld(mkWorld({ report: { ...mkWorld().report, sections: [] } }))).toBeNull();
  });

  it("refuses to put a generated agent on a real identity — id, name or role", () => {
    for (const field of ["id", "displayName", "role"] as const) {
      const w = mkWorld();
      (w.agents as Record<string, unknown>[])[0][field] = field === "id" ? "cnbcindonesia" : "Erick Thohir";
      expect(parseConsoleWorld(w)).toBeNull();
    }
    // An unknown entity type falls back to a legend colour rather than rejecting.
    const odd = mkWorld();
    (odd.ontology as { nodes: { type: string }[] }).nodes[0].type = "TipeAsing";
    expect(parseConsoleWorld(odd)?.ontology.nodes[0].type).toBe(ENTITY_TYPES[0]);
  });

  it("recognises real identities but leaves ordinary invented ones alone", () => {
    for (const bad of ["Kompas", "@tempo", "cnbcindonesia", "Erick Thohir", "Prabowo", "Kemenkeu"]) {
      expect(namesRealIdentity(bad)).toBe(true);
    }
    // A guard that rejects everything is useless — invented handles must pass.
    for (const ok of ["warga_bekasi88", "ibu_rina_kelas", "analis_kopi_pagi", "Ekonom Moneter Senior"]) {
      expect(namesRealIdentity(ok)).toBe(false);
    }
  });
});

describe("console-fallback — every step completes without the model", () => {
  it("builds a whole console world from the submitted text, deterministically", () => {
    const w = fallbackConsoleWorld(SEED);

    expect(w.ontology.nodes.length).toBeGreaterThanOrEqual(12);
    expect(w.ontology.edges.length).toBeGreaterThan(0);
    for (const e of w.ontology.edges) {
      expect(w.ontology.nodes.some((n) => n.id === e.s)).toBe(true);
      expect(w.ontology.nodes.some((n) => n.id === e.t)).toBe(true);
    }
    expect(w.agents.length).toBeGreaterThanOrEqual(MIN_AGENTS);
    expect(w.rounds).toHaveLength(CONSOLE_ROUNDS);
    for (const r of w.rounds) {
      expect(r.posts.length).toBeGreaterThan(0);
      // Both platforms must appear, or the dual-feed step renders one empty column.
      expect(new Set(r.posts.map((p) => p.platform)).size).toBe(2);
      for (const p of r.posts) expect(w.agents.some((a) => a.id === p.agentId)).toBe(true);
    }
    expect(w.report.sections.length).toBeGreaterThanOrEqual(MIN_SECTIONS);
    expect(w.report.memories.length).toBeGreaterThan(0);

    // It reads the document rather than reciting a canned scenario.
    expect(JSON.stringify(w)).toMatch(/Danantara/);
    expect(fallbackConsoleWorld(SEED)).toEqual(w);
  });

  it("never invents an agent that could be mistaken for a real account", () => {
    for (const a of fallbackConsoleWorld(SEED).agents) {
      expect(namesRealIdentity(a.id)).toBe(false);
      expect(namesRealIdentity(a.displayName)).toBe(false);
      expect(namesRealIdentity(a.role)).toBe(false);
    }
  });

  it("survives a tiny or punctuation-free paste without throwing", () => {
    for (const odd of ["x", "", "     ", "tanpa titik sama sekali hanya satu baris panjang tanpa tanda baca"]) {
      const w = fallbackConsoleWorld(odd);
      expect(w.rounds).toHaveLength(CONSOLE_ROUNDS);
      expect(w.ontology.nodes.length).toBeGreaterThanOrEqual(12);
      expect(w.ontology.edges.length).toBeGreaterThan(0);
    }
  });
});
