// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BumnSentiment, CeoIssue } from "@/lib/danantara/ceo/types";
import { CeoCommand } from "./CeoCommand";

function mkIssue(over: Partial<CeoIssue> & Pick<CeoIssue, "id" | "title">): CeoIssue {
  return {
    category: "kebijakan",
    relatedBumn: [],
    mentions: 1000,
    reach: 9_000_000,
    sentiment: -40,
    history: Array.from({ length: 8 }, () => 1000),
    headlines: [],
    aiLine: "Konteks singkat.",
    velocity: 0,
    status: "normal",
    rankHistory: [1, 1, 1, 1, 1, 1, 1, 1],
    rankDelta: 0,
    posMentions: 200,
    negMentions: 600,
    ...over,
  };
}

function mkBumn(slug: string, sentiment: number): BumnSentiment {
  return {
    id: slug,
    name: slug,
    short: slug.toUpperCase(),
    sector: "energi",
    sentiment,
    mentions: 1000,
    trend: Array.from({ length: 8 }, () => sentiment),
    topIssueId: `${slug}-neg`,
    rankHistory: Array.from({ length: 8 }, () => 1),
    rankDelta: 0,
    posMentions: 200,
    negMentions: 700,
  };
}

const SLUGS = ["mandiri", "pln", "telkom", "pertamina", "bni", "bri", "jasamarga"];

const TOPICS = {
  issues: [
    mkIssue({ id: "t0", title: "Danantara Topic A", reach: 50_000_000, posMentions: 100, negMentions: 800, sentiment: -60 }),
    mkIssue({ id: "t1", title: "Danantara Topic B", reach: 30_000_000, posMentions: 700, negMentions: 100, sentiment: 50 }),
  ],
};

const BOARD = {
  bumn: SLUGS.map((s, i) => mkBumn(s, -60 + i * 10)),
  issues: SLUGS.flatMap((s) => [
    mkIssue({ id: `${s}-neg`, title: `${s} negative`, relatedBumn: [s], reach: 9_000_000, posMentions: 100, negMentions: 800 }),
    mkIssue({ id: `${s}-pos`, title: `${s} positive`, relatedBumn: [s], reach: 5_000_000, posMentions: 800, negMentions: 100 }),
  ]),
};

function stubFetch({ topicsStatus = 200, boardStatus = 200 } = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes("bumn-board")) return new Response(JSON.stringify(BOARD), { status: boardStatus });
      return new Response(JSON.stringify(TOPICS), { status: topicsStatus });
    }),
  );
}

describe("CeoCommand — live wall (v37.0)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("renders all four zones from the live feeds (AC1)", async () => {
    stubFetch();
    render(<CeoCommand />);
    expect(screen.getByTestId("ceo-header")).toBeInTheDocument();
    expect(screen.getByTestId("ceo-ticker")).toBeInTheDocument();
    expect(screen.getByTestId("ceo-issues")).toBeInTheDocument();
    expect(screen.getByTestId("ceo-bumn")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Danantara Topic A")).toBeInTheDocument());
  });

  it("renders the topic rows from /topics and the 7 BUMN from /bumn-board (AC3, AC20)", async () => {
    stubFetch();
    render(<CeoCommand />);
    await waitFor(() => expect(screen.getAllByTestId(/^issue-row-/)).toHaveLength(2));
    expect(screen.getAllByTestId(/^bumn-tile-/)).toHaveLength(7);
  });

  it("uses a two-column wall, no spotlight/takeover (AC11)", async () => {
    stubFetch();
    render(<CeoCommand />);
    const wall = screen.getByTestId("ceo-wall");
    expect(wall.className).toContain("grid-cols-1");
    expect(wall.className).toContain("xl:grid-cols-2");
    expect(screen.queryByTestId("ceo-spotlight")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ceo-takeover")).not.toBeInTheDocument();
  });

  it("opens issue detail on row click and closes on Esc (AC10)", async () => {
    stubFetch();
    render(<CeoCommand />);
    const btn = await screen.findByTestId("btn-issue-row-t0");
    fireEvent.click(btn);
    expect(screen.getByTestId("ceo-detail-issue")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("ceo-detail")).not.toBeInTheDocument();
  });

  it("links the BUMN logo to that BUMN's dashboard (v40.0)", async () => {
    stubFetch();
    render(<CeoCommand />);
    const link = await screen.findByTestId("btn-bumn-tile-pln");
    expect(link).toHaveAttribute("href", "/bumn/pln");
  });

  it("clicking a BUMN topic opens that topic's detail (v40.0)", async () => {
    stubFetch();
    render(<CeoCommand />);
    const tile = await screen.findByTestId("bumn-tile-pln");
    const negCell = tile.querySelector("[data-testid='bumn-topic-negative']") as HTMLElement;
    fireEvent.click(negCell);
    expect(screen.getByTestId("ceo-detail-issue")).toBeInTheDocument();
  });

  it("shows an offline state when the topics feed fails — no mock fallback (AC1 v37.0)", async () => {
    stubFetch({ topicsStatus: 502 });
    render(<CeoCommand />);
    await waitFor(() => expect(screen.getByTestId("ceo-header").textContent).toContain("Offline"));
    // No seeded fallback rows.
    expect(screen.queryAllByTestId(/^issue-row-/)).toHaveLength(0);
  });

  it("manual refresh re-hits both feeds with ?fresh=1 (v37.0)", async () => {
    stubFetch();
    render(<CeoCommand />);
    await waitFor(() => expect(screen.getByText("Danantara Topic A")).toBeInTheDocument());
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const before = fetchMock.mock.calls.length;
    fireEvent.click(screen.getByTestId("ceo-refresh"));
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(before));
    const urls = fetchMock.mock.calls.map((c: unknown[]) => String(c[0]));
    expect(urls.some((u: string) => u.includes("topics?fresh=1"))).toBe(true);
    expect(urls.some((u: string) => u.includes("bumn-board?fresh=1"))).toBe(true);
  });

  const TINY_TEXT = /text-(?:xs|sm)(?![\w-])|text-\[(?:[1-9]|1[0-5])(?:\.\d+)?px\]/;
  it("renders no text smaller than 16px on the wall (AC15)", async () => {
    stubFetch();
    const { container } = render(<CeoCommand />);
    await waitFor(() => expect(screen.getAllByTestId(/^bumn-tile-/)).toHaveLength(7));
    const offenders = [...container.querySelectorAll("*")]
      .map((el) => el.getAttribute("class") ?? "")
      .filter((c) => TINY_TEXT.test(c));
    expect(offenders).toEqual([]);
  });

  it("header key numbers are at least 24px (AC15)", async () => {
    stubFetch();
    render(<CeoCommand />);
    const metrics = screen.getAllByTestId("metric-value");
    expect(metrics.length).toBeGreaterThanOrEqual(2);
    for (const el of metrics) expect(el.className).toMatch(/text-(?:2xl|3xl|4xl)/);
  });
});
