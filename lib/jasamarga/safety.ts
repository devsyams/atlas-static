import type { IncidentItem, RouteSegment, SafetyFactor, SafetyIndex, WeatherZone } from "./types";
import { loadColor } from "./ui";

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const round1 = (n: number) => +n.toFixed(1);

const WEATHER_PENALTY: Record<WeatherZone["impact"], number> = { rendah: 2, sedang: 8, tinggi: 16 };

/** 0–100 score → level band + emoji. */
export function safetyBand(score: number): { level: SafetyIndex["level"]; emoji: string } {
  if (score >= 80) return { level: "Aman", emoji: "🟢" };
  if (score >= 60) return { level: "Waspada", emoji: "🟡" };
  if (score >= 40) return { level: "Rawan", emoji: "🟠" };
  return { level: "Bahaya", emoji: "🔴" };
}

/** Color for a safety score, reusing the flow palette (inverted: high score = green). */
export function safetyColor(score: number): string {
  return loadColor((100 - score) / 10);
}

/**
 * Composite corridor Safe Meter from public signals. Starts at 100 and subtracts
 * weighted penalties for incidents, weather, speed volatility, and public mood.
 * Pure + deterministic given its inputs (+ optional prior score for the trend).
 */
export function computeSafety(
  segments: RouteSegment[],
  incidents: IncidentItem[],
  weather: WeatherZone[],
  negativity: number,
  prevScore?: number,
): SafetyIndex {
  // Insiden — severity-weighted, with a bump per blocked lane. Capped so a few
  // bad incidents dominate without single-handedly zeroing the score.
  const incidentPenalty = clamp(
    incidents.reduce((a, inc) => a + (inc.severity / 10) * 6 + (inc.lanes_blocked ?? 0) * 3, 0),
    0,
    45,
  );

  // Cuaca — worst BMKG impact across the corridor zones.
  const weatherPenalty = weather.reduce((max, w) => Math.max(max, WEATHER_PENALTY[w.impact]), 0);

  // Volatilitas Kecepatan — stddev of segment speeds; sharp localized drops are
  // riskier than a uniformly slow (but predictable) corridor.
  const speeds = segments.map((s) => s.speed);
  const mean = speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;
  const variance = speeds.length ? speeds.reduce((a, s) => a + (s - mean) ** 2, 0) / speeds.length : 0;
  const volatilityPenalty = clamp(Math.sqrt(variance) * 0.8, 0, 20);

  // Sentimen Publik — scaled from social negativity (0–10).
  const sentimenPenalty = clamp(negativity * 1.2, 0, 12);

  const factors: SafetyFactor[] = [
    { key: "insiden", label: "Insiden", penalty: round1(incidentPenalty) },
    { key: "cuaca", label: "Cuaca", penalty: round1(weatherPenalty) },
    { key: "volatilitas", label: "Volatilitas Kecepatan", penalty: round1(volatilityPenalty) },
    { key: "sentimen", label: "Sentimen Publik", penalty: round1(sentimenPenalty) },
  ];

  const score = Math.round(clamp(100 - factors.reduce((a, f) => a + f.penalty, 0), 0, 100));
  const { level, emoji } = safetyBand(score);
  const delta = prevScore == null ? 0 : score - prevScore;
  const trend = delta > 1 ? "up" : delta < -1 ? "down" : "flat";

  const top = [...factors].sort((a, b) => b.penalty - a.penalty)[0];
  const narrative =
    top.penalty < 4
      ? `Koridor relatif aman (${score}/100). Tidak ada faktor risiko menonjol.`
      : `Skor keselamatan ${score}/100 — ${level}. Faktor dominan: ${top.label.toLowerCase()}.`;

  return { score, level, emoji, trend, delta, factors, narrative };
}
