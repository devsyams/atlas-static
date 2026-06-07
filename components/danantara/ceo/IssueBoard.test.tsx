// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { makeIssue } from "@/lib/danantara/ceo/test-fixtures";
import { IssueBoard } from "./IssueBoard";

const issues = [
  makeIssue({ id: "good-big", title: "Dividen BUMN naik", posMentions: 900, negMentions: 100, reach: 9_000_000 }),
  makeIssue({ id: "good-small", title: "Investasi asing masuk", posMentions: 800, negMentions: 200, reach: 2_000_000 }),
  makeIssue({ id: "bad-big", title: "Dugaan korupsi proyek", posMentions: 100, negMentions: 900, reach: 8_000_000 }),
  makeIssue({ id: "bad-small", title: "PHK massal", posMentions: 200, negMentions: 800, reach: 1_000_000 }),
];

describe("IssueBoard grouped by sentiment (T12 / AC12 v9.0)", () => {
  it("renders a positive and a negative section with counts", () => {
    render(<IssueBoard issues={issues} />);
    const pos = screen.getByTestId("issue-group-positive");
    const neg = screen.getByTestId("issue-group-negative");
    expect(pos.textContent).toContain("POSITIVE TOPICS");
    expect(pos.textContent).toContain("(2)");
    expect(neg.textContent).toContain("NEGATIVE TOPICS");
    expect(neg.textContent).toContain("(2)");
  });

  it("places each issue in the section matching its dominant sentiment", () => {
    render(<IssueBoard issues={issues} />);
    const pos = screen.getByTestId("issue-group-positive");
    const neg = screen.getByTestId("issue-group-negative");
    expect(pos.textContent).toContain("Dividen BUMN naik");
    expect(pos.textContent).toContain("Investasi asing masuk");
    expect(neg.textContent).toContain("Dugaan korupsi proyek");
    expect(neg.textContent).toContain("PHK massal");
  });

  it("orders issues by reach (largest first) inside each section", () => {
    render(<IssueBoard issues={issues} />);
    const posRows = screen
      .getByTestId("issue-group-positive")
      .querySelectorAll("[data-testid^='issue-row-']");
    expect([...posRows].map((r) => r.getAttribute("data-testid"))).toEqual([
      "issue-row-good-big",
      "issue-row-good-small",
    ]);
    const negRows = screen
      .getByTestId("issue-group-negative")
      .querySelectorAll("[data-testid^='issue-row-']");
    expect([...negRows].map((r) => r.getAttribute("data-testid"))).toEqual([
      "issue-row-bad-big",
      "issue-row-bad-small",
    ]);
  });

  it("renders the negative and positive sections side by side, negative on the left (v35.0)", () => {
    render(<IssueBoard issues={issues} />);
    const columns = screen.getByTestId("issue-groups");
    expect(columns.className).toContain("grid-cols-2");
    const sections = [...columns.querySelectorAll("[data-testid^='issue-group-']")];
    expect(sections.map((s) => s.getAttribute("data-testid"))).toEqual([
      "issue-group-negative",
      "issue-group-positive",
    ]);
  });

  it("keeps a mini sentiment pie on every row and no panel-level pie", () => {
    render(<IssueBoard issues={issues} />);
    expect(screen.getAllByTestId("sentiment-pie-mini")).toHaveLength(issues.length);
    expect(screen.queryByTestId("sentiment-pie")).not.toBeInTheDocument();
  });

  it("renders no per-row sparkline (AC2 v7.0)", () => {
    const { container } = render(<IssueBoard issues={issues} />);
    expect(container.querySelector("polyline")).toBeNull();
  });

  it("renders the AI context line (aiLine) beneath the title as a smaller muted sneak peek (AC12 v18.0)", () => {
    render(
      <IssueBoard
        issues={[makeIssue({ id: "ctx", title: "Topik uji", aiLine: "Konteks singkat soal topik ini.", posMentions: 900, negMentions: 100 })]}
      />,
    );
    const ctx = screen.getByTestId("issue-ailine");
    expect(ctx.textContent).toContain("Konteks singkat soal topik ini.");
    // Smaller than the 20px title, but not below the 16px readability floor (AC15).
    expect(ctx.className).toContain("text-base");
    expect(ctx.className).toContain("text-muted-foreground");
    expect(ctx.className).toContain("line-clamp-2");
  });

  it("renders topic titles in full, never truncated (AC12 v7.0)", () => {
    render(<IssueBoard issues={issues} />);
    for (const title of screen.getAllByTestId("issue-title")) {
      expect(title.className).not.toContain("truncate");
    }
  });

  it("still fires onSelect when a row is clicked (AC10)", () => {
    const onSelect = vi.fn();
    render(<IssueBoard issues={issues} onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId("btn-issue-row-bad-big"));
    expect(onSelect).toHaveBeenCalledWith("bad-big");
  });

  it("renders an empty state label when a section has no issues", () => {
    render(<IssueBoard issues={[issues[0]]} />);
    const neg = screen.getByTestId("issue-group-negative");
    expect(neg.textContent).toContain("(0)");
    expect(neg.textContent).toContain("No ");
  });
});
