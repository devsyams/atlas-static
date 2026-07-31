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
    process.env.DANANTARA_TOPICS_API_KEY = KEY; // the shared key the route now reads
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

  it("uses DANANTARA_TOPICS_API_KEY and ignores any OPENGATE_API_KEY (Vercel key-drift fix, v3.2)", async () => {
    process.env.OPENGATE_API_KEY = "stale-wrong-key-on-vercel"; // must NOT be used
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
    expect(calledUrl).not.toContain("stale-wrong-key-on-vercel");
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
    delete process.env.DANANTARA_TOPICS_API_KEY;
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
      // Relative Location — host-safe behind the ingress (v3.3 bugfix).
      expect(res.headers.get("location")).toBe("/login");
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("emits a host-safe relative /login redirect when req.url host is the in-container bind (v3.3 bugfix)", async () => {
    const fetchMock = vi.fn(async () => okUpstream());
    vi.stubGlobal("fetch", fetchMock);
    // Prod ingress: req.url host is 0.0.0.0:3000, not the public host. Building the
    // redirect from req.url leaked that bind (https://0.0.0.0:3000/login); it must
    // now be a relative path the browser resolves against the public URL.
    const res = await GET(
      new Request("http://0.0.0.0:3000/api/v1/opengate/autologin", { headers: {} }),
    );
    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location).toBe("/login");
    expect(location).not.toContain("://");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
