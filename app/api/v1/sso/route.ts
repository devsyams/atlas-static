import { homeForScope, parseScope } from "../../../../lib/auth";
import { relativeRedirect } from "../../../../lib/http";
import { OPENGATE_SSO_COOKIE } from "../../../../lib/opengate-session";
import { scopeFromClaims, verifySsoToken } from "../../../../lib/sso-token";

/**
 * P9 — OpenGate → Danantara SSO handoff (inbound autologin; the mirror of P8's
 * outbound link).
 *
 * OpenGate signs a short-lived HS256 JWT (shared secret `ATLAS_SSO_SECRET`)
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
 *
 * Redirect host-safety: both redirects emit a **relative** `Location` (e.g.
 * `/login`, `/danantara/command`). Behind the ingress, `req.url`/`req.nextUrl`
 * reflect the in-container bind (`0.0.0.0:3000`), so building an absolute URL from
 * them leaks that unreachable address into `Location` and strands the browser even
 * after a successful handoff. A relative `Location` is resolved by the browser
 * against the public URL it requested — no host to leak, nothing to spoof.
 */

// 24 h, matching the cookies the login page sets so an SSO session behaves like a
// normal one. httpOnly is a deliberate hardening over the login page's JS cookies
// (see P9 Risk R1 for the AppShell/logout follow-up).
const SESSION_MAX_AGE = 60 * 60 * 24;

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  const result = await verifySsoToken(token, process.env.ATLAS_SSO_SECRET, Date.now());

  if (!result.valid) {
    return relativeRedirect("/login", 302);
  }

  const scope = scopeFromClaims(result.claims);
  const res = relativeRedirect(homeForScope(parseScope(scope)), 302);

  const secure = new URL(req.url).protocol === "https:";
  const attrs = { httpOnly: true, path: "/", sameSite: "lax" as const, maxAge: SESSION_MAX_AGE, secure };
  res.cookies.set("atlas_auth", "1", attrs);
  res.cookies.set("atlas_scope", scope, attrs);
  res.cookies.set(OPENGATE_SSO_COOKIE, token!, attrs);

  return res;
}
