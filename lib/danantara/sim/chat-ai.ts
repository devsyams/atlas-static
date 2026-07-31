/**
 * Deep interaction — prompt building for step 5 (A15 v4.0). Pure.
 *
 * Two conversation partners share one endpoint:
 *  - the **Report Agent**, which answers analytically about the simulated world and may
 *    only cite what is actually in it, and
 *  - **any simulated agent**, interviewed *in character*.
 *
 * The in-character mode is the one that needs guarding: the model is being asked to
 * speak as a person about a real organisation. So the prompt states plainly that the
 * persona is fictional, forbids it claiming to be a real person or to hold real
 * credentials, and forbids inventing facts beyond the world it was given.
 */

import type { AgentProfile, ConsoleWorld } from "./console-types";
import type { SimMode } from "./modes";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/** Cap so an interview can't grow the prompt without bound. */
export const MAX_TURNS = 12;
export const MAX_QUESTION = 600;

const REPORT_AGENT = [
  "Anda adalah ReportAgent Nexorus: analis yang menjawab pertanyaan tentang DUNIA SIMULASI",
  "yang baru saja dibangun, dan hanya tentang itu.",
  "",
  "ATURAN:",
  "- Jawab dalam Bahasa Indonesia, ringkas (maksimal 5 kalimat), langsung ke inti.",
  "- Gunakan HANYA isi dunia simulasi di bawah. Jangan mengarang angka, tanggal, atau",
  "  peristiwa yang tidak ada di sana.",
  "- Bila ditanya sesuatu yang tidak tercakup, katakan terus terang bahwa simulasi ini",
  "  tidak memuatnya — jangan menebak.",
  "- Ingatkan secara wajar bila pengguna memperlakukan hasil simulasi sebagai fakta",
  "  terukur; ini proyeksi, bukan pengukuran akun nyata.",
].join("\n");

function inCharacter(agent: AgentProfile): string {
  return [
    `Anda memerankan "${agent.displayName}" (@${agent.id}), TOKOH FIKTIF dalam sebuah simulasi opini publik.`,
    `Peran: ${agent.role}. Sikap: ${agent.stance}. Latar: ${agent.bio}`,
    `Perhatian utama: ${agent.topics.join(", ") || "isu umum"}.`,
    "",
    "ATURAN:",
    "- Jawab dalam Bahasa Indonesia, sebagai orang ini, maksimal 5 kalimat.",
    "- Pertahankan sikap dan sudut pandang Anda; boleh berubah pikiran hanya jika argumen",
    "  lawan bicara benar-benar menjawab keberatan Anda.",
    "- Gunakan HANYA fakta dari dokumen sumber dan dunia simulasi di bawah.",
    "- Anda TOKOH FIKTIF. Jangan mengaku sebagai orang nyata, pejabat, jurnalis, atau",
    "  memiliki jabatan/kredensial nyata. Bila ditanya apakah Anda nyata, jawab jujur",
    "  bahwa Anda persona simulasi.",
    "- Jangan memberi nasihat hukum, medis, atau keuangan.",
  ].join("\n");
}

export function chatSystem(world: ConsoleWorld, mode: SimMode, agent: AgentProfile | null): string {
  const persona = agent ? inCharacter(agent) : REPORT_AGENT;
  return [persona, "", `KONTEKS PENGGUNAAN: ${mode.label} — ${mode.blurb}`, "", worldBrief(world, agent)].join("\n");
}

/**
 * A compact brief of the world — everything the answer may draw on. Deliberately
 * trimmed: the full world is far larger than a chat turn needs, and a bloated prompt
 * makes every reply slower and more expensive.
 */
export function worldBrief(world: ConsoleWorld, agent: AgentProfile | null): string {
  const lines = [
    "DUNIA SIMULASI:",
    `Ringkasan: ${world.ontology.summary}`,
    `Ketegangan: ${world.ontology.tensions.join(" · ")}`,
    `Fakta jangkar: ${world.ontology.anchors.join(" · ")}`,
    "",
    `Laporan: ${world.report.title}`,
    world.report.abstract,
    "",
    "Bukti utama:",
    ...world.report.memories.slice(0, 8).map((m) => `- ${m}`),
  ];

  if (agent) {
    const own = world.rounds
      .flatMap((r) => r.posts.filter((p) => p.agentId === agent.id).map((p) => `R${r.round + 1}: ${p.text}`))
      .slice(0, 6);
    if (own.length > 0) lines.push("", "Yang SUDAH Anda tulis di simulasi (jaga konsistensi):", ...own.map((o) => `- ${o}`));
  } else {
    lines.push(
      "",
      `Populasi: ${world.agents.length} agen — ${world.agents.map((a) => `${a.displayName} (${a.stance})`).join(", ")}`,
      "",
      "Kutipan lini masa:",
      ...world.rounds
        .flatMap((r) => r.posts.slice(0, 1).map((p) => `R${r.round + 1} @${p.agentId}: ${p.text}`))
        .slice(0, 6)
        .map((l) => `- ${l}`),
    );
  }

  return lines.join("\n");
}

/** Flatten the transcript into a single user turn — the engine takes one string. */
export function buildChatUser(turns: ChatTurn[]): string {
  const recent = turns.slice(-MAX_TURNS);
  if (recent.length === 1) return recent[0].content.slice(0, MAX_QUESTION);
  return [
    "PERCAKAPAN SEJAUH INI:",
    ...recent.slice(0, -1).map((t) => `${t.role === "user" ? "Pengguna" : "Anda"}: ${t.content}`),
    "",
    `Pertanyaan terbaru: ${recent[recent.length - 1].content.slice(0, MAX_QUESTION)}`,
  ].join("\n");
}

/**
 * The honest reply when no model is available. It answers from the world where it can
 * rather than refusing outright, and never pretends to be a live agent.
 */
export function fallbackReply(world: ConsoleWorld, agent: AgentProfile | null): string {
  if (agent) {
    return `(${agent.displayName} — mode simulasi tanpa model aktif) Sikap saya di simulasi ini: ${agent.stance}. ${agent.bio} Untuk tanya jawab mendalam, aktifkan Nexorus AI di Settings.`;
  }
  return `Model tidak aktif, jadi saya hanya bisa mengulang isi laporan: ${world.report.abstract} Aktifkan Nexorus AI di Settings untuk tanya jawab mendalam.`;
}
