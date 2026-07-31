import { NextResponse } from "next/server";

import { relativeRedirect } from "@/lib/http";

/**
 * P8 — Nexorus OpenGate cross-app link. Mints a fresh OpenGate autologin magic
 * link server-side and 307-redirects the browser to it, so the gear-menu item
 * can be a plain `<a target="_blank">` (no popup-blocker risk, no client JS).
 *
 * Guardrails: the `api_key` never leaves the server; the route accepts no
 * client params (not an open proxy); it requires the `atlas_auth` session
 * cookie itself because the middleware matcher skips `/api` — without it,
 * anyone with the URL could mint logged-in OpenGate sessions. Every failure
 * degrades to OpenGate's own login page, never a dead end.
 */

const DEFAULT_AUTOLOGIN_BASE = "https://opengate.nexorus.io/autologin/autologin_generate";
const FALLBACK_URL = "https://opengate.nexorus.io";
const UPSTREAM_TIMEOUT_MS = 5_000;

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const cookies = req.headers.get("cookie") ?? "";
  const authed = /(?:^|;\s*)atlas_auth=1(?:;|$)/.test(cookies);
  if (!authed) {
    return relativeRedirect("/login");
  }

  // Shared key with the topics feed — read it straight from DANANTARA_TOPICS_API_KEY
  // so a missing/stale OPENGATE_API_KEY on a deploy can't override it (v3.2).
  const apiKey = process.env.DANANTARA_TOPICS_API_KEY;
  if (!apiKey) {
    return NextResponse.redirect(FALLBACK_URL);
  }

  const base = process.env.OPENGATE_AUTOLOGIN_BASE || DEFAULT_AUTOLOGIN_BASE;
  const upstream = `${base}?api_key=${encodeURIComponent(apiKey)}`;

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
