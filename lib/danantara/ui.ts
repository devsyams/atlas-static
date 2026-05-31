import type { ReputationIndex, SectorKey, StrengthIndex } from "./types";

/**
 * Sovereign palette mapped onto the command-center theme. Raw oklch strings so
 * they work in <canvas>/SVG fills (which can't read CSS vars). Read as health:
 * green = tangguh … deep red = rentan.
 */
export const SOV_COLORS = {
  strong: "oklch(0.72 0.16 155)", // success
  ok: "oklch(0.78 0.16 80)", // warning
  watch: "oklch(0.72 0.17 55)", // orange
  weak: "oklch(0.62 0.22 25)", // destructive
} as const;

/** 0–100 strength → band + emoji. */
export function strengthBand(score: number): { level: StrengthIndex["level"]; emoji: string } {
  if (score >= 78) return { level: "Tangguh", emoji: "🟢" };
  if (score >= 60) return { level: "Sehat", emoji: "🟡" };
  if (score >= 42) return { level: "Waspada", emoji: "🟠" };
  return { level: "Rentan", emoji: "🔴" };
}

/** Color for a 0–100 strength score (high = green). */
export function strengthColor(score: number): string {
  if (score >= 78) return SOV_COLORS.strong;
  if (score >= 60) return SOV_COLORS.ok;
  if (score >= 42) return SOV_COLORS.watch;
  return SOV_COLORS.weak;
}

/** 0–100 reputation → band + emoji. */
export function reputationBand(score: number): { level: ReputationIndex["level"]; emoji: string } {
  if (score >= 80) return { level: "Sangat Positif", emoji: "🟢" };
  if (score >= 65) return { level: "Positif", emoji: "🟢" };
  if (score >= 50) return { level: "Terjaga", emoji: "🟡" };
  if (score >= 35) return { level: "Tertekan", emoji: "🟠" };
  return { level: "Krisis", emoji: "🔴" };
}

/** Color for a 0–100 reputation score (high = green). */
export function reputationColor(score: number): string {
  if (score >= 65) return SOV_COLORS.strong;
  if (score >= 50) return SOV_COLORS.ok;
  if (score >= 35) return SOV_COLORS.watch;
  return SOV_COLORS.weak;
}

/** Sentiment color for a 0–10 scale where HIGH = negative (media tone). */
export function toneColor(neg: number): string {
  if (neg >= 6.5) return SOV_COLORS.weak;
  if (neg >= 5) return SOV_COLORS.watch;
  if (neg >= 3.5) return SOV_COLORS.ok;
  return SOV_COLORS.strong;
}

/**
 * Diverging color for a daily/period % move: green up, red down, neutral grey
 * near zero. Saturation tracks magnitude so a +6% bubble glows brighter than a
 * +0.4% one. Returns an oklch string usable in canvas/SVG.
 */
export function changeColor(pct: number): string {
  const mag = Math.min(1, Math.abs(pct) / 6);
  if (pct > 0.15) {
    const l = 0.62 + 0.08 * mag;
    const c = 0.08 + 0.12 * mag;
    return `oklch(${l.toFixed(3)} ${c.toFixed(3)} 155)`;
  }
  if (pct < -0.15) {
    const l = 0.66 - 0.06 * mag;
    const c = 0.1 + 0.13 * mag;
    return `oklch(${l.toFixed(3)} ${c.toFixed(3)} 25)`;
  }
  return "oklch(0.66 0.02 250)";
}

/** Add an alpha channel to an oklch(...) string. */
export function withAlpha(oklch: string, a: number): string {
  return oklch.replace(/\)\s*$/, ` / ${a})`);
}

export const SECTOR_LABEL: Record<SectorKey, string> = {
  perbankan: "Perbankan",
  energi: "Energi",
  telko: "Telekomunikasi & Digital",
  mineral: "Mineral & Tambang",
  infrastruktur: "Infrastruktur",
  pangan: "Pangan & Konsumer",
  industri: "Industri & Logistik",
};

export const SECTOR_SHORT: Record<SectorKey, string> = {
  perbankan: "Perbankan",
  energi: "Energi",
  telko: "Telko & Digital",
  mineral: "Mineral",
  infrastruktur: "Infra",
  pangan: "Pangan",
  industri: "Industri",
};

/** Distinct hue per sector for the donut / cluster accents (theme-aligned oklch). */
export const SECTOR_COLOR: Record<SectorKey, string> = {
  perbankan: "oklch(0.78 0.14 230)", // primary sky
  energi: "oklch(0.72 0.17 55)", // amber
  telko: "oklch(0.62 0.20 290)", // accent purple
  mineral: "oklch(0.70 0.16 155)", // teal-green
  infrastruktur: "oklch(0.72 0.15 200)", // cyan
  pangan: "oklch(0.78 0.16 110)", // lime
  industri: "oklch(0.70 0.14 320)", // magenta
};

/** "Rp 1.234 T" with Indonesian grouping. */
export function fmtT(t: number): string {
  return `Rp ${Math.round(t).toLocaleString("id-ID")} T`;
}

/** Compact "Rp 14,2 ribu T" style for very large AUM headline. */
export function fmtAum(t: number): string {
  if (t >= 1000) return `Rp ${(t / 1000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} ribu T`;
  return fmtT(t);
}

export function fmtUsdB(b: number): string {
  return `$${b.toLocaleString("en-US", { maximumFractionDigits: 0 })} B`;
}

export function fmtPct(p: number, decimals = 2): string {
  const s = p.toLocaleString("id-ID", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return `${p > 0 ? "+" : ""}${s}%`;
}

export function riskColor(risk: "rendah" | "sedang" | "tinggi"): string {
  return risk === "tinggi" ? "text-destructive" : risk === "sedang" ? "text-warning" : "text-success";
}
