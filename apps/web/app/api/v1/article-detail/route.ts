import { NextResponse, type NextRequest } from "next/server";
import { buildArticleDetail } from "@/lib/mbg/data";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  await new Promise((r) => setTimeout(r, 350));
  const detail = buildArticleDetail(request.nextUrl.searchParams);
  return NextResponse.json(detail);
}
