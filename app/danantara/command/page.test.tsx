// @vitest-environment jsdom
import { cookies } from "next/headers";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { signSsoToken, type SsoClaims } from "../../../lib/sso-token";

const SECRET = "dedicated-danantara-sso-secret-value";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));
vi.mock("../../../components/layout/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));
vi.mock("../../../components/danantara/ceo/DanantaraCommandCenter", () => ({
  DanantaraCommandCenter: ({ mediaIntelligenceHref }: { mediaIntelligenceHref?: string }) => (
    <div data-testid="danantara-command-center" data-href={mediaIntelligenceHref ?? ""} />
  ),
}));

import Page from "./page";

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

describe("/danantara/command (A13 — T1)", () => {
  beforeEach(() => {
    process.env.ATLAS_SSO_SECRET = SECRET;
  });

  afterEach(() => {
    delete process.env.ATLAS_SSO_SECRET;
    vi.clearAllMocks();
  });

  it("renders the Command Center inside AppShell and passes the OpenGate href for a signed SSO cookie", async () => {
    const token = await signSsoToken(claims(), SECRET);
    vi.mocked(cookies).mockReturnValueOnce({
      get: (name: string) => (name === "atlas_sso_token" ? { value: token } : undefined),
    } as never);

    render(await Page());
    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
    expect(screen.getByTestId("danantara-command-center")).toHaveAttribute(
      "data-href",
      "https://opengate.atlas.nexorus-alpha.io",
    );
  });

  it("hides the shortcut when the signed SSO cookie is absent", async () => {
    vi.mocked(cookies).mockReturnValueOnce({
      get: () => undefined,
    } as never);

    render(await Page());
    expect(screen.getByTestId("danantara-command-center")).toHaveAttribute("data-href", "");
  });
});
