/**
 * Build the query suffix for a Danantara feed fetch from the two independent client
 * flags: `fresh` (bypass the 6 h cache with `?fresh=1`) and `mock` (the A13 v4.0
 * scoped-mock signal that only `/bgn/command` sends). Returns `""` when neither is
 * set, so callers can write `` `/api/v1/danantara/topics${feedQuery({ fresh, mock })}` ``
 * without ever producing a malformed `?fresh=1?mock=1`.
 */
export function feedQuery(opts: { fresh?: boolean; mock?: boolean }): string {
  const params = new URLSearchParams();
  if (opts.fresh) params.set("fresh", "1");
  if (opts.mock) params.set("mock", "1");
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}
