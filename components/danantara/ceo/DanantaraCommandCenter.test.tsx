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

/** Route the fetch mock across the Danantara endpoints (incl. the now-unused board). */
function stubFetch({ boardStatus = 200, rosterStatus = 200 } = {}) {
  const fetchMock = vi.fn(async (url: string) => {
    const u = String(url);
    if (u.includes("counter-narrative")) return new Response(JSON.stringify({ source: "scripted" }), { status: 200 });
    if (u.includes("/actor-intelligence"))
      return new Response(JSON.stringify({ actors: ROSTER }), { status: rosterStatus });
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
    await waitFor(() => expect(screen.getByTestId("danantara-command-center")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByTestId("crisis-gate")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByTestId("ceo-wall")).toBeInTheDocument());
  });

  it("adds the Counter-Narrative War Room as the third section, in order (T11)", async () => {
    stubFetch();
    const { container } = render(<DanantaraCommandCenter />);
    await waitFor(() => expect(screen.getByTestId("counter-war-room")).toBeInTheDocument());

    const order = [...container.querySelectorAll("[data-testid]")]
      .map((el) => el.getAttribute("data-testid"))
      .filter((id) => id === "crisis-gate" || id === "ceo-wall" || id === "counter-war-room");
    expect(order).toEqual(["crisis-gate", "ceo-wall", "counter-war-room"]);
  });

  it("shows a single header — the wall's HeaderStrip is suppressed (T3)", async () => {
    stubFetch();
    render(<DanantaraCommandCenter />);
    await waitFor(() => expect(screen.getByTestId("ceo-wall")).toBeInTheDocument());
    expect(screen.queryByTestId("ceo-header")).not.toBeInTheDocument();
    // Exactly one Refresh control on the page (accessible name from content —
    // the gate's button has no aria-label, only `getByRole`'s name-from-content
    // computation would catch it going missing).
    expect(screen.getAllByRole("button", { name: /refresh/i })).toHaveLength(1);
  });

  it("one Refresh click refetches both blocks with fresh=1, with no double-fetch (T4)", async () => {
    const fetchMock = stubFetch();
    render(<DanantaraCommandCenter />);
    await waitFor(() => expect(screen.getByTestId("ceo-wall")).toBeInTheDocument());

    fetchMock.mockClear();
    fireEvent.click(screen.getByLabelText("Refresh"));

    await waitFor(() => {
      const urls = fetchMock.mock.calls.map((c) => String(c[0]));
      // /topics once per block: gate, wall, and (v3.0) the war room.
      expect(urls.filter((u) => u.includes("/topics") && u.includes("fresh=1"))).toHaveLength(3);
      expect(urls.filter((u) => u.includes("/threats") && u.includes("fresh=1"))).toHaveLength(1);
      expect(urls.filter((u) => u.includes("/actor-intelligence") && u.includes("fresh=1"))).toHaveLength(1);
      // Exact total: 5 feed requests. More would mean onRefresh AND the nonce both
      // fetched. (The war room's own POST to /counter-narrative is not a feed read
      // and is filtered out below.)
      expect(urls.filter((u) => !u.includes("counter-narrative"))).toHaveLength(5);
    });
  });

  it("keeps the CEO wall mounted when the actor roster feed fails (T5)", async () => {
    stubFetch({ rosterStatus: 502 });
    render(<DanantaraCommandCenter />);
    await waitFor(() => expect(screen.getByTestId("crisis-score").textContent).toMatch(/\d/));
    expect(screen.getByTestId("ceo-wall")).toBeInTheDocument();
  });

  it("carries no BUMN sentiment section and never fetches /bumn-board (T9)", async () => {
    const fetchMock = stubFetch();
    render(<DanantaraCommandCenter />);
    await waitFor(() => expect(screen.getByTestId("ceo-issues")).toBeInTheDocument());
    expect(screen.queryByTestId("ceo-bumn")).not.toBeInTheDocument();
    expect(screen.queryAllByTestId(/^bumn-tile-/)).toHaveLength(0);
    expect(fetchMock.mock.calls.map((c) => String(c[0])).filter((u) => u.includes("bumn-board"))).toHaveLength(0);
  });

  // A13 v5.0 — page-wide date window; default 7 hari since v6.0.
  it("threads the window: all three /topics reads mount with days=7; a preset switch re-windows all three (T19)", async () => {
    const fetchMock = stubFetch();
    render(<DanantaraCommandCenter />);
    await waitFor(() => expect(screen.getByTestId("counter-war-room")).toBeInTheDocument());

    await waitFor(() => {
      const mountTopics = fetchMock.mock.calls.map((c) => String(c[0])).filter((u) => u.includes("/topics"));
      expect(mountTopics).toHaveLength(3); // gate · wall · war room
      for (const u of mountTopics) expect(u).toContain("days=7");
    });

    fetchMock.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "30 hari" }));

    await waitFor(() => {
      const urls = fetchMock.mock.calls.map((c) => String(c[0])).filter((u) => !u.includes("counter-narrative"));
      expect(urls.filter((u) => u.includes("/topics") && u.includes("days=30"))).toHaveLength(3);
      // Not date-range based — must not refetch on a preset switch.
      expect(urls.filter((u) => u.includes("/threats") || u.includes("/actor-intelligence"))).toHaveLength(0);
    });
  });

  it("still shows the Danantara issue board — negative and positive topics (T9)", async () => {
    stubFetch();
    render(<DanantaraCommandCenter />);
    await waitFor(() => expect(screen.getByTestId("issue-group-negative")).toBeInTheDocument());
    expect(screen.getByTestId("issue-group-positive")).toBeInTheDocument();
    // The negative topic also headlines the gate above, so scope to the board.
    expect(screen.getByTestId("issue-group-negative").textContent).toContain("Investasi Hilirisasi Nikel");
    expect(screen.getByTestId("issue-group-positive").textContent).toContain("Topik Positif");
  });

  // A13 v4.0 — the BGN page threads brand + mock into every pane.
  it("threads brand + mock into every pane when set (T15/T18)", async () => {
    const fetchMock = stubFetch();
    render(<DanantaraCommandCenter brand="BGN" brandLogo="/bgn.png" mock />);
    await waitFor(() => expect(screen.getByTestId("ceo-issues")).toBeInTheDocument());
    // Brand reached the gate title + the issue board.
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("BGN");
    expect(screen.getByTestId("ceo-issues").textContent).toContain("BGN Issues");
    // Mock reached every feed read (topics ×3, threats, actor-intelligence) — but not
    // the war room's /counter-narrative POST, which drafts over the mocked topics.
    await waitFor(() => {
      const feeds = fetchMock.mock.calls
        .map((c) => String(c[0]))
        .filter((u) => u.includes("/api/v1/danantara/") && !u.includes("counter-narrative"));
      expect(feeds.length).toBeGreaterThanOrEqual(5);
      expect(feeds.every((u) => u.includes("mock=1"))).toBe(true);
    });
  });

  // A13 v6.2 — the BGN page repoints the gate's "View briefing" at /bgn/briefing.
  it("threads briefingHref to the gate's View briefing link (A13 v6.2)", async () => {
    stubFetch();
    render(<DanantaraCommandCenter brand="BGN" brandLogo="/bgn.png" briefingHref="/bgn/briefing" />);
    await waitFor(() =>
      expect(screen.getByTestId("crisis-detail-link")).toHaveAttribute("href", "/bgn/briefing"),
    );
  });

  // A13 v6.3 — the BGN page opts panel 3 onto the captured static roster.
  it("threads staticActors to the gate — only the actor-intelligence fetch carries static=1 (T21)", async () => {
    const fetchMock = stubFetch();
    render(<DanantaraCommandCenter brand="BGN" brandLogo="/bgn.png" staticActors />);
    await waitFor(() => expect(screen.getByTestId("ceo-issues")).toBeInTheDocument());
    await waitFor(() => {
      const feeds = fetchMock.mock.calls
        .map((c) => String(c[0]))
        .filter((u) => u.includes("/api/v1/danantara/") && !u.includes("counter-narrative"));
      expect(feeds.some((u) => u.includes("/actor-intelligence") && u.includes("static=1"))).toBe(true);
      expect(feeds.filter((u) => u.includes("static=1"))).toEqual(feeds.filter((u) => u.includes("/actor-intelligence")));
    });
  });

  it("defaults to Danantara branding and sends no mock=1 (regression)", async () => {
    const fetchMock = stubFetch();
    render(<DanantaraCommandCenter />);
    await waitFor(() => expect(screen.getByTestId("ceo-issues")).toBeInTheDocument());
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Danantara");
    expect(screen.getByTestId("ceo-issues").textContent).toContain("Danantara Issues");
    expect(fetchMock.mock.calls.map((c) => String(c[0])).some((u) => u.includes("mock=1"))).toBe(false);
  });
});
