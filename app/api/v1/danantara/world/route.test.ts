import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONSOLE_ROUNDS, MIN_SECTIONS } from "@/lib/danantara/sim/console-types";

const hasLiveAI = vi.fn();
const liveJson = vi.fn();

vi.mock("@/lib/ai/engine", () => ({
  hasLiveAI: () => hasLiveAI(),
  liveJson: (...args: unknown[]) => liveJson(...args),
}));

/** Fresh module per test — the route keeps an in-process cache. */
async function loadRoute() {
  vi.resetModules();
  return import("./route");
}

const SEED = `Danantara Indonesia resmi dilibatkan dalam rapat Komite Stabilitas Sistem Keuangan.
Menteri Keuangan menegaskan Danantara tidak memiliki hak suara dan hanya berperan sebagai pemberi masukan.
Sejumlah ekonom mempertanyakan potensi konflik kepentingan.`;

const AGENT_IDS = ["warga_a_1", "warga_b_2", "warga_c_3", "warga_d_4", "warga_e_5", "warga_f_6"];
const ENTITY_TYPES = ["Institution", "Regulator", "MediaOutlet", "Citizen"];
const RELATION_TYPES = ["RELATES_TO", "CRITICIZES", "REPORTS_ON"];

function mkWorld() {
  const nodes = Array.from({ length: 14 }, (_, i) => ({
    id: `n${i}`,
    label: `Entitas ${i}`,
    type: ENTITY_TYPES[i % ENTITY_TYPES.length],
  }));
  return {
    ontology: {
      summary: "Danantara dilibatkan dalam KSSK tanpa hak suara.",
      entityTypes: ENTITY_TYPES,
      relationTypes: RELATION_TYPES,
      tensions: ["Independensi vs investasi"],
      anchors: ["Tidak memiliki hak suara"],
      volatility: 70,
      nodes,
      edges: Array.from({ length: 13 }, (_, i) => ({ s: "n0", t: `n${i + 1}`, label: RELATION_TYPES[i % 3] })),
    },
    agents: AGENT_IDS.map((id, i) => ({
      id,
      displayName: `Nama ${i}`,
      role: `Peran ${i}`,
      bio: "Ikut memantau.",
      topics: ["Tata Kelola"],
      stance: ["hostile", "skeptical", "neutral", "supportive"][i % 4],
      followers: 900,
    })),
    rounds: Array.from({ length: CONSOLE_ROUNDS }, (_, r) => ({
      round: r,
      headline: `Ronde ${r}`,
      posts: [
        { agentId: AGENT_IDS[r % 6], platform: "plaza", text: `Post ${r}.`, engagement: 10, stance: "hostile", replyTo: "" },
        { agentId: AGENT_IDS[(r + 1) % 6], platform: "community", text: `Balas ${r}.`, engagement: 5, stance: "neutral", replyTo: "" },
      ],
    })),
    report: {
      title: "Proyeksi Opini Publik",
      abstract: "Ringkasan.",
      sections: Array.from({ length: MIN_SECTIONS }, (_, i) => ({
        heading: `Bagian ${i}`,
        subheading: `Sub ${i}`,
        paragraphs: [`Paragraf ${i}.`],
        quote: "",
      })),
      memories: ["Bukti satu"],
    },
  };
}

const post = (body: unknown) =>
  new Request("http://localhost/api/v1/danantara/world", { method: "POST", body: JSON.stringify(body) });

describe("POST /api/v1/danantara/world (A15 v5.0 — console world)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-31T09:00:00Z"));
    hasLiveAI.mockReturnValue(true);
    liveJson.mockReset();
    // v5.0 ships with the paid path OFF. These tests exercise the live code that a
    // meeting can still opt into, so they opt in explicitly.
    process.env.DANANTARA_SIM_LIVE = "1";
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete process.env.DANANTARA_SIM_LIVE;
  });

  it("spends nothing unless DANANTARA_SIM_LIVE is explicitly set", async () => {
    liveJson.mockResolvedValue(mkWorld());

    for (const value of [undefined, "0", "true", "yes"]) {
      if (value === undefined) delete process.env.DANANTARA_SIM_LIVE;
      else process.env.DANANTARA_SIM_LIVE = value;

      const { POST } = await loadRoute();
      const res = await POST(post({ seed: SEED }));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ source: "scripted" });
    }
    // The whole point of the gate: a key being present must not be enough to spend.
    expect(hasLiveAI).not.toHaveBeenCalled();
    expect(liveJson).not.toHaveBeenCalled();
  });

  it("builds a world once per document and serves the cache after", async () => {
    liveJson.mockResolvedValue(mkWorld());
    const { POST } = await loadRoute();

    await POST(post({ seed: SEED }));
    await POST(post({ seed: SEED }));
    expect(liveJson).toHaveBeenCalledTimes(1);

    await POST(post({ seed: `${SEED} Kalimat tambahan yang membuat dokumen ini berbeda.` }));
    expect(liveJson).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(361 * 60_000);
    await POST(post({ seed: SEED }));
    expect(liveJson).toHaveBeenCalledTimes(3);
  });

  it("never fails the console — no key, a throw, or a bad payload all return 200 scripted", async () => {
    hasLiveAI.mockReturnValue(false);
    let { POST } = await loadRoute();
    let res = await POST(post({ seed: SEED }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ source: "scripted" });
    expect(liveJson).not.toHaveBeenCalled();

    hasLiveAI.mockReturnValue(true);
    liveJson.mockRejectedValue(new Error("model down"));
    ({ POST } = await loadRoute());
    res = await POST(post({ seed: SEED }));
    expect(res.status).toBe(200);
    expect((await res.json()).source).toBe("scripted");

    // A world missing its report must not render a dead step.
    const broken = mkWorld();
    delete (broken as { report?: unknown }).report;
    liveJson.mockReset();
    liveJson.mockResolvedValue(broken);
    ({ POST } = await loadRoute());
    expect((await (await POST(post({ seed: SEED }))).json()).source).toBe("scripted");
  });

  it("does not burn a call on an empty or trivial paste", async () => {
    liveJson.mockResolvedValue(mkWorld());
    const { POST } = await loadRoute();

    for (const seed of ["", "   ", "terlalu pendek"]) {
      expect((await (await POST(post({ seed }))).json()).source).toBe("scripted");
    }
    expect((await (await POST(post({ nope: 1 }))).json()).source).toBe("scripted");

    const bad = new Request("http://localhost/api/v1/danantara/world", { method: "POST", body: "{oops" });
    expect((await (await POST(bad)).json()).source).toBe("scripted");
    expect(liveJson).not.toHaveBeenCalled();
  });

  it("returns the parsed world, grounded in the paste, and never leaks the key", async () => {
    liveJson.mockResolvedValue(mkWorld());
    const { POST } = await loadRoute();
    const body = await (await POST(post({ seed: SEED }))).json();

    expect(body.source).toBe("llm");
    expect(body.agents).toHaveLength(AGENT_IDS.length);
    expect(body.rounds).toHaveLength(CONSOLE_ROUNDS);
    expect(body.ontology.nodes.length).toBeGreaterThanOrEqual(12);
    expect(body.report.sections.length).toBeGreaterThanOrEqual(MIN_SECTIONS);

    const [system, user] = liveJson.mock.calls[0] as [string, string, object, number?];
    expect(user).toContain("Komite Stabilitas Sistem Keuangan"); // the presenter's own text
    expect(system).toMatch(/IDENTITAS WAJIB FIKTIF/); // the identity rule actually ships
    expect(JSON.stringify(body)).not.toContain("sk-ant");
  });
});
