import { NextResponse } from "next/server";

/**
 * A redirect with a **relative** `Location` — host-safe behind the ingress.
 *
 * Building an absolute URL from `req.url` / `req.nextUrl` leaks the in-container
 * bind address (`0.0.0.0:3000`) into `Location`, stranding the browser on an
 * unreachable host even when the request itself succeeded. A relative path lets
 * the browser resolve `Location` against the public URL it requested instead —
 * no host to leak, nothing to spoof, no forwarded-header trust required.
 *
 * Use this for **same-origin** targets only (e.g. `"/login"`,
 * `"/danantara/command"`). Keep `NextResponse.redirect(url)` for genuinely
 * external absolute URLs (OpenGate magic links, fallback origins). It is not
 * `NextResponse.redirect`, which requires an absolute URL and so can't emit a
 * relative `Location`.
 */
export function relativeRedirect(path: string, status: 302 | 307 = 307): NextResponse {
  return new NextResponse(null, { status, headers: { Location: path } });
}
