import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TopicsApiResponse } from "./ceo/topics-source";
import { FeedNotConfiguredError, fetchTopicsForCode } from "./topics-feed";

/** Two-topic payload. */
const SAMPLE: TopicsApiResponse = {
  success: true,
  status_code: 200,
  meta: { topic: "danantara_pertamina", startdate: "2026-06-03", enddate: "2026-06-10" },
  data: {
    topics: [
      { topik: "Kenaikan Harga Pertamax", impressions: 1000, reach: 800, sentiment: "negative", stats_sentiment: { positive: 5, negative: 85, neutral: 10 }, penjelasan: "..." },
      { topik: "Laba Pertamina Naik", impressions: 2000, reach: 1500, sentiment: "positive", stats_sentiment: { positive: 70, negative: 10, neutral: 20 }, penjelasan: "..." },
    ],
    summary: { total_impressions: 3000, total_reach: 2300, percentage: { positive: 24.8, negative: 52.22, neutral: 22.98 } },
    intent: [{ intent: "Keluhan", deskripsi: "", impressions: 100, share_of_voice: 60 }],
  },
};

/** Same shape, but a hollow window: no topics, null summary, intent still present
 * (the real transient-/stale-empty the upstream serves while slow/recomputing). */
const HOLLOW: TopicsApiResponse = {
  success: true,
  status_code: 200,
  meta: { topic: "danantara_pertamina", startdate: "2026-05-13", enddate: "2026-06-10" },
  data: { topics: [], summary: null as unknown as TopicsApiResponse["data"]["summary"], intent: [{ intent: "Keluhan", deskripsi: "", impressions: 100, share_of_voice: 60 }] },
};

const KEY = "SECRET-KEY";

/** A fetch mock that returns the i-th payload in `seq` (the last repeats). */
function seqFetch(seq: TopicsApiResponse[]) {
  let i = 0;
  // Declared fetch-like params so `mock.calls` is typed [url, init] for assertions.
  return vi.fn(async (_url: string, _init?: RequestInit) => {
    const r = seq[Math.min(i, seq.length - 1)];
    i += 1;
    return new Response(JSON.stringify(r), { status: 200 });
  });
}

describe("fetchTopicsForCode — stale/transient empty does not stick (A8 v4.1)", () => {
  beforeEach(() => {
    process.env.DANANTARA_TOPICS_API_BASE = "https://api.example.io/topics";
    process.env.DANANTARA_TOPICS_API_KEY = KEY;
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.DANANTARA_TOPICS_API_BASE;
    delete process.env.DANANTARA_TOPICS_API_KEY;
  });

  it("throws FeedNotConfiguredError when no base is configured, even with a key — T23 (A7 v48.0)", async () => {
    // TrawlDeck cutover: the GARUDA default base is retired; without an explicit
    // base the feed must report not-configured, never fetch a hardcoded host.
    delete process.env.DANANTARA_TOPICS_API_BASE;
    const fetchMock = seqFetch([SAMPLE]);
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchTopicsForCode("1")).rejects.toBeInstanceOf(FeedNotConfiguredError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("self-heals a cached/transient empty: confirms against the live upstream and uses live data", async () => {
    // Cacheable default + 28d widen both hollow (a stale empty), but the live feed has data.
    const fetchMock = seqFetch([HOLLOW, HOLLOW, SAMPLE]);
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchTopicsForCode("danantara_pertamina");

    expect(result.issues).toHaveLength(2); // live data shown, not the cached empty
    const inits = fetchMock.mock.calls.map((c) => c[1]);
    expect(inits[0]).toEqual({ next: { revalidate: 21600 } }); // primary path is cacheable (6 h)
    expect(inits).toContainEqual({ cache: "no-store" }); // a live (uncached) confirm happened
  });

  it("sends no startdate/enddate by default — the upstream's own window applies (v42.0/v5.0)", async () => {
    const fetchMock = seqFetch([SAMPLE]);
    vi.stubGlobal("fetch", fetchMock);

    await fetchTopicsForCode("danantara_pertamina");

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("topic=danantara_pertamina");
    expect(url).toContain(`api_key=${KEY}`);
    expect(url).not.toContain("startdate");
    expect(url).not.toContain("enddate");
  });

  it("widens an empty default window once to an explicit 28-day window (v43.0/v6.0)", async () => {
    const fetchMock = seqFetch([HOLLOW, SAMPLE]); // default empty → 28d has data
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchTopicsForCode("danantara_mandiri");

    expect(result.issues).toHaveLength(2); // the widened result is used
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [firstUrl, secondUrl] = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(firstUrl).not.toContain("startdate"); // default request stays date-less
    expect(secondUrl).toContain("startdate="); // the retry pins an explicit window
    expect(secondUrl).toContain("enddate=");
  });

  it("does NOT add a live re-fetch when the cacheable window already has topics", async () => {
    const fetchMock = seqFetch([SAMPLE]);
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchTopicsForCode("danantara_pln");

    expect(result.issues).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(1); // no widening, no confirm on the happy path
    expect(fetchMock.mock.calls[0][1]).toEqual({ next: { revalidate: 21600 } });
  });

  it("leaves a genuinely empty result empty (no fabricated data) after confirming live", async () => {
    const fetchMock = seqFetch([HOLLOW]); // cached and live both empty
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchTopicsForCode("danantara_bri");

    expect(result.issues).toHaveLength(0);
    expect(fetchMock).toHaveBeenCalledTimes(4); // (default + 28d) cached, then (default + 28d) live
    const inits = fetchMock.mock.calls.map((c) => c[1]);
    expect(inits).toContainEqual({ cache: "no-store" }); // it did try the live upstream
  });

  it("days opt → one explicit-window fetch (start = today − (days−1)), no widening — T24 (A7 v49.0)", async () => {
    const fetchMock = seqFetch([SAMPLE]);
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchTopicsForCode("1", { days: 30 });

    expect(result.issues).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const params = new URL(String(fetchMock.mock.calls[0][0])).searchParams;
    const start = Date.parse(params.get("startdate") ?? "");
    const end = Date.parse(params.get("enddate") ?? "");
    expect((end - start) / 86_400_000).toBe(29); // 30 days inclusive: today − 29 … today
  });

  it("days + empty window stays empty — the chosen window is never widened, only live-confirmed — T24", async () => {
    const fetchMock = seqFetch([HOLLOW]);
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchTopicsForCode("1", { days: 7 });

    expect(result.issues).toHaveLength(0);
    expect(fetchMock).toHaveBeenCalledTimes(2); // cacheable + one live confirm — NO 28d widen
    const [firstUrl, secondUrl] = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(secondUrl).toBe(firstUrl); // the confirm re-requests the SAME window
    const inits = fetchMock.mock.calls.map((c) => c[1]);
    expect(inits[0]).toEqual({ next: { revalidate: 21600 } });
    expect(inits[1]).toEqual({ cache: "no-store" });
  });

  it("on ?fresh=1 the path is already live, so it does not add a redundant confirm", async () => {
    const fetchMock = seqFetch([HOLLOW]);
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchTopicsForCode("danantara_bri", { fresh: true });

    expect(result.issues).toHaveLength(0);
    expect(fetchMock).toHaveBeenCalledTimes(2); // default + 28d widen only — no extra confirm
    for (const c of fetchMock.mock.calls) expect(c[1]).toEqual({ cache: "no-store" });
  });
});
