// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { makeBumn, makeIssue } from "@/lib/danantara/ceo/test-fixtures";
import { BumnHeatboard } from "./BumnHeatboard";

const rows = [
  makeBumn({ id: "prt", name: "Pertamina", short: "PTM", sector: "energi", sentiment: 45, mentions: 8400, posMentions: 6000, negMentions: 1400, topIssueId: "prt-bad" }),
  makeBumn({ id: "bri", name: "Bank Rakyat Indonesia", short: "BBRI", sentiment: 38, mentions: 9100, posMentions: 6500, negMentions: 1500 }),
  makeBumn({ id: "wsk", name: "Waskita Karya", short: "WSKT", sentiment: -68, mentions: 5200, posMentions: 800, negMentions: 3800, topIssueId: "wsk-bad" }),
  makeBumn({ id: "gia", name: "Garuda Indonesia", short: "GIAA", sentiment: -54, mentions: 8400, posMentions: 1500, negMentions: 6000 }),
];

const issues = [
  makeIssue({ id: "prt-bad", title: "Antrean BBM langka", relatedBumn: ["prt"] }),
  makeIssue({ id: "wsk-bad", title: "Restrukturisasi utang Waskita", relatedBumn: ["wsk"] }),
];

describe("BumnHeatboard issues-style rows (v19.0)", () => {
  it("renders exactly one row per BUMN, no positive/negative topic cells", () => {
    render(<BumnHeatboard rows={rows} issues={issues} />);
    expect(screen.getAllByTestId(/^bumn-tile-/)).toHaveLength(rows.length);
    expect(screen.queryByTestId("bumn-topic-positive")).not.toBeInTheDocument();
    expect(screen.queryByTestId("bumn-topic-negative")).not.toBeInTheDocument();
  });

  it("shows the BUMN name as the title", () => {
    render(<BumnHeatboard rows={rows} issues={issues} />);
    expect(screen.getByTestId("bumn-tile-prt").textContent).toContain("Pertamina");
    expect(screen.getByTestId("bumn-tile-gia").textContent).toContain("Garuda Indonesia");
  });

  it("renders one sentiment pie per BUMN row and no panel pie", () => {
    render(<BumnHeatboard rows={rows} issues={issues} />);
    expect(screen.getAllByTestId("sentiment-pie-mini")).toHaveLength(rows.length);
    expect(screen.queryByTestId("sentiment-pie")).not.toBeInTheDocument();
  });

  it("shows the mention count on each row", () => {
    render(<BumnHeatboard rows={rows} issues={issues} />);
    expect(screen.getByTestId("bumn-tile-prt").textContent).toContain("8.4K mentions");
  });

  it("shows the BUMN's top issue as a muted context line", () => {
    render(<BumnHeatboard rows={rows} issues={issues} />);
    expect(screen.getByTestId("bumn-tile-prt").querySelector("[data-testid='bumn-context']")?.textContent).toContain(
      "Antrean BBM langka",
    );
  });

  it("renders a logo for each BUMN", () => {
    render(<BumnHeatboard rows={rows} issues={issues} />);
    expect(screen.getAllByTestId("bumn-logo")).toHaveLength(rows.length);
  });

  it("prefixes each row with a sequential rank number (1., 2., …)", () => {
    render(<BumnHeatboard rows={rows} issues={issues} />);
    expect(screen.getAllByTestId("bumn-rank").map((el) => el.textContent)).toEqual(["1.", "2.", "3.", "4."]);
  });

  it("still fires onSelect when a row is clicked (AC10)", () => {
    const onSelect = vi.fn();
    render(<BumnHeatboard rows={rows} issues={issues} onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId("btn-bumn-tile-wsk"));
    expect(onSelect).toHaveBeenCalledWith("wsk");
  });
});
