import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { signSsoToken, type SsoClaims } from "@/lib/sso-token";
import { GET } from "./route";

const SECRET = "dedicated-danantara-sso-secret-value";

/** Fresh claims relative to the real clock (the route verifies at Date.now()). */
function claims(overrides: Partial<SsoClaims> = {}): SsoClaims {
  const iat = Math.floor(Date.now() / 1000);
  return {
    iss: "opengate",
    aud: "danantara",
    iat,
    exp: iat + 120,
    sub: "og-user-42",
    email: "ceo@danantara.id",
    scope: "danantara",
    ...overrides,
  };
}

const req = (token: string | null) =>
  new Request(
    token === null
      ? "http://localhost/api/v1/sso"
      : `http://localhost/api/v1/sso?token=${encodeURIComponent(token)}`,
  );

/** Location pathname of a redirect response. */
const loc = (res: Response) => new URL(res.headers.get("location") ?? "").pathname;

describe("GET /api/v1/sso (P9)", () => {
  beforeEach(() => {
    process.env.DANANTARA_SSO_SECRET = SECRET;
  });
  afterEach(() => {
    delete process.env.DANANTARA_SSO_SECRET;
  });

  it("establishes a session and 302s to the scope home on a valid token (T7/AC1/AC4/AC6)", async () => {
    const token = await signSsoToken(claims(), SECRET);
    const res = await GET(req(token));

    expect(res.status).toBe(302);
    expect(loc(res)).toBe("/danantara/krisis");

    const auth = res.cookies.get("atlas_auth");
    const scope = res.cookies.get("atlas_scope");
    expect(auth?.value).toBe("1");
    expect(scope?.value).toBe("danantara");

    // Cookie attributes locked with the OpenGate team.
    for (const c of [auth, scope]) {
      expect(c?.httpOnly).toBe(true);
      expect(c?.path).toBe("/");
      expect(c?.sameSite).toBe("lax");
    }

    // Double-check the serialized Set-Cookie headers carry the parity attributes.
    const raw = res.headers.getSetCookie();
    expect(raw.some((h) => /atlas_auth=1;/.test(h) && /HttpOnly/i.test(h) && /SameSite=Lax/i.test(h) && /Path=\//.test(h))).toBe(true);
  });

  it("defaults atlas_scope to 'danantara' when the token omits scope (T10/AC6)", async () => {
    const noScope = { ...claims() } as Record<string, unknown>;
    delete noScope.scope;
    const token = await signSsoToken(noScope as unknown as SsoClaims, SECRET);
    const res = await GET(req(token));

    expect(res.status).toBe(302);
    expect(loc(res)).toBe("/danantara/krisis");
    expect(res.cookies.get("atlas_scope")?.value).toBe("danantara");
  });

  it.each([
    ["expired", async () => signSsoToken(claims({ exp: Math.floor(Date.now() / 1000) - 10 }), SECRET)],
    ["wrong-secret", async () => signSsoToken(claims(), "not-the-shared-secret")],
    ["wrong-audience", async () => signSsoToken(claims({ aud: "someone-else" }), SECRET)],
    ["garbage", async () => "not-a-jwt"],
  ])("302s to /login and sets no session cookies on a %s token (T8/AC2/AC5)", async (_label, mk) => {
    const token = await mk();
    const res = await GET(req(token));

    expect(res.status).toBe(302);
    expect(loc(res)).toBe("/login");
    expect(res.cookies.get("atlas_auth")).toBeUndefined();
    expect(res.cookies.get("atlas_scope")).toBeUndefined();
    expect(res.headers.getSetCookie()).toHaveLength(0);
  });

  it("302s to /login when no token param is present (T8/AC2)", async () => {
    const res = await GET(req(null));
    expect(res.status).toBe(302);
    expect(loc(res)).toBe("/login");
    expect(res.headers.getSetCookie()).toHaveLength(0);
  });

  it("fails closed to /login when DANANTARA_SSO_SECRET is unset (T9/AC3)", async () => {
    delete process.env.DANANTARA_SSO_SECRET;
    // Token is otherwise valid, but with no secret configured we cannot verify it.
    const token = await signSsoToken(claims(), SECRET);
    const res = await GET(req(token));

    expect(res.status).toBe(302);
    expect(loc(res)).toBe("/login");
    expect(res.cookies.get("atlas_auth")).toBeUndefined();
    expect(res.headers.getSetCookie()).toHaveLength(0);
  });
});
