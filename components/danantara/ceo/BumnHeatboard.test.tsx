// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { makeBumn } from "@/lib/danantara/ceo/test-fixtures";
import { BumnHeatboard } from "./BumnHeatboard";

const rows = [
  makeBumn({ id: "prt", short: "Pertamina", sentiment: 45, posMentions: 700, negMentions: 100, mentions: 1000 }),
  makeBumn({ id: "bri", short: "BRI", sentiment: 38, posMentions: 600, negMentions: 150, mentions: 1000 }),
  makeBumn({ id: "wsk", short: "Waskita", sentiment: -68, posMentions: 50, negMentions: 800, mentions: 1000 }),
  makeBumn({ id: "gia", short: "Garuda", sentiment: -54, posMentions: 100, negMentions: 700, mentions: 1000 }),
];

describe("BumnHeatboard grouped by sentiment (T13 / AC13)", () => {
  it("renders a positive and a negative section with counts", () => {
    render(<BumnHeatboard rows={rows} />);
    const pos = screen.getByTestId("bumn-group-positive");
    const neg = screen.getByTestId("bumn-group-negative");
    expect(pos.textContent).toContain("SENTIMEN POSITIF");
    expect(pos.textContent).toContain("(2)");
    expect(neg.textContent).toContain("SENTIMEN NEGATIF");
    expect(neg.textContent).toContain("(2)");
  });

  it("places each BUMN in the section matching its net sentiment sign", () => {
    render(<BumnHeatboard rows={rows} />);
    const pos = screen.getByTestId("bumn-group-positive");
    const neg = screen.getByTestId("bumn-group-negative");
    expect(pos.textContent).toContain("Pertamina");
    expect(pos.textContent).toContain("BRI");
    expect(neg.textContent).toContain("Waskita");
    expect(neg.textContent).toContain("Garuda");
  });

  it("orders positive most-positive first and negative most-negative first", () => {
    render(<BumnHeatboard rows={rows} />);
    const posTiles = screen
      .getByTestId("bumn-group-positive")
      .querySelectorAll("[data-testid^='bumn-tile-']");
    expect([...posTiles].map((t) => t.getAttribute("data-testid"))).toEqual([
      "bumn-tile-prt",
      "bumn-tile-bri",
    ]);
    const negTiles = screen
      .getByTestId("bumn-group-negative")
      .querySelectorAll("[data-testid^='bumn-tile-']");
    expect([...negTiles].map((t) => t.getAttribute("data-testid"))).toEqual([
      "bumn-tile-wsk",
      "bumn-tile-gia",
    ]);
  });

  it("renders the positive and negative sections side by side (AC13 v5.0)", () => {
    render(<BumnHeatboard rows={rows} />);
    const columns = screen.getByTestId("bumn-groups");
    expect(columns.className).toContain("grid-cols-2");
    expect(columns.contains(screen.getByTestId("bumn-group-positive"))).toBe(true);
    expect(columns.contains(screen.getByTestId("bumn-group-negative"))).toBe(true);
  });

  it("shows a mini sentiment pie on every tile and no panel-level pie (AC14 v5.0)", () => {
    render(<BumnHeatboard rows={rows} />);
    expect(screen.getAllByTestId("sentiment-pie-mini")).toHaveLength(rows.length);
    expect(screen.queryByTestId("sentiment-pie")).not.toBeInTheDocument();
  });

  it("still fires onSelect when a tile is clicked (AC10)", () => {
    const onSelect = vi.fn();
    render(<BumnHeatboard rows={rows} onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId("btn-bumn-tile-wsk"));
    expect(onSelect).toHaveBeenCalledWith("wsk");
  });

  it("renders an empty state label when a section has no BUMN", () => {
    render(<BumnHeatboard rows={[rows[0]]} />);
    const neg = screen.getByTestId("bumn-group-negative");
    expect(neg.textContent).toContain("(0)");
    expect(neg.textContent).toContain("Tidak ada");
  });
});
