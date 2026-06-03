// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { buildInitialState } from "@/lib/danantara/ceo/data";
import { DetailModal } from "./DetailModal";

describe("DetailModal (T10 / AC10)", () => {
  const state = buildInitialState();
  const topIssue = state.issues[0];
  const topBumn = state.bumn[0];

  it("renders issue detail with headlines and related BUMN", () => {
    render(
      <DetailModal selection={{ type: "issue", id: topIssue.id }} state={state} onClose={vi.fn()} onNavigate={vi.fn()} />,
    );
    const detail = screen.getByTestId("ceo-detail-issue");
    expect(detail.textContent).toContain(topIssue.title);
    expect(detail.textContent).toContain(topIssue.headlines[0].title);
    expect(screen.getByTestId("sentiment-split-full")).toBeInTheDocument();
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

  it("navigates from issue detail to a related BUMN", () => {
    const onNavigate = vi.fn();
    render(
      <DetailModal selection={{ type: "issue", id: topIssue.id }} state={state} onClose={vi.fn()} onNavigate={onNavigate} />,
    );
    fireEvent.click(screen.getByTestId(`related-bumn-${topIssue.relatedBumn[0]}`));
    expect(onNavigate).toHaveBeenCalledWith({ type: "bumn", id: topIssue.relatedBumn[0] });
  });

  it("renders nothing when the id does not exist", () => {
    const { container } = render(
      <DetailModal selection={{ type: "issue", id: "does-not-exist" }} state={state} onClose={vi.fn()} onNavigate={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
