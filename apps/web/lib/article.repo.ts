import type { Kysely } from "kysely";

import type { DB } from "./db/types.gen";
import type { ArticleDetail, ForecastSignal } from "./mbg/types";

/**
 * Build the per-article detail from stored enrichment (replaces the static
 * `buildArticleDetail`). The forecast/signals are derived deterministically from
 * the article's crisis score + dominant issue + AI reasoning, as before.
 */
export async function getArticleDetail(
  db: Kysely<DB>,
  params: URLSearchParams,
): Promise<ArticleDetail> {
  const url = params.get("url") || "";
  const found = url
    ? await db
        .selectFrom("articles as a")
        .leftJoin("article_enrichment as e", "e.article_id", "a.id")
        .leftJoin("sources as s", "s.id", "a.source_id")
        .select([
          "a.url as url",
          "a.title as title",
          "s.name as source",
          "e.score as score",
          "e.dominant_issue as dominant_issue",
          "e.secondary_issues as secondary_issues",
          "e.ai_reasoning as ai_reasoning",
        ])
        .where("a.url", "=", url)
        .executeTakeFirst()
    : undefined;

  const title = params.get("title") || found?.title || "Artikel MBG";
  const source = params.get("source") || found?.source || "Sumber";
  const score = Number(params.get("score") || (found?.score != null ? Number(found.score) : 5));

  let trend: "up" | "down" | "stable";
  let probability: number;
  if (score >= 6) {
    trend = "up";
    probability = 60 + score * 2;
  } else if (score >= 3) {
    trend = "stable";
    probability = 48;
  } else {
    trend = "down";
    probability = 30;
  }
  probability = Math.max(5, Math.min(95, probability));

  const category =
    found?.dominant_issue ||
    (score >= 6 ? "Keamanan Pangan" : score >= 3 ? "Operasional" : "Apresiasi Publik");

  const secondaryIssues = (found?.secondary_issues as unknown as string[] | null) ?? [];
  const aiReasoning = (found?.ai_reasoning ?? "").trim();
  const secondary = secondaryIssues.length
    ? ` Isu turunan yang terdeteksi: ${secondaryIssues.join(", ")}.`
    : "";
  const summary =
    (aiReasoning
      ? aiReasoning
      : `Laporan dari ${source} menyoroti dinamika program Makan Bergizi Gratis (MBG).`) + secondary;

  const reasoning =
    score >= 6
      ? "Eskalasi kutipan media dan keterlibatan tokoh publik meningkatkan peluang isu membesar."
      : score >= 3
        ? "Isu kemungkinan stabil selama tidak ada insiden lanjutan yang memicu sorotan baru."
        : "Sentimen positif cenderung mereda secara alami tanpa kontroversi tambahan.";

  const recommendation =
    score >= 6
      ? "Siapkan klarifikasi resmi dan audit dapur penyedia dalam 24 jam untuk menahan eskalasi."
      : score >= 3
        ? "Pantau kanal lokal dan perbaiki titik distribusi yang dikeluhkan."
        : "Manfaatkan momentum positif untuk komunikasi publik program.";

  const signals: ForecastSignal[] = [
    { source: source.toLowerCase().replace(/\s+/g, ""), type: "berita", quote: title },
    aiReasoning
      ? { source: "ai-engine", type: "analisis", quote: aiReasoning }
      : {
          source: "warganet",
          type: "media sosial",
          quote: "Banyak yang menanyakan kejelasan penanganan dan tindak lanjut dari pihak berwenang.",
        },
    {
      source: "dinas terkait",
      type: "pernyataan",
      quote:
        "Pihak terkait menyatakan sedang menelusuri laporan dan akan menyampaikan hasil secepatnya.",
    },
  ];

  return {
    title,
    source,
    url: url || found?.url || "https://example.com",
    score,
    category,
    relative_time: "baru saja",
    summary,
    forecast: {
      question: "Apakah perhatian publik terhadap isu ini akan meningkat?",
      trend,
      probability,
      timeframe: "7 hari",
      reasoning,
      recommendation,
    },
    signals,
  };
}
