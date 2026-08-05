// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/layout/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));
vi.mock("@/components/danantara/ceo/CrisisGate", () => ({
  CrisisGate: (props: { mock?: boolean }) => <div data-testid="crisis-gate" data-mock={String(!!props.mock)} />,
}));

import Page from "./page";

describe("/danantara/krisis (A10 v11.2)", () => {
  afterEach(() => {
    delete process.env.DANANTARA_DEMO_MOCK;
  });

  it("renders the CrisisGate inside AppShell", () => {
    render(<Page />);
    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
    expect(screen.getByTestId("crisis-gate")).toBeInTheDocument();
  });

  it("serves live data by default — no demo mock (regression)", () => {
    render(<Page />);
    expect(screen.getByTestId("crisis-gate")).toHaveAttribute("data-mock", "false");
  });

  it("opts into the Danantara demo fixture when DANANTARA_DEMO_MOCK=1", () => {
    process.env.DANANTARA_DEMO_MOCK = "1";
    render(<Page />);
    expect(screen.getByTestId("crisis-gate")).toHaveAttribute("data-mock", "true");
  });
});
