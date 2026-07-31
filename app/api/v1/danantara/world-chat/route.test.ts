import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fallbackConsoleWorld } from "@/lib/danantara/sim/console-fallback";

const hasLiveAI = vi.fn();
const liveAnswer = vi.fn();

vi.mock("@/lib/ai/engine", () => ({
  hasLiveAI: () => hasLiveAI(),
  liveAnswer: (...args: unknown[]) => liveAnswer(...args),
}));

async function loadRoute() {
  vi.resetModules();
  return import("./route");
}

const WORLD = fallbackConsoleWorld(
  `Danantara Indonesia dilibatkan dalam rapat Komite Stabilitas Sistem Keuangan atas arahan Presiden.
Menteri Keuangan menegaskan Danantara tidak memiliki hak suara dan hanya memberi masukan.
Sejumlah ekonom mempertanyakan potensi konflik kepentingan yang muncul dari keterlibatan tersebut.`,
);
const AGENT = WORLD.agents[0];

const ask = (body: Record<string, unknown>) =>
  new Request("http://localhost/api/v1/danantara/world-chat", { method: "POST", body: JSON.stringify(body) });

const one = [{ role: "user", content: "Kenapa Anda berpendapat begitu?" }];

describe("POST /api/v1/danantara/world-chat (A15 v5.0)", () => {
  beforeEach(() => {
    hasLiveAI.mockReturnValue(true);
    liveAnswer.mockReset();
    liveAnswer.mockResolvedValue("Karena tata kelolanya belum dijelaskan secara terbuka.");
    // v5.0 ships with the paid path OFF; these tests opt into the live code explicitly.
    process.env.DANANTARA_SIM_LIVE = "1";
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.DANANTARA_SIM_LIVE;
  });

  it("spends nothing unless DANANTARA_SIM_LIVE is explicitly set", async () => {
    delete process.env.DANANTARA_SIM_LIVE;
    const { POST } = await loadRoute();
    const body = await (await POST(ask({ world: WORLD, agentId: AGENT.id, turns: one }))).json();

    expect(body.source).toBe("scripted");
    expect(body.reply.trim()).not.toBe(""); // still answers — just not on the paid path
    expect(liveAnswer).not.toHaveBeenCalled();
  });

  it("answers as the Report Agent when no agent is named", async () => {
    const { POST } = await loadRoute();
    const res = await POST(ask({ world: WORLD, turns: one, mode: "crisis" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.source).toBe("llm");
    expect(body.reply).toContain("tata kelolanya");

    const [system] = liveAnswer.mock.calls[0] as [string, string, number?];
    expect(system).toMatch(/ReportAgent/);
    expect(system).toContain(WORLD.report.title); // grounded in the world it was sent
  });

  it("answers in character, and tells the model the persona is fictional", async () => {
    const { POST } = await loadRoute();
    await POST(ask({ world: WORLD, agentId: AGENT.id, turns: one, mode: "crisis" }));

    const [system] = liveAnswer.mock.calls[0] as [string, string, number?];
    expect(system).toContain(AGENT.displayName);
    expect(system).toMatch(/TOKOH FIKTIF/);
    expect(system).toMatch(/Jangan mengaku sebagai orang nyata/);
  });

  it("refuses an agent that isn't in this world rather than silently answering as the ReportAgent", async () => {
    const { POST } = await loadRoute();
    const body = await (await POST(ask({ world: WORLD, agentId: "tidak_ada", turns: one }))).json();

    expect(body.source).toBe("scripted");
    expect(body.reply).toMatch(/tidak ada di dunia simulasi/i);
    expect(liveAnswer).not.toHaveBeenCalled();
  });

  it("never fails the panel — no key, a throw, an empty reply or a bad body all return 200", async () => {
    hasLiveAI.mockReturnValue(false);
    let { POST } = await loadRoute();
    let body = await (await POST(ask({ world: WORLD, turns: one }))).json();
    expect(body.source).toBe("scripted");
    expect(body.reply).toContain(WORLD.report.abstract);
    expect(liveAnswer).not.toHaveBeenCalled();

    hasLiveAI.mockReturnValue(true);
    liveAnswer.mockRejectedValue(new Error("model down"));
    ({ POST } = await loadRoute());
    expect((await (await POST(ask({ world: WORLD, turns: one }))).json()).source).toBe("scripted");

    // An empty completion must fall back rather than render a blank bubble.
    liveAnswer.mockReset();
    liveAnswer.mockResolvedValue("   ");
    ({ POST } = await loadRoute());
    body = await (await POST(ask({ world: WORLD, turns: one }))).json();
    expect(body.source).toBe("scripted");
    expect(body.reply.trim()).not.toBe("");

    const bad = new Request("http://localhost/api/v1/danantara/world-chat", { method: "POST", body: "{oops" });
    expect((await (await POST(bad)).json()).source).toBe("scripted");
  });

  it("does not call the model without a world or a question", async () => {
    const { POST } = await loadRoute();
    for (const body of [
      { turns: one },
      { world: WORLD, turns: [] },
      { world: WORLD, turns: [{ role: "assistant", content: "hai" }] },
      { world: WORLD, turns: [{ role: "user", content: "   " }] },
    ]) {
      expect((await (await POST(ask(body))).json()).source).toBe("scripted");
    }
    expect(liveAnswer).not.toHaveBeenCalled();
  });

  it("never leaks the provider key", async () => {
    const { POST } = await loadRoute();
    const res = await POST(ask({ world: WORLD, turns: one }));
    expect(JSON.stringify(await res.json())).not.toContain("sk-ant");
  });
});
