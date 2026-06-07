// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BumnSentiment, CeoIssue, CeoState } from "@/lib/danantara/ceo/types";
import { DetailModal } from "./DetailModal";

const issue: CeoIssue = {
  id: "pln-topic-0",
  title: "Blackout Massal Sumatera",
  category: "kebijakan",
  relatedBumn: ["pln"],
  mentions: 1000,
  reach: 9_000_000,
  sentiment: -69,
  history: Array.from({ length: 8 }, () => 1000),
  headlines: [],
  aiLine: "Penjelasan topik ini.",
  velocity: 0,
  status: "normal",
  rankHistory: [1, 1, 1, 1, 1, 1, 1, 1],
  rankDelta: 0,
  posMentions: 70,
  negMentions: 760,
};

const bumn: BumnSentiment = {
  id: "pln",
  name: "PLN",
  short: "PLN",
  sector: "energi",
  sentiment: -69,
  mentions: 1000,
  trend: Array.from({ length: 8 }, () => -69),
  topIssueId: "pln-topic-0",
  rankHistory: Array.from({ length: 8 }, () => 1),
  rankDelta: 0,
  posMentions: 70,
  negMentions: 760,
};

const state: CeoState = { tickCount: 0, issues: [issue], bumn: [bumn] };

describe("DetailModal (T10 / AC10)", () => {
  const topIssue = state.issues[0];
  const topBumn = state.bumn[0];

  it("renders issue detail with the description (not Top Coverage) and related BUMN (v32.0)", () => {
    render(
      <DetailModal selection={{ type: "issue", id: topIssue.id }} state={state} onClose={vi.fn()} onNavigate={vi.fn()} />,
    );
    const detail = screen.getByTestId("ceo-detail-issue");
    expect(detail.textContent).toContain(topIssue.title);
    // Top Coverage / headlines list is gone; the AI description takes its place.
    expect(detail.textContent).not.toContain("Top Coverage");
    expect(screen.getByTestId("issue-description").textContent).toContain(topIssue.aiLine);
    // v34.0: the horizontal split bar is gone — the sentiment pie carries the breakdown.
    expect(screen.queryByTestId("sentiment-split-full")).not.toBeInTheDocument();
    expect(screen.getByTestId("sentiment-pie")).toBeInTheDocument();
    // Impressions/Reach/Sentiment hints are spelled out in English.
    expect(detail.textContent).toContain("Total views across all posts in this topic");
    expect(detail.textContent).toContain("Number of users exposed to this topic");
    for (const id of topIssue.relatedBumn) {
      expect(screen.getByTestId(`related-bumn-${id}`)).toBeInTheDocument();
    }
  });

  it("renders BUMN detail with related issues", () => {
    render(
      <DetailModal selection={{ type: "bumn", id: topBumn.id }} state={state} onClose={vi.fn()} onNavigate={vi.fn()} />,
    );
    const detail = screen.getByTestId("ceo-detail-bumn");
    expect(detail.textContent).toContain(topBumn.name);
    const related = state.issues.filter((i) => i.relatedBumn.includes(topBumn.id));
    expect(related.length).toBeGreaterThan(0);
    for (const issue of related) {
      expect(screen.getByTestId(`related-issue-${issue.id}`)).toBeInTheDocument();
    }
  });

  it("closes via the X button", () => {
    const onClose = vi.fn();
    render(<DetailModal selection={{ type: "issue", id: topIssue.id }} state={state} onClose={onClose} onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByTestId("ceo-detail-close"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes via Escape", () => {
    const onClose = vi.fn();
    render(<DetailModal selection={{ type: "issue", id: topIssue.id }} state={state} onClose={onClose} onNavigate={vi.fn()} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes when clicking the overlay but not the panel", () => {
    const onClose = vi.fn();
    render(<DetailModal selection={{ type: "issue", id: topIssue.id }} state={state} onClose={onClose} onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByTestId("ceo-detail"));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("ceo-detail-overlay"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("links a related BUMN to its dashboard (v40.0)", () => {
    render(
      <DetailModal selection={{ type: "issue", id: topIssue.id }} state={state} onClose={vi.fn()} onNavigate={vi.fn()} />,
    );
    expect(screen.getByTestId(`related-bumn-${topIssue.relatedBumn[0]}`)).toHaveAttribute(
      "href",
      `/bumn/${topIssue.relatedBumn[0]}`,
    );
  });

  it("renders nothing when the id does not exist", () => {
    const { container } = render(
      <DetailModal selection={{ type: "issue", id: "does-not-exist" }} state={state} onClose={vi.fn()} onNavigate={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
