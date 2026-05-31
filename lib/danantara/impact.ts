import type { Holding } from "./types";

/**
 * Issue → price-impact engine. Maps a media/macro event onto projected price
 * moves across the portfolio via transmission channels (FX exposure, commodity
 * linkage, rate sensitivity, sentiment contagion), then derives a NAV impact,
 * reputation impact, an insight and a prediction. Pure & deterministic — drives
 * the interactive Impact Lab. All inputs are public-market relationships.
 */

export type EventKind = "makro" | "isu" | "entitas";
export type CommodityKey = "nikel" | "batubara" | "tembaga" | "cpo" | "minyak";

type Driver =
  | { type: "fx"; mag: number } // % rupiah depreciation
  | { type: "commodity"; commodity: CommodityKey; mag: number } // % price move
  | { type: "rate"; mag: number } // bps BI-rate change
  | { type: "sentiment_all"; severity: number } // 0–10 systemic media issue
  | { type: "entity"; entity: string; severity: number }; // entity-specific shock

export interface ImpactEvent {
  id: string;
  label: string;
  kind: EventKind;
  detail: string;
  driver: Driver;
}

export interface EntityImpact {
  id: string;
  short: string;
  name: string;
  sector: string;
  listed: boolean;
  impact_pct: number;
  confidence: number; // 0–1
  channel: string;
}

export interface ImpactPrediction {
  question: string;
  probability: number;
  answer_label: string;
  reasoning: string;
  timeframe: string;
  tone: "negative" | "neutral" | "positive";
}

export interface ImpactResult {
  event: ImpactEvent;
  entities: EntityImpact[];
  nav_impact_t: number;
  nav_impact_pct: number;
  reputation_impact: number; // delta points (negative = worse)
  avg_confidence: number;
  prediction: ImpactPrediction;
  insight: { headline: string; text: string; action: string };
}

interface Exposure {
  fx: number; // sensitivity to a WEAKER rupiah (+ benefits, − hurts)
  commodity: CommodityKey | null;
  commodity_beta: number; // sign = direction price→stock
  rate: number; // sensitivity to a rate HIKE (+ benefits, − hurts)
  sentiment: number; // 0–1 price reactivity to its own media tone
}

const DEFAULT_EXP: Exposure = { fx: 0, commodity: null, commodity_beta: 0, rate: -0.2, sentiment: 0.5 };

/** Per-entity exposure profile (public-market relationships, not internals). */
const EXPOSURE: Record<string, Exposure> = {
  bbri: { fx: -0.05, commodity: null, commodity_beta: 0, rate: 0.15, sentiment: 0.4 },
  bmri: { fx: -0.05, commodity: null, commodity_beta: 0, rate: 0.15, sentiment: 0.4 },
  bbni: { fx: -0.1, commodity: null, commodity_beta: 0, rate: 0.1, sentiment: 0.45 },
  bbtn: { fx: -0.1, commodity: null, commodity_beta: 0, rate: -0.3, sentiment: 0.6 },
  ptm: { fx: 0.2, commodity: "minyak", commodity_beta: 0.4, rate: -0.1, sentiment: 0.5 },
  pln: { fx: -0.6, commodity: "minyak", commodity_beta: -0.25, rate: -0.3, sentiment: 0.5 },
  pgas: { fx: 0.1, commodity: "minyak", commodity_beta: 0.2, rate: -0.1, sentiment: 0.5 },
  pgeo: { fx: 0, commodity: null, commodity_beta: 0, rate: -0.1, sentiment: 0.5 },
  tlkm: { fx: -0.2, commodity: null, commodity_beta: 0, rate: -0.15, sentiment: 0.4 },
  fcx: { fx: 0.7, commodity: "tembaga", commodity_beta: 0.7, rate: -0.1, sentiment: 0.5 },
  antm: { fx: 0.6, commodity: "nikel", commodity_beta: 0.8, rate: -0.15, sentiment: 0.8 },
  ptba: { fx: 0.5, commodity: "batubara", commodity_beta: 0.9, rate: -0.15, sentiment: 0.7 },
  tins: { fx: 0.5, commodity: null, commodity_beta: 0, rate: -0.2, sentiment: 0.8 },
  jsmr: { fx: -0.3, commodity: null, commodity_beta: 0, rate: -0.5, sentiment: 0.5 },
  wika: { fx: -0.5, commodity: null, commodity_beta: 0, rate: -0.8, sentiment: 0.85 },
  ptpp: { fx: -0.45, commodity: null, commodity_beta: 0, rate: -0.75, sentiment: 0.8 },
  adhi: { fx: -0.5, commodity: null, commodity_beta: 0, rate: -0.8, sentiment: 0.85 },
  bulog: { fx: -0.2, commodity: null, commodity_beta: 0, rate: -0.2, sentiment: 0.6 },
  ptpn: { fx: 0.3, commodity: "cpo", commodity_beta: 0.6, rate: -0.2, sentiment: 0.6 },
  idfood: { fx: -0.1, commodity: null, commodity_beta: 0, rate: -0.2, sentiment: 0.6 },
  smgr: { fx: -0.2, commodity: null, commodity_beta: 0, rate: -0.4, sentiment: 0.6 },
  pelindo: { fx: 0.1, commodity: null, commodity_beta: 0, rate: -0.2, sentiment: 0.4 },
  kai: { fx: -0.2, commodity: null, commodity_beta: 0, rate: -0.3, sentiment: 0.5 },
  injourney: { fx: -0.2, commodity: null, commodity_beta: 0, rate: -0.2, sentiment: 0.5 },
  giaa: { fx: -0.9, commodity: "minyak", commodity_beta: -0.3, rate: -0.4, sentiment: 0.85 },
  biofarma: { fx: -0.2, commodity: null, commodity_beta: 0, rate: -0.15, sentiment: 0.5 },
};

