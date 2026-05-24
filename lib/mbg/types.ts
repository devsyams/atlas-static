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
  severity_sum: number;
  heat: number;
  lat: number;
  lng: number;
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

export interface ActorTopPost {
  text: string;
  likes: number;
  comments: number;
  views: number;
}

/** A monitored social-media account in the sentiment/threat analysis. */
export interface SocialActor {
  handle: string;
  name: string;
  platform: string;
  status: string;
  followers: number;
  influence: number; // 0–10
  credibility: number; // 0–10
  sentiment: number; // negative … positive
  risk_level: string; // low | moderate | high | critical
  posts_7d: number;
  brand_mentions: number;
  avg_engagement: number;
  total_engagement: number;
  avatar: string;
  themes: string[];
  brand_summary: string;
  influence_analysis: string;
  collab_opportunity: string;
  recommended_actions: string;
  top_posts: ActorTopPost[];
}

export interface ActorAnalysisSummary {
  total: number;
  by_platform: Record<string, number>;
  by_risk: Record<string, number>;
}

export interface ActorThreadAnalysis {
  actors: SocialActor[];
  summary: ActorAnalysisSummary;
  updated_at: string;
}

export interface LeaderArticle {
  title: string;
  source: string;
  date: string;
  sentiment: number; // 0–5
  crisis_score: number; // 0–10
}

export interface Leader {
  id: string;
  name: string;
  position: string;
  organization: string;
  photo: string;
  sentiment: { score: number; trend: string; article_count: number };
  insight: string;
  prediction: { question: string; probability: number; answer_label: string; reasoning: string };
  recent_articles: LeaderArticle[];
}

export interface LeadershipSentiment {
  leaders: Leader[];
  ai_available: boolean;
  updated_at: string;
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
  actor_thread_analysis: ActorThreadAnalysis | null;
  leadership_sentiment: LeadershipSentiment | null;
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
