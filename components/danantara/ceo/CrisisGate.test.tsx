// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CeoIssue } from "@/lib/danantara/ceo/types";
import type { DetectedThreat } from "@/lib/danantara/ceo/threats-source";
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

// Panel 1 (the gauge) still reads /topics — this drives the Crisis Index score/band.
const TOPICS = {
  issues: [
    mkIssue({ id: "t0", title: "Investasi Hilirisasi Nikel", reach: 50_000_000, negMentions: 850, sentiment: -64 }),
    mkIssue({ id: "t1", title: "Topik Positif", reach: 5_000_000, negMentions: 80, posMentions: 700, sentiment: 50 }),
  ],
  summary: { total_impressions: 0, total_reach: 0, percentage: { positive: 22, negative: 70, neutral: 8 } },
};

// Panels 2 & 3 now read /threats — the #1 detected threat + its driving accounts.
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
const THREATS = { threat: THREAT, stats: { total_threats: 1, high_severity: 1, medium_severity: 0, low_severity: 0 } };

/** Route the fetch mock by URL so /topics and /threats return their own payloads. */
function stubFetch({ topicsStatus = 200, threatsStatus = 200 }: { topicsStatus?: number; threatsStatus?: number } = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes("/threats")) return new Response(JSON.stringify(THREATS), { status: threatsStatus });
      return new Response(JSON.stringify(TOPICS), { status: topicsStatus });
    }),
  );
}

describe("CrisisGate (A10 — fear-first landing)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("renders the index + band from /topics and the detected threat from /threats (AC1–AC3, AC8, T14)", async () => {
    stubFetch();
    render(<CrisisGate />);
    // Panel 1: the gauge score settles to its computed value (count-up).
    await waitFor(() => expect(screen.getByTestId("crisis-score").textContent).toBe("75"), { timeout: 3000 });
    expect(screen.getByTestId("crisis-band").textContent).toBe("Awas"); // Severe → Indonesian label
    // Panel 2: the biggest threat now comes from /threats (not the /topics biggestThreat).
    await waitFor(() => expect(screen.getByTestId("crisis-threat").textContent).toContain("Tuduhan Manipulasi Keuangan"));
  });

  it("lists the real driving accounts from /threats in the actors column (AC8, T14)", async () => {
    stubFetch();
    render(<CrisisGate />);
    await waitFor(() => expect(screen.getByText("@nocturnalforsa1")).toBeInTheDocument());
    expect(screen.getByText("@YudhaShanny2")).toBeInTheDocument();
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

  it("keeps the gauge live but shows no threat when only the /threats feed fails (AC8 graceful)", async () => {
    stubFetch({ threatsStatus: 502 });
    render(<CrisisGate />);
    await waitFor(() => expect(screen.getByTestId("crisis-score").textContent).toBe("75"));
    // No detected threat → the middle column shows its neutral empty state, no crash.
    expect(screen.queryByTestId("crisis-threat")).not.toBeInTheDocument();
  });
});
