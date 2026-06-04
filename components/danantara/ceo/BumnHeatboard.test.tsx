// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { makeBumn, makeIssue } from "@/lib/danantara/ceo/test-fixtures";
import { BumnHeatboard } from "./BumnHeatboard";

const rows = [
  makeBumn({ id: "prt", name: "Pertamina", short: "Pertamina", sector: "energi", sentiment: 45 }),
  makeBumn({ id: "wsk", name: "Waskita Karya", short: "WSKT", sentiment: -68 }),
];

const issues = [
  makeIssue({ id: "prt-good", title: "Laba Pertamina naik", relatedBumn: ["prt"], posMentions: 900, negMentions: 100, reach: 9_000_000, mentions: 1000 }),
  makeIssue({ id: "prt-bad", title: "Antrean BBM langka", relatedBumn: ["prt"], posMentions: 100, negMentions: 900, reach: 8_000_000, mentions: 1000 }),
  makeIssue({ id: "wsk-bad", title: "Restrukturisasi utang Waskita", relatedBumn: ["wsk"], posMentions: 100, negMentions: 900, reach: 7_000_000, mentions: 1000 }),
];

describe("BumnHeatboard one row per BUMN: identity | negative topic | positive topic (AC18 v24.0)", () => {
  it("renders a single list, one row per BUMN (no positive/negative BUMN groups)", () => {
    render(<BumnHeatboard rows={rows} issues={issues} />);
    expect(screen.getByTestId("bumn-list")).toBeInTheDocument();
    expect(screen.getAllByTestId(/^bumn-tile-/)).toHaveLength(rows.length);
    expect(screen.queryByTestId("bumn-group-positive")).not.toBeInTheDocument();
  });

  it("shows the BUMN's negative and positive topic on its row", () => {
    render(<BumnHeatboard rows={rows} issues={issues} />);
    const prt = screen.getByTestId("bumn-tile-prt");
    expect(prt.querySelector("[data-testid='bumn-topic-negative']")?.textContent).toContain("Antrean BBM langka");
    expect(prt.querySelector("[data-testid='bumn-topic-positive']")?.textContent).toContain("Laba Pertamina naik");
  });

  it("orders the negative topic before the positive topic in the row", () => {
    render(<BumnHeatboard rows={rows} issues={issues} />);
    const cells = [...screen.getByTestId("bumn-tile-prt").querySelectorAll("[data-testid^='bumn-topic-']")];
    expect(cells.map((c) => c.getAttribute("data-testid"))).toEqual(["bumn-topic-negative", "bumn-topic-positive"]);
  });

  it("shows a placeholder (no pie) when a BUMN has no topic of a tone", () => {
    render(<BumnHeatboard rows={rows} issues={issues} />);
    // Waskita has only a negative topic linked.
    const wsk = screen.getByTestId("bumn-tile-wsk");
    expect(wsk.querySelector("[data-testid='bumn-topic-negative']")?.textContent).toContain("Restrukturisasi utang Waskita");
    expect(wsk.querySelector("[data-testid='bumn-topic-positive']")).toBeNull();
    expect(wsk.textContent).toContain("No positive topic");
  });

  it("renders a mini pie on each present topic cell + a logo and ticker per BUMN", () => {
    render(<BumnHeatboard rows={rows} issues={issues} />);
    // prt: 2 topic pies, wsk: 1 topic pie = 3.
    expect(screen.getAllByTestId("sentiment-pie-mini")).toHaveLength(3);
    expect(screen.getAllByTestId("bumn-logo")).toHaveLength(rows.length);
    expect(screen.getByTestId("bumn-tile-prt").querySelector("[data-testid='bumn-name']")?.textContent).toBe("Pertamina");
  });

  it("shows the topic reach in each cell", () => {
    render(<BumnHeatboard rows={rows} issues={issues} />);
    const prt = screen.getByTestId("bumn-tile-prt");
    expect(prt.querySelector("[data-testid='bumn-topic-negative']")?.textContent).toContain("8.0M");
    expect(prt.querySelector("[data-testid='bumn-topic-positive']")?.textContent).toContain("9.0M");
  });

  it("shows the rank as a corner badge on the logo, not a stacked mono line (v27.0)", () => {
    render(<BumnHeatboard rows={rows} issues={issues} />);
    const prt = screen.getByTestId("bumn-tile-prt");
    const rank = prt.querySelector("[data-testid='bumn-rank']") as HTMLElement;
    // Pertamina is most-positive of the two → ranks #1 (sorted most-negative first → wsk #1)... rank is positional.
    expect(rank).not.toBeNull();
    // No trailing period anymore — just the digits.
    expect(rank.textContent?.trim()).toMatch(/^\d+$/);
    // Pinned as an absolute corner badge inside the logo wrapper.
    expect(rank.className).toContain("absolute");
    const logoWrap = prt.querySelector("[data-testid='bumn-logo']")?.parentElement;
    expect(logoWrap?.contains(rank)).toBe(true);
  });

  it("still fires onSelect when a row is clicked (AC10)", () => {
    const onSelect = vi.fn();
    render(<BumnHeatboard rows={rows} issues={issues} onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId("btn-bumn-tile-wsk"));
    expect(onSelect).toHaveBeenCalledWith("wsk");
  });
});
