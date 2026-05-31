import { NextResponse } from "next/server";

import { buildSnapshot } from "@/lib/jasamarga/data";

export const dynamic = "force-dynamic";

/**
 * "Laporan Piket AI" — the duty-officer shift report, synthesized deterministically
 * from the open-source snapshot (traffic + Waze + social + news + official). No LLM
 * in the demo. Same markdown contract the briefing panel renders for MBG.
 * Intentionally public — see ../route.ts for rationale.
 */
export async function POST(req: Request) {
  const corridorId = new URL(req.url).searchParams.get("corridor") ?? undefined;
  const d = buildSnapshot(corridorId);
  const rec = d.interventions.find((i) => i.recommended) ?? d.interventions[0];
  const liveSources = d.sources.filter((s) => s.status === "live").map((s) => s.name);

  const content = [
    `## Ringkasan Operasi`,
    `Indeks kemacetan **${d.load_index}/10 (${d.level})** di koridor ${d.corridor} berdasarkan data lalu lintas publik. Kecepatan rata-rata ${d.avg_speed} km/j, tambahan waktu tempuh +${d.avg_delay_min} mnt, ${d.active_incidents} insiden dilaporkan. ${d.insight.text}`,
    ``,
    `## Insiden (Laporan Publik)`,
    d.incidents
      .slice()
      .sort((a, b) => b.severity - a.severity)
      .slice(0, 4)
      .map((i) => `- **${i.km} ${i.direction}** — ${i.type} (severity ${i.severity.toFixed(1)}). ${i.status} · sumber ${i.source}.`)
      .join("\n"),
    ``,
    `## Titik Macet Teratas`,
    d.top_ruas
      .slice(0, 4)
      .map((r) => `- **${r.name}** (${r.km_range}) — ${r.speed} km/j, +${r.delay_min} mnt, pemicu ${r.dominant}.`)
      .join("\n"),
    ``,
    `## Sentimen Publik`,
    `- ${d.social.mentions_24h.toLocaleString("id-ID")} sebutan dalam 24 jam, ${Math.round(d.social.negativity * 10)}% negatif. Tren: ${d.social.trend.slice(0, 4).map((t) => t.keyword).join(", ")}.`,
    ``,
    `## Pengumuman Resmi`,
    d.official.slice(0, 3).map((o) => `- [${o.category} · ${o.time}] **${o.title}** — ${o.body}`).join("\n"),
    ``,
    `## Liputan Media`,
    d.news.slice(0, 3).map((n) => `- ${n.title} (${n.source}, ${n.time}).`).join("\n"),
    ``,
    `## Proyeksi`,
    d.predictions.map((p) => `- ${p.question} → **${p.probability}% ${p.answer_label}**. ${p.reasoning}`).join("\n"),
    ``,
    `## Rekomendasi`,
    `1. **${rec.title}** (${rec.segment}) — ${rec.rationale} Proyeksi waktu tempuh ${rec.impact_time_pct}%, antrean terurai ~${rec.impact_clear_min} mnt${rec.officially_announced ? " (sudah diumumkan resmi)" : " (belum diumumkan)"}.`,
    `2. Perkuat imbauan alih jalur via medsos & VMS; pantau lonjakan sentimen negatif.`,
    `3. Verifikasi laporan Waze yang belum terkonfirmasi dengan CCTV Travoy terdekat.`,
    ``,
    `_Sumber data: ${liveSources.join(" · ")}._`,
  ].join("\n");

  return NextResponse.json({ content, updated_at: d.updated_at });
}
