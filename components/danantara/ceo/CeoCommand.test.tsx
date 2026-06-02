// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TICK_MS } from "@/lib/danantara/ceo/data";
import { CeoCommand } from "./CeoCommand";

describe("CeoCommand (T1 / AC1)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders all five zones with zero interaction", () => {
    render(<CeoCommand />);
    expect(screen.getByTestId("ceo-header")).toBeInTheDocument();
    expect(screen.getByTestId("ceo-issues")).toBeInTheDocument();
    expect(screen.getByTestId("ceo-bumn")).toBeInTheDocument();
    expect(screen.getByTestId("ceo-spotlight")).toBeInTheDocument();
    expect(screen.getByTestId("ceo-ticker")).toBeInTheDocument();
  });

  it("renders 20 issue rows and 20 BUMN tiles (AC2, AC3)", () => {
    render(<CeoCommand />);
    expect(screen.getAllByTestId(/^issue-row-/)).toHaveLength(20);
    expect(screen.getAllByTestId(/^bumn-tile-/)).toHaveLength(20);
  });

  it("fires the breaking takeover when the scripted arc escalates an issue (T4 / AC4, AC5)", () => {
    render(<CeoCommand />);
    expect(screen.queryByTestId("ceo-takeover")).not.toBeInTheDocument();
    // Advance past the first demo arc (atTick 15 + rampTicks 5) plus margin.
    act(() => {
      vi.advanceTimersByTime(TICK_MS * 25);
    });
    expect(screen.getByTestId("ceo-takeover")).toBeInTheDocument();
  });

  it("clears the takeover after TAKEOVER_MS and pins the escalating issue in the spotlight", () => {
    render(<CeoCommand />);
    act(() => {
      vi.advanceTimersByTime(TICK_MS * 25);
    });
    expect(screen.getByTestId("ceo-takeover")).toBeInTheDocument();
    // Let the takeover timeout elapse (no further ticks needed: 5s < 4s*2)
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(screen.queryByTestId("ceo-takeover")).not.toBeInTheDocument();
    // The escalating issue stays pinned in the spotlight
    const spotlight = screen.getByTestId("ceo-spotlight");
    expect(spotlight.textContent).toContain("ESKALASI");
  });

  it("force-fires escalation with the presenter hotkey E (AC5)", () => {
    render(<CeoCommand />);
    expect(screen.queryByTestId("ceo-takeover")).not.toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "e" }));
    });
    act(() => {
      vi.advanceTimersByTime(TICK_MS * 8); // spiked ticks fill the velocity window
    });
    expect(screen.getByTestId("ceo-takeover")).toBeInTheDocument();
  });

  it("uses a stacked-to-3-column responsive wall (T7 / AC7)", () => {
    render(<CeoCommand />);
    const wall = screen.getByTestId("ceo-wall");
    expect(wall.className).toContain("grid-cols-1");
    expect(wall.className).toMatch(/xl:grid-cols-/);
  });
});
