// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/layout/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));
vi.mock("@/components/danantara/ceo/DanantaraCommandCenter", () => ({
  DanantaraCommandCenter: () => <div data-testid="danantara-command-center" />,
}));

import Page from "./page";

describe("/danantara/command (A13 — T1)", () => {
  it("renders the Command Center inside AppShell", () => {
    render(<Page />);
    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
    expect(screen.getByTestId("danantara-command-center")).toBeInTheDocument();
  });
});
