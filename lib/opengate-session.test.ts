import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { signSsoToken, type SsoClaims } from "./sso-token";
import { hasOpengateSession, OPENGATE_SESSION_COOKIE, signOpengateSessionCookie } from "./opengate-session";

const SECRET = "dedicated-danantara-sso-secret-value";

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

function cookieStore(token?: string) {
  return {
    get(name: string) {
      return name === OPENGATE_SESSION_COOKIE && token ? { value: token } : undefined;
    },
  };
}

describe("hasOpengateSession", () => {
  beforeEach(() => {
    process.env.ATLAS_SSO_SECRET = SECRET;
  });

  afterEach(() => {
    delete process.env.ATLAS_SSO_SECRET;
  });

  it("accepts a valid signed OpenGate SSO cookie", async () => {
    const iat = Math.floor(Date.now() / 1000);
    const sessionClaims = {
      iss: "opengate" as const,
      aud: "danantara" as const,
      iat,
      sub: "og-user-42",
      email: "ceo@danantara.id",
      scope: "danantara" as const,
    };
    const token = await signOpengateSessionCookie(sessionClaims, SECRET);
    await expect(hasOpengateSession(cookieStore(token), SECRET)).resolves.toBe(true);
  });

  it("rejects a missing or invalid signed cookie", async () => {
    await expect(hasOpengateSession(cookieStore(), SECRET)).resolves.toBe(false);
    const iat = Math.floor(Date.now() / 1000);
    const bad = await signOpengateSessionCookie(
      {
        iss: "someone-else" as unknown as "opengate",
        aud: "danantara" as const,
        iat,
        sub: "og-user-42",
        email: "ceo@danantara.id",
        scope: "danantara" as const,
      },
      SECRET,
    );
    await expect(hasOpengateSession(cookieStore(bad), SECRET)).resolves.toBe(false);
  });
});
