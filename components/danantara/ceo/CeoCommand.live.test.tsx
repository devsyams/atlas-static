// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CeoIssue } from "@/lib/danantara/ceo/types";
import { CeoCommand } from "./CeoCommand";

/** A ready-mapped CeoIssue, as the BFF route returns it. */
function liveIssue(over: Partial<CeoIssue> & Pick<CeoIssue, "id" | "title">): CeoIssue {
  return {
    category: "kebijakan",
    relatedBumn: [],
    mentions: 1000,
    reach: 9_000_000,
    sentiment: -60,
    history: Array.from({ length: 8 }, () => 1000),
    headlines: [],
    aiLine: "",
    velocity: 0,
    status: "normal",
    rankHistory: [1, 1, 1, 1, 1, 1, 1, 1],
    rankDelta: 0,
    posMentions: 100,
    negMentions: 800,
    ...over,
  };
}

const PAYLOAD = {
  issues: [liveIssue({ id: "live-1", title: "LIVE FEED TOPIC ALPHA" })],
  summary: { total_impressions: 1000, total_reach: 9_000_000, percentage: { positive: 10, negative: 80, neutral: 10 } },
  intent: [],
  meta: { topic: "danantara_main", startdate: "2026-05-10", enddate: "2026-06-07" },
};

describe("CeoCommand live topics feed (T21 / AC19)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("renders topics from the BFF when the fetch resolves", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(PAYLOAD), { status: 200 })),
    );
    render(<CeoCommand />);
    await waitFor(() => expect(screen.getByText("LIVE FEED TOPIC ALPHA")).toBeInTheDocument());
  });

  it("falls back to the seeded mock topics when the BFF fetch fails (graceful degradation)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("unavailable", { status: 502 })),
    );
    render(<CeoCommand />);
    // The wall never blanks: the 20 seeded rows stay, and a known seed title is present.
    await waitFor(() => expect(screen.getAllByTestId(/^issue-row-/).length).toBe(20));
    expect(screen.getAllByText("Transparansi & tata kelola dana kelolaan").length).toBeGreaterThan(0);
    expect(screen.getAllByTestId(/^bumn-tile-/).length).toBe(20);
  });
});
