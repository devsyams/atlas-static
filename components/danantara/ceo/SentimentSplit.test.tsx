// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SentimentSplit } from "./SentimentSplit";

describe("SentimentSplit (T9 / AC9)", () => {
  it("compact: renders both positive and negative counts", () => {
    render(<SentimentSplit pos={4200} neg={7700} total={14000} />);
    const el = screen.getByTestId("sentiment-split");
    expect(el.textContent).toContain("4,2 rb");
    expect(el.textContent).toContain("7,7 rb");
  });

  it("full: renders labeled Positif/Netral/Negatif counts", () => {
    render(<SentimentSplit pos={4200} neg={7700} total={14000} variant="full" />);
    const el = screen.getByTestId("sentiment-split-full");
    expect(el.textContent).toContain("Positif");
    expect(el.textContent).toContain("Negatif");
    expect(el.textContent).toContain("Netral");
    expect(el.textContent).toContain("4,2 rb");
    expect(el.textContent).toContain("7,7 rb");
  });

  it("handles zero totals without NaN", () => {
    render(<SentimentSplit pos={0} neg={0} total={0} />);
    expect(screen.getByTestId("sentiment-split").textContent).not.toContain("NaN");
  });
});
