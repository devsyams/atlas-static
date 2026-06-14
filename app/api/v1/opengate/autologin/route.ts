import { NextResponse } from "next/server";

/**
 * P8 — Nexorus OpenGate cross-app link. Mints a fresh OpenGate autologin magic
 * link server-side and 307-redirects the browser to it, so the gear-menu item
 * can be a plain `<a target="_blank">` (no popup-blocker risk, no client JS).
 *
 * With an `idquery` (P8 v2.0), the magic link instead lands the user on that
 * specific Nexorus topic (`dashboard_demo?id=monitoring&idquery=…`); without
 * one it lands on the dashboard home, exactly as before.
 *
 * Guardrails: the `api_key` never leaves the server; the route accepts exactly
 * one client param (`idquery`), strictly validated so it can be neither an open
 * proxy nor an open redirect; it requires the `atlas_auth` session cookie itself
 * because the middleware matcher skips `/api` — without it, anyone with the URL
 * could mint logged-in OpenGate sessions. Every failure degrades to OpenGate's
 * own login page, never a dead end.
 */

const DEFAULT_AUTOLOGIN_BASE = "https://opengate.nexorus.io/autologin/autologin_generate";
const FALLBACK_URL = "https://opengate.nexorus.io";
const UPSTREAM_TIMEOUT_MS = 5_000;

/** Nexorus deep-link ids are opaque alphanumeric tokens (e.g. 694368b190153).
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

  const apiKey = process.env.OPENGATE_API_KEY || process.env.DANANTARA_TOPICS_API_KEY;
  if (!apiKey) {
    return NextResponse.redirect(FALLBACK_URL);
  }

  const base = process.env.OPENGATE_AUTOLOGIN_BASE || DEFAULT_AUTOLOGIN_BASE;
  let upstream = `${base}?api_key=${encodeURIComponent(apiKey)}`;

  // Optional per-topic deep link: forward only a well-formed `idquery` so the
  // minted link lands on that Nexorus topic; anything else falls through to home.
  const idQuery = new URL(req.url).searchParams.get("idquery");
  if (idQuery && ID_QUERY_RE.test(idQuery)) {
    upstream += `&idquery=${encodeURIComponent(idQuery)}`;
  }

  try {
    const res = await fetch(upstream, {
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (!res.ok) return NextResponse.redirect(FALLBACK_URL);

    const body: { ok?: boolean; login_url?: string } = await res.json();
    if (body.ok !== true || !body.login_url) {
      return NextResponse.redirect(FALLBACK_URL);
    }
    return NextResponse.redirect(body.login_url);
  } catch {
    return NextResponse.redirect(FALLBACK_URL);
  }
}