const exp = (id: string): Exposure => EXPOSURE[id] ?? DEFAULT_EXP;

const COMMODITY_LABEL: Record<CommodityKey, string> = {
  nikel: "nikel",
  batubara: "batu bara",
  tembaga: "tembaga",
  cpo: "CPO",
  minyak: "minyak",
};

/** Catalogue of scenarios — macro shocks, systemic issues, entity-specific events. */
export const IMPACT_EVENTS: ImpactEvent[] = [
  { id: "fx_up_big", label: "USD/IDR melonjak +10%", kind: "makro", detail: "Tekanan dolar global; rupiah melemah 10%.", driver: { type: "fx", mag: 10 } },
  { id: "fx_up", label: "USD/IDR menguat +5%", kind: "makro", detail: "Rupiah melemah 5% terhadap dolar AS.", driver: { type: "fx", mag: 5 } },
  { id: "nickel_down", label: "Harga nikel turun −12%", kind: "makro", detail: "Koreksi harga nikel LME menekan emiten mineral.", driver: { type: "commodity", commodity: "nikel", mag: -12 } },
  { id: "coal_down", label: "Harga batu bara turun −10%", kind: "makro", detail: "Pelemahan harga batu bara acuan.", driver: { type: "commodity", commodity: "batubara", mag: -10 } },
  { id: "oil_up", label: "Harga minyak naik +8%", kind: "makro", detail: "Lonjakan Brent — untung di hulu, beban di hilir & penerbangan.", driver: { type: "commodity", commodity: "minyak", mag: 8 } },
  { id: "rate_up", label: "BI-Rate naik +25 bps", kind: "makro", detail: "Pengetatan moneter menaikkan biaya dana.", driver: { type: "rate", mag: 25 } },
  { id: "gov_issue", label: "Isu tata kelola & transparansi Danantara", kind: "isu", detail: "Sorotan publik atas audit & keterbukaan kinerja dana.", driver: { type: "sentiment_all", severity: 6.4 } },
  { id: "politicization", label: "Isu independensi & politisasi", kind: "isu", detail: "Narasi intervensi politik atas keputusan investasi.", driver: { type: "sentiment_all", severity: 5.6 } },
  { id: "garuda_crisis", label: "Krisis layanan Garuda viral", kind: "entitas", detail: "Keluhan layanan penerbangan menjadi sorotan publik.", driver: { type: "entity", entity: "giaa", severity: 4.2 } },
  { id: "mindid_env", label: "Sorotan lingkungan smelter MIND ID", kind: "entitas", detail: "Liputan dampak lingkungan proyek hilirisasi nikel.", driver: { type: "entity", entity: "antm", severity: 3.8 } },
];

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const r2 = (n: number) => +n.toFixed(2);

