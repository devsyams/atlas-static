import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { revalidateTag } from "next/cache";

vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));
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

/** A hollow window: empty `threats` list but a non-zero severity stat — the real
 *  transient the upstream serves while slow/recomputing. */
const EMPTY: ThreatsApiResponse = {
  success: true,
  status_code: 200,
  meta: { topic: "danantara_main" },
  data: { stats: { total_threats: 0, high_severity: 1, medium_severity: 0, low_severity: 0 }, threats: [] },
};

const KEY = "SECRET-KEY";

describe("fetchThreatsForCode (A10 v5.0)", () => {
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

  it("throws ThreatsNotConfiguredError when no api key is configured (503 path)", async () => {
    delete process.env.DANANTARA_TOPICS_API_KEY;
    await expect(fetchThreatsForCode("danantara_main")).rejects.toBeInstanceOf(ThreatsNotConfiguredError);
  });

  it("throws ThreatsNotConfiguredError when no base is configured, even with a key — T23 (A10 v6.0)", async () => {
    // TrawlDeck cutover: the GARUDA default base is retired; without an explicit
    // base the feed must report not-configured, never fetch a hardcoded host.
    delete process.env.DANANTARA_INTELLIGENCE_BASE_URL;
    delete process.env.BGN_INTELLIGENCE_BASE_URL;
    delete process.env.BGN_INTELLIGENCE_API_KEY;
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(SAMPLE), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchThreatsForCode("1")).rejects.toBeInstanceOf(ThreatsNotConfiguredError);
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

    await fetchThreatsForCode("1", { product: "bgn" });

    expect(calledUrl).toContain("https://trawldeck.example.io/atlas/v1/threats?");
    expect(calledUrl).toContain("api_key=tdk_bgn");
    expect(calledUrl).not.toContain("api.example.io");
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
    expect(calledInit).toEqual({ next: { revalidate: 21600, tags: ["danantara-threats"] } });
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
    // A10 v11.1: fresh also evicts the 6 h cache, not just bypasses it.
    expect(revalidateTag).toHaveBeenCalledWith("danantara-threats", "max");
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

describe("fetchThreatsForCode — stale-empty self-heal (A10 v5.2 — T20)", () => {
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

  /** A fetch mock returning the i-th payload in `seq` (the last repeats), recording each call's init. */
  function seqFetch(seq: ThreatsApiResponse[]) {
    let i = 0;
    const inits: (RequestInit | undefined)[] = [];
    const fn = vi.fn(async (...args: unknown[]) => {
      inits.push(args[1] as RequestInit | undefined);
      const r = seq[Math.min(i, seq.length - 1)];
      i += 1;
      return new Response(JSON.stringify(r), { status: 200 });
    });
    return { fn, inits };
  }

  it("self-heals a cached/transient hollow: re-confirms live and prefers the live threats", async () => {
    const { fn, inits } = seqFetch([EMPTY, SAMPLE]); // cacheable hollow → the live upstream has a threat
    vi.stubGlobal("fetch", fn);

    const r = await fetchThreatsForCode("danantara_main");
    expect(r.threats).toHaveLength(1); // live data shown, not the cached hollow
    expect(inits[0]).toEqual({ next: { revalidate: 21600, tags: ["danantara-threats"] } }); // primary path is cacheable (6 h)
    expect(inits).toContainEqual({ cache: "no-store" }); // a live confirm happened
  });

  it("leaves a genuinely empty feed empty (no fabricated threats) after confirming live", async () => {
    const { fn, inits } = seqFetch([EMPTY]); // cacheable and live both empty
    vi.stubGlobal("fetch", fn);

    const r = await fetchThreatsForCode("danantara_main");
    expect(r.threats).toHaveLength(0);
    expect(fn).toHaveBeenCalledTimes(2); // cacheable, then one live confirm
    expect(inits).toContainEqual({ cache: "no-store" });
  });

  it("on ?fresh=1 the path is already live, so it adds no redundant confirm", async () => {
    const { fn } = seqFetch([EMPTY]);
    vi.stubGlobal("fetch", fn);

    const r = await fetchThreatsForCode("danantara_main", { fresh: true });
    expect(r.threats).toHaveLength(0);
    expect(fn).toHaveBeenCalledTimes(1); // no extra confirm
  });

  it("does not add a live confirm when the cacheable window already has threats", async () => {
    const { fn } = seqFetch([SAMPLE]);
    vi.stubGlobal("fetch", fn);

    const r = await fetchThreatsForCode("danantara_main");
    expect(r.threats).toHaveLength(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
