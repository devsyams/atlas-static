import { NextResponse, type NextRequest } from "next/server";

// Inlined (not imported from lib/auth) so the edge middleware bundle stays free of
// node-only deps (pg/argon2). This is a cheap presence redirect for UX; the
// authoritative session/role checks run per-route via getCurrentUser/requireRole.
const SESSION_COOKIE = "atlas_session";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const authed = Boolean(req.cookies.get(SESSION_COOKIE)?.value);

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
