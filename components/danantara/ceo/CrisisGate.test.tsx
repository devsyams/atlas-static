// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
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

// Panels 2 & 3 read /threats — the detected threat + its driving accounts.
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
    { handle: "nocturnalforsa1", platform: "twitter", followers: 31, credibility: 2, riskLevel: "low", accountType: "real_person", bot: false, engagement: 1361, note: "complainer" },
    { handle: "YudhaShanny2", platform: "twitter", followers: 13793, credibility: 3, riskLevel: "high", accountType: "propaganda_provocator", bot: true, engagement: 4, note: "provokator" },
  ],
};
const THREATS = { threat: THREAT, drivers: THREAT.drivers, driversSource: "threat", stats: { total_threats: 1, high_severity: 1, medium_severity: 0, low_severity: 0 } };

// The roster fallback the /threats route returns when there is no detected threat.
const ROSTER_DRIVERS: ThreatDriver[] = [
  { handle: "neg_influencer", platform: "twitter", followers: 1_200_000, credibility: 7, riskLevel: "high", accountType: "Negative Critic", bot: false, engagement: 0, note: "kritik tata kelola" },
];
const THREATS_EMPTY = { threat: null, drivers: ROSTER_DRIVERS, driversSource: "roster", stats: { total_threats: 0, high_severity: 0, medium_severity: 0, low_severity: 0 } };

/** Route the fetch mock by URL so /topics and /threats return their own payloads. */
function stubFetch({
  topics = TOPICS,
  threats = THREATS,
  topicsStatus = 200,
  threatsStatus = 200,
}: { topics?: unknown; threats?: unknown; topicsStatus?: number; threatsStatus?: number } = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes("/threats")) return new Response(JSON.stringify(threats), { status: threatsStatus });
      return new Response(JSON.stringify(topics), { status: topicsStatus });
    }),
  );
}

describe("CrisisGate (A10 — fear-first landing)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("renders the index + band from /topics and the detected threat from /threats (AC1–AC3, AC8, T14)", async () => {
    stubFetch();
    render(<CrisisGate />);
    await waitFor(() => expect(screen.getByTestId("crisis-score").textContent).toBe("75"), { timeout: 3000 });
    expect(screen.getByTestId("crisis-band").textContent).toBe("Awas");
    await waitFor(() => expect(screen.getByTestId("crisis-threat").textContent).toContain("Tuduhan Manipulasi Keuangan"));
  });

  it("lists the real driving accounts from /threats in the actors column (AC8, T14)", async () => {
    stubFetch();
    render(<CrisisGate />);
    await waitFor(() => expect(screen.getByText("@nocturnalforsa1")).toBeInTheDocument());
    expect(screen.getByText("@YudhaShanny2")).toBeInTheDocument();
  });

  it("shows the top negative topics (reach + neg share) under the threat (AC8, T15)", async () => {
    stubFetch();
    render(<CrisisGate />);
    await waitFor(() => expect(screen.getByText("Investasi Hilirisasi Nikel")).toBeInTheDocument());
    expect(screen.getByText("85% neg")).toBeInTheDocument();
    expect(screen.getByText("50.0 jt")).toBeInTheDocument();
  });

  it("falls back to the /topics biggest threat + roster when /threats has no incident (AC9, T16/T17)", async () => {
    stubFetch({ topics: TOPICS_2NEG, threats: THREATS_EMPTY });
    render(<CrisisGate />);
    // Middle headline falls back to the /topics biggestThreat (t0).
    await waitFor(() => expect(screen.getByTestId("crisis-threat").textContent).toContain("Investasi Hilirisasi Nikel"));
    // The other negative topic still shows in "Topik pendorong"…
    expect(screen.getByText("Sorotan Transparansi Danantara")).toBeInTheDocument();
    // …and the fallback headline topic is NOT duplicated in the list (T17).
    expect(screen.getAllByText("Investasi Hilirisasi Nikel")).toHaveLength(1);
    // Right column falls back to the /actor-intelligence roster.
    expect(screen.getByText("@neg_influencer")).toBeInTheDocument();
  });

  it("drills through to the Executive Briefing (AC4)", async () => {
    stubFetch();
    render(<CrisisGate />);
    const link = await screen.findByTestId("crisis-detail-link");
    expect(link).toHaveAttribute("href", "/danantara/brief");
  });

  it("degrades to an offline state when the topics feed fails, without crashing (AC5)", async () => {
    stubFetch({ topicsStatus: 502 });
    render(<CrisisGate />);
    await waitFor(() => expect(screen.getByTestId("crisis-offline")).toBeInTheDocument());
    expect(screen.getByTestId("crisis-offline").textContent).toContain("Data unavailable");
    expect(screen.getByTestId("crisis-detail-link")).toHaveAttribute("href", "/danantara/brief");
  });

  it("falls back to the /topics biggest threat when the /threats feed itself fails (AC9)", async () => {
    stubFetch({ threatsStatus: 502 });
    render(<CrisisGate />);
    // Gauge stays live, and the middle column shows the /topics fallback rather than blanking.
    await waitFor(() => expect(screen.getByTestId("crisis-score").textContent).toBe("75"));
    await waitFor(() => expect(screen.getByTestId("crisis-threat").textContent).toContain("Investasi Hilirisasi Nikel"));
    // No roster either (the whole /threats call failed) → actors column is empty, no crash.
    expect(screen.queryByText("@neg_influencer")).not.toBeInTheDocument();
  });
});
