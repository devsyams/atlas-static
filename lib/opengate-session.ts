import { verifySsoToken } from "./sso-token";

export const OPENGATE_SSO_COOKIE = "atlas_sso_token";

type CookieSource = {
  get(name: string): { value: string } | undefined;
};

export async function hasOpengateSession(cookieStore: CookieSource, secret: string | undefined): Promise<boolean> {
  const token = cookieStore.get(OPENGATE_SSO_COOKIE)?.value;
  const result = await verifySsoToken(token, secret, Date.now());
  return result.valid && result.claims.iss === "opengate" && result.claims.scope === "danantara";
}