import rawData from "@/mbg-crisis-data-v2.json";
import type {
  ActorThreadAnalysis,
  AiStatus,
  Article,
  ArticleDetail,
  CityMapPoint,
  DashboardData,
  Keyword,
  LeadershipSentiment,
  MarketTickerItem,
  Prediction,
  TopCity,
} from "./types";

const raw = rawData as typeof rawData;

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Demo timestamps anchored to "now": a plain date, a date+time fixed at 00:10:00,
 * and an RFC-style string whose first 16 chars are the date (the slice the UI
 * shows for article rows). Every displayed timestamp is rebased onto these so the
 * dashboard always reads as current.
 */
function nowStamps() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mon = MON[d.getMonth()];
  const yyyy = d.getFullYear();
  const dow = DOW[d.getDay()];
  const date = `${dd} ${mon} ${yyyy}`;
  return {
    date,
    dateTime: `${date} 00:10:00`,
    rfc: `${dow}, ${dd} ${mon} ${yyyy} 00:10:00 GMT`,
  };
}

/** Map the exported crisis JSON onto the dashboard shape the UI consumes. */
export function buildDashboard(): DashboardData {
  const stamps = nowStamps();
  const leadership = raw.leadership_sentiment as unknown as LeadershipSentiment | null;
  const actors = raw.actor_thread_analysis as unknown as ActorThreadAnalysis | null;

  return {
    score: raw.crisis_score.score,
    emoji: raw.crisis_score.emoji,
    level: raw.crisis_score.level,
    article_count: raw.crisis_score.article_count,
    high_crisis_count: raw.crisis_score.high_crisis_count,
    updated_at: stamps.dateTime,
    ai_status: raw.ai_status as AiStatus,
    mapped_article_count: raw.mapped_article_count,
    unmapped_article_count: raw.unmapped_article_count,
    insight: raw.insight,
    predictions: (raw.predictions ?? []) as Prediction[],
    market_ticker: (raw.market_ticker ?? []) as MarketTickerItem[],
    top_keywords: raw.top_keywords as Keyword[],
    city_map_points: raw.city_map_points as CityMapPoint[],
    top_cities: raw.top_cities as TopCity[],
    articles: raw.articles.map(
      (a): Article => ({
        title: a.title,
        source: a.source,
        score: a.score,
        date: stamps.rfc,
        link: a.link,
        location: a.location
          ? { city: a.location.city, province: a.location.province }
          : null,
        dominant_issue: a.dominant_issue,
      }),
    ),
    actor_thread_analysis: actors ? { ...actors, updated_at: stamps.dateTime } : null,
    leadership_sentiment: leadership
      ? {
          ...leadership,
          updated_at: stamps.dateTime,
          leaders: leadership.leaders.map((l) => ({
            ...l,
            recent_articles: l.recent_articles.map((a) => ({ ...a, date: stamps.rfc })),
          })),
        }
      : null,
  };
}

/** Per-article detail, enriched with the real article's AI signals when found. */
export function buildArticleDetail(params: URLSearchParams): ArticleDetail {
  const url = params.get("url") || "";
  const found = raw.articles.find((a) => a.link === url);

  const title = params.get("title") || found?.title || "Artikel MBG";
  const source = params.get("source") || found?.source || "Sumber";
  const score = Number(params.get("score") || found?.score || 5);

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

  const secondary = found?.secondary_issues?.length
    ? ` Isu turunan yang terdeteksi: ${found.secondary_issues.join(", ")}.`
    : "";
  const summary =
    (found?.ai_reasoning && found.ai_reasoning.trim()
      ? found.ai_reasoning.trim()
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

  const signals = [
    {
      source: source.toLowerCase().replace(/\s+/g, ""),
      type: "berita",
      quote: title,
    },
    found?.ai_reasoning && found.ai_reasoning.trim()
      ? { source: "ai-engine", type: "analisis", quote: found.ai_reasoning.trim() }
      : {
          source: "warganet",
          type: "media sosial",
          quote:
            "Banyak yang menanyakan kejelasan penanganan dan tindak lanjut dari pihak berwenang.",
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
    url: url || found?.link || "https://example.com",
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
