import { NextResponse, type NextRequest } from "next/server";

import { homeForScope, parseScope, scopeAllowsPath } from "@/lib/auth";

/**
 * Lightweight auth + scope gate. Every page requires the `atlas_auth` cookie set
 * by the login page; the `atlas_scope` cookie carries the user's dashboard scope.
 * A `danantara`-scoped demo user is bounced back to /danantara if they try to
 * open any other dashboard. (Demo-grade only — cookies are presence flags.)
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const authed = req.cookies.get("atlas_auth")?.value === "1";
  const scope = parseScope(req.cookies.get("atlas_scope")?.value);

  if (pathname === "/login") {
    if (authed) return NextResponse.redirect(new URL(homeForScope(scope), req.url));
    return NextResponse.next();
  }

  if (!authed) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Scoped users can only reach their own dashboard.
  if (!scopeAllowsPath(scope, pathname)) {
    return NextResponse.redirect(new URL(homeForScope(scope), req.url));
  }

  return NextResponse.next();
}

export const config = {
  // Run on every route except API routes, Next internals, and static files.
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
