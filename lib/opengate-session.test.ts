import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { hasOpengateSession, OPENGATE_SESSION_COOKIE, signOpengateSessionCookie } from "./opengate-session";

const SECRET = "dedicated-danantara-sso-secret-value";

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
      typ: "opengate-session" as const,
      iss: "opengate" as const,
      aud: "danantara" as const,
      iat,
      exp: iat + 86400,
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
        typ: "opengate-session" as const,
        iss: "someone-else" as unknown as "opengate",
        aud: "danantara" as const,
        iat,
        exp: iat + 86400,
        sub: "og-user-42",
        email: "ceo@danantara.id",
        scope: "danantara" as const,
      },
      SECRET,
    );
    await expect(hasOpengateSession(cookieStore(bad), SECRET)).resolves.toBe(false);
  });

  it("rejects an expired signed cookie", async () => {
    const iat = Math.floor(Date.now() / 1000) - 120;
    const expired = await signOpengateSessionCookie(
      {
        typ: "opengate-session" as const,
        iss: "opengate" as const,
        aud: "danantara" as const,
        iat,
        exp: iat + 60,
        sub: "og-user-42",
        email: "ceo@danantara.id",
        scope: "danantara" as const,
      },
      SECRET,
    );
    await expect(hasOpengateSession(cookieStore(expired), SECRET)).resolves.toBe(false);
  });
});
