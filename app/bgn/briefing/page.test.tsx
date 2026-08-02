// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import Page from "./page";

vi.mock("../../../components/layout/AppShell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));
vi.mock("../../../components/danantara/brief/DanantaraBrief", () => ({
  DanantaraBrief: ({ backHref }: { backHref?: string }) => (
    <div data-testid="danantara-brief" data-back={backHref ?? ""} />
  ),
}));

describe("/bgn/briefing (A11 v3.0 — T8)", () => {
  it("renders the briefing inside AppShell with the back arrow returning to /bgn/command", () => {
    render(<Page />);
    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
    expect(screen.getByTestId("danantara-brief")).toHaveAttribute("data-back", "/bgn/command");
  });
});
