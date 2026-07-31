import { NextResponse } from "next/server";

import { homeForScope, parseScope } from "@/lib/auth";
import { scopeFromClaims, verifySsoToken } from "@/lib/sso-token";

/**
 * P9 — OpenGate → Danantara SSO handoff (inbound autologin; the mirror of P8's
 * outbound link).
 *
 * OpenGate signs a short-lived HS256 JWT (shared secret `DANANTARA_SSO_SECRET`)
 * and redirects the just-logged-in user to `GET /api/v1/sso?token=<jwt>`. We
 * verify it server-side and establish Danantara's own session — the same
 * `atlas_auth` / `atlas_scope` cookies the middleware gate reads — so the user is
 * never asked to log in again.
 *
 * Why under `/api`: the middleware matcher skips `/api`, so a logged-out arrival
 * is NOT bounced to `/login` before we can consume the token. `token` is the only
 * accepted input; the secret and all verification stay server-side. The 120 s
 * token `exp` is the replay guard — no `jti`/single-use bookkeeping needed.
 *
 * Fails closed: a missing/malformed/wrong-alg/badly-signed/wrong-audience/expired
 * token — or a missing secret — degrades to `/login`, never a partial session and
 * never a dead end.
 */

// 24 h, matching the cookies the login page sets so an SSO session behaves like a
// normal one. httpOnly is a deliberate hardening over the login page's JS cookies
// (see P9 Risk R1 for the AppShell/logout follow-up).
const SESSION_MAX_AGE = 60 * 60 * 24;

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  const result = await verifySsoToken(token, process.env.DANANTARA_SSO_SECRET, Date.now());

  if (!result.valid) {
    return NextResponse.redirect(new URL("/login", req.url), 302);
  }

  const scope = scopeFromClaims(result.claims);
  const home = homeForScope(parseScope(scope));
  const res = NextResponse.redirect(new URL(home, req.url), 302);

  const attrs = { httpOnly: true, path: "/", sameSite: "lax" as const, maxAge: SESSION_MAX_AGE };
  res.cookies.set("atlas_auth", "1", attrs);
  res.cookies.set("atlas_scope", scope, attrs);

  return res;
}
