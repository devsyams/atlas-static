import { NextResponse } from "next/server";

import { isAllowedAtcsUrl } from "@/lib/jasamarga/atcs";

export const dynamic = "force-dynamic";

/** Streams a single HLS segment (.ts) from an allowlisted ATCS host, same-origin. */
export async function GET(req: Request) {
  const u = new URL(req.url).searchParams.get("u");
  if (!u || !isAllowedAtcsUrl(u)) return new NextResponse("forbidden", { status: 403 });

  let res: Response;
  try {
    res = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
  } catch {
    return new NextResponse("upstream unreachable", { status: 502 });
  }
  if (!res.ok || !res.body) return new NextResponse("upstream error", { status: 502 });

  return new NextResponse(res.body, {
    headers: {
      "content-type": res.headers.get("content-type") ?? "video/mp2t",
      "cache-control": "no-store",
    },
  });
}
