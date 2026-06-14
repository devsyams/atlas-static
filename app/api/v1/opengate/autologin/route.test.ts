import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const KEY = "SUPER-SECRET-OPENGATE-KEY";
const BASE = "https://opengate.example.io/autologin/autologin_generate";
// NextResponse.redirect normalizes the bare origin with a trailing slash.
const FALLBACK = "https://opengate.nexorus.io/";
const LOGIN_URL = "https://opengate.nexorus.io/autologin/consume?token=abc123";

/** Build a request to the route, signed in by default (atlas_auth=1). */
const req = (cookie: string | null = "atlas_auth=1") =>
  new Request("http://localhost/api/v1/opengate/autologin", {
    headers: cookie === null ? {} : { cookie },
  });

const okUpstream = () =>
  new Response(JSON.stringify({ ok: true, login_url: LOGIN_URL, expires_in: 60 }), {
    status: 200,
  });

describe("GET /api/v1/opengate/autologin (P8)", () => {
  beforeEach(() => {
    process.env.OPENGATE_AUTOLOGIN_BASE = BASE;
    process.env.OPENGATE_API_KEY = KEY;
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete process.env.OPENGATE_AUTOLOGIN_BASE;
    delete process.env.OPENGATE_API_KEY;
    delete process.env.DANANTARA_TOPICS_API_KEY;
  });

  it("redirects to the upstream login_url on success (T2 / AC2)", async () => {
    const fetchMock = vi.fn(async () => okUpstream());
    vi.stubGlobal("fetch", fetchMock);

    const res = await GET(req());
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(LOGIN_URL);
  });

  it("falls back to DANANTARA_TOPICS_API_KEY when OPENGATE_API_KEY is unset (T2 / AC2)", async () => {
    delete process.env.OPENGATE_API_KEY;
    process.env.DANANTARA_TOPICS_API_KEY = "sbz_shared";
    let calledUrl = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calledUrl = String(url);
        return okUpstream();
      }),
    );

    const res = await GET(req());
    expect(calledUrl).toContain("api_key=sbz_shared");
    expect(res.headers.get("location")).toBe(LOGIN_URL);
  });

  it.each([
    ["upstream network error", () => Promise.reject(new Error("ECONNREFUSED"))],
    ["upstream timeout", () => Promise.reject(new DOMException("timeout", "TimeoutError"))],
    ["non-200 upstream", async () => new Response("nope", { status: 500 })],
    [
      "ok: false",
      async () => new Response(JSON.stringify({ ok: false }), { status: 200 }),
    ],
    [
      "missing login_url",
      async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    ],
    [
      "non-JSON body",
      async () => new Response("<html>err</html>", { status: 200 }),
    ],
  ])("falls back to the OpenGate login page on %s (T3 / AC3)", async (_label, impl) => {
    vi.stubGlobal("fetch", vi.fn(impl));

    const res = await GET(req());
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(FALLBACK);
  });

  it("falls back when no api key is configured at all (T3 / AC3)", async () => {
    delete process.env.OPENGATE_API_KEY;
    const fetchMock = vi.fn(async () => okUpstream());
    vi.stubGlobal("fetch", fetchMock);

    const res = await GET(req());
    expect(res.headers.get("location")).toBe(FALLBACK);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the api_key upstream but never leaks it to the browser (T4 / AC4)", async () => {
    let calledUrl = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calledUrl = String(url);
        return okUpstream();
      }),
    );

    const res = await GET(req());
    expect(calledUrl).toContain(`api_key=${KEY}`); // sent server-side
    const headers = JSON.stringify(Object.fromEntries(res.headers.entries()));
    expect(headers).not.toContain(KEY);
    expect(await res.text()).not.toContain(KEY);
  });

  it("redirects to /login without an ATLAS session, never touching upstream (T5 / AC5)", async () => {
    const fetchMock = vi.fn(async () => okUpstream());
    vi.stubGlobal("fetch", fetchMock);

    for (const cookie of [null, "atlas_auth=0", "other=1"]) {
      const res = await GET(req(cookie));
      expect(res.status).toBe(307);
      expect(new URL(res.headers.get("location") ?? "").pathname).toBe("/login");
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

/** Build a request to the route with a raw query string, signed in by default. */
const reqQ = (query: string, cookie: string | null = "atlas_auth=1") =>
  new Request(`http://localhost/api/v1/opengate/autologin${query}`, {
    headers: cookie === null ? {} : { cookie },
  });

const TOPIC_LOGIN_URL =
  "https://nexorus.garudaperkasa.io/dashboard_demo?id=monitoring&idquery=694368b190153";

/** Upstream that echoes whether an `idquery` was forwarded, so the test can
 * assert the route lands on a topic link only when it forwarded one. */
const echoUpstream = () =>
  vi.fn(async (url: string) => {
    const idq = new URL(String(url)).searchParams.get("idquery");
    return new Response(
      JSON.stringify({ ok: true, login_url: idq ? TOPIC_LOGIN_URL : LOGIN_URL }),
      { status: 200 },
    );
  });

describe("GET /api/v1/opengate/autologin — per-topic deep link (P8 v2.0)", () => {
  beforeEach(() => {
    process.env.OPENGATE_AUTOLOGIN_BASE = BASE;
    process.env.OPENGATE_API_KEY = KEY;
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete process.env.OPENGATE_AUTOLOGIN_BASE;
    delete process.env.OPENGATE_API_KEY;
  });

  it("forwards a valid idquery upstream and lands on the topic login_url (T7 / AC7,AC9)", async () => {
    const fetchMock = echoUpstream();
    vi.stubGlobal("fetch", fetchMock);

    const res = await GET(reqQ("?idquery=694368b190153"));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(TOPIC_LOGIN_URL);
    const calledUrl = String(fetchMock.mock.calls[0][0]);
    expect(calledUrl).toContain("idquery=694368b190153");
  });

  it.each([
    ["no idquery param", "?"],
    ["empty idquery", "?idquery="],
    ["invalid charset", "?idquery=" + encodeURIComponent("../evil path")],
    ["injection attempt", "?idquery=" + encodeURIComponent("a&redirect=http://evil")],
  ])(
    "treats %s as the home link: never forwards it upstream and the value never reaches the redirect (T8 / AC9)",
    async (_label, query) => {
      const fetchMock = echoUpstream();
      vi.stubGlobal("fetch", fetchMock);

      const res = await GET(reqQ(query));

      expect(res.status).toBe(307);
      // Home behavior: upstream got no idquery, so we land on the home login_url.
      expect(res.headers.get("location")).toBe(LOGIN_URL);
      const calledUrl = String(fetchMock.mock.calls[0][0]);
      expect(calledUrl).not.toContain("idquery");
      expect(res.headers.get("location")).not.toContain("evil");
    },
  );

  it("falls back to the Nexorus/OpenGate home when the upstream fails even with an idquery (T8 / AC9)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));

    const res = await GET(reqQ("?idquery=694368b190153"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(FALLBACK);
  });
});
