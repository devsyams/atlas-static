import type { MarketTickerItem } from "@/lib/mbg/types";

/**
 * Live USD/IDR for the ticker. Yahoo Finance gives the spot rate plus the prior
 * close (so we can show a real daily change); open.er-api is a key-free fallback
 * for the rate only. Both are cached ~10 min. Returns null if everything fails,
 * letting the caller keep the static JSON value.
 */
export async function fetchUsdIdr(): Promise<MarketTickerItem | null> {
  return (await fromYahoo()) ?? (await fromErApi());
}

function format(rate: number): string {
  return `Rp ${Math.round(rate).toLocaleString("id-ID")}`;
}

async function fromYahoo(): Promise<MarketTickerItem | null> {
  try {
    const res = await fetch(
      "https://query1.finance.yahoo.com/v8/finance/chart/IDR=X?range=5d&interval=1d",
      { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 600 } },
    );
    if (!res.ok) return null;
    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;
    const price: unknown = meta?.regularMarketPrice;
    const prev: unknown = meta?.chartPreviousClose ?? meta?.previousClose;
    if (typeof price !== "number") return null;
    const delta =
      typeof prev === "number" && prev > 0
        ? Math.round(((price - prev) / prev) * 1000) / 10
        : undefined;
    return { label: "USD/IDR", value: format(price), delta };
  } catch {
    return null;
  }
}

async function fromErApi(): Promise<MarketTickerItem | null> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      next: { revalidate: 600 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const idr: unknown = json?.rates?.IDR;
    if (typeof idr !== "number") return null;
    return { label: "USD/IDR", value: format(idr) };
  } catch {
    return null;
  }
}
