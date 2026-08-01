/**
 * Counter-Narrative War Room — grounding + parsing layer (A14 v1.0).
 *
 * Pure: no I/O, no provider. The route owns the model call (via `lib/ai/engine`),
 * hands us the raw JSON, and falls back to `fallbackCounterNarrative` if
 * `parseCounterNarrative` rejects it. Every figure the drafts are allowed to quote
 * must appear in `buildCounterNarrativeGrounding` — that is the whole contract.
 *
 * **Framing is load-bearing, not decoration.** The output is ready-to-post political
 * content. Written as undisclosed astroturfing it collides with platform rules on
 * coordinated inauthentic behaviour, with Indonesian paid-endorsement disclosure
 * norms, and — the failure mode that actually bites this architecture — with model
 * refusal, which degrades *silently* to the fallback in the middle of a demo. So the
 * prompt asks for **disclosed amplification**: paid partners who disclose, the
 * client's own owned channels, and employee/community advocates writing in their own
 * voice. No impersonation, no invented statistics, no naming individuals.
 */

import { hostileReachOf, negativeShare } from "./counter-narrative";
import type { CeoIssue } from "./types";

/** The three content channels. `grassroots` is the math module's `homeless`. */
export type DraftChannel = "kol" | "clipper" | "grassroots";
export const DRAFT_CHANNELS: readonly DraftChannel[] = ["kol", "clipper", "grassroots"];

/** Per-channel body cap. Mirrored in the prompt AND enforced by the parser. */
export const DRAFT_MAX: Record<DraftChannel, number> = { kol: 280, clipper: 150, grassroots: 200 };

/** Hard reject ceiling — generous over the per-channel caps, but never unbounded. */
const BODY_HARD_MAX = 400;
const HASHTAG_MAX = 6;
const HEADLINES_PER_TOPIC = 3;

const DEFAULT_PLATFORM: Record<DraftChannel, string> = {
  kol: "X / Instagram",
  clipper: "TikTok / Reels",
  grassroots: "Facebook / WhatsApp",
};

export interface CounterDraft {
  channel: DraftChannel;
  platform: string;
  body: string;
  hashtags: string[];
}

export interface CounterNarrativeTopic {
  topicId: string;
  title: string;
  attackLine: string;
  counterAngle: string;
  drafts: CounterDraft[];
}

export interface CounterNarrativeAi {
  topics: CounterNarrativeTopic[];
}

export const COUNTER_NARRATIVE_SYSTEM = [
  "Anda adalah kepala war room komunikasi Nexorus AI untuk Danantara.",
  "Anda menerima RINGKASAN TOPIK NEGATIF hasil pemantauan media sosial dan berita publik.",
  "Tugas Anda: menyiapkan materi komunikasi tanding untuk tiga kanal yang SAH:",
  "  1) `kol` — mitra KOL BERBAYAR yang mencantumkan keterbukaan (disclosure) endorsement,",
  "  2) `clipper` — kanal milik klien sendiri (owned channels) berupa video pendek,",
  "  3) `grassroots` — karyawan dan komunitas terkait yang bersuara dengan nama dan posisinya sendiri.",
  "",
  "ATURAN KERAS:",
  "- Gunakan HANYA fakta dan angka yang ada di RINGKASAN TOPIK. Jangan mengarang statistik,",
  "  kutipan tokoh, nama pejabat, tanggal, atau janji kebijakan.",
  "- Bila menyebut angka, salin PERSIS dari ringkasan (jangkauan, impresi, persentase negatif).",
  "- `attack_line`: SATU kalimat berisi inti framing pihak yang menyerang, dari sudut pandang",
  "  mereka, disimpulkan dari judul + penjelasan + headline topik. Bukan opini Anda.",
  "- `counter_angle`: 2-3 kalimat sudut balasan yang jujur. Jangan membantah fakta; ubah",
  "  kerangkanya lewat bukti, konteks, progres, atau manfaat langsung bagi publik.",
  "- Buat TEPAT 3 draft per topik: `kol`, `clipper`, `grassroots`. Nada dan diksi harus BERBEDA;",
  "  jangan menyalin satu draft ke draft lain.",
  "- Panjang dan gaya: `kol` maksimal 280 karakter, otoritatif dan berbasis data;",
  "  `clipper` maksimal 150 karakter, hook video pendek — kalimat pertama wajib hook;",
  "  `grassroots` maksimal 200 karakter, bahasa sehari-hari, tanpa jargon korporat.",
  "- Semua `body` dalam Bahasa Indonesia yang natural dan SIAP TEMPEL: tanpa placeholder",
  '  seperti [nama], tanpa tanda kutip pembungkus, tanpa awalan "Draft:".',
  "- `hashtags`: 2–4 tagar, tiap item diawali `#`, tanpa spasi, relevan dengan topik.",
  "- JANGAN menyerang, menyebut, atau memancing individu atau akun tertentu.",
  "- JANGAN menulis draft yang mengaku sebagai warga netral, media independen, atau pihak",
  "  tidak terafiliasi. Draft `grassroots` adalah suara karyawan/komunitas yang memang terkait —",
  "  jujur soal posisinya.",
  "- Kembalikan `topic_id` PERSIS seperti pada ringkasan.",
].join("\n");

