import type { Prediction } from "@/lib/mbg/types";

import { getCorridor } from "./corridors";
import type { OpsInsight, OpsSnapshot } from "./types";

/**
 * A12 — the grounding + parsing layer that makes the two AI-badged JasaMarga
 * widgets (AI Ops Insight, Prediksi Kemacetan) actually LLM-backed.
 *
 * Pure: no I/O, no provider. The route owns the model call (via lib/ai/engine),
 * hands us the raw JSON, and falls back to the deterministic snapshot values if
 * `parseOpsAi` rejects it. Every number the model is allowed to cite must appear
 * in `buildOpsGrounding` — that is the whole contract (AC3).
 */

export interface OpsAi {
  insight: OpsInsight;
  predictions: Prediction[];
}

/** Exactly what the Prediksi Kemacetan board renders. */
const PREDICTION_COUNT = 3;

export const JASAMARGA_AI_SYSTEM = [
  "Anda adalah analis lalu lintas senior Nexorus AI untuk operasi jalan tol JasaMarga.",
  "Anda menerima SNAPSHOT KORIDOR berisi kondisi terkini dari sumber publik/daring",
  "(TomTom Traffic, BMKG, media sosial, berita, kanal resmi).",
  "",
  "ATURAN KERAS:",
  "- Gunakan HANYA angka dan fakta yang ada di SNAPSHOT KORIDOR. Jangan mengarang angka apa pun.",
  "- Setiap `reasoning` wajib mengutip minimal satu angka konkret dari snapshot.",
  "- `probability` adalah bilangan bulat 0–100 dan harus konsisten dengan bukti di snapshot.",
  "- Tulis dalam Bahasa Indonesia yang ringkas dan operasional (bukan pemasaran).",
  "- Buat tepat 3 skenario prediksi yang saling berbeda dan relevan bagi operator.",
].join("\n");

/** JSON Schema for the structured-output call. */
export const OPS_AI_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    insight: {
      type: "object",
      properties: {
        title: { type: "string", description: "Judul analisis, maksimal ~10 kata." },
        text: { type: "string", description: "2–3 kalimat analisis, mengutip angka dari snapshot." },
        action: { type: "string", description: "Satu rekayasa/tindakan konkret yang disarankan." },
      },
      required: ["title", "text", "action"],
      additionalProperties: false,
    },
    predictions: {
      type: "array",
      description: "Tepat 3 skenario.",
      items: {
        type: "object",
        properties: {
          question: { type: "string", description: "Pertanyaan ya/tidak yang bisa dinilai." },
          probability: { type: "integer", description: "Keyakinan 0–100." },
          answer_label: { type: "string", description: "Mis. Kecil / Berimbang / Mungkin / Sangat mungkin." },
          reasoning: { type: "string", description: "Alasan, mengutip angka dari snapshot." },
          timeframe: { type: "string", description: "Mis. '2 jam', 'malam ini'." },
          tone: { type: "string", enum: ["negative", "neutral", "positive"] },
        },
        required: ["question", "probability", "answer_label", "reasoning", "timeframe", "tone"],
        additionalProperties: false,
      },
    },
  },
  required: ["insight", "predictions"],
  additionalProperties: false,
};

/**
 * Render the snapshot the operator is *currently looking at* into a compact brief.
 * This is the model's only source of numbers (AC3), so anything the analysis is
 * allowed to mention has to be here.
 */
