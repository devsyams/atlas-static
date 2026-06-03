// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SentimentPie } from "./SentimentPie";

describe("SentimentPie (T14 / AC14)", () => {
  // pos 5000/10000 = 50%, neg 3000/10000 = 30%, neu 2000/10000 = 20%
  const totals = { pos: 5000, neg: 3000, neu: 2000, total: 10000 };

  it("renders positive, negative and neutral percentage labels", () => {
    render(<SentimentPie totals={totals} />);
    const el = screen.getByTestId("sentiment-pie");
    expect(el.textContent).toContain("Positif 50%");
    expect(el.textContent).toContain("Negatif 30%");
    expect(el.textContent).toContain("Netral 20%");
  });

  it("renders one donut segment per non-zero share", () => {
    const { container } = render(<SentimentPie totals={totals} />);
    expect(container.querySelectorAll("[data-segment]")).toHaveLength(3);
  });

  it("skips segments whose share is zero", () => {
    const { container } = render(
      <SentimentPie totals={{ pos: 0, neg: 800, neu: 200, total: 1000 }} />,
    );
    const segments = [...container.querySelectorAll("[data-segment]")].map((s) =>
      s.getAttribute("data-segment"),
    );
    expect(segments).not.toContain("pos");
    expect(segments).toContain("neg");
    expect(segments).toContain("neu");
  });

  it("handles a zero total without NaN", () => {
    const { container } = render(
      <SentimentPie totals={{ pos: 0, neg: 0, neu: 0, total: 0 }} />,
    );
    const el = screen.getByTestId("sentiment-pie");
    expect(el.textContent).not.toContain("NaN");
    expect(container.querySelectorAll("[data-segment]")).toHaveLength(0);
  });
});
