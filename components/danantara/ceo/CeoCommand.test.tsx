// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TICK_MS } from "@/lib/danantara/ceo/data";
import { CeoCommand } from "./CeoCommand";

describe("CeoCommand two-column sentiment wall (v5.0)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders all four zones with zero interaction (T1 / AC1)", () => {
    render(<CeoCommand />);
    expect(screen.getByTestId("ceo-header")).toBeInTheDocument();
    expect(screen.getByTestId("ceo-ticker")).toBeInTheDocument();
    expect(screen.getByTestId("ceo-issues")).toBeInTheDocument();
    expect(screen.getByTestId("ceo-bumn")).toBeInTheDocument();
  });

  it("renders no spotlight and never fires a takeover (T11 / AC11)", () => {
    render(<CeoCommand />);
    expect(screen.queryByTestId("ceo-spotlight")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ceo-takeover")).not.toBeInTheDocument();
    // Even after the scripted demo arc escalates an issue (~tick 18), no overlay interrupts.
    act(() => {
      vi.advanceTimersByTime(TICK_MS * 25);
    });
    expect(screen.queryByTestId("ceo-takeover")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ceo-spotlight")).not.toBeInTheDocument();
  });

  it("uses a two-column wall on xl, stacked on phone (T11 / AC11, T7 / AC7)", () => {
    render(<CeoCommand />);
    const wall = screen.getByTestId("ceo-wall");
    expect(wall.className).toContain("grid-cols-1");
    expect(wall.className).toContain("xl:grid-cols-2");
  });

  it("renders 20 issue rows and 20 BUMN tiles across the sentiment groups (AC2, AC3)", () => {
    render(<CeoCommand />);
    expect(screen.getAllByTestId(/^issue-row-/)).toHaveLength(20);
    expect(screen.getAllByTestId(/^bumn-tile-/)).toHaveLength(20);
  });

  it("renders a mini sentiment pie on every row and tile, no panel pie (AC9, AC14 v5.0)", () => {
    render(<CeoCommand />);
    // 20 issue rows + 20 BUMN tiles, each with its own pie
    expect(screen.getAllByTestId("sentiment-pie-mini")).toHaveLength(40);
    expect(screen.queryByTestId("sentiment-pie")).not.toBeInTheDocument();
  });

  it("renders positive|negative sub-columns side by side in both panels (AC12, AC13 v5.0)", () => {
    render(<CeoCommand />);
    expect(screen.getByTestId("issue-groups").className).toContain("grid-cols-2");
    expect(screen.getByTestId("bumn-groups").className).toContain("grid-cols-2");
  });

  it("escalating issues still badge on the board when the scripted arc fires (AC2)", () => {
    render(<CeoCommand />);
    act(() => {
      vi.advanceTimersByTime(TICK_MS * 19);
    });
    expect(screen.getByTestId("ceo-issues").textContent).toContain("ESKALASI");
  });

  it("shows rank movement badges on issue rows and BUMN tiles (AC8)", () => {
    render(<CeoCommand />);
    // At load everything is "stay" (rankDelta 0 by construction).
    expect(screen.getAllByTestId("rank-stay").length).toBeGreaterThanOrEqual(40); // 20 issues + 20 BUMN
  });

  it("detail modal keeps the labeled sentiment split bar (AC9 v5.0)", () => {
    render(<CeoCommand />);
    act(() => {
      fireEvent.click(screen.getAllByTestId(/^btn-issue-row-/)[0]);
    });
    expect(screen.getByTestId("sentiment-split-full")).toBeInTheDocument();
    act(() => {
      fireEvent.keyDown(window, { key: "Escape" });
    });
  });

  it("opens issue detail when a row is clicked, closes with Esc (T10 / AC10)", () => {
    render(<CeoCommand />);
    expect(screen.queryByTestId("ceo-detail")).not.toBeInTheDocument();
    const firstRowBtn = screen.getAllByTestId(/^btn-issue-row-/)[0];
    act(() => {
      fireEvent.click(firstRowBtn);
    });
    expect(screen.getByTestId("ceo-detail-issue")).toBeInTheDocument();
    act(() => {
      fireEvent.keyDown(window, { key: "Escape" });
    });
    expect(screen.queryByTestId("ceo-detail")).not.toBeInTheDocument();
  });

  it("opens BUMN detail when a tile is clicked (T10 / AC10)", () => {
    render(<CeoCommand />);
    const firstTileBtn = screen.getAllByTestId(/^btn-bumn-tile-/)[0];
    act(() => {
      fireEvent.click(firstTileBtn);
    });
    expect(screen.getByTestId("ceo-detail-bumn")).toBeInTheDocument();
  });

  it("keeps ticking while a detail modal is open (T10 / AC10)", () => {
    render(<CeoCommand />);
    act(() => {
      fireEvent.click(screen.getAllByTestId(/^btn-issue-row-/)[0]);
    });
    expect(screen.getByTestId("ceo-detail")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(TICK_MS * 5);
    });
    // Modal still open and the wall is still live underneath.
    expect(screen.getByTestId("ceo-detail")).toBeInTheDocument();
    expect(screen.getAllByTestId(/^issue-row-/)).toHaveLength(20);
  });
});
