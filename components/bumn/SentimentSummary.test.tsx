// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SentimentSummary } from "./SentimentSummary";

const PCT = { positive: 32.27, negative: 50.74, neutral: 16.99 };

describe("SentimentSummary (A8 v2.0 / AC3)", () => {
  it("leads with the dominant sentiment as a big verdict", () => {
    render(<SentimentSummary percentage={PCT} totalImpressions={2484080} totalReach={1656053} />);
    const verdict = screen.getByTestId("sentiment-verdict");
    expect(verdict.textContent).toMatch(/negative/i); // 50.74 is the largest share
    expect(verdict.textContent).toContain("51%");
  });

  it("shows all three sentiment percentages", () => {
    render(<SentimentSummary percentage={PCT} totalImpressions={2484080} totalReach={1656053} />);
    const el = screen.getByTestId("sentiment-summary");
    expect(el.textContent).toContain("32%"); // positive
    expect(el.textContent).toContain("17%"); // neutral
    expect(el.textContent).toContain("51%"); // negative
  });

  it("uses the summary totals (impressions & reach) as context", () => {
    render(<SentimentSummary percentage={PCT} totalImpressions={2484080} totalReach={1656053} />);
    const el = screen.getByTestId("sentiment-summary");
    expect(el.textContent).toContain("2.5M"); // impressions
    expect(el.textContent).toContain("1.7M"); // reach
  });

  it("handles an all-zero summary without crashing", () => {
    render(<SentimentSummary percentage={{ positive: 0, negative: 0, neutral: 0 }} totalImpressions={0} totalReach={0} />);
    expect(screen.getByTestId("sentiment-summary")).toBeInTheDocument();
  });
});
