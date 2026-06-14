import { NextResponse } from "next/server";

/**
 * P8 v2.0 — Nexorus dashboard topic deep link. Mints a fresh garudaperkasa
 * autologin magic link server-side and 307-redirects the browser to it, asking
 * (via a `redirect` param) to land on that topic's monitoring view
 * (`dashboard_demo?id=monitoring&idquery=…`) after sign-in. The gear-menu
 * OpenGate link (`/api/v1/opengate/autologin`) is a different service and is
 * unchanged.
 *
 * NOTE (verified 2026-06-14 against the live service): the magic link currently
 * IGNORES the `redirect` param and always lands on `dashboard_demo?id=topics`,
 * so today this signs the user into the dashboard but not the exact topic. The
 * `redirect` is wired and ready so the deep link becomes topic-precise the moment
 * the backend honors it (see docs/integrations/nexorus-dashboard-deeplink.md).
 *
 * Guardrails: the `api_key` never leaves the server; the route accepts exactly
 * one client param (`idquery`), strictly validated so it can be neither an open
 * proxy nor an open redirect; it requires the `atlas_auth` session cookie itself
 * because the middleware matcher skips `/api`. Every failure degrades to the
 * dashboard home, never a dead end.
 *
 * Token expiry: the magic-link token is short-lived (~2 min) and single-use, but
 * that needs no client bookkeeping — it is minted HERE on each click and the
 * browser is 307'd straight onto it, so it is consumed within seconds, then the
 * Nexorus session cookie takes over. `force-dynamic` + `no-store` keep it fresh;
 * never bake the minted `login_url` into page HTML (that is what would let it go
 * stale or leak).
 */

const DEFAULT_AUTOLOGIN_BASE = "https://nexorus.garudaperkasa.io/autologin/autologin_generate";
const DEFAULT_DASHBOARD_BASE = "https://nexorus.garudaperkasa.io/dashboard_demo";
const UPSTREAM_TIMEOUT_MS = 5_000;

/** Nexorus deep-link ids are opaque alphanumeric tokens (e.g. 68ca1a83408aa).
 * Anything else is treated as absent, so a bad value can never be smuggled into
 * the upstream URL or the redirect target. */
const ID_QUERY_RE = /^[A-Za-z0-9]+$/;

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const cookies = req.headers.get("cookie") ?? "";
  const authed = /(?:^|;\s*)atlas_auth=1(?:;|$)/.test(cookies);
  if (!authed) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const dashBase = process.env.NEXORUS_DASHBOARD_BASE || DEFAULT_DASHBOARD_BASE;
  const fallback = new URL(dashBase).origin;

  const apiKey = process.env.NEXORUS_DASHBOARD_API_KEY || process.env.DANANTARA_TOPICS_API_KEY;
  if (!apiKey) {
    return NextResponse.redirect(fallback);
  }

  const genBase = process.env.NEXORUS_DASHBOARD_AUTOLOGIN_BASE || DEFAULT_AUTOLOGIN_BASE;
  const upstream = `${genBase}?api_key=${encodeURIComponent(apiKey)}`;

  // Only a well-formed idquery becomes a post-login destination; anything else
  // just signs the user in (no topic redirect, no open redirect).
  const idQuery = new URL(req.url).searchParams.get("idquery");
  const topicTarget =
    idQuery && ID_QUERY_RE.test(idQuery)
      ? `${dashBase}?id=monitoring&idquery=${encodeURIComponent(idQuery)}`
      : null;

  try {
    const res = await fetch(upstream, {
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (!res.ok) return NextResponse.redirect(fallback);

    const body: { ok?: boolean; login_url?: string } = await res.json();
    if (body.ok !== true || !body.login_url) {
      return NextResponse.redirect(fallback);
    }

    const loginUrl = body.login_url;
    if (!topicTarget) return NextResponse.redirect(loginUrl);

    const sep = loginUrl.includes("?") ? "&" : "?";
    return NextResponse.redirect(`${loginUrl}${sep}redirect=${encodeURIComponent(topicTarget)}`);
  } catch {
    return NextResponse.redirect(fallback);
  }
}
