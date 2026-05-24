import { NextResponse, type NextRequest } from "next/server";

/**
 * Lightweight auth gate: every page requires the `atlas_auth` cookie, which the
 * login page sets after the hardcoded credentials check. Unauthenticated
 * requests are redirected to /login; authenticated visits to /login bounce home.
 * (Demo-grade only — the cookie is a presence flag, not a real session.)
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const authed = req.cookies.get("atlas_auth")?.value === "1";

  if (pathname === "/login") {
    if (authed) return NextResponse.redirect(new URL("/", req.url));
    return NextResponse.next();
  }

  if (!authed) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  // Run on every route except API routes, Next internals, and static files.
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
