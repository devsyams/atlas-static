import { NextResponse } from "next/server";

import { buildSnapshot } from "@/lib/jasamarga/data";

export const dynamic = "force-dynamic";

/**
 * "Laporan Piket AI" — the duty-officer shift report, synthesized deterministically
 * from the live snapshot (no LLM in the demo). Same markdown contract the briefing
 * panel renders for MBG. Intentionally public — see ../route.ts for rationale.
 */
export async function POST() {
  const d = buildSnapshot();
  const fleetOn = d.fleet.filter((f) => f.status !== "Standby").length;
  const breaches = d.spm.filter((s) => !s.ok);
  const rec = d.interventions.find((i) => i.recommended) ?? d.interventions[0];

  const content = [
    `## Ringkasan Operasi`,
    `Indeks beban jaringan **${d.load_index}/10 (${d.level})** di koridor ${d.corridor}. Kecepatan rata-rata ${d.avg_speed} km/j, ${d.active_incidents} insiden aktif, ${d.vehicles_now.toLocaleString("id-ID")} kendaraan di jalur. ${d.insight.text}`,
    ``,
    `## Insiden Prioritas`,
    d.incidents
      .slice()
      .sort((a, b) => b.severity - a.severity)
      .slice(0, 4)
      .map(
        (i) =>
          `- **${i.km} ${i.direction}** — ${i.type} (severity ${i.severity.toFixed(1)}). ${i.lanes_blocked}/${i.lanes_total} lajur tertutup · ${i.status} · ${i.unit}.`,
      )
      .join("\n"),
    ``,
    `## Titik Beban Teratas`,
    d.top_ruas
      .slice(0, 4)
      .map((r) => `- **${r.name}** (${r.km_range}) — beban ${r.load.toFixed(1)}/10, ${r.speed} km/j, pemicu ${r.dominant}.`)
      .join("\n"),
    ``,
    `## Armada & Respons`,
    `- ${fleetOn} dari ${d.fleet.length} unit dikerahkan (derek, ambulans, PJR, rescue). Respons derek 9 mnt, ambulans 11 mnt — di bawah standar SPM 30 mnt.`,
    ``,
    `## Kepatuhan SPM`,
    breaches.length
      ? breaches.map((s) => `- ⚠️ **${s.category}** — ${s.value} (standar ${s.standard}), kepatuhan ${s.compliance}%.`).join("\n")
      : "- Seluruh parameter SPM dalam standar.",
    ``,
    `## Proyeksi`,
    d.predictions.map((p) => `- ${p.question} → **${p.probability}% ${p.answer_label}**. ${p.reasoning}`).join("\n"),
    ``,
    `## Rekomendasi Rekayasa`,
    `1. **${rec.title}** (${rec.segment}) — ${rec.rationale} Proyeksi waktu tempuh ${rec.impact_time_pct}%, antrean terurai ~${rec.impact_clear_min} menit (risiko ${rec.risk}).`,
    `2. Siagakan unit cadangan di KM 29 & KM 67; prioritaskan evakuasi truk ODOL di KM 52.`,
    `3. Buka gardu tambahan di GT Cikampek Utama sebelum puncak sore 17:00.`,
  ].join("\n");

  return NextResponse.json({ content, updated_at: d.updated_at });
}
