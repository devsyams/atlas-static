import type { MarketTickerItem } from "@/lib/mbg/types";
import { fetchUsdIdr } from "@/lib/market/usdidr";

/**
 * Live IHSG (Jakarta Composite, ^JKSE) + USD/IDR for the sovereign dashboard.
 * Both via Yahoo Finance (key-free, cached ~10 min). Either may be null on
 * failure — the snapshot builder falls back to synthetic values, mirroring the
 * JasaMarga "2 live · rest demo" provenance model.
 */
export async function fetchLiveMarkets(): Promise<{ ihsg?: MarketTickerItem; usdidr?: MarketTickerItem }> {
  const [ihsg, usdidr] = await Promise.all([fetchIhsg(), fetchUsdIdr()]);
  return { ihsg: ihsg ?? undefined, usdidr: usdidr ?? undefined };
}

async function fetchIhsg(): Promise<MarketTickerItem | null> {
  try {
    const res = await fetch(
      "https://query1.finance.yahoo.com/v8/finance/chart/%5EJKSE?range=5d&interval=1d",
      { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 600 } },
    );
    if (!res.ok) return null;
    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;
    const price: unknown = meta?.regularMarketPrice;
    const prev: unknown = meta?.chartPreviousClose ?? meta?.previousClose;
    if (typeof price !== "number") return null;
    const delta =
      typeof prev === "number" && prev > 0 ? Math.round(((price - prev) / prev) * 1000) / 10 : undefined;
    return {
      label: "IHSG",
      value: price.toLocaleString("id-ID", { maximumFractionDigits: 0 }),
      delta,
    };
  } catch {
    return null;
  }
}
