import { buildDashboard } from "@/lib/mbg/data";
import type { DashboardData } from "@/lib/mbg/types";

/** Synapse analyst persona — grounded, concise, Indonesian, no vendor names. */
export const SYNAPSE_SYSTEM = [
  "Kamu adalah Synapse, analis intelijen untuk command center Atlas (pemantauan krisis program MBG / Makan Bergizi Gratis di Indonesia).",
  "Jawab ringkas, faktual, dan HANYA berdasarkan DATA INTELIJEN yang diberikan di bawah.",
  "Gunakan Bahasa Indonesia. Kutip angka langsung dari data. Jika informasi tidak ada di data, katakan 'tidak tersedia di data saat ini'.",
  "Hindari basa-basi. Saat relevan, beri implikasi singkat atau rekomendasi tindakan untuk pengambil keputusan.",
].join(" ");

export interface GroundingContext {
  data: DashboardData;
  text: string;
}

/** Compact, structured snapshot of the whole dashboard for grounding the AI. */
export function buildGroundingContext(): GroundingContext {
  const d = buildDashboard();
  const lines: string[] = [];

  lines.push(
    `SKOR KRISIS: ${d.score}/10 (${d.level}) — ${d.article_count} artikel, ${d.high_crisis_count} berstatus krisis tinggi. Diperbarui ${d.updated_at}. Status AI: ${d.ai_status} (${d.mapped_article_count} terpeta, ${d.unmapped_article_count} belum).`,
  );
  if (d.insight) lines.push(`INSIGHT: ${d.insight.title} — ${d.insight.text}`);
  if (d.prediction)
    lines.push(
      `PREDIKSI: "${d.prediction.question}" → ${d.prediction.probability}% (${d.prediction.answer_label}). ${d.prediction.reasoning}`,
    );

  if (d.top_cities.length)
    lines.push(
      `KOTA/PROVINSI TERATAS (intensitas negatif): ${d.top_cities
        .map(
          (c) =>
            `${c.city} (${c.province}; ${c.article_count} artikel; severity ${c.severity_sum}; isu ${c.dominant_issue})`,
        )
        .join("; ")}`,
    );

  if (d.top_keywords.length)
    lines.push(`KATA KUNCI: ${d.top_keywords.map((k) => `${k.keyword}×${k.count}`).join(", ")}`);

  if (d.actor_thread_analysis?.actors.length)
    lines.push(
      `AKTOR MEDIA SOSIAL: ${d.actor_thread_analysis.actors
        .map(
          (a) =>
            `@${a.handle} (${a.platform}; risiko ${a.risk_level}; sentimen ${a.sentiment}; pengaruh ${a.influence}/10; ${a.posts_7d} post/7h; sebut MBG ${a.brand_mentions})`,
        )
        .join(" | ")}`,
    );

  if (d.leadership_sentiment?.leaders.length)
    lines.push(
      `SENTIMEN PEMIMPIN: ${d.leadership_sentiment.leaders
        .map(
          (l) =>
            `${l.name} (${l.position}, ${l.organization}) sentimen ${l.sentiment.score}/5 tren ${l.sentiment.trend}; "${l.prediction.question}" → ${l.prediction.probability}% ${l.prediction.answer_label}`,
        )
        .join(" | ")}`,
    );

  const arts = d.articles
    .slice(0, 10)
    .map(
      (a) =>
        `- [skor ${a.score}] ${a.title} (${a.source}${a.location ? `, ${a.location.city}` : ""}; isu ${a.dominant_issue ?? "-"})`,
    )
    .join("\n");
  if (arts) lines.push(`ARTIKEL TERKINI:\n${arts}`);

  return { data: d, text: lines.join("\n") };
}
