// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CeoIssue } from "@/lib/danantara/ceo/types";
import type { DetectedThreat, ThreatDriver } from "@/lib/danantara/ceo/threats-source";
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

// Panel 1 (the gauge) reads /topics — drives the Crisis Index score/band.
const TOPICS = {
  issues: [
    mkIssue({ id: "t0", title: "Investasi Hilirisasi Nikel", reach: 50_000_000, negMentions: 850, sentiment: -64 }),
    mkIssue({ id: "t1", title: "Topik Positif", reach: 5_000_000, negMentions: 80, posMentions: 700, sentiment: 50 }),
  ],
  summary: { total_impressions: 0, total_reach: 0, percentage: { positive: 22, negative: 70, neutral: 8 } },
};

// Two negatives — for the fallback test: the biggest (t0) becomes the headline; t2 stays in the top-3.
const TOPICS_2NEG = {
  issues: [
    mkIssue({ id: "t0", title: "Investasi Hilirisasi Nikel", reach: 50_000_000, negMentions: 850, sentiment: -64 }),
    mkIssue({ id: "t2", title: "Sorotan Transparansi Danantara", reach: 20_000_000, negMentions: 600, sentiment: -20 }),
    mkIssue({ id: "t1", title: "Topik Positif", reach: 5_000_000, negMentions: 80, posMentions: 700, sentiment: 50 }),
  ],
  summary: { total_impressions: 0, total_reach: 0, percentage: { positive: 22, negative: 70, neutral: 8 } },
};

// Panel 2 reads /threats — the detected threat headline only (v5.3: no drivers here).
const THREAT: DetectedThreat = {
  id: "threat_1",
  title: "Tuduhan Manipulasi Keuangan dan Korupsi",
  severityClass: "high",
  severity: 8,
  intelligence: "…",
  impact: "merusak reputasi…",
  threatType: "internal_negative",
  postsCount: 8,
  growthRate: "+15%",
  totalEngagement: 1383,
  platforms: ["twitter"],
  trendingKeywords: ["Patriot Bond", "korupsi"],
  timeToViral: 24,
  recommendedActions: [],
  drivers: [
    // These live on the threat but are NO LONGER used for panel 3 (v5.3) — kept to prove decoupling.
    { handle: "nocturnalforsa1", platform: "twitter", followers: 31, credibility: 2, riskLevel: "low", accountType: "real_person", bot: false, engagement: 1361, note: "complainer" },
  ],
};
const THREATS = { threat: THREAT, stats: { total_threats: 1, high_severity: 1, medium_severity: 0, low_severity: 0 } };
const THREATS_EMPTY = { threat: null, stats: { total_threats: 0, high_severity: 0, medium_severity: 0, low_severity: 0 } };

// Panel 3 reads /actor-intelligence — always (v5.3).
const ROSTER_DRIVERS: ThreatDriver[] = [
  { handle: "neg_influencer", platform: "twitter", followers: 1_200_000, credibility: 7, riskLevel: "high", accountType: "Negative Critic", bot: false, engagement: 0, note: "kritik tata kelola", avatarUrl: "data:image/jpg;base64,AAAA" },
];
const ROSTER_RESPONSE = { actors: ROSTER_DRIVERS };

/** Route the fetch mock by URL: /actor-intelligence, /threats, or /topics. */
function stubFetch({
  topics = TOPICS,
  threats = THREATS,
  roster = ROSTER_RESPONSE,
  topicsStatus = 200,
  threatsStatus = 200,
  rosterStatus = 200,
}: {
  topics?: unknown;
  threats?: unknown;
  roster?: unknown;
  topicsStatus?: number;
  threatsStatus?: number;
  rosterStatus?: number;
} = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes("/actor-intelligence")) return new Response(JSON.stringify(roster), { status: rosterStatus });
      if (u.includes("/threats")) return new Response(JSON.stringify(threats), { status: threatsStatus });
      return new Response(JSON.stringify(topics), { status: topicsStatus });
    }),
  );
}

