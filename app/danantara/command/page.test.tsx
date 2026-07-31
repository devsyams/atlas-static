// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ "x-forwarded-host": "opengate.atlas.nexorus-alpha.io" })),
}));
vi.mock("@/components/layout/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));
vi.mock("@/components/danantara/ceo/DanantaraCommandCenter", () => ({
  DanantaraCommandCenter: ({ mediaIntelligenceHref }: { mediaIntelligenceHref?: string }) => (
    <div data-testid="danantara-command-center" data-href={mediaIntelligenceHref ?? ""} />
  ),
}));

import Page from "./page";

describe("/danantara/command (A13 — T1)", () => {
  it("renders the Command Center inside AppShell and passes the OpenGate href", async () => {
    render(await Page());
    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
    expect(screen.getByTestId("danantara-command-center")).toHaveAttribute(
      "data-href",
      "https://opengate.atlas.nexorus-alpha.io",
    );
  });
});
