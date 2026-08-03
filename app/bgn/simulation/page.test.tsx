// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/layout/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));
const simulationConsoleMock = vi.fn((_props: { bgn?: boolean }) => <div data-testid="simulation-room" />);
vi.mock("@/components/danantara/sim/console/SimulationConsole", () => ({
  SimulationConsole: (props: { bgn?: boolean }) => simulationConsoleMock(props),
}));

import Page from "./page";

describe("/bgn/simulation (A15 v5.0)", () => {
  it("renders the Simulation Console inside AppShell with bgn samples", () => {
    render(<Page />);
    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
    expect(screen.getByTestId("simulation-room")).toBeInTheDocument();
    expect(simulationConsoleMock).toHaveBeenCalledWith(expect.objectContaining({ bgn: true }));
  });
});
