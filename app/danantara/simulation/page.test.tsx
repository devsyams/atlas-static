// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/layout/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));
vi.mock("@/components/danantara/sim/console/SimulationConsole", () => ({
  SimulationConsole: () => <div data-testid="simulation-room" />,
}));

import Page from "./page";

describe("/danantara/simulation (A15 v3.0)", () => {
  it("renders the Simulation Console inside AppShell", () => {
    render(<Page />);
    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
    expect(screen.getByTestId("simulation-room")).toBeInTheDocument();
  });
});
