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

  it("shows a segmented sentiment bar per row instead of a pie (v41.0)", () => {
    render(<IssueBoard issues={issues} />);
    // The mini-pie is gone; each card carries a segmented sentiment bar.
    expect(screen.queryAllByTestId("sentiment-pie-mini")).toHaveLength(0);
    expect(screen.queryByTestId("sentiment-pie")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("sentiment-bar")).toHaveLength(issues.length);
  });

  it("renders the BUMN-Sentiment-Summary layout per card: metrics row + bar + per-sentiment values (v41.2)", () => {
    render(
      <IssueBoard
        issues={[makeIssue({ id: "x", title: "Topik uji", aiLine: "Penjelasan singkat.", mentions: 1000, posMentions: 200, negMentions: 600, reach: 9_000_000 })]}
      />,
    );
    const card = screen.getByTestId("issue-row-x");
    // Penjelasan + a Sentiment·Impressions·Reach metrics row.
    expect(card.textContent).toContain("Penjelasan singkat.");
    expect(card.textContent).toContain("impressions");
    expect(card.textContent).toContain("reach");
    // The "value of each sentiment" legend names all three shares.
    const legend = card.querySelector("[data-testid='sentiment-legend']") as HTMLElement;
    expect(legend.textContent).toContain("Positive 20%");
    expect(legend.textContent).toContain("Neutral 20%");
    expect(legend.textContent).toContain("Negative 60%");
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
    // Smaller than the 18px title, but not below the 16px readability floor (AC15).
    expect(ctx.className).toContain("text-base");
    expect(ctx.className).toContain("text-muted-foreground");
    expect(ctx.className).toContain("line-clamp-2");
  });

  // v47.0 supersedes "titles render in full, never truncated" (AC12 v7.0): a title
  // that wrapped to one line made its card 25px shorter than a two-line neighbour,
  // so the Negative and Positive columns stopped lining up. Titles now occupy a
  // fixed two-line box; the full text is kept in `title=` and in the detail modal.
  it("gives every card the same height: a fixed two-line title box (AC12 v47.0)", () => {
    render(<IssueBoard issues={issues} />);
    for (const title of screen.getAllByTestId("issue-title")) {
      // Clamp caps a long title; min-height stops a short one collapsing the card.
      expect(title.className).toContain("line-clamp-2");
      expect(title.className).toContain("min-h-[2.75em]");
      expect(title.className).not.toContain("truncate"); // never a single-line ellipsis
    }
  });

  it("never loses the full title — it stays available on the card and in the modal (AC12 v47.0)", () => {
    const long =
      "Isu dan Kritik atas Keterlibatan Danantara dalam Komite Stabilitas Sistem Keuangan (KSSK) yang Berkepanjangan";
    render(<IssueBoard issues={[makeIssue({ id: "long", title: long, posMentions: 100, negMentions: 900 })]} />);
    const title = screen.getByTestId("issue-title");
    expect(title.textContent).toBe(long); // clamping is visual only, never a substring
    expect(title.getAttribute("title")).toBe(long);
  });

  it("reserves the penjelasan box even when a topic has none, so cards stay level (AC12 v47.0)", () => {
    render(
      <IssueBoard
        issues={[
          makeIssue({ id: "with", title: "Punya penjelasan", aiLine: "Ada konteksnya.", posMentions: 100, negMentions: 900 }),
          makeIssue({ id: "without", title: "Tanpa penjelasan", aiLine: "", posMentions: 100, negMentions: 900 }),
        ]}
      />,
    );
    const boxes = screen.getAllByTestId("issue-ailine");
    expect(boxes).toHaveLength(2); // rendered for both, not conditionally dropped
    for (const b of boxes) expect(b.className).toContain("min-h-[2.75em]");
  });

  it("shows a shimmering skeleton (no real rows) while the feed is loading", () => {
    render(<IssueBoard issues={[]} loading />);
    expect(screen.getByTestId("issue-skeleton-negative")).toBeInTheDocument();
    expect(screen.getByTestId("issue-skeleton-positive")).toBeInTheDocument();
    expect(screen.getByTestId("ceo-issues").textContent).toContain("Loading…");
    expect(screen.queryByTestId("issue-group-negative")).not.toBeInTheDocument();
    expect(screen.queryAllByTestId(/^issue-row-/)).toHaveLength(0);
  });

  it("renders the real groups (no skeleton) once data has arrived", () => {
    render(<IssueBoard issues={issues} />);
    expect(screen.queryByTestId("issue-skeleton-negative")).not.toBeInTheDocument();
    expect(screen.getByTestId("issue-group-negative")).toBeInTheDocument();
  });

  it("renders the topic title compact for the side-by-side columns, at/above the 16px floor (text-lg = 18px)", () => {
    render(<IssueBoard issues={issues} />);
    const title = screen.getAllByTestId("issue-title")[0];
    expect(title.className).toContain("text-lg");
    expect(title.className).not.toContain("text-2xl");
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

  it("titles the board '{brand} Issues' — Danantara by default, overridable to BGN (A7 v47.1)", () => {
    const { rerender } = render(<IssueBoard issues={issues} />);
    expect(screen.getByTestId("ceo-issues").textContent).toContain("Danantara Issues");
    rerender(<IssueBoard issues={issues} brand="BGN" />);
    expect(screen.getByTestId("ceo-issues").textContent).toContain("BGN Issues");
    expect(screen.getByTestId("ceo-issues").textContent).not.toContain("Danantara Issues");
  });
});
