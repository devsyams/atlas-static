import type { FlowStatus } from "./types";

/**
 * Traffic flow palette mapped onto the command-center theme. Raw oklch strings
 * so they work in <canvas>/SVG fills (which can't read CSS vars). Mirrors the
 * crisis palette but read as flow: green = lancar … deep red = lumpuh.
 */
export const FLOW_COLORS: Record<FlowStatus, string> = {
  lancar: "oklch(0.72 0.16 155)", // success / free flow
  padat: "oklch(0.78 0.16 80)", // warning / dense
  macet: "oklch(0.62 0.22 25)", // destructive / jammed
  lumpuh: "oklch(0.45 0.18 22)", // deep red / gridlock
};

export const FLOW_LABEL: Record<FlowStatus, string> = {
  lancar: "Lancar",
  padat: "Padat",
  macet: "Macet",
  lumpuh: "Lumpuh",
};

/** Network strain level (0–10) → flow status + label + emoji. */
export function loadLevel(index: number): { status: FlowStatus; label: string; emoji: string } {
  if (index <= 2.5) return { status: "lancar", label: "Lancar", emoji: "🟢" };
  if (index <= 5) return { status: "padat", label: "Padat", emoji: "🟡" };
  if (index <= 8) return { status: "macet", label: "Macet", emoji: "🟠" };
  return { status: "lumpuh", label: "Lumpuh", emoji: "⛔" };
}

/** Color for a 0–10 strain score, reusing the flow palette. */
export function loadColor(index: number): string {
  return FLOW_COLORS[loadLevel(index).status];
}

/** Color for a speed (km/h) on a toll mainline (free flow ≈ 80). */
export function speedStatus(speed: number): FlowStatus {
  if (speed >= 60) return "lancar";
  if (speed >= 40) return "padat";
  if (speed >= 20) return "macet";
  return "lumpuh";
}

export function fmtInt(n: number): string {
  return Math.round(n).toLocaleString("id-ID");
}

/** Rupiah in compact "Rp x,y M / jt" form for tickers and tiles. */
export function fmtRupiah(n: number): string {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toLocaleString("id-ID", { maximumFractionDigits: 2 })} M`;
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;
  return `Rp ${fmtInt(n)}`;
}

export function riskColor(risk: "rendah" | "sedang" | "tinggi"): string {
  return risk === "tinggi"
    ? "text-destructive"
    : risk === "sedang"
      ? "text-warning"
      : "text-success";
}
