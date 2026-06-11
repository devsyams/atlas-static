// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SentimentSummarySplit } from "./SentimentSummarySplit";

const PCT = { positive: 32.27, negative: 50.74, neutral: 16.99 };

function renderSplit(over: Partial<Parameters<typeof SentimentSummarySplit>[0]> = {}) {
  return render(
    <SentimentSummarySplit
      percentage={PCT}
      totalImpressions={2484080}
      totalReach={1656053}
      counts={{ negative: 4, positive: 2 }}
      drivers={{ negative: { title: "Antrean BBM langka", reach: 8_900_000 }, positive: { title: "Laba naik", reach: 5_000_000 } }}
      {...over}
    />,
  );
}

describe("SentimentSummarySplit (A8 v4.0 / AC10a)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("renders the Negative box before (left of) the Positive box", () => {
    renderSplit();
    const neg = screen.getByTestId("summary-box-negative");
    const pos = screen.getByTestId("summary-box-positive");
    // DOCUMENT_POSITION_FOLLOWING: pos comes after neg in the DOM (left → right).
    expect(neg.compareDocumentPosition(pos) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("each box shows its tone share %, topic count, and loudest driver", () => {
    renderSplit();
    const neg = screen.getByTestId("summary-box-negative");
    expect(neg.textContent).toMatch(/negative/i);
    expect(neg.textContent).toContain("51%");
    expect(neg.textContent).toContain("4"); // negative topic count
    expect(neg.textContent).toContain("Antrean BBM langka");
    const pos = screen.getByTestId("summary-box-positive");
    expect(pos.textContent).toMatch(/positive/i);
    expect(pos.textContent).toContain("32%");
    expect(pos.textContent).toContain("Laba naik");
  });

  it("keeps the segmented bar (with neutral) and the impressions/reach KPIs", () => {
    renderSplit();
    const el = screen.getByTestId("sentiment-summary-split");
    expect(screen.getByTestId("sentiment-bar")).toBeInTheDocument();
    expect(el.textContent).toContain("17%"); // neutral share in the legend
    expect(el.textContent).toContain("2.5M"); // impressions
    expect(el.textContent).toContain("1.7M"); // reach
  });

  it("clicking the Positive box jumps to the positive cluster (AC10c)", () => {
    const scrollSpy = vi.fn();
    renderSplit();
    const target = document.createElement("section");
    target.id = "bumn-cluster-positive";
    target.scrollIntoView = scrollSpy;
    document.body.appendChild(target);

    fireEvent.click(screen.getByTestId("summary-box-positive"));
    expect(scrollSpy).toHaveBeenCalled();
    target.remove();
  });

  it("clicking the Negative box jumps to the negative cluster", () => {
    const scrollSpy = vi.fn();
    renderSplit();
    const target = document.createElement("section");
    target.id = "bumn-cluster-negative";
    target.scrollIntoView = scrollSpy;
    document.body.appendChild(target);

    fireEvent.click(screen.getByTestId("summary-box-negative"));
    expect(scrollSpy).toHaveBeenCalled();
    target.remove();
  });

  it("handles an all-zero summary and missing drivers without crashing", () => {
    render(
      <SentimentSummarySplit
        percentage={{ positive: 0, negative: 0, neutral: 0 }}
        totalImpressions={0}
        totalReach={0}
        counts={{ negative: 0, positive: 0 }}
      />,
    );
    expect(screen.getByTestId("sentiment-summary-split")).toBeInTheDocument();
  });
});
