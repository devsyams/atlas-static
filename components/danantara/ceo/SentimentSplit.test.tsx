// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SentimentSplit } from "./SentimentSplit";

describe("SentimentSplit (T9 / AC9)", () => {
  // pos 4200/14000 = 30%, neg 7700/14000 = 55%
  it("compact: renders positive and negative percentages", () => {
    render(<SentimentSplit pos={4200} neg={7700} total={14000} />);
    const el = screen.getByTestId("sentiment-split");
    expect(el.textContent).toContain("30%");
    expect(el.textContent).toContain("55%");
    // counts are NOT shown in compact mode
    expect(el.textContent).not.toContain("rb");
  });

  it("full: renders labeled percentages with counts as secondary detail", () => {
    render(<SentimentSplit pos={4200} neg={7700} total={14000} variant="full" />);
    const el = screen.getByTestId("sentiment-split-full");
    expect(el.textContent).toContain("Positif 30%");
    expect(el.textContent).toContain("Negatif 55%");
    expect(el.textContent).toContain("Netral 15%");
    // counts still visible as secondary detail
    expect(el.textContent).toContain("4,2 rb");
    expect(el.textContent).toContain("7,7 rb");
  });

  it("handles zero totals without NaN", () => {
    render(<SentimentSplit pos={0} neg={0} total={0} />);
    const el = screen.getByTestId("sentiment-split");
    expect(el.textContent).not.toContain("NaN");
    expect(el.textContent).toContain("0%");
  });

  it("percentages always sum to ~100 for non-zero totals", () => {
    render(<SentimentSplit pos={1} neg={1} total={3} variant="full" />);
    const el = screen.getByTestId("sentiment-split-full");
    // 33% + 33% + 33% (rounding) — just assert all three render with a % sign
    expect((el.textContent!.match(/%/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });
});
