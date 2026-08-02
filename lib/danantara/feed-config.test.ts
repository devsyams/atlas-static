import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { feedProductFromParams, resolveFeedEndpoint, resolveTopicCode } from "./feed-config";

/**
 * Per-product feed config (A7 v50.0 / A10 v11.0). `/danantara` (+ BUMN board) reads the
 * Danantara product; `/bgn/command` sends `?bgn=1` and reads the BGN product. Each product
 * has its own base URL + key + topic code; the endpoint suffix (`/topics` `/threats`
 * `/actor-intelligence`) is appended in code, since both upstreams share it.
 */

const params = (qs: string) => new URL(`https://x/api?${qs}`).searchParams;

describe("feedProductFromParams", () => {
  it("selects the BGN product only for ?bgn=1", () => {
    expect(feedProductFromParams(params("bgn=1"))).toBe("bgn");
  });

  it("defaults to the Danantara product otherwise", () => {
    expect(feedProductFromParams(params(""))).toBe("danantara");
    expect(feedProductFromParams(params("bgn=0"))).toBe("danantara");
    expect(feedProductFromParams(params("bgn=true"))).toBe("danantara");
    expect(feedProductFromParams(params("mock=1"))).toBe("danantara");
  });
});

describe("resolveFeedEndpoint", () => {
  beforeEach(() => {
    process.env.DANANTARA_INTELLIGENCE_BASE_URL = "https://api.garudaperkasa.io/api-nexorus";
    process.env.DANANTARA_TOPICS_API_KEY = "sbz_danantara";
    process.env.BGN_INTELLIGENCE_BASE_URL = "https://trawldeck.atlas.nexorus-alpha.io/atlas/v1";
    process.env.BGN_INTELLIGENCE_API_KEY = "tdk_bgn";
  });
  afterEach(() => {
    delete process.env.DANANTARA_INTELLIGENCE_BASE_URL;
    delete process.env.DANANTARA_TOPICS_API_KEY;
    delete process.env.BGN_INTELLIGENCE_BASE_URL;
    delete process.env.BGN_INTELLIGENCE_API_KEY;
  });

  it("appends the endpoint suffix to the Danantara product base + its key", () => {
    expect(resolveFeedEndpoint("danantara", "topics")).toEqual({
      base: "https://api.garudaperkasa.io/api-nexorus/topics",
      apiKey: "sbz_danantara",
    });
    expect(resolveFeedEndpoint("danantara", "threats")?.base).toBe(
      "https://api.garudaperkasa.io/api-nexorus/threats",
    );
    expect(resolveFeedEndpoint("danantara", "actor-intelligence")?.base).toBe(
      "https://api.garudaperkasa.io/api-nexorus/actor-intelligence",
    );
  });

  it("reads the BGN product's own base + key for ?bgn=1 callers", () => {
    expect(resolveFeedEndpoint("bgn", "topics")).toEqual({
      base: "https://trawldeck.atlas.nexorus-alpha.io/atlas/v1/topics",
      apiKey: "tdk_bgn",
    });
  });

  it("trims a trailing slash on the base before appending the suffix", () => {
    process.env.DANANTARA_INTELLIGENCE_BASE_URL = "https://api.garudaperkasa.io/api-nexorus/";
    expect(resolveFeedEndpoint("danantara", "topics")?.base).toBe(
      "https://api.garudaperkasa.io/api-nexorus/topics",
    );
  });

  it("returns null when the product's base is unset (→ caller's 503)", () => {
    delete process.env.DANANTARA_INTELLIGENCE_BASE_URL;
    expect(resolveFeedEndpoint("danantara", "topics")).toBeNull();
  });

  it("returns null when the product's key is unset", () => {
    delete process.env.BGN_INTELLIGENCE_API_KEY;
    expect(resolveFeedEndpoint("bgn", "topics")).toBeNull();
  });

  it("does not cross the wires — the BGN key never leaks into the Danantara product", () => {
    delete process.env.DANANTARA_TOPICS_API_KEY; // Danantara key missing, BGN key present
    expect(resolveFeedEndpoint("danantara", "topics")).toBeNull();
  });
});

describe("resolveTopicCode", () => {
  afterEach(() => {
    delete process.env.DANANTARA_TOPIC_CODE;
    delete process.env.BGN_TOPIC_CODE;
  });

  it("uses the Danantara env code by default", () => {
    process.env.DANANTARA_TOPIC_CODE = "danantara_main";
    expect(resolveTopicCode(params(""), "danantara")).toBe("danantara_main");
  });

  it("uses the BGN env code for the BGN product", () => {
    process.env.BGN_TOPIC_CODE = "1";
    expect(resolveTopicCode(params("bgn=1"), "bgn")).toBe("1");
  });

  it("honors an allowlisted ?code= override (BUMN dashboards)", () => {
    process.env.DANANTARA_TOPIC_CODE = "danantara_main";
    expect(resolveTopicCode(params("code=danantara_mandiri"), "danantara")).toBe("danantara_mandiri");
  });

  it("ignores a non-allowlisted ?code= and falls back to the product env code", () => {
    process.env.DANANTARA_TOPIC_CODE = "danantara_main";
    expect(resolveTopicCode(params("code=evil_open_proxy"), "danantara")).toBe("danantara_main");
  });

  it("falls back to danantara_main when the product code env is unset", () => {
    expect(resolveTopicCode(params(""), "danantara")).toBe("danantara_main");
    expect(resolveTopicCode(params("bgn=1"), "bgn")).toBe("danantara_main");
  });
});