/** JSON Schema for the structured-output call. */
export const COUNTER_NARRATIVE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    topics: {
      type: "array",
      description: "Tepat satu entri per topik pada ringkasan, urutan bebas.",
      items: {
        type: "object",
        properties: {
          topic_id: { type: "string", description: "Persis seperti pada ringkasan." },
          attack_line: { type: "string", description: "Satu kalimat framing pihak penyerang." },
          counter_angle: { type: "string", description: "2-3 kalimat sudut balasan faktual yang ringkas." },
          drafts: {
            type: "array",
            description: "Tepat 3 draft: kol, clipper, grassroots.",
            items: {
              type: "object",
              properties: {
                channel: { type: "string", enum: ["kol", "clipper", "grassroots"] },
                platform: { type: "string", description: "Mis. 'X / Instagram', 'TikTok / Reels'." },
                body: { type: "string", description: "Teks siap tempel dalam Bahasa Indonesia." },
                hashtags: { type: "array", items: { type: "string" }, description: "2–4 tagar diawali '#'." },
              },
              required: ["channel", "platform", "body", "hashtags"],
              additionalProperties: false,
            },
          },
        },
        required: ["topic_id", "attack_line", "counter_angle", "drafts"],
        additionalProperties: false,
      },
    },
  },
  required: ["topics"],
  additionalProperties: false,
};

const idNum = (n: number) => n.toLocaleString("id-ID");

/**
 * Render the topics the war room is *currently showing* into a compact brief. This
 * is the model's only source of facts, so anything a draft may cite has to be here.
 * Headlines are included because they carry the only verbatim hostile language in
 * the payload — they are what make `attack_line` specific rather than generic.
 */
export function buildCounterNarrativeGrounding(topics: CeoIssue[]): string {
  const lines: string[] = [
    "RINGKASAN TOPIK NEGATIF (Danantara, sumber publik/daring):",
    "Catatan: 'jangkauan negatif' adalah ESTIMASI = jangkauan total × pangsa impresi negatif.",
  ];

  topics.forEach((t, i) => {
    const negPct = Math.round(negativeShare(t) * 100);
    const posPct = t.mentions > 0 ? Math.round((t.posMentions / t.mentions) * 100) : 0;
    lines.push(
      "",
      `TOPIK ${i + 1} [topic_id: ${t.id}]`,
      `Judul: "${t.title}"`,
      `Penjelasan (Nexorus AI): ${t.aiLine || "(tidak tersedia)"}`,
      `Jangkauan total: ${idNum(t.reach)} · Impresi: ${idNum(t.mentions)} · Negatif: ${idNum(t.negMentions)} (${negPct}%) · Positif: ${idNum(t.posMentions)} (${posPct}%)`,
      `Jangkauan negatif (estimasi): ${idNum(hostileReachOf(t))}`,
      `Status: ${t.status} · Velocity: ${Math.round(t.velocity)}%`,
    );
    const heads = t.headlines.slice(0, HEADLINES_PER_TOPIC);
    if (heads.length > 0) {
      lines.push(`Headline terkait: ${heads.map((h) => `[${h.source}] "${h.title}" (${h.time})`).join("; ")}`);
    }
  });

  lines.push(
    "",
    `Susun untuk SETIAP topik di atas: attack_line, counter_angle, dan 3 draft (kol, clipper, grassroots).`,
  );
  return lines.join("\n");
}

/**
 * All-or-nothing validation. One bad draft rejects the whole payload, so the section
 * can never render a mix of model output and template output. Bodies over the hard
 * ceiling are **rejected, never truncated** — a half sentence in a copy box would
 * read as broken copy on the board.
 */
