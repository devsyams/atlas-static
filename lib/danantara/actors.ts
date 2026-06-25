import type { MediaActor } from "./types";

/**
 * The media/social actors shaping the Danantara narrative — a static, public-source
 * roster (no jitter) so the Crisis Gate can name *who* is driving a topic. Lives in
 * its own module (rather than inside `buildSnapshot`) so the lightweight
 * `/api/v1/danantara/actors` BFF can serve it without building the whole snapshot.
 *
 * `drives` tags each actor with the issue categories they actively push/frame
 * (matching `IssueCategory`), which `actorsDrivingThreat` uses to surface the
 * actors behind the current top threat. Amplifier/official accounts carry the full
 * set because they ride (or must answer) whatever trends.
 */
export const DANANTARA_ACTORS: MediaActor[] = [
  { handle: "kontan_id", name: "Harian Kontan", platform: "X", type: "media", reach: 1_900_000, influence: 8.4, credibility: 8.8, stance: "neutral", posts_7d: 42, mentions: 96, drives: ["pasar", "tata-kelola"], note: "Liputan korporasi & pasar; framing faktual atas kinerja portofolio." },
  { handle: "cnbcindonesia", name: "CNBC Indonesia", platform: "X", type: "media", reach: 3_100_000, influence: 8.9, credibility: 8.5, stance: "neutral", posts_7d: 58, mentions: 121, drives: ["pasar", "kebijakan"], note: "Volume tinggi; menggerakkan agenda makro & valas yang menyentuh sentimen dana." },
  { handle: "analis_pasar", name: "Analis Pasar Modal", platform: "X", type: "analis", reach: 420_000, influence: 7.6, credibility: 7.9, stance: "positive", posts_7d: 31, mentions: 64, drives: ["investasi", "kebijakan"], note: "Pendukung tesis hilirisasi & dividen; kredibel di komunitas investor ritel." },
  { handle: "ekonom_kritis", name: "Ekonom Independen", platform: "X", type: "analis", reach: 510_000, influence: 7.8, credibility: 7.4, stance: "negative", posts_7d: 27, mentions: 73, drives: ["tata-kelola"], note: "Penggerak utama narasi tata kelola & independensi; perlu pelibatan & data tandingan." },
  { handle: "infoBUMN", name: "Info BUMN (akun komunitas)", platform: "Instagram", type: "influencer", reach: 880_000, influence: 6.9, credibility: 6.2, stance: "neutral", posts_7d: 19, mentions: 88, drives: ["tata-kelola", "investasi", "kebijakan", "pasar", "sosial"], note: "Amplifier visual; cepat memviralkan kabar baik maupun buruk." },
  { handle: "danantara_id", name: "Danantara Indonesia", platform: "Instagram", type: "resmi", reach: 540_000, influence: 6.4, credibility: 8.0, stance: "positive", posts_7d: 11, mentions: 11, drives: ["tata-kelola", "investasi", "kebijakan", "pasar", "sosial"], note: "Kanal resmi; perlu kadens lebih tinggi untuk merebut narasi proaktif." },
];
