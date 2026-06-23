// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CeoIssue } from "@/lib/danantara/ceo/types";
import { DanantaraBrief } from "./DanantaraBrief";

function mkIssue(over: Partial<CeoIssue> & Pick<CeoIssue, "id" | "title">): CeoIssue {
  return {
    category: "kebijakan",
    relatedBumn: [],
    mentions: 1_000_000,
    reach: 5_000_000,
    sentiment: 0,
    history: [],
    headlines: [],
    aiLine: "Konteks singkat.",
    velocity: 0,
    status: "normal",
    rankHistory: [],
    rankDelta: 0,
    posMentions: 500_000,
    negMentions: 200_000,
    ...over,
  };
}

const PAYLOAD = {
  issues: [
    mkIssue({ id: "win", title: "Obligasi Global Perdana", reach: 30_000_000, posMentions: 800_000, negMentions: 100_000 }),
    mkIssue({ id: "bad", title: "Transparansi dan Tata Kelola", reach: 20_000_000, posMentions: 100_000, negMentions: 800_000 }),
  ],
  summary: { total_impressions: 12_000_000, total_reach: 8_000_000, percentage: { positive: 58, negative: 27, neutral: 15 } },
  intent: [{ intent: "Investasi", deskripsi: "x", impressions: 9_000_000, share_of_voice: 60 }],
};

// A clearly rising daily series with a partial trailing day → "Improving".
const TREND = {
  points: [
    { date: "1", positive: 100, negative: 300, neutral: 0 },
    { date: "2", positive: 200, negative: 200, neutral: 0 },
    { date: "3", positive: 300, negative: 100, neutral: 0 },
    { date: "4", positive: 400, negative: 50, neutral: 0 },
    { date: "today", positive: 0, negative: 1, neutral: 2 },
  ],
};

function stubFetch(topicsStatus = 200, trendStatus = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes("sentiment-trend")) return new Response(JSON.stringify(TREND), { status: trendStatus });
      return new Response(JSON.stringify(PAYLOAD), { status: topicsStatus });
    }),
  );
}

describe("DanantaraBrief (A11 — Executive Briefing)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("renders the verdict, both driver cards, share of voice and the topic list (AC1–AC4)", async () => {
    stubFetch();
    render(<DanantaraBrief />);
    await waitFor(() => expect(screen.getByTestId("brief-verdict").textContent).toContain("broadly positive"));
    expect(screen.getByTestId("brief-driver-win").textContent).toContain("Obligasi Global Perdana");
    expect(screen.getByTestId("brief-driver-concern").textContent).toContain("Transparansi dan Tata Kelola");
    expect(screen.getByTestId("brief-topics")).toBeInTheDocument();
    expect(screen.getByTestId("brief-topic-win")).toBeInTheDocument();
  });

  it("offers a back link to the crisis gate", async () => {
    stubFetch();
    render(<DanantaraBrief />);
    const back = await screen.findByTestId("brief-back-link");
    expect(back).toHaveAttribute("href", "/danantara/krisis");
  });

  it("hides the 7-day sentiment momentum (AC7 currently disabled)", async () => {
    stubFetch();
    render(<DanantaraBrief />);
    await waitFor(() => expect(screen.getByTestId("brief-verdict")).toBeInTheDocument());
    expect(screen.queryByTestId("sentiment-momentum")).not.toBeInTheDocument();
  });

  it("opens the topic detail modal on click (AC4)", async () => {
    stubFetch();
    render(<DanantaraBrief />);
    const row = await screen.findByTestId("brief-topic-bad");
    fireEvent.click(row);
    expect(screen.getByTestId("ceo-detail-issue")).toBeInTheDocument();
  });

  it("degrades to an offline state when the feed fails (AC5)", async () => {
    stubFetch(502);
    render(<DanantaraBrief />);
    await waitFor(() => expect(screen.getByTestId("brief-offline")).toBeInTheDocument());
    expect(screen.getByTestId("brief-offline").textContent).toContain("Data unavailable");
  });
});
