import { NextResponse, type NextRequest } from "next/server";

import { getArticleDetail } from "@/lib/article.repo";
import { requireRole } from "@/lib/auth/authz";
import { getDb } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const guard = await requireRole("viewer");
  if ("response" in guard) return guard.response;

  const detail = await getArticleDetail(getDb(), request.nextUrl.searchParams);
  return NextResponse.json(detail);
}
