import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActorRosterApiResponse } from "./ceo/actor-roster-source";
import { ActorRosterNotConfiguredError, fetchActorRosterForCode } from "./actor-roster-feed";

const SAMPLE: ActorRosterApiResponse = {
  success: true,
  status_code: 200,
  meta: { topic: "danantara_main" },
  data: [
    { username: "neg_influencer", platform: "twitter", follower_count: "1,200,000", influence_score: 9, credibility_score: 7, sentiment_score: -8, risk_level: "high", account_classification: "Negative Critic" },
  ],
};

const KEY = "SECRET-KEY";

describe("fetchActorRosterForCode (A10 v5.2)", () => {
  beforeEach(() => {
    process.env.DANANTARA_INTELLIGENCE_BASE_URL = "https://api.example.io";
    process.env.DANANTARA_TOPICS_API_KEY = KEY;
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.DANANTARA_TOPICS_API_KEY;
    delete process.env.DANANTARA_INTELLIGENCE_BASE_URL;
    delete process.env.BGN_INTELLIGENCE_BASE_URL;
    delete process.env.BGN_INTELLIGENCE_API_KEY;
  });

  it("throws ActorRosterNotConfiguredError when no api key is configured", async () => {
    delete process.env.DANANTARA_TOPICS_API_KEY;
    await expect(fetchActorRosterForCode("danantara_main")).rejects.toBeInstanceOf(ActorRosterNotConfiguredError);
  });

  it("throws ActorRosterNotConfiguredError when no base is configured, even with a key — T25 (A10 v9.0)", async () => {
    // TrawlDeck cutover: the GARUDA default base is retired; without an explicit
    // base the feed must report not-configured, never fetch a hardcoded host.
    delete process.env.DANANTARA_INTELLIGENCE_BASE_URL;
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(SAMPLE), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchActorRosterForCode("1")).rejects.toBeInstanceOf(ActorRosterNotConfiguredError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reads the BGN product's own base + key when product:'bgn' — A10 v11.0", async () => {
    process.env.BGN_INTELLIGENCE_BASE_URL = "https://trawldeck.example.io/atlas/v1";
    process.env.BGN_INTELLIGENCE_API_KEY = "tdk_bgn";
    let calledUrl = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calledUrl = String(url);
        return new Response(JSON.stringify(SAMPLE), { status: 200 });
      }),
    );

    await fetchActorRosterForCode("1", { product: "bgn" });

    expect(calledUrl).toContain("https://trawldeck.example.io/atlas/v1/actor-intelligence?");
    expect(calledUrl).toContain("api_key=tdk_bgn");
    expect(calledUrl).not.toContain("api.example.io");
  });

  it("maps a successful upstream; sends topic + reused key; caches 6h by default", async () => {
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

    const drivers = await fetchActorRosterForCode("danantara_main");
    expect(drivers).toHaveLength(1);
    expect(drivers[0].handle).toBe("neg_influencer");
    expect(drivers[0].followers).toBe(1_200_000);
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
    await fetchActorRosterForCode("danantara_main", { fresh: true });
    expect(calledInit).toEqual({ cache: "no-store" });
  });

  it("throws on a malformed payload / upstream failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ success: false }), { status: 200 })));
    await expect(fetchActorRosterForCode("danantara_main")).rejects.toThrow();

    vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 500 })));
    await expect(fetchActorRosterForCode("danantara_main")).rejects.toThrow();
  });
});
