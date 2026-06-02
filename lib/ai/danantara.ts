import { buildSnapshot } from "@/lib/danantara/data";
import type { SovereignSnapshot } from "@/lib/danantara/types";
import { fmtPct, fmtT } from "@/lib/danantara/ui";

/**
 * Nexorus AI persona + grounding for the Danantara Sovereign Wealth Command.
 * Mirrors lib/ai/context.ts + lib/ai/scripted.ts (the MBG pair) so the chat
 * route can swap grounding per dashboard.
 */
export const DANANTARA_SYSTEM = [
  "Kamu adalah Nexorus AI, analis intelijen investasi & media untuk Danantara Sovereign Wealth Command (pemantauan portofolio BUMN, pasar, dan reputasi publik Danantara Indonesia).",
  "Jawab ringkas, faktual, dan HANYA berdasarkan DATA INTELIJEN yang diberikan di bawah.",
  "Gunakan Bahasa Indonesia. Kutip angka langsung dari data. Jika informasi tidak ada di data, katakan 'tidak tersedia di data saat ini'.",
  "Hindari basa-basi. Saat relevan, beri implikasi singkat atau rekomendasi tindakan untuk komite investasi / dewan pengawas.",
  "Topik krisis MBG (Makan Bergizi Gratis) BUKAN cakupan dasbor ini — jika ditanya, jelaskan singkat lalu arahkan kembali ke konteks Danantara.",
].join(" ");

export interface DanantaraGrounding {
  data: SovereignSnapshot;
  text: string;
}

const sign = (n: number) => `${n >= 0 ? "+" : ""}${n}`;

/** Compact, structured snapshot of the sovereign dashboard for grounding the AI. */
export function buildDanantaraGrounding(): DanantaraGrounding {
  const d = buildSnapshot();
  const m = d.media;
  const movers = [...d.holdings].sort((a, b) => b.change_pct - a.change_pct);
  const gainers = movers.slice(0, 3);
  const losers = movers.slice(-3).reverse();
  const lines: string[] = [];

  lines.push(
    `DANA KELOLAAN: ${fmtT(d.aum_t)} (≈ $${d.aum_usd_b} miliar) di ${d.holdings_count} BUMN (${d.listed_count} tercatat bursa). NAV hari ini ${fmtPct(d.day_change_pct)}, imbal hasil YTD ${fmtPct(d.ytd_return_pct, 1)}, dividen YTD ${fmtT(d.dividend_ytd_t)}. Diperbarui ${d.updated_at}.`,
  );
  lines.push(
    `INDEKS KETAHANAN SOVEREIGN: ${d.strength.score}/100 (${d.strength.level}), tren ${d.strength.trend} (${sign(d.strength.delta)}). ${d.strength.narrative}`,
  );
  lines.push(`INSIGHT: ${d.insight.title} — ${d.insight.text}`);

  lines.push(
    `PENGGERAK PORTOFOLIO — penguat: ${gainers
      .map((h) => `${h.short} ${fmtPct(h.change_pct)}`)
      .join(", ")}; pelemah: ${losers.map((h) => `${h.short} ${fmtPct(h.change_pct)}`).join(", ")}.`,
  );
  lines.push(
    `ALOKASI SEKTOR: ${d.sectors
      .map((s) => `${s.label} ${s.weight_pct}% AUM (${fmtT(s.value_t)}; ${fmtPct(s.change_pct)})`)
      .join("; ")}.`,
  );
  lines.push(
    `PASAR & MAKRO: ${d.markets
      .map((q) => `${q.label} ${q.value}${q.unit ?? ""} (${fmtPct(q.delta)})${q.live ? " [live]" : ""}`)
      .join("; ")}.`,
  );
  lines.push(
    `DIVIDEN UTAMA: ${d.dividends
      .map((x) => `${x.name} ${fmtT(x.amount_t)} (yield ${x.yield_pct}%)`)
      .join("; ")}.`,
  );

  lines.push(
    `REPUTASI & MEDIA: Indeks reputasi ${m.reputation.score}/100 (${m.reputation.level}), tren ${m.reputation.trend}. Sentimen net ${sign(m.totals.net_sentiment)}, ${m.totals.mentions_24h.toLocaleString("id-ID")} sebutan/24 jam, jangkauan ${(m.totals.reach / 1e6).toFixed(0)} jt, ${m.totals.share_negative}% sebutan negatif. ${m.reputation.narrative}`,
  );
  if (m.issues.length)
    lines.push(
      `ISU DOMINAN: ${m.issues
        .map((i) => `"${i.label}" (salience ${i.salience}, ${i.share_pct}% sebutan, sentimen ${i.sentiment}/10, tren ${i.trend})`)
        .join("; ")}.`,
    );
  if (m.crisis.length)
    lines.push(
      `SINYAL KRISIS DINI: ${m.crisis
        .map((c) => `[${c.entity}] "${c.title}" — severity ${c.severity}/10, velocity +${c.velocity}%/24j, status ${c.status} (${c.source})`)
        .join("; ")}.`,
    );
  if (m.hoaxes.length)
    lines.push(
      `HOAKS/DISINFORMASI: ${m.hoaxes
        .map((h) => `"${h.claim}" — ${h.status}, jangkauan ${(h.reach / 1e6).toFixed(1)} jt (${h.platforms.join(", ")}); bantahan: ${h.counter}`)
        .join(" | ")}.`,
    );
  if (m.actors.length)
    lines.push(
      `AKTOR MEDIA: ${m.actors
        .map((a) => `${a.handle} (${a.platform}, ${a.type}) pengaruh ${a.influence}/10, kredibilitas ${a.credibility}/10, sikap ${a.stance}, ${a.posts_7d} post/7h`)
        .join("; ")}.`,
    );

  if (d.predictions.length)
    lines.push(
      `PREDIKSI AI:\n${d.predictions
        .map((p) => `- "${p.question}" → ${p.probability}% (${p.answer_label}). ${p.reasoning}`)
        .join("\n")}`,
    );
  if (d.allocations.length)
    lines.push(
      `OPSI ALOKASI MODAL:\n${d.allocations
        .map(
          (a) =>
            `- ${a.title}${a.recommended ? " [DIREKOMENDASIKAN]" : ""} — ${a.thesis} Modal ${fmtT(a.capital_t)}, proyeksi ${a.return_pct}%, horizon ${a.horizon}, risiko ${a.risk}.`,
        )
        .join("\n")}`,
    );
  lines.push(
    `SUMBER DATA (publik/daring): ${d.sources.map((s) => `${s.name} (${s.status})`).join("; ")}.`,
  );

  return { data: d, text: lines.join("\n") };
}