/** One event's effect on a single holding via its transmission channel. Pure. */
function computeEntity(event: ImpactEvent, h: Holding, holdings: Holding[]): { impact: number; confidence: number; channel: string } {
  const d = event.driver;
  const e = exp(h.id);
  if (d.type === "fx") {
    return {
      impact: e.fx * d.mag * 0.55,
      confidence: h.listed ? 0.74 : 0.55,
      channel: e.fx < -0.05 ? "Beban utang & impor berdenominasi valas naik" : e.fx > 0.05 ? "Pendapatan komoditas (USD) terangkat rupiah lemah" : "Eksposur valas minimal",
    };
  }
  if (d.type === "commodity") {
    if (e.commodity === d.commodity && e.commodity_beta !== 0) {
      const dir = e.commodity_beta > 0 ? "pendapatan" : "biaya";
      return { impact: e.commodity_beta * d.mag * 0.5, confidence: 0.7, channel: `Harga ${COMMODITY_LABEL[d.commodity]} → ${dir}` };
    }
    return { impact: 0, confidence: 0.6, channel: "Tanpa eksposur komoditas ini" };
  }
  if (d.type === "rate") {
    return {
      impact: e.rate * (d.mag / 25) * 2.8,
      confidence: 0.66,
      channel: e.rate < -0.1 ? "Biaya dana & beban bunga utang naik" : e.rate > 0.05 ? "Margin bunga bersih (NIM) membaik" : "Sensitivitas suku bunga rendah",
    };
  }
  if (d.type === "sentiment_all") {
    return h.listed
      ? { impact: -d.severity * e.sentiment * 0.42, confidence: 0.58, channel: "Contagion sentimen pasar (de-rating)" }
      : { impact: -d.severity * e.sentiment * 0.12, confidence: 0.45, channel: "Tekanan reputasi (entitas tidak tercatat)" };
  }
  // entity-specific
  const target = holdings.find((x) => x.id === d.entity);
  if (h.id === d.entity) return { impact: -d.severity * e.sentiment * 0.9, confidence: 0.8, channel: "Dampak langsung — entitas terdampak" };
  if (target && h.sector === target.sector) return { impact: -d.severity * e.sentiment * 0.18, confidence: 0.5, channel: "Spillover ke sektor sejenis" };
  return { impact: 0, confidence: 0.5, channel: "Dampak tidak langsung" };
}

/** Systemic reputation hit of an event (negative = worse). */
function eventReputation(event: ImpactEvent): number {
  const d = event.driver;
  if (d.type === "sentiment_all") return -clamp(d.severity * 1.2, 0, 12);
  if (d.type === "entity") return -clamp(d.severity * 0.7, 0, 8);
  return 0;
}

function meta(h: Holding, impact: number, confidence: number, channel: string): EntityImpact {
  return { id: h.id, short: h.short, name: h.name, sector: h.sector, listed: h.listed, impact_pct: r2(clamp(impact, -12, 12)), confidence, channel };
}

