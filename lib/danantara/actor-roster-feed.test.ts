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
    process.env.DANANTARA_TOPICS_API_KEY = KEY;
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.DANANTARA_TOPICS_API_KEY;
    delete process.env.DANANTARA_ACTORS_API_BASE;
  });

  it("throws ActorRosterNotConfiguredError when no api key is configured", async () => {
    delete process.env.DANANTARA_TOPICS_API_KEY;
    await expect(fetchActorRosterForCode("danantara_main")).rejects.toBeInstanceOf(ActorRosterNotConfiguredError);
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
