const enc = new TextEncoder();
const dec = new TextDecoder();

export const OPENGATE_SESSION_COOKIE = "atlas_opengate_session";

type CookieSource = {
  get(name: string): { value: string } | undefined;
};

type OpengateSessionClaims = {
  iss: "opengate";
  aud: "danantara";
  iat: number;
  sub: string;
  email: string;
  scope: "danantara";
};

function bytesToB64url(bytes: Uint8Array<ArrayBuffer>): string {
  let bin = "";
  for (const b of Array.from(bytes)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const pad = (4 - (s.length % 4)) % 4;
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
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

export async function signOpengateSessionCookie(claims: OpengateSessionClaims, secret: string): Promise<string> {
  const payload = bytesToB64url(enc.encode(JSON.stringify(claims)));
  const key = await hmacKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(payload)));
  return `${payload}.${bytesToB64url(sig)}`;
}

async function verifyOpengateSessionCookie(
  token: string | null | undefined,
  secret: string | undefined,
): Promise<boolean> {
  if (!secret || !token) return false;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return false;

  let claims: OpengateSessionClaims;
  try {
    claims = JSON.parse(dec.decode(b64urlToBytes(parts[0]))) as OpengateSessionClaims;
  } catch {
    return false;
  }

  if (claims.iss !== "opengate" || claims.aud !== "danantara" || claims.scope !== "danantara") return false;

  try {
    const key = await hmacKey(secret);
    return crypto.subtle.verify("HMAC", key, b64urlToBytes(parts[1]), enc.encode(parts[0]));
  } catch {
    return false;
  }
}

export async function hasOpengateSession(cookieStore: CookieSource, secret: string | undefined): Promise<boolean> {
  return verifyOpengateSessionCookie(cookieStore.get(OPENGATE_SESSION_COOKIE)?.value, secret);
}
