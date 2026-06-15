import { NextResponse } from "next/server";

/**
 * P8 v3.0 — Nexorus dashboard topic deep link. Mints a fresh **OpenGate**
 * autologin magic link server-side and 307-redirects the browser to it. The
 * post-login destination is baked into the **generate** call via
 * `redirect=<url-encoded>`, so the returned `login_url` already carries it.
 *
 * OpenGate hosts the dashboard itself and lands the user on
 * `https://opengate.nexorus.io/dashboard_demo?<decoded redirect>` after sign-in —
 * i.e. it appends the decoded `redirect` after `dashboard_demo?`. So `redirect`
 * is the **query string only** (`id=monitoring&idquery=…`), NOT a full URL:
 * passing a URL nests it as `…/dashboard_demo?https://…/dashboard_demo?…`.
 *
 * v3.0 resolves the v2.0 gap: the OpenGate team confirmed `autologin_generate`
 * honors `redirect`, so the deep link is topic-precise now (no more interim
 * "signed-in dashboard home"). The gear-menu OpenGate home link
 * (`/api/v1/opengate/autologin`) is the same service, just without a `redirect`.
 *
 * Guardrails: the `api_key` never leaves the server; the route accepts exactly
 * one client param (`idquery`), strictly validated so it can be neither an open
 * proxy nor an open redirect (the redirect target is built server-side to a fixed
 * same-origin dashboard URL); it requires the `atlas_auth` session cookie itself
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

const DEFAULT_AUTOLOGIN_BASE = "https://opengate.nexorus.io/autologin/autologin_generate";
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

  const genBase = process.env.OPENGATE_AUTOLOGIN_BASE || DEFAULT_AUTOLOGIN_BASE;
  // OpenGate hosts the dashboard; a failure lands the user on its home page.
  const fallback = new URL(genBase).origin;

  const apiKey = process.env.OPENGATE_API_KEY || process.env.DANANTARA_TOPICS_API_KEY;
  if (!apiKey) {
    return NextResponse.redirect(fallback);
  }

  // Only a well-formed idquery becomes a post-login destination; anything else
  // just signs the user in (no topic redirect, no open redirect).
  const idQuery = new URL(req.url).searchParams.get("idquery");
  // OpenGate appends the decoded `redirect` after `dashboard_demo?`, so this is
  // the query string only — a full URL would nest under the dashboard path.
  const redirectQuery =
    idQuery && ID_QUERY_RE.test(idQuery) ? `id=monitoring&idquery=${idQuery}` : null;

  // Bake the destination into the generate call: OpenGate encodes it into the
  // magic-link token, so the returned login_url lands the user there after sign-in.
  let upstream = `${genBase}?api_key=${encodeURIComponent(apiKey)}`;
  if (redirectQuery) upstream += `&redirect=${encodeURIComponent(redirectQuery)}`;

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

    // The destination is carried by the token — 307 straight to the magic link.
    return NextResponse.redirect(body.login_url);
  } catch {
    return NextResponse.redirect(fallback);
  }
}
