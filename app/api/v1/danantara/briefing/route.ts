import { NextResponse } from "next/server";

import { buildSnapshot } from "@/lib/danantara/data";
import { fmtT } from "@/lib/danantara/ui";

export const dynamic = "force-dynamic";

/**
 * "Investment Committee Brief" — synthesized deterministically from the
 * open-source sovereign snapshot (markets + portfolio + dividends + sentiment).
 * No LLM in the demo. Same markdown contract the briefing panel renders for MBG
 * & JasaMarga. Intentionally public — see ../route.ts for rationale.
 */
export async function POST() {
  const d = buildSnapshot();
  const rec = d.allocations.find((a) => a.recommended) ?? d.allocations[0];
  const topFactor = [...d.strength.factors].sort((a, b) => b.penalty - a.penalty)[0];
  const movers = [...d.holdings].sort((a, b) => b.change_pct - a.change_pct);
  const gainers = movers.slice(0, 3);
  const losers = movers.slice(-3).reverse();

  const content = [
    `## Ringkasan Eksekutif`,
    `Aset kelolaan **${fmtT(d.aum_t)} (≈ $${d.aum_usd_b} miliar)** dengan indeks ketahanan **${d.strength.score}/100 (${d.strength.level})**. NAV bergerak ${d.day_change_pct >= 0 ? "+" : ""}${d.day_change_pct}% hari ini; imbal hasil YTD ${d.ytd_return_pct >= 0 ? "+" : ""}${d.ytd_return_pct}%. ${d.insight.text}`,
    ``,
    `## Pasar & Makro`,
    d.markets.slice(0, 5).map((m) => `- **${m.label}** ${m.value}${m.unit ?? ""} (${m.delta >= 0 ? "+" : ""}${m.delta}%)${m.live ? " · live" : ""}.`).join("\n"),
    ``,
    `## Penggerak Portofolio`,
    `- Penguat: ${gainers.map((h) => `${h.short} ${h.change_pct >= 0 ? "+" : ""}${h.change_pct}%`).join(", ")}.`,
    `- Pelemah: ${losers.map((h) => `${h.short} ${h.change_pct}%`).join(", ")}.`,
    ``,
    `## Alokasi Sektor`,
    d.sectors.slice(0, 5).map((s) => `- **${s.label}** — ${s.weight_pct}% AUM (${fmtT(s.value_t)}), ${s.change_pct >= 0 ? "+" : ""}${s.change_pct}% hari ini.`).join("\n"),
    ``,
    `## Ketahanan & Risiko`,
    `- Faktor risiko dominan: **${topFactor.label}** (−${topFactor.penalty}). ${d.strength.narrative}`,
    ``,
    `## Dividen`,
    `- Setoran dividen YTD **${fmtT(d.dividend_ytd_t)}**. Kontributor utama: ${d.dividends.slice(0, 3).map((x) => x.name.split("(")[0].trim()).join(", ")}.`,
    ``,
    `## Proyeksi`,
    d.predictions.map((p) => `- ${p.question} → **${p.probability}% ${p.answer_label}**. ${p.reasoning}`).join("\n"),
    ``,
    `## Rekomendasi Komite Investasi`,
    `1. **${rec.title}** — ${rec.thesis} Usulan modal ${fmtT(rec.capital_t)}, proyeksi imbal hasil ${rec.return_pct}% (${rec.horizon}, risiko ${rec.risk}).`,
    `2. Pertahankan alokasi inti bank Himbara & energi; optimalkan arus dividen untuk reinvestasi strategis.`,
    `3. Perkuat lindung nilai valas & manajemen likuiditas; jaga transparansi pelaporan kinerja ke publik.`,
    ``,
    `_Sumber data: ${d.sources.filter((s) => s.status === "live").map((s) => s.name).join(" · ") || "pasar publik (mode demo)"}._`,
  ].join("\n");

  return NextResponse.json({ content, updated_at: d.updated_at });
}
