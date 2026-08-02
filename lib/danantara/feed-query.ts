/**
 * Build the query suffix for a Danantara feed fetch from the independent client
 * flags: `fresh` (bypass the 6 h cache with `?fresh=1`), `mock` (the A13 v4.0
 * scoped-mock signal that only /bgn/command sent while the upstream was dead),
 * and `days` (the A7 v49.0 selected topics window). Returns `""` when none is
 * set, so callers can write `` `/api/v1/danantara/topics${feedQuery({ fresh, mock })}` ``
 * without ever producing a malformed `?fresh=1?mock=1`.
 */
export function feedQuery(opts: { fresh?: boolean; mock?: boolean; days?: number; static?: boolean }): string {
  const params = new URLSearchParams();
  if (opts.fresh) params.set("fresh", "1");
  if (opts.mock) params.set("mock", "1");
  if (opts.static) params.set("static", "1"); // A10 v10.0 — captured actor roster
  if (opts.days) params.set("days", String(opts.days));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}
