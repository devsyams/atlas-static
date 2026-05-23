export type AiStatus = "ready" | "partial" | "unavailable";

export interface ArticleLocation {
  city: string;
  province: string;
}

export interface Article {
  title: string;
  source: string;
  score: number;
  date: string;
  link: string;
  location: ArticleLocation | null;
  dominant_issue: string | null;
}

export interface CityMapPoint {
  city_key: string;
  city: string;
  province: string;
  lat: number;
  lng: number;
  heat: number;
  severity_sum: number;
  article_count: number;
  dominant_issue: string;
}

export interface TopCity {
  city_key: string;
  city: string;
  province: string;
  article_count: number;
  dominant_issue: string;
}

export interface Keyword {
  keyword: string;
  count: number;
}

export interface Insight {
  title: string;
  text: string;
}

export interface Prediction {
  question: string;
  probability: number;
  answer_label: string;
  reasoning: string;
}

export interface DashboardData {
  score: number;
  emoji: string;
  level: string;
  article_count: number;
  high_crisis_count: number;
  updated_at: string;
  ai_status: AiStatus;
  mapped_article_count: number;
  unmapped_article_count: number;
  insight: Insight | null;
  prediction: Prediction | null;
  top_keywords: Keyword[];
  city_map_points: CityMapPoint[];
  top_cities: TopCity[];
  articles: Article[];
}

export type ForecastTrend = "up" | "down" | "stable";

export interface ForecastSignal {
  source: string;
  type: string;
  quote: string;
}

export interface Forecast {
  question: string;
  trend: ForecastTrend;
  probability: number;
  timeframe: string;
  reasoning: string;
  recommendation: string;
}

export interface ArticleDetail {
  title: string;
  source: string;
  url: string;
  score: number;
  category: string;
  relative_time: string;
  summary: string;
  forecast: Forecast;
  signals: ForecastSignal[];
}
