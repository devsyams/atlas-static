import { NextResponse } from "next/server";
import { buildDashboard } from "@/lib/mbg/data";
import { fetchUsdIdr } from "@/lib/market/usdidr";

export const dynamic = "force-dynamic";

export async function GET() {
  const dashboard = buildDashboard();

  // Override the USD/IDR ticker item with a live rate (falls back to the static
  // JSON value if the upstream feeds are unreachable).
  const usdidr = await fetchUsdIdr();
  if (usdidr) {
    dashboard.market_ticker = dashboard.market_ticker.map((item) =>
      item.label === "USD/IDR" ? { ...item, value: usdidr.value, delta: usdidr.delta } : item,
    );
  }

  return NextResponse.json(dashboard);
}
