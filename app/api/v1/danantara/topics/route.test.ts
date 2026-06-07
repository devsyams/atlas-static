import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TopicsApiResponse } from "@/lib/danantara/ceo/topics-source";
import { GET } from "./route";

const SAMPLE: TopicsApiResponse = {
  success: true,
  status_code: 200,
  meta: { topic: "danantara_main", startdate: "2026-05-10", enddate: "2026-06-07" },
  data: {
    topics: [
      {
        topik: "Kontroversi Laporan Keuangan Danantara",
        impressions: 1000,
        reach: 800,
        sentiment: "negative",
        stats_sentiment: { positive: 5, negative: 85, neutral: 10 },
        penjelasan: "...",
      },
      {
        topik: "Kunjungan Presiden ke Wisma Danantara",
        impressions: 2000,
        reach: 1500,
        sentiment: "positive",
        stats_sentiment: { positive: 70, negative: 10, neutral: 20 },
        penjelasan: "...",
      },
    ],
    summary: { total_impressions: 3000, total_reach: 2300, percentage: { positive: 24.8, negative: 52.22, neutral: 22.98 } },
    intent: [],
  },
};

const KEY = "SUPER-SECRET-KEY";

/** Build a request to the route, optionally with the manual-refresh flag. */
const req = (fresh = false) =>
  new Request(`http://localhost/api/v1/danantara/topics${fresh ? "?fresh=1" : ""}`);

describe("GET /api/v1/danantara/topics (T20 / AC19)", () => {
  beforeEach(() => {
    process.env.DANANTARA_TOPICS_API_BASE = "https://api.example.io/topics";
    process.env.DANANTARA_TOPICS_API_KEY = KEY;
    process.env.DANANTARA_TOPIC_CODE = "danantara_main";
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.DANANTARA_TOPICS_API_BASE;
    delete process.env.DANANTARA_TOPICS_API_KEY;
    delete process.env.DANANTARA_TOPIC_CODE;
  });

  it("returns mapped topics on a successful upstream fetch", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(SAMPLE), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.issues).toHaveLength(2);
    expect(body.summary.total_impressions).toBe(3000);
    expect(body.meta.topic).toBe("danantara_main");
  });

  it("caches the upstream for 1h by default, and bypasses the cache on ?fresh=1 (v36.0)", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(SAMPLE), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await GET(req(false));
    expect(fetchMock.mock.calls[0][1]).toEqual({ next: { revalidate: 3600 } });

    await GET(req(true));
    expect(fetchMock.mock.calls[1][1]).toEqual({ cache: "no-store" });
  });

  it("sends the api_key upstream but never leaks it in the response (governance)", async () => {
    let calledUrl = "";
    const fetchMock = vi.fn(async (url: string) => {
      calledUrl = String(url);
      return new Response(JSON.stringify(SAMPLE), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await GET(req());
    const body = await res.json();

    expect(calledUrl).toContain(`api_key=${KEY}`); // sent server-side
    expect(JSON.stringify(body)).not.toContain(KEY); // never returned to the client
  });

  it("returns a non-OK status when the upstream fails (client falls back)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("upstream down", { status: 500 })),
    );
    const res = await GET(req());
    expect(res.ok).toBe(false);
  });

  it("returns 503 when no api key is configured", async () => {
    delete process.env.DANANTARA_TOPICS_API_KEY;
    const res = await GET(req());
    expect(res.status).toBe(503);
  });
});
