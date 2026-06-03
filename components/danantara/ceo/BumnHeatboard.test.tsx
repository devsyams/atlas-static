// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { makeBumn, makeIssue } from "@/lib/danantara/ceo/test-fixtures";
import { BumnHeatboard } from "./BumnHeatboard";

const rows = [
  makeBumn({ id: "prt", short: "Pertamina", sentiment: 45 }),
  makeBumn({ id: "bri", short: "BRI", sentiment: 38 }),
  makeBumn({ id: "wsk", short: "Waskita", sentiment: -68 }),
  makeBumn({ id: "gia", short: "Garuda", sentiment: -54 }),
];

const issues = [
  makeIssue({ id: "prt-good", title: "Laba Pertamina naik", relatedBumn: ["prt"], posMentions: 900, negMentions: 100, reach: 9_000_000, mentions: 1000 }),
  makeIssue({ id: "prt-bad", title: "Antrean BBM langka", relatedBumn: ["prt"], posMentions: 100, negMentions: 900, reach: 8_000_000, mentions: 1000 }),
  makeIssue({ id: "wsk-bad", title: "Restrukturisasi utang Waskita", relatedBumn: ["wsk"], posMentions: 100, negMentions: 900, reach: 7_000_000, mentions: 1000 }),
];

describe("BumnHeatboard single per-row list (T16 / AC16)", () => {
  it("renders exactly one row per BUMN", () => {
    render(<BumnHeatboard rows={rows} issues={issues} />);
    expect(screen.getAllByTestId(/^bumn-tile-/)).toHaveLength(rows.length);
  });

  it("no longer renders side-by-side sentiment sub-columns", () => {
    render(<BumnHeatboard rows={rows} issues={issues} />);
    expect(screen.queryByTestId("bumn-group-positive")).not.toBeInTheDocument();
    expect(screen.queryByTestId("bumn-group-negative")).not.toBeInTheDocument();
  });

  it("shows the BUMN's leading positive and negative topic on its row", () => {
    render(<BumnHeatboard rows={rows} issues={issues} />);
    const prt = screen.getByTestId("bumn-tile-prt");
    expect(prt.textContent).toContain("Laba Pertamina naik");
    expect(prt.textContent).toContain("Antrean BBM langka");
  });

  it("shows a placeholder when a BUMN has no topic of a given tone", () => {
    render(<BumnHeatboard rows={rows} issues={issues} />);
    // Waskita only has a negative topic linked.
    const wsk = screen.getByTestId("bumn-tile-wsk");
    expect(wsk.textContent).toContain("Restrukturisasi utang Waskita");
    expect(wsk.querySelector("[data-testid='bumn-topic-positive']")).toBeNull();
    expect(wsk.textContent).toContain("No positive topic");
  });

  it("renders a mini pie on each present topic cell, none on placeholders, no panel pie (AC14 v10.0)", () => {
    render(<BumnHeatboard rows={rows} issues={issues} />);
    // prt has both topics (2 pies) + wsk has one negative topic (1 pie) = 3.
    expect(screen.getAllByTestId("sentiment-pie-mini")).toHaveLength(3);
    expect(screen.queryByTestId("sentiment-pie")).not.toBeInTheDocument();
    // The placeholder cell (wsk positive) carries no pie.
    const wsk = screen.getByTestId("bumn-tile-wsk");
    expect(wsk.querySelector("[data-testid='bumn-topic-positive']")).toBeNull();
  });

  it("prefixes each row with a sequential rank number and no net-sentiment score (AC3/AC16 v11.0)", () => {
    render(<BumnHeatboard rows={rows} issues={issues} />);
    const ranks = screen.getAllByTestId("bumn-rank").map((el) => el.textContent);
    expect(ranks).toEqual(["1", "2", "3", "4"]);
    // The old −100..100 score (e.g. Pertamina's +45 / Waskita's -68) is gone.
    const prt = screen.getByTestId("bumn-tile-prt");
    expect(prt.querySelector("[data-testid='bumn-score']")).toBeNull();
    expect(prt.textContent).not.toContain("45");
  });

  it("shows each present topic's reach value in its cell (AC16 v11.0)", () => {
    render(<BumnHeatboard rows={rows} issues={issues} />);
    const prt = screen.getByTestId("bumn-tile-prt");
    expect(prt.querySelector("[data-testid='bumn-topic-positive']")?.textContent).toContain("9.0M");
    expect(prt.querySelector("[data-testid='bumn-topic-negative']")?.textContent).toContain("8.0M");
  });

  it("still fires onSelect when a row is clicked (AC10)", () => {
    const onSelect = vi.fn();
    render(<BumnHeatboard rows={rows} issues={issues} onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId("btn-bumn-tile-wsk"));
    expect(onSelect).toHaveBeenCalledWith("wsk");
  });
});
