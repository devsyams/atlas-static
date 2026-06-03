/** Sentiment −100..100 → row background tint (red ↔ green via oklch). */
export function sentimentTint(sentiment: number, alpha = 0.18): string {
  const t = (sentiment + 100) / 200; // 0 (worst) .. 1 (best)
  const hue = 25 + t * 130; // red 25 → green 155
  const chroma = 0.07 + (Math.abs(sentiment) / 100) * 0.1;
  return `oklch(0.45 ${chroma.toFixed(3)} ${hue.toFixed(0)} / ${alpha})`;
}

/** SentimentPie totals from any item carrying mention counts (AC14). */
export function pieTotals(item: { mentions: number; posMentions: number; negMentions: number }): {
  pos: number;
  neg: number;
  neu: number;
  total: number;
} {
  return {
    pos: item.posMentions,
    neg: item.negMentions,
    neu: Math.max(0, item.mentions - item.posMentions - item.negMentions),
    total: item.mentions,
  };
}

/** Compact count: 890 → "890", 4200 → "4.2K", 1_240_000 → "1.2M". */
export function fmtCount(n: number): string {
  const fmt = (v: number) =>
    v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 1 });
  if (n >= 1_000_000) return `${fmt(n / 1_000_000)}M`;
  if (n >= 1_000) return `${fmt(n / 1_000)}K`;
  return n.toLocaleString("en-US");
}
