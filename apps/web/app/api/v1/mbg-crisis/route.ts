import { NextResponse } from "next/server";

import { cached } from "@/lib/cache";
import { getDashboard } from "@/lib/dashboard.repo";
import { getDb } from "@/lib/db/client";
import { fetchUsdIdr } from "@/lib/market/usdidr";

export const dynamic = "force-dynamic";

const CACHE_KEY = "dashboard:mbg-crisis";
const CACHE_TTL_SEC = 45;

export async function GET() {
  // Source of truth is Postgres (spec §6.1), cached ~45s so polls don't re-query.
  const dashboard = await cached(CACHE_KEY, CACHE_TTL_SEC, () => getDashboard(getDb()));

  // Apply the live USD/IDR override AFTER the cache so the rate stays fresh
  // (falls back to the stored value if the upstream feeds are unreachable).
  const usdidr = await fetchUsdIdr();
  if (usdidr) {
    dashboard.market_ticker = dashboard.market_ticker.map((item) =>
      item.label === "USD/IDR" ? { ...item, value: usdidr.value, delta: usdidr.delta } : item,
    );
  }

  return NextResponse.json(dashboard);
}
