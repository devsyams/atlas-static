/**
 * Sentiment-trend helpers (A11 v2.0) — pure, deterministic, no I/O. They turn the
 * upstream `sentiment-trend` daily series into a CEO-grade **momentum** read: net
 * sentiment per day, and whether the conversation is improving or deteriorating.
 *
 * The upstream's **last day is "today" and still accumulating** — a tiny-volume
 * tail that would fake a crash. `trendPoints` flags it `partial` and
 * `trendDirection` excludes it from the direction read.
 */

export interface TrendInputPoint {
  date: string;
  positive: number;
  negative: number;
  neutral: number;
}

export interface TrendDay {
  date: string;
  total: number;
  net: number; // (positive − negative) / total × 100, in points; 0 when empty
  pos: number; // positive share of the day, %
  neg: number; // negative share of the day, %
  partial: boolean;
}

export type TrendDir = "up" | "down" | "flat";

export interface TrendDirection {
  direction: TrendDir; // up = improving (net rose), down = deteriorating
  deltaPts: number; // recent-half mean − earlier-half mean, in points
  latest: number;
  earliest: number;
}

/** A trailing day with under this fraction of the median daily volume is "partial". */
const PARTIAL_FRACTION = 0.3;
/** |delta| within this many points reads as flat. */
const FLAT_PTS = 2;

/** Map the daily series to net-sentiment points and flag a low-volume trailing day. */
export function trendPoints(data: TrendInputPoint[]): TrendDay[] {
  const days: TrendDay[] = data.map((d) => {
    const total = Math.max(0, d.positive) + Math.max(0, d.negative) + Math.max(0, d.neutral);
    const net = total > 0 ? ((d.positive - d.negative) / total) * 100 : 0;
    const pos = total > 0 ? (d.positive / total) * 100 : 0;
    const neg = total > 0 ? (d.negative / total) * 100 : 0;
    return { date: d.date, total, net, pos, neg, partial: false };
  });
  if (days.length >= 3) {
    const rest = days
      .slice(0, -1)
      .map((d) => d.total)
      .filter((t) => t > 0)
      .sort((a, b) => a - b);
    if (rest.length) {
      const median = rest[Math.floor(rest.length / 2)];
      const last = days[days.length - 1];
      if (median > 0 && last.total < PARTIAL_FRACTION * median) last.partial = true;
    }
  }
  return days;
}

/**
 * Direction of the 7-day net sentiment: compare the mean of the recent half vs
 * the earlier half (robust to single-day noise), over the **complete** days only.
 */
export function trendDirection(days: TrendDay[]): TrendDirection {
  const complete = days.filter((d) => !d.partial && d.total > 0);
  if (complete.length < 2) {
    const only = Math.round(complete[0]?.net ?? 0);
    return { direction: "flat", deltaPts: 0, latest: only, earliest: only };
  }
  const mid = Math.floor(complete.length / 2);
  const avg = (arr: TrendDay[]) => arr.reduce((s, d) => s + d.net, 0) / arr.length;
  const earliest = avg(complete.slice(0, mid));
  const latest = avg(complete.slice(mid));
  const deltaPts = Math.round(latest - earliest);
  const direction: TrendDir = deltaPts > FLAT_PTS ? "up" : deltaPts < -FLAT_PTS ? "down" : "flat";
  return { direction, deltaPts, latest: Math.round(latest), earliest: Math.round(earliest) };
}