/** Shared NAV/prediction/insight assembly for single & combined scenarios. */
function finalize(event: ImpactEvent, raw: EntityImpact[], reputation_impact: number, holdings: Holding[], aum: number): ImpactResult {
  const byId = new Map(raw.map((x) => [x.id, x.impact_pct]));
  const nav_impact_t = r2(holdings.reduce((a, h) => a + (h.value_t * (byId.get(h.id) ?? 0)) / 100, 0));
  const nav_impact_pct = r2((nav_impact_t / aum) * 100);

  const entities = raw
    .filter((x) => Math.abs(x.impact_pct) >= 0.1)
    .sort((a, b) => Math.abs(b.impact_pct) - Math.abs(a.impact_pct))
    .slice(0, 16);
  const avg_confidence = entities.length ? +(entities.reduce((a, x) => a + x.confidence, 0) / entities.length).toFixed(2) : 0.6;

  const top = entities[0];
  const prediction: ImpactPrediction = top
    ? top.impact_pct < 0
      ? {
          question: `Saham ${top.short} terkoreksi > ${Math.abs(Math.round(top.impact_pct))}% dalam 2 hari bursa?`,
          probability: Math.round(clamp(48 + Math.abs(top.impact_pct) * 6 + top.confidence * 18, 30, 92)),
          answer_label: "Cenderung Ya",
          reasoning: `${top.channel}. Magnitudo proyeksi ${top.impact_pct}% dengan keyakinan ${Math.round(top.confidence * 100)}%; pasar cenderung bereaksi cepat pada kanal ini.`,
          timeframe: "2 hari",
          tone: "negative",
        }
      : {
          question: `Saham ${top.short} menguat > ${Math.round(top.impact_pct)}% dalam 2 hari bursa?`,
          probability: Math.round(clamp(46 + top.impact_pct * 6 + top.confidence * 18, 30, 90)),
          answer_label: "Cenderung Ya",
          reasoning: `${top.channel}. Proyeksi +${top.impact_pct}% dengan keyakinan ${Math.round(top.confidence * 100)}%.`,
          timeframe: "2 hari",
          tone: "positive",
        }
    : { question: "Dampak material pada portofolio?", probability: 35, answer_label: "Berimbang", reasoning: "Eksposur portofolio terhadap peristiwa ini terbatas.", timeframe: "2 hari", tone: "neutral" };

  const losers = entities.filter((x) => x.impact_pct < 0);
  const gainers = entities.filter((x) => x.impact_pct > 0);
  const headline =
    nav_impact_pct < -0.1
      ? `Tekanan bersih ke NAV ${nav_impact_pct}% — ${losers[0]?.short ?? "—"} paling terdampak`
      : nav_impact_pct > 0.1
        ? `Dampak bersih positif +${nav_impact_pct}% — ${gainers[0]?.short ?? "—"} diuntungkan`
        : `Dampak bersih NAV nyaris netral (${nav_impact_pct}%) — efek terdistribusi`;
  const text =
    `Skenario "${event.label}" merambat lewat ${entities.length} entitas. ` +
    (losers.length ? `Tertekan: ${losers.slice(0, 3).map((x) => `${x.short} ${x.impact_pct}%`).join(", ")}. ` : "") +
    (gainers.length ? `Diuntungkan: ${gainers.slice(0, 3).map((x) => `${x.short} +${x.impact_pct}%`).join(", ")}. ` : "") +
    (reputation_impact < -0.1 ? `Reputasi dana ikut tertekan (${reputation_impact.toFixed(1)} poin) — risiko contagion narasi.` : "Dampak reputasi minimal.");
  const action =
    reputation_impact < -3
      ? "Aktifkan respons komunikasi krisis: rilis data tandingan, libatkan analis kredibel, pantau eskalasi."
      : "Tinjau lindung nilai valas & emiten berleverage tinggi; prioritaskan aset berdividen stabil; komunikasikan ketahanan neraca ke pasar.";

  return { event, entities, nav_impact_t, nav_impact_pct, reputation_impact: r2(reputation_impact), avg_confidence, prediction, insight: { headline, text, action } };
}

/** Single-scenario impact. */
export function simulateImpact(event: ImpactEvent, holdings: Holding[], aum: number): ImpactResult {
  const raw = holdings.map((h) => {
    const r = computeEntity(event, h, holdings);
    return meta(h, r.impact, r.confidence, r.channel);
  });
  return finalize(event, raw, eventReputation(event), holdings, aum);
}

/** Combined multi-factor impact — sums independent shocks across events. */
export function simulateCombined(events: ImpactEvent[], holdings: Holding[], aum: number): ImpactResult {
  const raw = holdings.map((h) => {
    let impact = 0;
    const confs: number[] = [];
    const chans: string[] = [];
    for (const ev of events) {
      const r = computeEntity(ev, h, holdings);
      if (Math.abs(r.impact) >= 0.05) {
        impact += r.impact;
        confs.push(r.confidence);
        chans.push(r.channel);
      }
    }
    // Compounding uncertainty: each extra simultaneous factor trims confidence.
    const confidence = confs.length ? clamp(confs.reduce((a, b) => a + b, 0) / confs.length - 0.04 * (confs.length - 1), 0.4, 0.9) : 0.5;
    const channel = chans.length > 1 ? `Kombinasi ${chans.length} faktor` : chans[0] ?? "Dampak minimal";
    return meta(h, clamp(impact, -15, 15), confidence, channel);
  });

  const reputation_impact = clamp(events.reduce((a, ev) => a + eventReputation(ev), 0), -20, 0);
  const synthetic: ImpactEvent = {
    id: "combined",
    label: events.length ? `Kombinasi ${events.length} skenario` : "Tanpa skenario",
    kind: "makro",
    detail: events.map((e) => e.label).join("  +  ") || "Pilih ≥ 1 peristiwa.",
    driver: { type: "fx", mag: 0 },
  };
  return finalize(synthetic, raw, reputation_impact, holdings, aum);
}

