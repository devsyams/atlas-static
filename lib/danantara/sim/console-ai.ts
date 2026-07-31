/**
 * Console world builder — prompt, schema and parser (A15 v3.0). Pure, deterministic.
 *
 * One structured call turns a pasted document into everything the five-step console
 * renders: the ontology's **type system** and a knowledge graph, agent profiles, six
 * rounds across two platforms, and a long-form report with its supporting evidence.
 *
 * The two rules from v2.0 still hold and are still enforced in the parser, not just
 * requested in the prompt:
 *  1. **Invented identities only** — a generated post must never carry a real person's,
 *     journalist's, outlet's or official account's identity (defamation exposure).
 *  2. **Reimplemented, not copied** — the workflow shape is a category pattern; none of
 *     this derives from any AGPL source.
 */

import {
  CONSOLE_ROUNDS,
  MAX_AGENTS,
  MAX_SECTIONS,
  MIN_AGENTS,
  MIN_ROUNDS,
  MIN_SECTIONS,
  type AgentProfile,
  type ConsoleOntology,
  type ConsolePost,
  type ConsoleReport,
  type ConsoleRound,
  type ConsoleWorld,
  type GraphEdge,
  type GraphNode,
  type ReportSection,
  type Stance,
} from "./console-types";
import { modeByKey, type SimMode } from "./modes";
import { namesRealIdentity } from "./real-identities";

export { SEED_MAX } from "./real-identities";

const POST_MAX = 340;

/**
 * Payload budget. The first cut asked for up to 40 graph nodes and 6 posts a round; on
 * a cold call that regularly overran the token budget, truncated the JSON mid-object
 * and dropped the whole world to the deterministic fallback. These bounds keep a full
 * world comfortably inside one response.
 */
const MIN_NODES = 10;
const MAX_NODES = 22;
const TARGET_NODES = "14–20";
const POSTS_PER_ROUND = "3–4";

const BASE_SYSTEM = [
  "Anda adalah mesin simulasi opini publik Nexorus. Anda menerima SATU DOKUMEN SUMBER",
  "(artikel, laporan, draf kebijakan, atau siaran pers) dan membangun dunia simulasi lengkap.",
  "",
  "ATURAN KERAS:",
  "- Seluruh keluaran dalam Bahasa Indonesia yang natural, KECUALI `entityTypes` dan",
  "  `relationTypes` yang memakai istilah teknis Inggris.",
  "- Dasarkan SEMUA isi pada DOKUMEN SUMBER. Jangan mengarang statistik, tanggal, atau",
  "  kutipan yang tidak ada di dokumen.",
  "",
  "1) ONTOLOGY",
  "- `entityTypes`: 6–10 tipe entitas dalam PascalCase Inggris (mis. Institution, Regulator,",
  "  MediaOutlet, Citizen, Analyst, GovernmentAgency).",
  "- `relationTypes`: 5–8 relasi dalam SCREAMING_SNAKE_CASE Inggris (mis. CRITICIZES,",
  "  REPORTS_ON, ISSUES_STATEMENT_ON, RESPONDS_TO, AFFILIATED_WITH).",
  `- \`nodes\`: ${TARGET_NODES} entitas nyata dari dokumen. \`type\` HARUS salah satu \`entityTypes\`.`,
  "- `edges`: relasi antar node; `s` dan `t` HARUS id node yang ada; `label` salah satu `relationTypes`.",
  "- `volatility` 0–100: seberapa mudah materi ini memicu keributan publik.",
  "",
  "2) AGENTS",
  "- 6–9 profil agen simulasi dengan sikap berbeda-beda",
  "  (hostile, skeptical, neutral, supportive harus terwakili).",
  "- `id` snake_case deskriptif + angka acak, mis. `jurnalis_investigasi_ekonomi_412`.",
  "- `role` singkat, mis. 'Jurnalis Investigasi Ekonomi'. `topics` 2–4 bidang perhatian.",
  "",
  "IDENTITAS WAJIB FIKTIF — INI ATURAN TERPENTING:",
  "- Semua `id`, `displayName` dan `role` HARUS ciptaan Anda sendiri.",
  "- DILARANG KERAS memakai nama atau akun orang nyata, pejabat, politikus, tokoh publik,",
  "  jurnalis, selebritas, atau media/organisasi nyata sebagai identitas agen.",
  "- Nama orang atau lembaga nyata BOLEH disebut di dalam teks post dan di `nodes`,",
  "  karena itu memang isi dokumen — tetapi TIDAK BOLEH menjadi identitas agen.",
  "",
  "3) ROUNDS",
  `- Tepat ${CONSOLE_ROUNDS} ronde. Tiap ronde ${POSTS_PER_ROUND} post.`,
  "- `platform`: `plaza` (linimasa terbuka, cepat, ramai) atau `community` (forum topik,",
  "  lebih panjang dan argumentatif). Gunakan KEDUANYA di tiap ronde.",
  "- `agentId` HARUS ada di daftar `agents`. `replyTo` opsional, mengacu ke `agentId` lain.",
  `- Tiap \`text\` maksimal ${POST_MAX} karakter, gaya media sosial.`,
  "- Nada harus berkembang: keributan naik, lalu muncul suara penyeimbang.",
  "",
  "4) REPORT",
  "- `title` gaya laporan analitik. `abstract` 2–3 kalimat.",
  "- `sections`: 3 bagian; tiap bagian punya `heading`, `subheading`,",
  "  2–4 `paragraphs`, dan boleh satu `quote` (kutipan dari dunia simulasi).",
  "- `memories`: 5–8 baris bukti singkat yang mendasari laporan.",
].join("\n");

