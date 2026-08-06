// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/layout/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));

vi.mock("@/components/polri/PolriCommand", () => ({
  PolriCommand: () => <div data-testid="polri-command">Polri - Executive Command POLRI ISSUE Polda Metro Jaya</div>,
}));

import Page from "./page";

describe("/polri", () => {
  it("renders the Polri executive command inside AppShell", () => {
    render(<Page />);

    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
    expect(screen.getByTestId("polri-command")).toHaveTextContent("Polri - Executive Command");
    expect(screen.getByTestId("polri-command")).toHaveTextContent("POLRI ISSUE");
    expect(screen.getByTestId("polri-command")).toHaveTextContent("Polda Metro Jaya");
  });
});
