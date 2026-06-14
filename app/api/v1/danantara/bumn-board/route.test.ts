import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BUMN_REGISTRY } from "@/lib/bumn/registry";
import type { TopicsApiResponse } from "@/lib/danantara/ceo/topics-source";
import { GET } from "./route";

const KEY = "SUPER-SECRET-KEY";

const sample = (): TopicsApiResponse => ({
  success: true,
  status_code: 200,
  meta: { topic: "danantara_x", startdate: "2026-05-31", enddate: "2026-06-07" },
  data: {
    topics: [
      { topik: "Topik A", impressions: 1000, reach: 9_000_000, sentiment: "negative", stats_sentiment: { positive: 7, negative: 76, neutral: 17 }, penjelasan: "..." },
      { topik: "Topik B", impressions: 500, reach: 2_000_000, sentiment: "positive", stats_sentiment: { positive: 70, negative: 10, neutral: 20 }, penjelasan: "..." },
    ],
    summary: { total_impressions: 1500, total_reach: 11_000_000, percentage: { positive: 7, negative: 76, neutral: 17 } },
    intent: [],
  },
});

const req = (fresh = false) => new Request(`http://localhost/api/v1/danantara/bumn-board${fresh ? "?fresh=1" : ""}`);

describe("GET /api/v1/danantara/bumn-board (T-A20 / AC20)", () => {
  beforeEach(() => {
    process.env.DANANTARA_TOPICS_API_BASE = "https://api.example.io/topics";
    process.env.DANANTARA_TOPICS_API_KEY = KEY;
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.DANANTARA_TOPICS_API_BASE;
    delete process.env.DANANTARA_TOPICS_API_KEY;
  });

  it("fans out to every registered BUMN and returns one row each", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      calls += 1;
      return new Response(JSON.stringify(sample()), { status: 200 });
    }));

    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.bumn).toHaveLength(BUMN_REGISTRY.length);
    expect(calls).toBe(BUMN_REGISTRY.length); // one upstream per BUMN (7-day window has topics)
    // net sentiment from summary (7 − 76), unique re-tagged ids
    expect(body.bumn[0].sentiment).toBe(-69);
    expect(body.issues.every((i: { relatedBumn: string[] }) => i.relatedBumn.length === 1)).toBe(true);
  });

  it("caps the in-flight upstream fan-out so a big roster can't hammer the upstream (T19 / AC1 v7.0)", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5)); // hold the slot so calls overlap
      inFlight -= 1;
      return new Response(JSON.stringify(sample()), { status: 200 });
    }));

    const res = await GET(req());
    const body = await res.json();
    expect(body.bumn).toHaveLength(BUMN_REGISTRY.length); // every BUMN still produced
    expect(BUMN_REGISTRY.length).toBeGreaterThan(8); // guard: the cap is actually exercised
    expect(maxInFlight).toBeLessThanOrEqual(8); // never more than the cap at once
  });

  it("never leaks the api key in the response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(sample()), { status: 200 })));
    const res = await GET(req());
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain(KEY);
  });

  it("returns 503 when the feed is not configured", async () => {
    delete process.env.DANANTARA_TOPICS_API_KEY;
    const res = await GET(req());
    expect(res.status).toBe(503);
  });

  it("returns 502 when every BUMN feed fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 500 })));
    const res = await GET(req());
    expect(res.status).toBe(502);
  });
});