/**
 * The system prompt for a given use case. The base rules (identity safety, the schema
 * contract, the platform split) never change; the mode adds the framing and tells the
 * report what to lead with — a policy team and a crisis-PR team want different answers
 * out of the same machinery.
 */
export function consoleSystem(mode: SimMode): string {
  return [BASE_SYSTEM, "", ...mode.framing, "", `FOKUS LAPORAN: ${mode.reportFocus}`].join("\n");
}

/** Kept for callers that don't care about the mode (defaults to policy framing). */
export const CONSOLE_SYSTEM = consoleSystem(modeByKey("policy"));

export const CONSOLE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    ontology: {
      type: "object",
      properties: {
        summary: { type: "string", description: "Satu kalimat: dokumen ini tentang apa." },
        entityTypes: { type: "array", items: { type: "string" }, description: "6–10 tipe, PascalCase Inggris." },
        relationTypes: { type: "array", items: { type: "string" }, description: "5–8 relasi, SCREAMING_SNAKE_CASE." },
        tensions: { type: "array", items: { type: "string" }, description: "2–4 ketegangan inti." },
        anchors: { type: "array", items: { type: "string" }, description: "2–6 fakta jangkar dari dokumen." },
        volatility: { type: "integer", description: "0–100." },
        nodes: {
          type: "array",
          description: `${TARGET_NODES} entitas dari dokumen.`,
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "snake_case unik." },
              label: { type: "string", description: "Nama tampilan singkat." },
              type: { type: "string", description: "Salah satu entityTypes." },
            },
            required: ["id", "label", "type"],
            additionalProperties: false,
          },
        },
        edges: {
          type: "array",
          description: "Relasi antar node.",
          items: {
            type: "object",
            properties: {
              s: { type: "string", description: "id node sumber." },
              t: { type: "string", description: "id node tujuan." },
              label: { type: "string", description: "Salah satu relationTypes." },
            },
            required: ["s", "t", "label"],
            additionalProperties: false,
          },
        },
      },
      required: ["summary", "entityTypes", "relationTypes", "tensions", "anchors", "volatility", "nodes", "edges"],
      additionalProperties: false,
    },
    agents: {
      type: "array",
      description: "6–9 profil agen, identitas fiktif.",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "snake_case + angka, fiktif." },
          displayName: { type: "string", description: "Nama tampilan fiktif." },
          role: { type: "string", description: "Peran singkat." },
          bio: { type: "string", description: "1–2 kalimat: siapa dia dan kenapa peduli." },
          topics: { type: "array", items: { type: "string" }, description: "2–4 bidang perhatian." },
          stance: { type: "string", enum: ["hostile", "skeptical", "neutral", "supportive"] },
          followers: { type: "integer" },
        },
        required: ["id", "displayName", "role", "bio", "topics", "stance", "followers"],
        additionalProperties: false,
      },
    },
    rounds: {
      type: "array",
      description: `Tepat ${CONSOLE_ROUNDS} ronde.`,
      items: {
        type: "object",
        properties: {
          round: { type: "integer" },
          headline: { type: "string", description: "Satu frasa: apa yang terjadi di ronde ini." },
          posts: {
            type: "array",
            description: `${POSTS_PER_ROUND} post, memakai kedua platform.`,
            items: {
              type: "object",
              properties: {
                agentId: { type: "string", description: "Harus ada di agents." },
                platform: { type: "string", enum: ["plaza", "community"] },
                text: { type: "string", description: `Maksimal ${POST_MAX} karakter.` },
                engagement: { type: "integer" },
                stance: { type: "string", enum: ["hostile", "skeptical", "neutral", "supportive"] },
                replyTo: { type: "string", description: "agentId yang dibalas, boleh kosong." },
              },
              required: ["agentId", "platform", "text", "engagement", "stance", "replyTo"],
              additionalProperties: false,
            },
          },
        },
        required: ["round", "headline", "posts"],
        additionalProperties: false,
      },
    },
    report: {
      type: "object",
      properties: {
        title: { type: "string" },
        abstract: { type: "string", description: "2–3 kalimat." },
        sections: {
          type: "array",
          description: "Tepat 3 bagian.",
          items: {
            type: "object",
            properties: {
              heading: { type: "string" },
              subheading: { type: "string" },
              paragraphs: { type: "array", items: { type: "string" }, description: "2–4 paragraf." },
              quote: { type: "string", description: "Kutipan dari dunia simulasi; boleh kosong." },
            },
            required: ["heading", "subheading", "paragraphs", "quote"],
            additionalProperties: false,
          },
        },
        memories: { type: "array", items: { type: "string" }, description: "5–8 baris bukti." },
      },
      required: ["title", "abstract", "sections", "memories"],
      additionalProperties: false,
    },
  },
  required: ["ontology", "agents", "rounds", "report"],
  additionalProperties: false,
};

