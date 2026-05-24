import type { GroundingContext } from "./context";

/** Deterministic, on-brand fallbacks derived from the grounding data (no LLM). */

export function scriptedChat(question: string, ctx: GroundingContext): string {
  const d = ctx.data;
  const q = question.toLowerCase();
  const cities = [...d.top_cities].sort((a, b) => b.severity_sum - a.severity_sum);

  if (/(provinsi|kota|hotspot|wilayah|daerah|memburuk|parah|terdampak)/.test(q)) {
    const top = cities[0];
    const list = cities
      .slice(0, 4)
      .map((c, i) => `${i + 1}. ${c.city} (${c.province}) — ${c.article_count} artikel, isu ${c.dominant_issue}`)
      .join("\n");
    return top
      ? `Hotspot paling memburuk saat ini adalah **${top.city}, ${top.province}** (severity ${top.severity_sum}, isu utama ${top.dominant_issue}).\n\nPeringkat wilayah:\n${list}`
      : "Belum ada wilayah yang terpetakan di data saat ini.";
  }

  if (/(aktor|sumber|akun|medsos|media sosial|sentimen negatif|penggerak)/.test(q)) {
    const actors = d.actor_thread_analysis?.actors ?? [];
    if (!actors.length) return "Belum ada aktor yang dipantau di data saat ini.";
    const list = actors
      .map((a) => `• @${a.handle} (${a.platform}) — risiko ${a.risk_level}, pengaruh ${a.influence}/10, sentimen ${a.sentiment}`)
      .join("\n");
    return `Ada ${actors.length} aktor media sosial yang dipantau:\n${list}\n\nFokuskan pemantauan pada akun berpengaruh tinggi bila sentimennya memburuk.`;
  }

  if (/(pemimpin|kepemimpinan|leader|menteri|kepala|pejabat|bgn)/.test(q)) {
    const leaders = d.leadership_sentiment?.leaders ?? [];
    if (!leaders.length) return "Belum ada data sentimen kepemimpinan.";
    const list = leaders
      .map((l) => `• ${l.name} (${l.position}) — sentimen ${l.sentiment.score}/5, tren ${l.sentiment.trend}, prediksi ${l.prediction.probability}% ${l.prediction.answer_label}`)
      .join("\n");
    return `Sentimen kepemimpinan:\n${list}`;
  }

  if (/(prediksi|akan|ramal|proyeksi|masa depan|7 hari)/.test(q) && d.prediction) {
    return `${d.prediction.question}\n\nEstimasi: **${d.prediction.probability}% — ${d.prediction.answer_label}**. ${d.prediction.reasoning}`;
  }

  if (/(rekomendasi|tindakan|saran|harus|langkah|respons)/.test(q)) {
    const issue = cities[0]?.dominant_issue ?? "isu dominan";
    return `Rekomendasi prioritas:\n1. Klarifikasi resmi + audit terkait ${issue} dalam 24 jam.\n2. Aktifkan juru bicara terpadu dan pantau ${cities[0]?.city ?? "wilayah hotspot"}.\n3. Siapkan narasi tandingan berbasis fakta untuk meredam sentimen negatif.`;
  }

  // Default: situation overview
  return [
    `Indeks krisis MBG saat ini **${d.score}/10 (${d.level})** dari ${d.article_count} artikel (${d.high_crisis_count} krisis tinggi).`,
    d.insight ? `Insight: ${d.insight.title}.` : "",
    cities[0] ? `Hotspot utama: ${cities[0].city} (${cities[0].province}), isu ${cities[0].dominant_issue}.` : "",
    d.prediction ? `Prediksi: ${d.prediction.probability}% ${d.prediction.answer_label}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function scriptedBriefing(ctx: GroundingContext): string {
  const d = ctx.data;
  const cities = [...d.top_cities].sort((a, b) => b.severity_sum - a.severity_sum);
  const actors = d.actor_thread_analysis?.actors ?? [];
  const leaders = d.leadership_sentiment?.leaders ?? [];

  return [
    `## Ringkasan Eksekutif`,
    `Indeks krisis **${d.score}/10 (${d.level})** dari ${d.article_count} artikel (${d.high_crisis_count} krisis tinggi). ${d.insight?.text ?? ""}`,
    ``,
    `## Insiden Utama`,
    cities
      .slice(0, 5)
      .map((c) => `- **${c.city}, ${c.province}** — ${c.article_count} artikel, isu ${c.dominant_issue} (severity ${c.severity_sum}).`)
      .join("\n") || "- Tidak ada insiden terpetakan.",
    ``,
    `## Aktor & Narasi`,
    actors.length
      ? actors.map((a) => `- @${a.handle} (${a.platform}) — risiko ${a.risk_level}, pengaruh ${a.influence}/10.`).join("\n")
      : "- Tidak ada aktor dipantau.",
    ``,
    `## Sentimen Kepemimpinan`,
    leaders.length
      ? leaders.map((l) => `- ${l.name} (${l.position}) — ${l.sentiment.score}/5, tren ${l.sentiment.trend}.`).join("\n")
      : "- Tidak ada data.",
    ``,
    `## Prediksi`,
    d.prediction ? `${d.prediction.question} → **${d.prediction.probability}% ${d.prediction.answer_label}**. ${d.prediction.reasoning}` : "Tidak tersedia.",
    ``,
    `## Rekomendasi`,
    `1. Klarifikasi resmi + audit terkait ${cities[0]?.dominant_issue ?? "isu dominan"} dalam 24 jam.`,
    `2. Aktifkan juru bicara terpadu; prioritaskan ${cities[0]?.city ?? "wilayah hotspot"}.`,
    `3. Angkat narasi tandingan berbasis fakta dan kisah sukses daerah.`,
  ].join("\n");
}

