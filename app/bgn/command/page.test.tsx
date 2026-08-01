// @vitest-environment jsdom
import { cookies } from "next/headers";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Page from "./page";
import { type SsoClaims } from "../../../lib/sso-token";
import { OPENGATE_SESSION_COOKIE, signOpengateSessionCookie } from "../../../lib/opengate-session";

const SECRET = "dedicated-danantara-sso-secret-value";
const SESSION_MAX_AGE = 60 * 60 * 24;

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));
vi.mock("../../../components/layout/AppShell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));
vi.mock("../../../components/danantara/ceo/DanantaraCommandCenter", () => ({
  DanantaraCommandCenter: ({
    mediaIntelligenceHref,
    brand,
    brandLogo,
    mock,
  }: {
    mediaIntelligenceHref?: string;
    brand?: string;
    brandLogo?: string;
    mock?: boolean;
  }) => (
    <div
      data-testid="danantara-command-center"
      data-href={mediaIntelligenceHref ?? ""}
      data-brand={brand ?? ""}
      data-logo={brandLogo ?? ""}
      data-mock={mock ? "1" : "0"}
    />
  ),
}));

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

describe("/bgn/command (A13 v5.0 — T13/T20)", () => {
  beforeEach(() => {
    process.env.ATLAS_SSO_SECRET = SECRET;
  });

  afterEach(() => {
    delete process.env.ATLAS_SSO_SECRET;
    vi.clearAllMocks();
  });

  it("renders the Command Center inside AppShell — rebranded BGN, live feed (no mock) — with the OpenGate href for a signed SSO cookie", async () => {
    const sessionClaims = {
      typ: "opengate-session" as const,
      iss: "opengate" as const,
      aud: "danantara" as const,
      iat: claims().iat,
      exp: claims().iat + SESSION_MAX_AGE,
      sub: claims().sub,
      email: claims().email,
      scope: "danantara" as const,
    };
    const sessionCookie = await signOpengateSessionCookie(sessionClaims, SECRET);
    vi.mocked(cookies).mockReturnValueOnce({
      get: (name: string) => (name === OPENGATE_SESSION_COOKIE ? { value: sessionCookie } : undefined),
    } as never);

    render(await Page());
    const cc = screen.getByTestId("danantara-command-center");
    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
    expect(cc).toHaveAttribute("data-href", "https://opengate.atlas.nexorus-alpha.io");
    expect(cc).toHaveAttribute("data-brand", "BGN");
    expect(cc).toHaveAttribute("data-logo", "/bgn.png");
    // v5.0 (T20): the TrawlDeck facade is live — the page must NOT opt into the mock.
    expect(cc).toHaveAttribute("data-mock", "0");
  });

  it("hides the shortcut when the signed SSO cookie is absent — still rebranded, still live", async () => {
    vi.mocked(cookies).mockReturnValueOnce({
      get: () => undefined,
    } as never);

    render(await Page());
    const cc = screen.getByTestId("danantara-command-center");
    expect(cc).toHaveAttribute("data-href", "");
    expect(cc).toHaveAttribute("data-brand", "BGN");
    expect(cc).toHaveAttribute("data-mock", "0");
  });
});
