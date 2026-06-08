// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CeoIssue } from "@/lib/danantara/ceo/types";
import { BumnDashboard } from "./BumnDashboard";

function issue(over: Partial<CeoIssue> & Pick<CeoIssue, "id" | "title">): CeoIssue {
  return {
    category: "kebijakan",
    relatedBumn: [],
    mentions: 1000,
    reach: 9_000_000,
    sentiment: -40,
    history: Array.from({ length: 8 }, () => 1000),
    headlines: [],
    aiLine: "",
    velocity: 0,
    status: "normal",
    rankHistory: [1, 1, 1, 1, 1, 1, 1, 1],
    rankDelta: 0,
    posMentions: 200,
    negMentions: 600,
    ...over,
  };
}

const FULL = {
  issues: [issue({ id: "t0", title: "Topik Uji PLN", aiLine: "Penjelasan topik ini.", reach: 9_000_000, mentions: 1000 })],
  summary: { total_impressions: 1000, total_reach: 9_000_000, percentage: { positive: 20, negative: 60, neutral: 20 } },
  intent: [
    { intent: "Kritik Kebijakan", deskripsi: "", impressions: 100, share_of_voice: 61 },
    { intent: "Berita dan Informasi", deskripsi: "", impressions: 30, share_of_voice: 10 },
  ],
  meta: { topic: "danantara_pln", startdate: "2026-05-31", enddate: "2026-06-07" },
};

const EMPTY = {
  issues: [],
  summary: null,
  intent: [{ intent: "Berita dan Informasi", deskripsi: "", impressions: 1, share_of_voice: 100 }],
  meta: { topic: "danantara_bri", startdate: "2026-05-31", enddate: "2026-06-07" },
};

const TINY_TEXT = /text-(?:xs|sm)(?![\w-])|text-\[(?:[1-9]|1[0-5])(?:\.\d+)?px\]/;

describe("BumnDashboard (A8)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows a shimmering topics skeleton while the feed has not responded yet", () => {
    // A fetch that never resolves keeps the dashboard in its loading state.
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    render(<BumnDashboard name="PLN" topicCode="danantara_pln" />);
    expect(screen.getByTestId("bumn-topics-skeleton")).toBeInTheDocument();
    expect(screen.queryByTestId("bumn-empty")).not.toBeInTheDocument();
  });

  it("renders the sentiment summary, intent share leaderboard, and a full topic row (T6 / T8 / AC3-5)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(FULL), { status: 200 })));
    render(<BumnDashboard name="PLN" topicCode="danantara_pln" />);

    await waitFor(() => expect(screen.getAllByText("Topik Uji PLN").length).toBeGreaterThan(0));
    // Sentiment summary (new verdict viz) + intent share leaderboard present.
    expect(screen.getByTestId("sentiment-summary")).toBeInTheDocument();
    expect(screen.getByTestId("sentiment-verdict")).toBeInTheDocument();
    expect(screen.getByTestId("intent-share")).toBeInTheDocument();
    // Topic detail bits + an explicit per-topic sentiment badge.
    const list = screen.getByTestId("bumn-topics");
    expect(list.textContent).toContain("Penjelasan topik ini."); // description
    expect(list.textContent).toContain("Impressions");
    expect(list.textContent).toContain("Reach");
    expect(screen.getAllByTestId("topic-sentiment")[0].textContent).toMatch(/negative/i); // pos200/neg600 → Negative
  });

  it("calls the BFF with the BUMN's code", async () => {
    let calledUrl = "";
    const fetchMock = vi.fn(async (url: string) => {
      calledUrl = String(url);
      return new Response(JSON.stringify(FULL), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<BumnDashboard name="PLN" topicCode="danantara_pln" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(calledUrl).toContain("code=danantara_pln");
  });

  it("shows the empty-topics state but still renders the intent share leaderboard (T9 / AC6)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(EMPTY), { status: 200 })));
    render(<BumnDashboard name="Bank BRI" topicCode="danantara_bri" />);

    await waitFor(() => expect(screen.getByTestId("intent-share")).toBeInTheDocument());
    expect(screen.getByTestId("bumn-empty")).toBeInTheDocument();
    expect(screen.getByText(/no topics/i)).toBeInTheDocument();
  });

  it("uses a readable type scale (no text below 16px) and a v2-style header (T12 / AC8)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(FULL), { status: 200 })));
    const { container } = render(<BumnDashboard name="PLN" topicCode="danantara_pln" />);
    await waitFor(() => expect(screen.getAllByText("Topik Uji PLN").length).toBeGreaterThan(0));

    const offenders = [...container.querySelectorAll("*")]
      .map((el) => el.getAttribute("class") ?? "")
      .filter((c) => TINY_TEXT.test(c));
    expect(offenders).toEqual([]);
    // Header h1 carries the BUMN name.
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("PLN");
  });
});