export function scriptedWidget(widget: string, mode: string, ctx: GroundingContext): string {
  const d = ctx.data;
  const cities = [...d.top_cities].sort((a, b) => b.severity_sum - a.severity_sum);
  const top = cities[0];
  switch (widget) {
    case "score":
      return `Indeks ${d.score}/10 (${d.level}) mencerminkan ${d.high_crisis_count} dari ${d.article_count} artikel berstatus krisis tinggi. Pendorong utama: isu ${top?.dominant_issue ?? "keamanan pangan"}.`;
    case "map":
      return `${d.mapped_article_count} artikel terpeta ke ${d.top_cities.length} wilayah. Konsentrasi tertinggi di ${top?.city ?? "-"} (${top?.province ?? "-"}).`;
    case "actors":
      return `${(d.actor_thread_analysis?.actors ?? []).length} aktor dipantau; perhatikan akun berpengaruh tinggi bila sentimen memburuk.`;
    case "leadership":
      return (d.leadership_sentiment?.leaders ?? []).map((l) => `${l.name}: ${l.sentiment.score}/5 (${l.sentiment.trend}).`).join(" ") || "Tidak ada data.";
    case "articles":
      return `${d.articles.length} artikel terbaru; mayoritas berisi isu ${top?.dominant_issue ?? "keamanan pangan"}.`;
    case "keywords":
      return `Kata kunci dominan: ${d.top_keywords.slice(0, 5).map((k) => `${k.keyword} (${k.count})`).join(", ")}.`;
    default:
      return scriptedChat(`${widget} ${mode}`, ctx);
  }
}

export interface ForecastResult {
  generated: string;
  provinces: { name: string; city: string; trajectory: "naik" | "stabil" | "turun"; probability: number; drivers: string }[];
  anomalies: { title: string; detail: string; severity: "high" | "med" | "low" }[];
}

export function scriptedForecast(ctx: GroundingContext): ForecastResult {
  const d = ctx.data;
  const cities = [...d.top_cities].sort((a, b) => b.severity_sum - a.severity_sum);
  const maxSev = Math.max(1, ...cities.map((c) => c.severity_sum));

  const provinces = cities.slice(0, 5).map((c) => {
    const norm = c.severity_sum / maxSev; // 0..1
    const probability = Math.round(35 + norm * 55); // 35..90
    const trajectory: "naik" | "stabil" | "turun" = probability >= 70 ? "naik" : probability >= 45 ? "stabil" : "turun";
    return {
      name: c.province,
      city: c.city,
      trajectory,
      probability,
      drivers: `isu ${c.dominant_issue}, ${c.article_count} artikel`,
    };
  });

  const anomalies: ForecastResult["anomalies"] = [];
  const topKw = d.top_keywords[0];
  if (topKw) anomalies.push({ title: `Lonjakan narasi "${topKw.keyword}"`, detail: `${topKw.keyword} disebut ${topKw.count}× — narasi dominan yang perlu diwaspadai.`, severity: "high" });
  if (cities[0]) anomalies.push({ title: `Eskalasi di ${cities[0].city}`, detail: `Konsentrasi isu ${cities[0].dominant_issue} tertinggi; berpotensi meluas ke wilayah berpola serupa.`, severity: cities[0].severity_sum > maxSev * 0.7 ? "high" : "med" });
  if (d.unmapped_article_count > 0) anomalies.push({ title: `${d.unmapped_article_count} sinyal belum terpetakan`, detail: `Ada artikel yang belum terverifikasi lokasinya — potensi titik buta.`, severity: "low" });

  return { generated: d.updated_at, provinces, anomalies };
}