export function parseCounterNarrative(raw: unknown, topics: CeoIssue[]): CounterNarrativeAi | null {
  if (!raw || typeof raw !== "object") return null;
  const list = (raw as { topics?: unknown }).topics;
  if (!Array.isArray(list) || list.length !== topics.length) return null;

  const byId = new Map(topics.map((t) => [t.id, t]));
  const parsed = new Map<string, CounterNarrativeTopic>();

  for (const entry of list) {
    if (!entry || typeof entry !== "object") return null;
    const o = entry as Record<string, unknown>;

    const topicId = typeof o.topic_id === "string" ? o.topic_id : "";
    const source = byId.get(topicId);
    if (!source) return null; // unknown id
    if (parsed.has(topicId)) return null; // duplicate id — would join drafts to the wrong card

    const attackLine = text(o.attack_line);
    const counterAngle = text(o.counter_angle);
    if (!attackLine || !counterAngle) return null;

    if (!Array.isArray(o.drafts) || o.drafts.length !== DRAFT_CHANNELS.length) return null;
    const drafts = new Map<DraftChannel, CounterDraft>();
    for (const d of o.drafts) {
      const draft = parseDraft(d);
      if (!draft || drafts.has(draft.channel)) return null;
      drafts.set(draft.channel, draft);
    }
    if (drafts.size !== DRAFT_CHANNELS.length) return null;

    parsed.set(topicId, {
      topicId,
      title: source.title,
      attackLine,
      counterAngle,
      drafts: DRAFT_CHANNELS.map((c) => drafts.get(c)!),
    });
  }

  // Always emit in grounding order — never the order the model happened to choose.
  return { topics: topics.map((t) => parsed.get(t.id)!) };
}

function parseDraft(raw: unknown): CounterDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const channel = o.channel as DraftChannel;
  if (!DRAFT_CHANNELS.includes(channel)) return null;

  const body = text(o.body);
  if (!body || body.length > BODY_HARD_MAX) return null;

  return {
    channel,
    platform: text(o.platform) || DEFAULT_PLATFORM[channel],
    body,
    hashtags: cleanHashtags(o.hashtags),
  };
}

function text(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Cosmetic normalisation only — never a rejection reason. */
function cleanHashtags(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((h) => (typeof h === "string" ? h.replace(/\s+/g, "") : ""))
    .filter(Boolean)
    .map((h) => (h.startsWith("#") ? h : `#${h}`))
    .slice(0, HASHTAG_MAX);
}

/**
 * The deterministic fallback — what a boardroom sees when the key is missing, the
 * kill switch is off, the model errors, or it refuses. Built from each topic's own
 * Indonesian penjelasan and title, so it reads as a real (if plainer) answer rather
 * than a placeholder. The provenance badge tells the truth about which one is live.
 */
export function fallbackCounterNarrative(topics: CeoIssue[]): CounterNarrativeAi {
  return {
    topics: topics.map((t) => {
      return {
        topicId: t.id,
        title: t.title,
        attackLine: firstSentence(t.aiLine) || `Narasi negatif berkembang di sekitar "${t.title}".`,
        // The title is the card's own heading directly above this line — splicing it
        // in here too produced broken Indonesian once real (long) titles arrived.
        counterAngle:
          "Jangan sekadar membantah isunya. Perluas konteksnya dengan data resmi, progres yang sudah berjalan, dan manfaat langsung bagi publik agar pembaca melihat gambaran yang utuh.",
        drafts: [
          {
            channel: "kol",
            platform: DEFAULT_PLATFORM.kol,
            body: cap(
              `Soal ${t.title}: angkanya ada dan bisa dicek. Yang jarang dibahas justru konteks dan progresnya. Mari bahas datanya, bukan asumsinya.`,
              DRAFT_MAX.kol,
            ),
            hashtags: tags(t.title),
          },
          {
            channel: "clipper",
            platform: DEFAULT_PLATFORM.clipper,
            body: cap(`Ramai soal ${t.title}? Ini 3 hal yang belum kamu dengar.`, DRAFT_MAX.clipper),
            hashtags: tags(t.title),
          },
          {
            channel: "grassroots",
            platform: DEFAULT_PLATFORM.grassroots,
            body: cap(
              `Saya ikut memantau isu ${t.title}. Sebelum ikut menyimpulkan, coba lihat dulu data lengkapnya.`,
              DRAFT_MAX.grassroots,
            ),
            hashtags: tags(t.title),
          },
        ],
      };
    }),
  };
}

function firstSentence(s: string): string {
  const clean = (s || "").trim();
  if (!clean) return "";
  const end = clean.search(/[.!?](\s|$)/);
  return end === -1 ? clean : clean.slice(0, end + 1);
}

/**
 * Keep a template body under its channel cap. Only ever trims the interpolated
 * title, and always on a word boundary with an ellipsis — the surrounding copy is
 * fixed and known-short, so this can never produce a dangling half-sentence.
 */
function cap(body: string, max: number): string {
  if (body.length <= max) return body;
  const words = body.slice(0, max - 1).split(" ");
  words.pop();
  return `${words.join(" ")}…`;
}

function tags(title: string): string[] {
  const slug = title
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean)
    .join("");
  return slug ? ["#Danantara", `#${slug}`] : ["#Danantara", "#Klarifikasi"];
}
