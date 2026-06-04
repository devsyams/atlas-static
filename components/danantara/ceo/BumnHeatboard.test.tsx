// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { makeBumn, makeIssue } from "@/lib/danantara/ceo/test-fixtures";
import { BumnHeatboard } from "./BumnHeatboard";

const rows = [
  makeBumn({ id: "prt", name: "Pertamina", short: "Pertamina", sector: "energi", sentiment: 45, mentions: 8400, posMentions: 6000, negMentions: 1400, topIssueId: "prt-iss" }),
  makeBumn({ id: "bri", name: "Bank Rakyat Indonesia", short: "BBRI", sentiment: 38, mentions: 9100, posMentions: 6500, negMentions: 1500 }),
  makeBumn({ id: "wsk", name: "Waskita Karya", short: "WSKT", sentiment: -68, mentions: 5200, posMentions: 800, negMentions: 3800, topIssueId: "wsk-iss" }),
  makeBumn({ id: "gia", name: "Garuda Indonesia", short: "GIAA", sentiment: -54, mentions: 8400, posMentions: 1500, negMentions: 6000 }),
];

const issues = [
  makeIssue({ id: "prt-iss", title: "Antrean BBM langka", relatedBumn: ["prt"] }),
  makeIssue({ id: "wsk-iss", title: "Restrukturisasi utang Waskita", relatedBumn: ["wsk"] }),
];

describe("BumnHeatboard two-column issues-style board (AC18 v20.0)", () => {
  it("renders SENTIMEN POSITIF and SENTIMEN NEGATIF sub-columns side by side with counts", () => {
    render(<BumnHeatboard rows={rows} issues={issues} />);
    expect(screen.getByTestId("bumn-groups").className).toContain("grid-cols-2");
    const pos = screen.getByTestId("bumn-group-positive");
    const neg = screen.getByTestId("bumn-group-negative");
    expect(pos.textContent).toContain("SENTIMEN POSITIF");
    expect(pos.textContent).toContain("(2)");
    expect(neg.textContent).toContain("SENTIMEN NEGATIF");
    expect(neg.textContent).toContain("(2)");
  });

  it("places each BUMN in the group matching its net-sentiment sign, titled by nickname", () => {
    render(<BumnHeatboard rows={rows} issues={issues} />);
    // Title uses the BUMN short/nickname, not the full name.
    expect(screen.getByTestId("bumn-group-positive").querySelector("[data-testid='bumn-name']")?.textContent).toBe("Pertamina");
    expect(screen.getByTestId("bumn-group-positive").textContent).toContain("BBRI");
    expect(screen.getByTestId("bumn-group-negative").textContent).toContain("WSKT");
    expect(screen.getByTestId("bumn-group-negative").textContent).toContain("GIAA");
  });

  it("renders one row per BUMN, no positive/negative topic cells", () => {
    render(<BumnHeatboard rows={rows} issues={issues} />);
    expect(screen.getAllByTestId(/^bumn-tile-/)).toHaveLength(rows.length);
    expect(screen.queryByTestId("bumn-topic-positive")).not.toBeInTheDocument();
  });

  it("renders one sentiment pie + a logo per BUMN row, no panel pie", () => {
    render(<BumnHeatboard rows={rows} issues={issues} />);
    expect(screen.getAllByTestId("sentiment-pie-mini")).toHaveLength(rows.length);
    expect(screen.getAllByTestId("bumn-logo")).toHaveLength(rows.length);
    expect(screen.queryByTestId("sentiment-pie")).not.toBeInTheDocument();
  });

  it("shows the mention count and top-issue context line on a row", () => {
    render(<BumnHeatboard rows={rows} issues={issues} />);
    const prt = screen.getByTestId("bumn-tile-prt");
    expect(prt.textContent).toContain("8.4K mentions");
    expect(prt.querySelector("[data-testid='bumn-context']")?.textContent).toContain("Antrean BBM langka");
  });

  it("ranks rows within each group (1., 2., …)", () => {
    render(<BumnHeatboard rows={rows} issues={issues} />);
    const posRanks = [...screen.getByTestId("bumn-group-positive").querySelectorAll("[data-testid='bumn-rank']")].map((el) => el.textContent);
    expect(posRanks).toEqual(["1.", "2."]);
  });

  it("still fires onSelect when a row is clicked (AC10)", () => {
    const onSelect = vi.fn();
    render(<BumnHeatboard rows={rows} issues={issues} onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId("btn-bumn-tile-wsk"));
    expect(onSelect).toHaveBeenCalledWith("wsk");
  });
});
