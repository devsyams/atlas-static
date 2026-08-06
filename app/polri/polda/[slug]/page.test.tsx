// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/layout/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));

vi.mock("@/components/polri/polda/PolriPoldaBriefing", () => ({
  PolriPoldaBriefing: ({ slug }: { slug: string }) => <div data-testid="polda-briefing">briefing:{slug}</div>,
}));

import Page from "./page";

describe("/polri/polda/[slug]", () => {
  it("renders the selected Polda executive briefing inside AppShell", async () => {
    const ui = await Page({ params: Promise.resolve({ slug: "metro-jaya" }) });
    render(ui);

    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
    expect(screen.getByTestId("polda-briefing")).toHaveTextContent("briefing:metro-jaya");
  });
});
