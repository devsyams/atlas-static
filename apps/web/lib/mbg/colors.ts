// Crisis palette mapped onto our dark oklch command-center theme.
// Raw oklch strings are used for <canvas> and Leaflet (which can't read CSS vars).

export const CRISIS_COLORS = {
  safe: "oklch(0.72 0.16 155)", // --success
  watch: "oklch(0.78 0.16 80)", // --warning
  crisis: "oklch(0.62 0.22 25)", // --destructive
  danger: "oklch(0.45 0.18 22)", // deep red
} as const;

/** Severity color for a 0–10 score (mirrors the mock's thresholds). */
export function scoreColor(score: number): string {
  if (score <= 2) return CRISIS_COLORS.safe;
  if (score <= 5) return CRISIS_COLORS.watch;
  if (score <= 8) return CRISIS_COLORS.crisis;
  return CRISIS_COLORS.danger;
}

/** Tailwind classes for the article score badge. */
export function badgeClass(score: number): string {
  if (score >= 6) return "bg-destructive/15 text-destructive";
  if (score >= 3) return "bg-warning/15 text-warning";
  return "bg-success/15 text-success";
}

/** Detail-modal score tag classes. */
export function scoreTagClass(score: number): string {
  if (score >= 6) return "bg-destructive/20 text-destructive";
  if (score >= 3) return "bg-warning/20 text-warning";
  return "bg-success/20 text-success";
}

/** Map marker pixel radius from heat. */
export function markerRadius(heat: number): number {
  return Math.max(8, Math.min(18, 6 + (heat || 0) / 1.5));
}

export function cityKeyFromLocation(
  location: { city?: string; province?: string } | null,
): string | null {
  if (!location || !location.city || !location.province) return null;
  return `${location.city}|${location.province}`;
}
