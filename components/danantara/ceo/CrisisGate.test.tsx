// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CeoIssue } from "@/lib/danantara/ceo/types";
import { CrisisGate } from "./CrisisGate";

function mkIssue(over: Partial<CeoIssue> & Pick<CeoIssue, "id" | "title">): CeoIssue {
  return {
    category: "kebijakan",
    relatedBumn: [],
    mentions: 1000,
    reach: 9_000_000,
    sentiment: -40,
    history: [],
    headlines: [],
    aiLine: "",
    velocity: 0,
    status: "normal",
    rankHistory: [],
    rankDelta: 0,
    posMentions: 200,
    negMentions: 600,
    ...over,
  };
}

const TOPICS = {
  issues: [
    mkIssue({ id: "t0", title: "Investasi Hilirisasi Nikel", reach: 50_000_000, negMentions: 850, sentiment: -64 }),
    mkIssue({ id: "t1", title: "Topik Positif", reach: 5_000_000, negMentions: 80, posMentions: 700, sentiment: 50 }),
  ],
  summary: { total_impressions: 0, total_reach: 0, percentage: { positive: 22, negative: 70, neutral: 8 } },
};

function stubFetch(status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(TOPICS), { status })),
  );
}

describe("CrisisGate (A10 — fear-first landing)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("renders the index, band word and the named biggest threat (AC1–AC3)", async () => {
    stubFetch();
    render(<CrisisGate />);
    // Score settles to its computed value (count-up).
    await waitFor(() => expect(screen.getByTestId("crisis-score").textContent).toBe("75"), { timeout: 3000 });
    expect(screen.getByTestId("crisis-band").textContent).toBe("Awas"); // Severe → Indonesian label
    const threat = screen.getByTestId("crisis-threat");
    expect(threat.textContent).toContain("Investasi Hilirisasi Nikel");
  });

  it("drills through to the Executive Briefing (AC4)", async () => {
    stubFetch();
    render(<CrisisGate />);
    const link = await screen.findByTestId("crisis-detail-link");
    expect(link).toHaveAttribute("href", "/danantara/brief");
  });

  it("degrades to an offline state when the feed fails, without crashing (AC5)", async () => {
    stubFetch(502);
    render(<CrisisGate />);
    await waitFor(() => expect(screen.getByTestId("crisis-offline")).toBeInTheDocument());
    expect(screen.getByTestId("crisis-offline").textContent).toContain("Data unavailable");
    expect(screen.getByTestId("crisis-detail-link")).toHaveAttribute("href", "/danantara/brief");
  });
});