export function buildConsoleGrounding(seedText: string): string {
  return [
    "DOKUMEN SUMBER:",
    '"""',
    seedText.trim(),
    '"""',
    "",
    "Bangun dunia simulasi lengkap: ontology (termasuk nodes & edges), agents, rounds, report.",
  ].join("\n");
}

/** All-or-nothing: a half-built world would render a step that silently lost content. */
export function parseConsoleWorld(raw: unknown): ConsoleWorld | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const agents = parseAgents(o.agents);
  if (!agents) return null;
  const ids = new Set(agents.map((a) => a.id));

  const ontology = parseOntology(o.ontology);
  if (!ontology) return null;

  const rounds = parseRounds(o.rounds, ids);
  if (!rounds) return null;

  const report = parseReport(o.report);
  if (!report) return null;

  return { ontology, agents, rounds, report };
}

function parseOntology(raw: unknown): ConsoleOntology | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const summary = str(o.summary);
  const entityTypes = strList(o.entityTypes);
  const relationTypes = strList(o.relationTypes);
  const tensions = strList(o.tensions);
  const anchors = strList(o.anchors);
  if (!summary || entityTypes.length === 0 || relationTypes.length === 0 || tensions.length === 0) return null;

  const volatility = typeof o.volatility === "number" ? clampInt(o.volatility, 0, 100) : null;
  if (volatility === null) return null;

  if (!Array.isArray(o.nodes) || o.nodes.length < MIN_NODES) return null;
  const nodes: GraphNode[] = [];
  const nodeIds = new Set<string>();
  for (const n of o.nodes.slice(0, MAX_NODES)) {
    if (!n || typeof n !== "object") return null;
    const q = n as Record<string, unknown>;
    const id = str(q.id);
    const label = str(q.label);
    const type = str(q.type);
    if (!id || !label || !type || nodeIds.has(id)) return null;
    nodeIds.add(id);
    // An unknown type would render a node with no legend entry and no colour.
    nodes.push({ id, label, type: entityTypes.includes(type) ? type : entityTypes[0] });
  }

  // Edges pointing at absent nodes are dropped, not fatal — the graph still draws.
  const edges: GraphEdge[] = Array.isArray(o.edges)
    ? (o.edges as unknown[])
        .map((e) => {
          if (!e || typeof e !== "object") return null;
          const q = e as Record<string, unknown>;
          const s = str(q.s);
          const t = str(q.t);
          const label = str(q.label);
          if (!s || !t || !label || s === t || !nodeIds.has(s) || !nodeIds.has(t)) return null;
          return { s, t, label };
        })
        .filter((e): e is GraphEdge => e !== null)
    : [];
  if (edges.length === 0) return null;

  return { summary, entityTypes, relationTypes, tensions, anchors, volatility, nodes, edges };
}

