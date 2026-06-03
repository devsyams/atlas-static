/** Compact Indonesian count: 890 → "890", 4200 → "4,2 rb", 1_240_000 → "1,2 jt". */
export function fmtCount(n: number): string {
  const fmt = (v: number) =>
    v.toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 1 });
  if (n >= 1_000_000) return `${fmt(n / 1_000_000)} jt`;
  if (n >= 1_000) return `${fmt(n / 1_000)} rb`;
  return n.toLocaleString("id-ID");
}
