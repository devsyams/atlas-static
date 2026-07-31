import { describe, expect, it } from "vitest";
import { MAX_TURNS, buildChatUser, chatSystem, fallbackReply, worldBrief, type ChatTurn } from "./chat-ai";
import { fallbackConsoleWorld } from "./console-fallback";
import { modeByKey } from "./modes";

const WORLD = fallbackConsoleWorld(
  `Danantara Indonesia dilibatkan dalam rapat Komite Stabilitas Sistem Keuangan atas arahan Presiden.
Menteri Keuangan menegaskan Danantara tidak memiliki hak suara dan hanya memberi masukan.
Sejumlah ekonom mempertanyakan potensi konflik kepentingan yang muncul dari keterlibatan tersebut.`,
);
const AGENT = WORLD.agents[0];
const MODE = modeByKey("crisis");

describe("chat-ai — the Report Agent (A15 v4.0)", () => {
  it("is bound to the simulated world and told to admit gaps", () => {
    const s = chatSystem(WORLD, MODE, null);
    expect(s).toMatch(/ReportAgent/);
    expect(s).toMatch(/HANYA isi dunia simulasi/);
    expect(s).toMatch(/jangan menebak/i);
    // It must push back if the user treats a projection as measurement.
    expect(s).toMatch(/proyeksi, bukan pengukuran/);
    // And it carries the actual world, not a generic brief.
    expect(s).toContain(WORLD.report.title);
    expect(s).toMatch(/Danantara/);
  });

  it("summarises the world without dumping all of it into every turn", () => {
    const brief = worldBrief(WORLD, null);
    expect(brief).toContain(WORLD.ontology.summary);
    expect(brief).toMatch(/Populasi: \d+ agen/);
    // A whole world per chat turn would be slow and expensive; the brief is bounded.
    expect(brief.length).toBeLessThan(JSON.stringify(WORLD).length / 2);
  });
});

describe("chat-ai — in-character interviews (A15 v4.0)", () => {
  it("states the persona is fictional and forbids claiming to be real", () => {
    const s = chatSystem(WORLD, MODE, AGENT);
    expect(s).toContain(AGENT.displayName);
    expect(s).toContain(AGENT.role);
    expect(s).toMatch(/TOKOH FIKTIF/);
    expect(s).toMatch(/Jangan mengaku sebagai orang nyata/);
    expect(s).toMatch(/persona simulasi/);
    // No professional advice while wearing a persona.
    expect(s).toMatch(/nasihat hukum, medis, atau keuangan/);
  });

  it("shows the agent what it already said, so an interview stays consistent", () => {
    const brief = worldBrief(WORLD, AGENT);
    expect(brief).toMatch(/Yang SUDAH Anda tulis/);
    const own = WORLD.rounds.flatMap((r) => r.posts.filter((p) => p.agentId === AGENT.id));
    expect(own.length).toBeGreaterThan(0);
    expect(brief).toContain(own[0].text.slice(0, 40));
  });
});

describe("chat-ai — transcript handling", () => {
  it("sends a lone question as-is", () => {
    expect(buildChatUser([{ role: "user", content: "Kenapa begitu?" }])).toBe("Kenapa begitu?");
  });

  it("keeps the thread readable and bounded on a long interview", () => {
    const turns: ChatTurn[] = Array.from({ length: 30 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `pesan-${i}`,
    }));
    const out = buildChatUser(turns);
    expect(out).toMatch(/PERCAKAPAN SEJAUH INI/);
    expect(out).toContain("pesan-29"); // the latest question survives
    expect(out).not.toContain("pesan-0"); // the oldest is dropped
    expect(out.split("\n").filter((l) => /^(Pengguna|Anda):/.test(l)).length).toBeLessThanOrEqual(MAX_TURNS);
  });

  it("truncates an enormous question rather than forwarding it whole", () => {
    const out = buildChatUser([{ role: "user", content: "x".repeat(5000) }]);
    expect(out.length).toBeLessThan(1000);
  });
});

describe("chat-ai — fallback when no model is available", () => {
  it("answers from the world and never pretends to be live", () => {
    const asAgent = fallbackReply(WORLD, AGENT);
    expect(asAgent).toContain(AGENT.displayName);
    expect(asAgent).toMatch(/tanpa model aktif/);

    const asReport = fallbackReply(WORLD, null);
    expect(asReport).toContain(WORLD.report.abstract);
    expect(asReport).toMatch(/Model tidak aktif/);
  });
});