export function buildOpsGrounding(s: OpsSnapshot): string {
  const c = getCorridor(s.corridor);
  const slowest = [...s.segments].sort((a, b) => a.speed - b.speed)[0];
  const peak = [...s.forecast].sort((a, b) => b.load - a.load)[0];
  const worstWeather =
    s.weather.find((w) => w.impact === "tinggi") ?? s.weather.find((w) => w.impact === "sedang") ?? s.weather[0];

  const lines: string[] = [
    `KORIDOR: ${c.name} (${c.short}), diperbarui ${s.updated_at}.`,
    `Sumber lalu lintas: ${s.traffic_source === "tomtom" ? "TomTom Traffic (live)" : "simulasi"}.`,
    `KONDISI: ${s.level} ${s.emoji} — indeks beban ${s.load_index}/10.`,
    `Kecepatan rata-rata ${s.avg_speed} km/j. Tambahan waktu tempuh ${s.avg_delay_min} mnt ujung-ke-ujung.`,
    `Insiden aktif: ${s.active_incidents}.`,
    `Skor keselamatan (Safe Meter): ${s.safety.score}/100 — ${s.safety.level}, tren ${s.safety.trend} (${s.safety.delta}).`,
    `Faktor penalti: ${s.safety.factors.map((f) => `${f.label} −${f.penalty}`).join(", ") || "—"}.`,
    "",
    "RUAS (km, kecepatan km/j, tundaan mnt, status):",
    ...s.segments.map(
      (g) => `- ${g.label} (KM ${g.km_from}–${g.km_to}): ${g.speed} km/j, +${g.delay_min} mnt, ${g.status}`,
    ),
  ];

  if (slowest) {
    lines.push("", `RUAS TERLAMBAT: ${slowest.label} — ${slowest.speed} km/j, +${slowest.delay_min} mnt.`);
  }

  lines.push("", `INSIDEN (${s.incidents.length}):`);
  lines.push(
    ...(s.incidents.length
      ? s.incidents.map(
          (i) =>
            `- ${i.type} di ${i.km} (${i.direction}) — severity ${i.severity}, ${i.status}, sumber ${i.source}, ${i.reported}. ${i.detail}`,
        )
      : ["- tidak ada insiden terpantau"]),
  );

  // AC17 — weather is only presented as fact when it actually is one. The model
  // was previously recommending rain warnings off a hardcoded string literal.
  const wxReal = s.weather_source === "bmkg";
  lines.push(
    "",
    `CUACA ${wxReal ? "(DATA NYATA — BMKG)" : "(simulasi — JANGAN jadikan dasar rekomendasi)"}: ${s.weather
      .map((w) => `${w.zone}: ${w.condition} ${w.temp}°C (dampak ${w.impact})`)
      .join("; ")}.`,
  );
  if (worstWeather) lines.push(`Cuaca paling berdampak: ${worstWeather.condition} di ${worstWeather.zone}.`);

  // AC11 — when the client's real media-intelligence feed is attached, the model
  // reasons over actual public reaction instead of a synthetic mention count.
  if (s.social.source === "live" && s.social.sentiment_pct) {
    const p = s.social.sentiment_pct;
    lines.push(
      "",
      "SENTIMEN PUBLIK (DATA NYATA — media intelligence, topik JasaMarga):",
      `- Impresi ${s.social.impressions ?? s.social.mentions_24h}, jangkauan ${s.social.reach ?? 0}.`,
      `- Sentimen: ${p.positive}% positif, ${p.negative}% negatif, ${p.neutral}% netral.`,
      "- Topik teratas (jangkauan):",
      ...(s.social.topics ?? [])
        .slice(0, 5)
        .map((t) => `  · "${t.title}" — jangkauan ${t.reach}, sentimen ${t.sentiment}. ${t.aiLine}`),
    );
  } else {
    lines.push(
      "",
      `SENTIMEN PUBLIK (simulasi): ${s.social.mentions_24h} sebutan/24 jam, negativitas ${s.social.negativity}/10.`,
      `Tren kata kunci: ${s.social.trend.map((t) => `${t.keyword} (${t.count})`).join(", ") || "—"}.`,
    );
  }

  lines.push(
    "",
    `PROYEKSI BEBAN 6 JAM: ${s.forecast.map((f) => `${f.hour}=${f.load}`).join(", ")}.`,
    peak ? `Puncak diperkirakan ${peak.hour} dengan beban ${peak.load}/10.` : "",
    "",
    `ALTERNATIF: ${c.altRoute}${c.elevatedName ? `; jalur layang: ${c.elevatedName}` : ""}.`,
  );

  return lines.filter((l) => l !== "").join("\n");
}

function cleanStr(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function cleanProb(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return Math.round(Math.max(0, Math.min(100, v)));
}

const TONES = new Set(["negative", "neutral", "positive"]);

/**
 * Validate an LLM payload into the app's existing `OpsInsight` + `Prediction`
 * types. Returns null on anything malformed — the caller then falls back to the
 * deterministic snapshot values (AC4). We never partially trust a payload:
 * a single bad prediction rejects the whole thing, so the board can't render a
 * mix of model output and template output.
 */
export function parseOpsAi(raw: unknown): OpsAi | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const rawInsight = o.insight;
  if (!rawInsight || typeof rawInsight !== "object") return null;
  const i = rawInsight as Record<string, unknown>;

  const title = cleanStr(i.title);
  const text = cleanStr(i.text);
  if (!title || !text) return null;
  const action = cleanStr(i.action) ?? undefined;

  if (!Array.isArray(o.predictions) || o.predictions.length !== PREDICTION_COUNT) return null;

  const predictions: Prediction[] = [];
  for (const p of o.predictions) {
    if (!p || typeof p !== "object") return null;
    const r = p as Record<string, unknown>;

    const question = cleanStr(r.question);
    const answer_label = cleanStr(r.answer_label);
    const reasoning = cleanStr(r.reasoning);
    const probability = cleanProb(r.probability);
    if (!question || !answer_label || !reasoning || probability === null) return null;

    const tone = cleanStr(r.tone);
    predictions.push({
      question,
      probability,
      answer_label,
      reasoning,
      timeframe: cleanStr(r.timeframe) ?? undefined,
      tone: tone && TONES.has(tone) ? (tone as Prediction["tone"]) : undefined,
    });
  }

  return { insight: { title, text, action }, predictions };
}
