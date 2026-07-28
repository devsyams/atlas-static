import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ThreatsApiResponse } from "./ceo/threats-source";
import { fetchThreatsForCode, ThreatsNotConfiguredError } from "./threats-feed";

const SAMPLE: ThreatsApiResponse = {
  success: true,
  status_code: 200,
  meta: { topic: "danantara_main" },
  data: {
    stats: { total_threats: 1, high_severity: 1, medium_severity: 0, low_severity: 0 },
    threats: [
      {
        id: "t1",
        severity_class: "high",
        severity: 8,
        title: "Tuduhan Manipulasi Keuangan",
        intelligence: "",
        impact: "",
        threat_type: "internal_negative",
        posts_count: 1,
        growth_rate: "+15%",
        total_engagement: 1,
        platforms: ["twitter"],
        trending_keywords: [],
        time_to_viral: 24,
        recommended_actions: [],
        top_impact_posts: [],
      },
    ],
  },
};

const KEY = "SECRET-KEY";

describe("fetchThreatsForCode (A10 v5.0)", () => {
  beforeEach(() => {
    process.env.DANANTARA_TOPICS_API_KEY = KEY;
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.DANANTARA_TOPICS_API_KEY;
    delete process.env.DANANTARA_THREATS_API_BASE;
  });

  it("throws ThreatsNotConfiguredError when no api key is configured (503 path)", async () => {
    delete process.env.DANANTARA_TOPICS_API_KEY;
    await expect(fetchThreatsForCode("danantara_main")).rejects.toBeInstanceOf(ThreatsNotConfiguredError);
  });

  it("maps a successful upstream; sends topic + reused topics key; caches 6h by default", async () => {
    let calledUrl = "";
    let calledInit: RequestInit | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calledUrl = String(url);
        calledInit = init;
        return new Response(JSON.stringify(SAMPLE), { status: 200 });
      }),
    );

    const r = await fetchThreatsForCode("danantara_main");
    expect(r.threats).toHaveLength(1);
    expect(r.threats[0].title).toBe("Tuduhan Manipulasi Keuangan");
    expect(r.stats.total_threats).toBe(1);
    expect(calledUrl).toContain("topic=danantara_main");
    expect(calledUrl).toContain(`api_key=${KEY}`);
    expect(calledInit).toEqual({ next: { revalidate: 21600 } });
  });

  it("bypasses the data cache on ?fresh=1", async () => {
    let calledInit: RequestInit | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (...args: unknown[]) => {
        calledInit = args[1] as RequestInit | undefined;
        return new Response(JSON.stringify(SAMPLE), { status: 200 });
      }),
    );
    await fetchThreatsForCode("danantara_main", { fresh: true });
    expect(calledInit).toEqual({ cache: "no-store" });
  });

  it("throws on a malformed payload (no threats array)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ success: false }), { status: 200 })));
    await expect(fetchThreatsForCode("danantara_main")).rejects.toThrow();
  });

  it("throws on an upstream non-OK status", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 500 })));
    await expect(fetchThreatsForCode("danantara_main")).rejects.toThrow();
  });
});
