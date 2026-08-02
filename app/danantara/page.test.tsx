// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/layout/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));
vi.mock("@/components/danantara/ceo/CeoCommand", () => ({
  CeoCommand: (props: { mock?: boolean }) => <div data-testid="ceo-command" data-mock={String(!!props.mock)} />,
}));

import Page from "./page";

describe("/danantara (AC1)", () => {
  afterEach(() => {
    delete process.env.DANANTARA_DEMO_MOCK;
  });

  it("renders the new CeoCommand inside AppShell", () => {
    render(<Page />);
    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
    expect(screen.getByTestId("ceo-command")).toBeInTheDocument();
  });

  it("serves live data by default — no demo mock (regression)", () => {
    render(<Page />);
    expect(screen.getByTestId("ceo-command")).toHaveAttribute("data-mock", "false");
  });

  it("opts into the Danantara demo fixture when DANANTARA_DEMO_MOCK=1 (A7 v50.1)", () => {
    process.env.DANANTARA_DEMO_MOCK = "1";
    render(<Page />);
    expect(screen.getByTestId("ceo-command")).toHaveAttribute("data-mock", "true");
  });
});
