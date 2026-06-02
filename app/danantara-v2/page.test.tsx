// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/layout/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));
vi.mock("@/components/danantara/SovereignCommand", () => ({
  SovereignCommand: () => <div data-testid="sovereign-command" />,
}));

import Page from "./page";

describe("/danantara-v2 (T6 / AC6)", () => {
  it("renders the old SovereignCommand inside AppShell", () => {
    render(<Page />);
    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
    expect(screen.getByTestId("sovereign-command")).toBeInTheDocument();
  });
});
