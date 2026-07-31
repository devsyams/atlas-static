import { describe, expect, it } from "vitest";

import {
  scopeFromClaims,
  signSsoToken,
  verifySsoToken,
  type SsoClaims,
} from "./sso-token";

const SECRET = "dedicated-danantara-sso-secret-value";
const NOW = 1_753_900_000_000; // fixed "now" in ms for deterministic exp checks

/** A valid claim set per the locked contract, exp = iat + 120s. */
function claims(overrides: Partial<SsoClaims> = {}): SsoClaims {
  const iat = Math.floor(NOW / 1000);
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

describe("verifySsoToken (P9)", () => {
  it("accepts a valid, unexpired HS256 token and returns its claims (T1/AC1/AC6)", async () => {
    const token = await signSsoToken(claims(), SECRET);
    const result = await verifySsoToken(token, SECRET, NOW);

    expect(result.valid).toBe(true);
    if (!result.valid) throw new Error("expected valid");
    expect(result.claims.sub).toBe("og-user-42");
    expect(result.claims.email).toBe("ceo@danantara.id");
    expect(result.claims.scope).toBe("danantara");
    expect(result.claims.aud).toBe("danantara");
  });

  it("rejects an expired token (exp passed) (T2/AC5)", async () => {
    const token = await signSsoToken(claims(), SECRET);
    // 121s later — one second past the 120s window.
    const result = await verifySsoToken(token, SECRET, NOW + 121_000);

    expect(result.valid).toBe(false);
    if (result.valid) throw new Error("expected invalid");
    expect(result.reason).toBe("expired");
  });

  it("rejects a token signed with a different secret (T3/AC2)", async () => {
    const token = await signSsoToken(claims(), "some-other-secret");
    const result = await verifySsoToken(token, SECRET, NOW);

    expect(result.valid).toBe(false);
    if (result.valid) throw new Error("expected invalid");
    expect(result.reason).toBe("bad-signature");
  });

  it("rejects a token whose payload was tampered after signing (T3/AC2)", async () => {
    const token = await signSsoToken(claims(), SECRET);
    const [header, payload, sig] = token.split(".");
    // Swap in a different (attacker-chosen) payload while keeping the signature.
    const forgedPayload = Buffer.from(
      JSON.stringify(claims({ sub: "attacker", email: "evil@x.io" })),
    ).toString("base64url");
    expect(forgedPayload).not.toBe(payload);
    const forged = `${header}.${forgedPayload}.${sig}`;

    const result = await verifySsoToken(forged, SECRET, NOW);
    expect(result.valid).toBe(false);
    if (result.valid) throw new Error("expected invalid");
    expect(result.reason).toBe("bad-signature");
  });

  it("rejects a token whose audience is not 'danantara' (T4/AC2)", async () => {
    const token = await signSsoToken(claims({ aud: "someone-else" }), SECRET);
    const result = await verifySsoToken(token, SECRET, NOW);

    expect(result.valid).toBe(false);
    if (result.valid) throw new Error("expected invalid");
    expect(result.reason).toBe("bad-audience");
  });

  it("rejects a token whose alg is not HS256, including 'none' (T4/AC2)", async () => {
    // Hand-craft an alg:none token (no signature) — the classic bypass attempt.
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify(claims())).toString("base64url");
    const noneToken = `${header}.${payload}.`;

    const result = await verifySsoToken(noneToken, SECRET, NOW);
    expect(result.valid).toBe(false);
    if (result.valid) throw new Error("expected invalid");
    expect(result.reason).toBe("bad-alg");
  });

  it("rejects a structurally malformed token (T4/AC2)", async () => {
    const result = await verifySsoToken("not-a-jwt", SECRET, NOW);
    expect(result.valid).toBe(false);
    if (result.valid) throw new Error("expected invalid");
    expect(result.reason).toBe("malformed");
  });

  it("rejects when the secret is unset (fails closed) (T5/AC3)", async () => {
    const token = await signSsoToken(claims(), SECRET);
    const result = await verifySsoToken(token, undefined, NOW);

    expect(result.valid).toBe(false);
    if (result.valid) throw new Error("expected invalid");
    expect(result.reason).toBe("no-secret");
  });

  it("rejects when no token is supplied (T5/AC2)", async () => {
    const result = await verifySsoToken(null, SECRET, NOW);
    expect(result.valid).toBe(false);
    if (result.valid) throw new Error("expected invalid");
    expect(result.reason).toBe("no-token");
  });

  it("rejects a token with a missing/non-numeric exp (T2/AC5)", async () => {
    const bad = { ...claims() } as Record<string, unknown>;
    delete bad.exp;
    const token = await signSsoToken(bad as unknown as SsoClaims, SECRET);
    const result = await verifySsoToken(token, SECRET, NOW);

    expect(result.valid).toBe(false);
    if (result.valid) throw new Error("expected invalid");
    expect(result.reason).toBe("no-exp");
  });
});

describe("scopeFromClaims (P9)", () => {
  it("returns the scope claim when present (T6/AC6)", () => {
    expect(scopeFromClaims(claims({ scope: "danantara" }))).toBe("danantara");
  });

  it("defaults to 'danantara' when the scope claim is absent or empty (T6/AC6)", () => {
    expect(scopeFromClaims(claims({ scope: "" }))).toBe("danantara");
    const noScope = { ...claims() } as Record<string, unknown>;
    delete noScope.scope;
    expect(scopeFromClaims(noScope as unknown as SsoClaims)).toBe("danantara");
  });
});