describe("CrisisGate (A10 — fear-first landing)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("renders the index + band from /topics and the detected threat from /threats (AC1–AC3, AC8)", async () => {
    stubFetch();
    render(<CrisisGate />);
    await waitFor(() => expect(screen.getByTestId("crisis-score").textContent).toBe("75"), { timeout: 3000 });
    expect(screen.getByTestId("crisis-band").textContent).toBe("Awas");
    await waitFor(() => expect(screen.getByTestId("crisis-threat").textContent).toContain("Tuduhan Manipulasi Keuangan"));
  });

  it("shows the /actor-intelligence roster in the actors column even when a threat is detected (AC11, T22)", async () => {
    stubFetch(); // a detected threat IS present
    render(<CrisisGate />);
    // Panel 3 shows the roster account (with avatar), not the threat's own drivers.
    await waitFor(() => expect(screen.getByText("@neg_influencer")).toBeInTheDocument());
    expect(screen.queryByText("@nocturnalforsa1")).not.toBeInTheDocument();
  });

  it("shows the top negative topics (reach + neg share) under the threat (AC8, T15)", async () => {
    stubFetch();
    render(<CrisisGate />);
    await waitFor(() => expect(screen.getByText("Investasi Hilirisasi Nikel")).toBeInTheDocument());
    expect(screen.getByText("85% neg")).toBeInTheDocument();
    expect(screen.getByText("50.0 jt")).toBeInTheDocument();
  });

  it("falls back to the /topics biggest threat when /threats has no incident; roster still shows (AC9/AC11, T16/T17)", async () => {
    stubFetch({ topics: TOPICS_2NEG, threats: THREATS_EMPTY });
    render(<CrisisGate />);
    await waitFor(() => expect(screen.getByTestId("crisis-threat").textContent).toContain("Investasi Hilirisasi Nikel"));
    expect(screen.getByText("Sorotan Transparansi Danantara")).toBeInTheDocument();
    expect(screen.getAllByText("Investasi Hilirisasi Nikel")).toHaveLength(1); // headline not duplicated in the list
    expect(screen.getByText("@neg_influencer")).toBeInTheDocument(); // roster still populates panel 3
  });

  it("drills through to the Executive Briefing (AC4)", async () => {
    stubFetch();
    render(<CrisisGate />);
    const link = await screen.findByTestId("crisis-detail-link");
    expect(link).toHaveAttribute("href", "/danantara/brief");
  });

  it("keeps the Media Intelligence shortcut hidden by default and shows it when the href prop is provided", async () => {
    stubFetch();
    render(<CrisisGate />);
    expect(screen.queryByRole("link", { name: /media intelligence/i })).not.toBeInTheDocument();

    render(<CrisisGate mediaIntelligenceHref="https://opengate.atlas.nexorus-alpha.io" />);
    expect(screen.getByRole("link", { name: /media intelligence/i })).toHaveAttribute(
      "href",
      "https://opengate.atlas.nexorus-alpha.io",
    );
    expect(screen.getByRole("link", { name: /media intelligence/i }).nextElementSibling).toHaveAttribute(
      "href",
      "/danantara/brief",
    );
  });

  it("degrades to an offline state when the topics feed fails, without crashing (AC5)", async () => {
    stubFetch({ topicsStatus: 502 });
    render(<CrisisGate />);
    await waitFor(() => expect(screen.getByTestId("crisis-offline")).toBeInTheDocument());
    expect(screen.getByTestId("crisis-offline").textContent).toContain("Data unavailable");
    expect(screen.getByTestId("crisis-detail-link")).toHaveAttribute("href", "/danantara/brief");
  });

  it("keeps panel 3 (roster) alive when the /threats feed itself fails (AC9/AC11)", async () => {
    stubFetch({ threatsStatus: 502 });
    render(<CrisisGate />);
    // Gauge stays live; middle shows the /topics fallback; panel 3's roster is a separate fetch, so it still shows.
    await waitFor(() => expect(screen.getByTestId("crisis-score").textContent).toBe("75"));
    await waitFor(() => expect(screen.getByTestId("crisis-threat").textContent).toContain("Investasi Hilirisasi Nikel"));
    expect(screen.getByText("@neg_influencer")).toBeInTheDocument();
  });

  // A13 (v5.5) — the props are opt-in; the no-props render must not change.
  it("without props keeps its locked one-screen height — /danantara/krisis unchanged (T7)", async () => {
    stubFetch();
    render(<CrisisGate />);
    await waitFor(() => expect(screen.getByTestId("crisis-gate")).toBeInTheDocument());
    expect(screen.getByTestId("crisis-gate").className).toContain("lg:h-[calc(100dvh-7.75rem)]");
  });

  it("embedded drops the height lock so a page can scroll past it (T6)", async () => {
    stubFetch();
    render(<CrisisGate embedded />);
    await waitFor(() => expect(screen.getByTestId("crisis-gate")).toBeInTheDocument());
    const cls = screen.getByTestId("crisis-gate").className;
    expect(cls).not.toContain("lg:h-[calc(100dvh-7.75rem)]");
    expect(cls).toContain("min-h-[calc(100dvh-9rem)]");
    // overflow-hidden must stay: the crisis-breathe scale(1.06) on the ambient glow
    // would otherwise bleed past the section's edge onto the page below it.
    expect(cls).toContain("overflow-hidden");
  });

  it("embedded fills the first screen on desktop so the meter isn't squeezed (T6b)", async () => {
    stubFetch();
    render(<CrisisGate embedded />);
    await waitFor(() => expect(screen.getByTestId("crisis-gate")).toBeInTheDocument());
    const cls = screen.getByTestId("crisis-gate").className;
    // The desktop min-height must keep filling the first screen. The old `lg:min-h-[28rem]`
    // (carried over from the standalone class, where it was only a floor beneath the
    // now-removed lg:h lock) collapsed the section to 28rem on desktop, squeezing the
    // vh-sized gauge. It must not cap the height back down.
    expect(cls).not.toContain("lg:min-h-[28rem]");
    expect(cls).not.toContain("28rem");
  });

  // A10 v7.0 — the range picker is functional; default 7 hari since v8.0.
  it("mounts with '7 hari' selected and fetches /topics with days=7 (AC7 v8.0, T24)", async () => {
    stubFetch();
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    render(<CrisisGate />);
    await waitFor(() => expect(screen.getByTestId("crisis-gate")).toBeInTheDocument());

    expect(screen.getByRole("button", { name: "7 hari" })).toHaveAttribute("aria-pressed", "true");
    const topicUrls = fetchMock.mock.calls.map((c) => String(c[0])).filter((u) => u.includes("/topics"));
    expect(topicUrls).toHaveLength(1);
    expect(topicUrls[0]).toContain("days=7");
  });

  it("switching the preset refetches only /topics with the new days and fires onRangeChange (AC7 v7.0, T24)", async () => {
    stubFetch();
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const onRangeChange = vi.fn();
    render(<CrisisGate onRangeChange={onRangeChange} />);
    await waitFor(() => expect(screen.getByTestId("crisis-gate")).toBeInTheDocument());

    fetchMock.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "30 hari" }));

    await waitFor(() => {
      const urls = fetchMock.mock.calls.map((c) => String(c[0]));
      expect(urls.filter((u) => u.includes("/topics") && u.includes("days=30"))).toHaveLength(1);
      // The threats + actor feeds are not date-range based — a preset switch must not refetch them.
      expect(urls.filter((u) => u.includes("/threats") || u.includes("/actor-intelligence"))).toHaveLength(0);
    });
    expect(onRangeChange).toHaveBeenCalledWith(30);
    expect(screen.getByRole("button", { name: "30 hari" })).toHaveAttribute("aria-pressed", "true");
  });

  it("refetches all three feeds when refreshNonce changes, and not on mount (T4 support)", async () => {
    stubFetch();
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const { rerender } = render(<CrisisGate refreshNonce={0} />);
    await waitFor(() => expect(screen.getByTestId("crisis-gate")).toBeInTheDocument());
    // Mount with a nonce present must NOT double-fetch: 3 feeds, 3 calls, none fresh.
    expect(fetchMock.mock.calls.filter((c) => String(c[0]).includes("fresh=1"))).toHaveLength(0);

    fetchMock.mockClear();
    rerender(<CrisisGate refreshNonce={1} />);
    await waitFor(() => {
      const fresh = fetchMock.mock.calls.map((c) => String(c[0])).filter((u) => u.includes("fresh=1"));
      expect(fresh).toHaveLength(3);
    });
  });

  it("with onRefresh the header button delegates instead of fetching itself (T4 support)", async () => {
    stubFetch();
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const onRefresh = vi.fn();
    render(<CrisisGate onRefresh={onRefresh} />);
    await waitFor(() => expect(screen.getByTestId("crisis-gate")).toBeInTheDocument());

    fetchMock.mockClear();
    fireEvent.click(screen.getByLabelText("Refresh"));

    expect(onRefresh).toHaveBeenCalledTimes(1);
    // The container owns the refetch (via the nonce) — the button must not also fetch.
    expect(fetchMock.mock.calls.filter((c) => String(c[0]).includes("fresh=1"))).toHaveLength(0);
  });

  // A10 v5.6 — BGN rebrand (opt-in brand/brandLogo/mock props).
  it("keeps the Danantara brand, logo and briefing link by default (regression)", async () => {
    stubFetch();
    render(<CrisisGate />);
    await waitFor(() => expect(screen.getByTestId("crisis-gate")).toBeInTheDocument());
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Danantara");
    expect(screen.getByAltText("Danantara").getAttribute("src")).toContain("danantara.png");
    expect(screen.getByTestId("crisis-detail-link")).toHaveAttribute("href", "/danantara/brief");
  });

  it("rebrands the gate name + logo and still shows the briefing link when a brand is set (A10 v9.2)", async () => {
    stubFetch();
    render(<CrisisGate brand="BGN" brandLogo="/bgn.png" />);
    await waitFor(() => expect(screen.getByTestId("crisis-gate")).toBeInTheDocument());
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("BGN");
    expect(screen.getByAltText("BGN").getAttribute("src")).toContain("bgn.png");
    // v9.2 (client request): the "View briefing" link is restored on the rebranded gate;
    // it still points at the (Danantara-branded) /danantara/brief, whose data is already BGN.
    expect(screen.getByTestId("crisis-detail-link")).toHaveAttribute("href", "/danantara/brief");
  });

  it("appends mock=1 to all three feed fetches when mock is set (A10 v5.6)", async () => {
    stubFetch();
    render(<CrisisGate mock />);
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    await waitFor(() => {
      const feeds = fetchMock.mock.calls.map((c) => String(c[0])).filter((u) => u.includes("/api/v1/danantara/"));
      expect(feeds).toHaveLength(3);
      expect(feeds.every((u) => u.includes("mock=1"))).toBe(true);
    });
  });

  it("omits mock=1 by default (regression)", async () => {
    stubFetch();
    render(<CrisisGate />);
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(3));
    expect(fetchMock.mock.calls.map((c) => String(c[0])).some((u) => u.includes("mock=1"))).toBe(false);
  });
});