function parseAgents(raw: unknown): AgentProfile[] | null {
  if (!Array.isArray(raw) || raw.length < MIN_AGENTS || raw.length > MAX_AGENTS) return null;
  const out: AgentProfile[] = [];
  const seen = new Set<string>();

  for (const a of raw) {
    if (!a || typeof a !== "object") return null;
    const o = a as Record<string, unknown>;
    const id = str(o.id).replace(/^@+/, "").toLowerCase();
    const displayName = str(o.displayName);
    const role = str(o.role);
    const bio = str(o.bio);
    const stance = o.stance as Stance;
    if (!id || !displayName || !role || !bio || seen.has(id)) return null;
    if (!isStance(stance)) return null;
    // Never render generated content on a real identity — id, name AND role.
    if (namesRealIdentity(id) || namesRealIdentity(displayName) || namesRealIdentity(role)) return null;
    seen.add(id);
    out.push({
      id,
      displayName,
      role,
      bio,
      topics: strList(o.topics).slice(0, 6),
      stance,
      followers: typeof o.followers === "number" ? Math.max(0, Math.round(o.followers)) : 0,
    });
  }
  return out;
}

function parseRounds(raw: unknown, ids: Set<string>): ConsoleRound[] | null {
  // Accept a short world rather than discarding a usable one: the console plays
  // however many rounds it is given, and 5 good rounds beat falling back entirely.
  if (!Array.isArray(raw) || raw.length < MIN_ROUNDS) return null;
  const out: ConsoleRound[] = [];

  for (const [i, r] of raw.slice(0, CONSOLE_ROUNDS).entries()) {
    if (!r || typeof r !== "object") return null;
    const o = r as Record<string, unknown>;
    const headline = str(o.headline);
    if (!headline || !Array.isArray(o.posts) || o.posts.length === 0) return null;

    const posts: ConsolePost[] = [];
    for (const p of o.posts) {
      if (!p || typeof p !== "object") return null;
      const q = p as Record<string, unknown>;
      const agentId = str(q.agentId).replace(/^@+/, "").toLowerCase();
      const text = str(q.text);
      const stance = q.stance as Stance;
      if (!agentId || !ids.has(agentId)) return null;
      if (!text || text.length > POST_MAX) return null;
      if (!isStance(stance)) return null;
      const replyTo = str(q.replyTo).replace(/^@+/, "").toLowerCase();
      posts.push({
        agentId,
        platform: q.platform === "community" ? "community" : "plaza",
        text,
        engagement: typeof q.engagement === "number" ? Math.max(0, Math.round(q.engagement)) : 0,
        stance,
        replyTo: replyTo && ids.has(replyTo) && replyTo !== agentId ? replyTo : undefined,
      });
    }
    out.push({ round: i, headline, posts });
  }
  return out;
}

function parseReport(raw: unknown): ConsoleReport | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const title = str(o.title);
  const abstract = str(o.abstract);
  if (!title || !abstract) return null;

  if (!Array.isArray(o.sections) || o.sections.length < MIN_SECTIONS) return null;
  const sections: ReportSection[] = [];
  for (const s of o.sections.slice(0, MAX_SECTIONS)) {
    if (!s || typeof s !== "object") return null;
    const q = s as Record<string, unknown>;
    const heading = str(q.heading);
    const paragraphs = strList(q.paragraphs);
    if (!heading || paragraphs.length === 0) return null;
    const quote = str(q.quote);
    sections.push({ heading, subheading: str(q.subheading), paragraphs, quote: quote || undefined });
  }

  const memories = strList(o.memories);
  if (memories.length === 0) return null;

  return { title, abstract, sections, memories };
}

function isStance(v: unknown): v is Stance {
  return v === "hostile" || v === "skeptical" || v === "neutral" || v === "supportive";
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function strList(v: unknown): string[] {
  return Array.isArray(v) ? v.map(str).filter(Boolean) : [];
}

function clampInt(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo;
  return Math.round(Math.min(hi, Math.max(lo, v)));
}
