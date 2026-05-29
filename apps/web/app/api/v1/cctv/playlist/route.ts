import { NextResponse } from "next/server";

import { getAtcsCamera, isAllowedAtcsUrl } from "@/lib/jasamarga/atcs";

export const dynamic = "force-dynamic";

/**
 * HLS playlist proxy for public ATCS CCTV. Fetches the upstream .m3u8 server-side
 * (no browser CORS), then rewrites segment (.ts) and sub-playlist (.m3u8) lines to
 * same-origin proxy routes so the browser can play it AND read its pixels (needed
 * for client-side COCO-SSD detection). Only allowlisted hosts are proxied.
 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const u = sp.get("u");
  const url = u && isAllowedAtcsUrl(u) ? u : getAtcsCamera(sp.get("cam")).url;

  let res: Response;
  try {
    res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
  } catch {
    return new NextResponse("upstream unreachable", { status: 502 });
  }
  if (!res.ok) return new NextResponse("upstream error", { status: 502 });

  const text = await res.text();
  const base = url.slice(0, url.lastIndexOf("/") + 1);

  const out = text
    .split("\n")
    .map((line) => {
      const t = line.trim();
      if (!t || t.startsWith("#")) return line;
      const abs = /^https?:\/\//.test(t) ? t : base + t;
      if (!isAllowedAtcsUrl(abs)) return line;
      const route = abs.includes(".m3u8") ? "playlist" : "seg";
      return `/api/v1/cctv/${route}?u=${encodeURIComponent(abs)}`;
    })
    .join("\n");

  return new NextResponse(out, {
    headers: {
      "content-type": "application/vnd.apple.mpegurl",
      "cache-control": "no-store",
    },
  });
}
