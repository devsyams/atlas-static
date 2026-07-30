// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BumnSentiment, CeoIssue } from "@/lib/danantara/ceo/types";
import type { ThreatDriver } from "@/lib/danantara/ceo/threats-source";
import { DanantaraCommandCenter } from "./DanantaraCommandCenter";

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
    reach: 1_000_000,
    posReach: 200_000,
    negReach: 700_000,
  };
}

const SLUGS = ["mandiri", "pln", "telkom", "pertamina", "bni", "bri", "jasamarga"];

const TOPICS = {
  issues: [
    mkIssue({ id: "t0", title: "Investasi Hilirisasi Nikel", reach: 50_000_000, negMentions: 850, sentiment: -64 }),
    mkIssue({ id: "t1", title: "Topik Positif", reach: 5_000_000, negMentions: 80, posMentions: 700, sentiment: 50 }),
  ],
  summary: { total_impressions: 0, total_reach: 0, percentage: { positive: 22, negative: 70, neutral: 8 } },
};

const BOARD = {
  bumn: SLUGS.map((s, i) => mkBumn(s, -60 + i * 10)),
  issues: SLUGS.flatMap((s) => [
    mkIssue({ id: `${s}-neg`, title: `${s} negative`, relatedBumn: [s], reach: 9_000_000, posMentions: 100, negMentions: 800 }),
  ]),
};

// Calm window: no detected threat, so panel 2 uses the /topics fallback (A10 v5.2).
const THREATS_EMPTY = { threat: null, stats: { total_threats: 0, high_severity: 0, medium_severity: 0, low_severity: 0 } };

const ROSTER: ThreatDriver[] = [
  {
    handle: "neg_influencer",
    platform: "twitter",
    followers: 1_200_000,
    credibility: 7,
    riskLevel: "high",
    accountType: "Negative Critic",
    bot: false,
    engagement: 0,
    note: "kritik tata kelola",
    avatarUrl: "data:image/jpg;base64,AAAA",
  },
];

/** Route the fetch mock across all four Danantara endpoints. */
function stubFetch({ boardStatus = 200 } = {}) {
  const fetchMock = vi.fn(async (url: string) => {
    const u = String(url);
    if (u.includes("/actor-intelligence")) return new Response(JSON.stringify({ actors: ROSTER }), { status: 200 });
    if (u.includes("/threats")) return new Response(JSON.stringify(THREATS_EMPTY), { status: 200 });
    if (u.includes("bumn-board")) return new Response(JSON.stringify(BOARD), { status: boardStatus });
    return new Response(JSON.stringify(TOPICS), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("DanantaraCommandCenter (A13 — one-page)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("stacks the Crisis Gate and the CEO wall on one page (T2)", async () => {
    stubFetch();
    render(<DanantaraCommandCenter />);
    await waitFor(() => expect(screen.getByTestId("crisis-gate")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByTestId("ceo-wall")).toBeInTheDocument());
  });

  it("shows a single header — the wall's HeaderStrip is suppressed (T3)", async () => {
    stubFetch();
    render(<DanantaraCommandCenter />);
    await waitFor(() => expect(screen.getByTestId("ceo-wall")).toBeInTheDocument());
    expect(screen.queryByTestId("ceo-header")).not.toBeInTheDocument();
    // Exactly one Refresh control on the page.
    expect(screen.getAllByLabelText("Refresh")).toHaveLength(1);
  });

  it("one Refresh click refetches both blocks with fresh=1, with no double-fetch (T4)", async () => {
    const fetchMock = stubFetch();
    render(<DanantaraCommandCenter />);
    await waitFor(() => expect(screen.getByTestId("ceo-wall")).toBeInTheDocument());

    fetchMock.mockClear();
    fireEvent.click(screen.getByLabelText("Refresh"));

    await waitFor(() => {
      const urls = fetchMock.mock.calls.map((c) => String(c[0]));
      expect(urls.filter((u) => u.includes("/topics") && u.includes("fresh=1"))).toHaveLength(2);
      expect(urls.filter((u) => u.includes("/threats") && u.includes("fresh=1"))).toHaveLength(1);
      expect(urls.filter((u) => u.includes("/actor-intelligence") && u.includes("fresh=1"))).toHaveLength(1);
      expect(urls.filter((u) => u.includes("bumn-board") && u.includes("fresh=1"))).toHaveLength(1);
      // Exact total: 5 requests. More would mean onRefresh AND the nonce both fetched.
      expect(urls).toHaveLength(5);
    });
  });

  it("keeps the crisis index live when the BUMN board feed fails (T5)", async () => {
    stubFetch({ boardStatus: 502 });
    render(<DanantaraCommandCenter />);
    await waitFor(() => expect(screen.getByTestId("crisis-score").textContent).toMatch(/\d/));
    expect(screen.getByTestId("ceo-wall")).toBeInTheDocument();
  });
});
