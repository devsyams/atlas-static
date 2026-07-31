export const OPENGATE_HOST = "opengate.atlas.nexorus-alpha.io";
export const OPENGATE_ORIGIN = `https://${OPENGATE_HOST}`;

type HeaderSource = Pick<Headers, "get">;

function firstHeaderValue(value: string | null): string | null {
  if (!value) return null;
  return value.split(",")[0]!.trim().toLowerCase().replace(/:\d+$/, "");
}

export function requestHost(headers: HeaderSource): string | null {
  return firstHeaderValue(headers.get("x-forwarded-host") ?? headers.get("host"));
}

export function isOpengateRequest(headers: HeaderSource): boolean {
  return requestHost(headers) === OPENGATE_HOST;
}