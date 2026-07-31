/**
 * P9 — OpenGate → Danantara SSO handoff token (inbound autologin).
 *
 * A compact HS256 JWT that OpenGate mints and Danantara verifies to establish a
 * local session without a second login. Verification is **zero-dependency
 * WebCrypto** HMAC-SHA256 — available in the Node route runtime and in vitest's
 * node env — so we add no JWT library (no `jose`, no `jsonwebtoken`). The 120 s
 * `exp` is the replay guard; there is no `jti`/single-use store by contract.
 *
 * Plain TS (no React/Node-only APIs beyond WebCrypto + atob/btoa) so it could run
 * in the Edge runtime too if the endpoint ever moves.
 *
 * Contract (locked with the OpenGate/TrawlDeckCorcom team, 2026-07-31):
 *   alg    HS256, signed with ATLAS_SSO_SECRET (a DEDICATED shared secret,
 *          NOT OpenGate's AUTH_JWT_SECRET; same value sealed into both k8s envs)
 *   iss    'opengate'
 *   aud    'danantara'          (verified)
 *   iat    seconds
 *   exp    seconds = iat + 120  (verified: rejected once passed)
 *   sub    <opengate user id>
 *   email  <user email>
 *   scope  'danantara'          (→ atlas_scope; defaults to 'danantara' if absent)
 */

export interface SsoClaims {
  iss: string;
  aud: string;
  iat: number;
  exp: number;
  sub: string;
  email: string;
  scope: string;
}

/** The only audience this app accepts. */
export const SSO_AUDIENCE = "danantara";
/** atlas_scope fallback when a token omits `scope` (OpenGate always sends it). */
export const SSO_DEFAULT_SCOPE = "danantara";

type VerifyOk = { valid: true; claims: SsoClaims };
type VerifyErr = {
  valid: false;
  reason:
    | "no-secret"
    | "no-token"
    | "malformed"
    | "bad-alg"
    | "bad-signature"
    | "bad-audience"
    | "no-exp"
    | "expired";
};
export type VerifyResult = VerifyOk | VerifyErr;

const enc = new TextEncoder();
const dec = new TextDecoder();

function bytesToB64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const pad = (4 - (s.length % 4)) % 4;
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  const bin = atob(b64);
  // Allocate an explicit ArrayBuffer so the view is `Uint8Array<ArrayBuffer>`,
  // which WebCrypto's BufferSource parameter requires (not `ArrayBufferLike`).
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64urlDecodeToString(s: string): string {
  return dec.decode(b64urlToBytes(s));
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/**
 * Sign claims into an HS256 JWT. This is the reference/test signer — the live
 * signer is OpenGate — but keeping it here documents the exact wire format both
 * sides must agree on and lets our tests mint real tokens.
 */
export async function signSsoToken(claims: SsoClaims, secret: string): Promise<string> {
  const header = bytesToB64url(enc.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const payload = bytesToB64url(enc.encode(JSON.stringify(claims)));
  const data = `${header}.${payload}`;
  const key = await hmacKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
  return `${data}.${bytesToB64url(sig)}`;
}

/**
 * Verify an HS256 SSO token against `secret` at time `nowMs` (injected so tests
 * are deterministic). Checks, in order: secret present, token present, structure,
 * `alg === 'HS256'` (blocks `alg:none` / algorithm-confusion), signature,
 * `aud === 'danantara'`, and `exp` not passed. Returns the claims only on full
 * success; every failure carries a `reason` and sets no trust.
 */
export async function verifySsoToken(
  token: string | null | undefined,
  secret: string | undefined,
  nowMs: number,
): Promise<VerifyResult> {
  if (!secret) return { valid: false, reason: "no-secret" };
  if (!token) return { valid: false, reason: "no-token" };

  const parts = token.split(".");
  if (parts.length !== 3 || !parts[0] || !parts[1]) return { valid: false, reason: "malformed" };
  const [headerB64, payloadB64, sigB64] = parts;

  let header: { alg?: string };
  let claims: SsoClaims;
  try {
    header = JSON.parse(b64urlDecodeToString(headerB64)) as { alg?: string };
    claims = JSON.parse(b64urlDecodeToString(payloadB64)) as SsoClaims;
  } catch {
    return { valid: false, reason: "malformed" };
  }

  // Pin the algorithm BEFORE touching the signature so `alg:none` and asymmetric
  // algorithm-confusion attempts are rejected outright.
  if (header.alg !== "HS256") return { valid: false, reason: "bad-alg" };

  let signatureOk = false;
  try {
    const key = await hmacKey(secret);
    signatureOk = await crypto.subtle.verify(
      "HMAC",
      key,
      b64urlToBytes(sigB64),
      enc.encode(`${headerB64}.${payloadB64}`),
    );
  } catch {
    return { valid: false, reason: "bad-signature" };
  }
  if (!signatureOk) return { valid: false, reason: "bad-signature" };

  if (claims.aud !== SSO_AUDIENCE) return { valid: false, reason: "bad-audience" };

  if (typeof claims.exp !== "number" || !Number.isFinite(claims.exp)) {
    return { valid: false, reason: "no-exp" };
  }
  if (claims.exp * 1000 <= nowMs) return { valid: false, reason: "expired" };

  return { valid: true, claims };
}

/** The atlas_scope value to set from verified claims: the `scope` claim, or the
 *  contract default `'danantara'` when it is absent/empty. */
export function scopeFromClaims(claims: SsoClaims): string {
  return claims.scope || SSO_DEFAULT_SCOPE;
}
