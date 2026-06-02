// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/layout/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));
vi.mock("@/components/danantara/ceo/CeoCommand", () => ({
  CeoCommand: () => <div data-testid="ceo-command" />,
}));

import Page from "./page";

describe("/danantara (AC1)", () => {
  it("renders the new CeoCommand inside AppShell", () => {
    render(<Page />);
    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
    expect(screen.getByTestId("ceo-command")).toBeInTheDocument();
  });
});
