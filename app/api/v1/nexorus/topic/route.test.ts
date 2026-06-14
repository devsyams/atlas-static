import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const KEY = "SUPER-SECRET-NEXORUS-KEY";
const GEN_BASE = "https://nexorus.example.io/autologin/autologin_generate";
const DASH_BASE = "https://nexorus.example.io/dashboard_demo";
// NextResponse.redirect normalizes the bare origin with a trailing slash.
const FALLBACK = "https://nexorus.example.io/";
const LOGIN_URL = "https://nexorus.example.io/autologin/autologin_login?token=abc123";

/** Request to the route with a raw query string, signed in by default. */
const req = (query = "", cookie: string | null = "atlas_auth=1") =>
  new Request(`http://localhost/api/v1/nexorus/topic${query}`, {
    headers: cookie === null ? {} : { cookie },
  });

const okUpstream = () =>
  new Response(JSON.stringify({ ok: true, login_url: LOGIN_URL, expires_in: 60 }), { status: 200 });

describe("GET /api/v1/nexorus/topic (P8 v2.0 — dashboard deep link)", () => {
  beforeEach(() => {
    process.env.NEXORUS_DASHBOARD_AUTOLOGIN_BASE = GEN_BASE;
    process.env.NEXORUS_DASHBOARD_BASE = DASH_BASE;
    process.env.NEXORUS_DASHBOARD_API_KEY = KEY;
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete process.env.NEXORUS_DASHBOARD_AUTOLOGIN_BASE;
    delete process.env.NEXORUS_DASHBOARD_BASE;
    delete process.env.NEXORUS_DASHBOARD_API_KEY;
    delete process.env.DANANTARA_TOPICS_API_KEY;
  });

  it("mints the magic link and 307s to it with a redirect to the topic (T7 / AC7)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => okUpstream()));

    const res = await GET(req("?idquery=68ca1a83408aa"));

    expect(res.status).toBe(307);
    const loc = res.headers.get("location") ?? "";
    expect(loc.startsWith(LOGIN_URL)).toBe(true);
    // The post-login destination is carried as an (encoded) redirect param.
    const target = `${DASH_BASE}?id=monitoring&idquery=68ca1a83408aa`;
    expect(loc).toContain(`redirect=${encodeURIComponent(target)}`);
  });

  it("sends the api_key upstream but never leaks it to the browser (AC4)", async () => {
    let calledUrl = "";
    vi.stubGlobal("fetch", vi.fn(async (url: string) => { calledUrl = String(url); return okUpstream(); }));

    const res = await GET(req("?idquery=68ca1a83408aa"));
    expect(calledUrl).toContain(`api_key=${KEY}`);
    const headers = JSON.stringify(Object.fromEntries(res.headers.entries()));
    expect(headers).not.toContain(KEY);
    expect(res.headers.get("location")).not.toContain(KEY);
  });

  it("falls back to DANANTARA_TOPICS_API_KEY when no dashboard key is set", async () => {
    delete process.env.NEXORUS_DASHBOARD_API_KEY;
    process.env.DANANTARA_TOPICS_API_KEY = "sbz_shared";
    let calledUrl = "";
    vi.stubGlobal("fetch", vi.fn(async (url: string) => { calledUrl = String(url); return okUpstream(); }));

    await GET(req("?idquery=68ca1a83408aa"));
    expect(calledUrl).toContain("api_key=sbz_shared");
  });

  it.each([
    ["missing idquery", "?"],
    ["empty idquery", "?idquery="],
    ["invalid charset", "?idquery=" + encodeURIComponent("../evil")],
    ["injection attempt", "?idquery=" + encodeURIComponent("a&x=http://evil")],
  ])("logs in without a topic redirect for %s (no open redirect; AC8,AC9)", async (_label, query) => {
    vi.stubGlobal("fetch", vi.fn(async () => okUpstream()));

    const res = await GET(req(query));
    expect(res.status).toBe(307);
    const loc = res.headers.get("location") ?? "";
    // Still logs the user in (lands on the magic link) but carries no topic redirect.
    expect(loc.startsWith(LOGIN_URL)).toBe(true);
    expect(loc).not.toContain("redirect=");
    expect(loc).not.toContain("evil");
  });

  it.each([
    ["network error", () => Promise.reject(new Error("ECONNREFUSED"))],
    ["timeout", () => Promise.reject(new DOMException("timeout", "TimeoutError"))],
    ["non-200", async () => new Response("nope", { status: 500 })],
    ["ok:false", async () => new Response(JSON.stringify({ ok: false }), { status: 200 })],
    ["missing login_url", async () => new Response(JSON.stringify({ ok: true }), { status: 200 })],
    ["non-JSON", async () => new Response("<html>", { status: 200 })],
  ])("falls back to the dashboard home on %s (AC3)", async (_label, impl) => {
    vi.stubGlobal("fetch", vi.fn(impl));

    const res = await GET(req("?idquery=68ca1a83408aa"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(FALLBACK);
  });

  it("falls back when no api key is configured at all (AC3)", async () => {
    delete process.env.NEXORUS_DASHBOARD_API_KEY;
    const fetchMock = vi.fn(async () => okUpstream());
    vi.stubGlobal("fetch", fetchMock);

    const res = await GET(req("?idquery=68ca1a83408aa"));
    expect(res.headers.get("location")).toBe(FALLBACK);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("redirects to /login without an ATLAS session, never touching upstream (AC5)", async () => {
    const fetchMock = vi.fn(async () => okUpstream());
    vi.stubGlobal("fetch", fetchMock);

    for (const cookie of [null, "atlas_auth=0", "other=1"]) {
      const res = await GET(req("?idquery=68ca1a83408aa", cookie));
      expect(res.status).toBe(307);
      expect(new URL(res.headers.get("location") ?? "").pathname).toBe("/login");
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
