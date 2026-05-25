import { NextResponse, type NextRequest } from "next/server";

import { getArticleDetail } from "@/lib/article.repo";
import { getDb } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const detail = await getArticleDetail(getDb(), request.nextUrl.searchParams);
  return NextResponse.json(detail);
}
