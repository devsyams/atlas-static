// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TAKEOVER_MS, TICK_MS } from "@/lib/danantara/ceo/data";
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

  it("pins the live escalating issue in the spotlight, then clears the pin after cooldown (AC4)", () => {
    render(<CeoCommand />);
    // Reach escalation (~tick 18) and stay inside the escalating window (tick 19).
    act(() => {
      vi.advanceTimersByTime(TICK_MS * 19);
    });
    expect(screen.getByTestId("ceo-takeover")).toBeInTheDocument();
    // Clear the takeover overlay (5s timeout; also advances ~1 more tick — still escalating).
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(screen.queryByTestId("ceo-takeover")).not.toBeInTheDocument();
    // The LIVE escalating issue is pinned in the spotlight.
    expect(screen.getByTestId("ceo-spotlight").textContent).toContain("ESKALASI");
    // Advance well past cooldown (issue cools ~tick 23) — the pin must clear (AC4) and rotation resume.
    act(() => {
      vi.advanceTimersByTime(TICK_MS * 6);
    });
    expect(screen.getByTestId("ceo-spotlight").textContent).not.toContain("ESKALASI");
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

  it("queues takeovers when two escalations happen close together (hotkey spam)", () => {
    render(<CeoCommand />);
    // Press E twice quickly — two different issues get arcs.
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "e" }));
    });
    act(() => {
      vi.advanceTimersByTime(TICK_MS); // one tick so the first arc's target is no longer available for 2nd press
    });
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "e" }));
    });
    // Let both arcs ramp to escalation.
    act(() => {
      vi.advanceTimersByTime(TICK_MS * 10);
    });
    // First takeover showing.
    const first = screen.getByTestId("ceo-takeover").textContent;
    // Dismiss it (TAKEOVER_MS) — the queued second takeover must then appear.
    act(() => {
      vi.advanceTimersByTime(TAKEOVER_MS);
    });
    const second = screen.queryByTestId("ceo-takeover");
    expect(second).toBeInTheDocument();
    expect(second!.textContent).not.toBe(first);
  });
});