/** Deterministic, on-brand fallback answers derived from the sovereign snapshot (no LLM). */
export function scriptedDanantaraChat(question: string, ctx: DanantaraGrounding): string {
  const d = ctx.data;
  const m = d.media;
  const q = question.toLowerCase();
  const movers = [...d.holdings].sort((a, b) => b.change_pct - a.change_pct);
  const gainers = movers.slice(0, 3);
  const losers = movers.slice(-3).reverse();

  // Off-scope guard: MBG belongs to the crisis dashboard, not this one.
  if (/\bmbg\b|makan bergizi/.test(q)) {
    return `Topik program MBG dipantau di dasbor **MBG Crisis Command**, bukan di Danantara Sovereign Command. Di dasbor ini saya memantau portofolio ${d.holdings_count} BUMN senilai **${fmtT(d.aum_t)}**, pasar, dan reputasi publik Danantara. Ada yang ingin ditanyakan soal portofolio, dividen, atau sentimen media?`;
  }

  if (/(hoaks|hoax|disinformasi|fitnah|menyesatkan|kabar bohong)/.test(q)) {
    if (!m.hoaxes.length) return "Tidak ada hoaks yang terpantau di data saat ini.";
    const list = m.hoaxes
      .map((h) => `• "${h.claim}" — **${h.status}** (jangkauan ${(h.reach / 1e6).toFixed(1)} jt via ${h.platforms.join(", ")}).\n  Bantahan: ${h.counter}`)
      .join("\n");
    return `Pemantauan disinformasi (${m.hoaxes.length} klaim):\n${list}`;
  }

  if (/(dividen|setoran|kas negara)/.test(q)) {
    const list = d.dividends
      .map((x, i) => `${i + 1}. ${x.name} — **${fmtT(x.amount_t)}** (yield ${x.yield_pct}%)`)
      .join("\n");
    return `Setoran dividen YTD mencapai **${fmtT(d.dividend_ytd_t)}**. Kontributor terbesar:\n${list}`;
  }

  if (/(prediksi|proyeksi|ramal|outlook|masa depan|target|akan)/.test(q) && d.predictions.length) {
    const proj = d.projection[d.projection.length - 1];
    const projLine = proj ? `\n\nProyeksi AUM ${proj.label}: skenario dasar **${fmtT(proj.base)}**, optimis **${fmtT(proj.bull)}**.` : "";
    return (
      d.predictions
        .map((p) => `${p.question}\nEstimasi: **${p.probability}% — ${p.answer_label}**. ${p.reasoning}`)
        .join("\n\n") + projLine
    );
  }

  if (/(reputasi|citra|persepsi|sentimen|media|pemberitaan|publik)/.test(q)) {
    const topIssue = [...m.issues].sort((a, b) => b.salience - a.salience)[0];
    return [
      `Indeks Reputasi & Kepercayaan saat ini **${m.reputation.score}/100 (${m.reputation.level})**, tren ${m.reputation.trend === "up" ? "membaik" : m.reputation.trend === "down" ? "melemah" : "stabil"}.`,
      `Sentimen net **${sign(m.totals.net_sentiment)}** dari ${m.totals.mentions_24h.toLocaleString("id-ID")} sebutan/24 jam (jangkauan ${(m.totals.reach / 1e6).toFixed(0)} jt, ${m.totals.share_negative}% negatif).`,
      topIssue ? `Isu paling menonjol: **"${topIssue.label}"** (salience ${topIssue.salience}, sentimen ${topIssue.sentiment}/10).` : "",
      m.reputation.narrative,
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (/(krisis|sinyal|ancaman|peringatan|risiko reputasi|isu)/.test(q)) {
    if (!m.crisis.length) return "Tidak ada sinyal krisis yang terpantau di data saat ini.";
    const list = [...m.crisis]
      .sort((a, b) => b.severity - a.severity)
      .map((c) => `• **${c.entity}** — "${c.title}" (severity ${c.severity}/10, +${c.velocity}% dalam 24 jam, status ${c.status}).`)
      .join("\n");
    return `Radar krisis dini memantau ${m.crisis.length} sinyal:\n${list}\n\nPrioritaskan sinyal berstatus Naik/Memuncak untuk respons komunikasi.`;
  }

  if (/(aktor|akun|influencer|analis|narasi|medsos|media sosial)/.test(q)) {
    if (!m.actors.length) return "Belum ada aktor media yang dipantau di data saat ini.";
    const list = m.actors
      .map((a) => `• ${a.handle} (${a.platform}, ${a.type}) — pengaruh ${a.influence}/10, kredibilitas ${a.credibility}/10, sikap ${a.stance}`)
      .join("\n");
    return `Ada ${m.actors.length} aktor media yang dipantau:\n${list}\n\nFokuskan engagement pada aktor berpengaruh tinggi dengan sikap negatif.`;
  }

  if (/(sektor|perbankan|energi|telko|telekomunikasi|mineral|tambang|infrastruktur|pangan)/.test(q)) {
    const list = d.sectors
      .map((s, i) => `${i + 1}. **${s.label}** — ${s.weight_pct}% AUM (${fmtT(s.value_t)}), ${fmtPct(s.change_pct)} hari ini`)
      .join("\n");
    return `Alokasi sektor portofolio (total ${fmtT(d.aum_t)}):\n${list}`;
  }

  if (/(rekomendasi|alokasi modal|investasi|modal|tindakan|saran|langkah|deploy)/.test(q)) {
    const rec = d.allocations.find((a) => a.recommended) ?? d.allocations[0];
    const others = d.allocations.filter((a) => a !== rec).slice(0, 3);
    return [
      rec
        ? `Rekomendasi utama komite investasi: **${rec.title}** — ${rec.thesis}\nModal ${fmtT(rec.capital_t)}, proyeksi imbal hasil **${rec.return_pct}%** (${rec.horizon}, risiko ${rec.risk}).`
        : "",
      others.length
        ? `\nOpsi lain:\n${others.map((a) => `• ${a.title} — ${fmtT(a.capital_t)}, proyeksi ${a.return_pct}% (${a.horizon}, risiko ${a.risk}).`).join("\n")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (/(pasar|makro|ihsg|rupiah|kurs|usd|valas|komoditas|nikel|batu bara|emas|brent|minyak|obligasi)/.test(q)) {
    const list = d.markets
      .map((x) => `• **${x.label}** ${x.value}${x.unit ?? ""} (${fmtPct(x.delta)})${x.live ? " · live" : ""}`)
      .join("\n");
    return `Papan pasar & makro saat ini:\n${list}`;
  }

  if (/(portofolio|saham|emiten|holding|bumn|penggerak|mover|bergerak|naik|turun|kinerja|nav)/.test(q)) {
    return [
      `Portofolio ${d.holdings_count} BUMN senilai **${fmtT(d.aum_t)}** bergerak ${fmtPct(d.day_change_pct)} hari ini (YTD ${fmtPct(d.ytd_return_pct, 1)}).`,
      `\nPenguat:\n${gainers.map((h) => `• **${h.short}**${h.ticker ? ` (${h.ticker})` : ""} ${fmtPct(h.change_pct)} — ${h.blurb}`).join("\n")}`,
      `\nPelemah:\n${losers.map((h) => `• **${h.short}**${h.ticker ? ` (${h.ticker})` : ""} ${fmtPct(h.change_pct)} — ${h.blurb}`).join("\n")}`,
    ].join("\n");
  }

  // Default: situation overview
  const topIssue = [...m.issues].sort((a, b) => b.salience - a.salience)[0];
  return [
    `Dana kelolaan Danantara **${fmtT(d.aum_t)} (≈ $${d.aum_usd_b} miliar)**, NAV ${fmtPct(d.day_change_pct)} hari ini, YTD ${fmtPct(d.ytd_return_pct, 1)}.`,
    `Indeks Ketahanan **${d.strength.score}/100 (${d.strength.level})**, Indeks Reputasi **${m.reputation.score}/100 (${m.reputation.level})**.`,
    d.insight ? `Insight: ${d.insight.title}.` : "",
    topIssue ? `Isu publik menonjol: "${topIssue.label}".` : "",
    d.predictions[0] ? `Prediksi utama: ${d.predictions[0].probability}% ${d.predictions[0].answer_label}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}
