import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ThreatsApiResponse } from "@/lib/danantara/ceo/threats-source";
import type { ActorRosterApiResponse } from "@/lib/danantara/ceo/actor-roster-source";
import { GET } from "./route";

const SAMPLE: ThreatsApiResponse = {
  success: true,
  status_code: 200,
  meta: { topic: "danantara_main" },
  data: {
    stats: { total_threats: 1, high_severity: 1, medium_severity: 0, low_severity: 0 },
    threats: [
      {
        id: "t1",
        severity_class: "high",
        severity: 8,
        title: "Tuduhan Manipulasi Keuangan",
        intelligence: "",
        impact: "",
        threat_type: "internal_negative",
        posts_count: 1,
        growth_rate: "+15%",
        total_engagement: 1361,
        platforms: ["twitter"],
        trending_keywords: ["korupsi"],
        time_to_viral: 24,
        recommended_actions: [],
        top_impact_posts: [
          { username: "nocturnalforsa1", text: "…", engagement: 1361, followers: "29", actor_intelligence: { username: "nocturnalforsa1", account_type: "real_person", credibility_score: 2, risk_level: "low", follower_count: "31", analysis: "…" } },
        ],
      },
    ],
  },
};

/** Hollow threats window (empty list). */
const EMPTY: ThreatsApiResponse = {
  success: true,
  status_code: 200,
  meta: { topic: "danantara_main" },
  data: { stats: { total_threats: 0, high_severity: 1, medium_severity: 0, low_severity: 0 }, threats: [] },
};

/** The /actor-intelligence roster used for the calm-period fallback. */
const ROSTER: ActorRosterApiResponse = {
  success: true,
  status_code: 200,
  meta: { topic: "danantara_main" },
  data: [
    { username: "neg_influencer", platform: "twitter", follower_count: "1,200,000", influence_score: 9, credibility_score: 7, sentiment_score: -8, risk_level: "high", account_classification: "Negative Critic", profile_picture: "data:image/jpg;base64,AAAA" },
  ],
};

const KEY = "SUPER-SECRET-KEY";
const req = (fresh = false) => new Request(`http://localhost/api/v1/danantara/threats${fresh ? "?fresh=1" : ""}`);

/** Route the fetch mock by URL: /threats vs /actor-intelligence. */
function stubByUrl({ threats = SAMPLE, roster = ROSTER, threatsStatus = 200, rosterStatus = 200 } = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes("/actor-intelligence")) return new Response(JSON.stringify(roster), { status: rosterStatus });
      return new Response(JSON.stringify(threats), { status: threatsStatus });
    }),
  );
}

describe("GET /api/v1/danantara/threats (T13 / T19 / AC8 / AC9)", () => {
  beforeEach(() => {
    process.env.DANANTARA_TOPICS_API_KEY = KEY;
    process.env.DANANTARA_TOPIC_CODE = "danantara_main";
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.DANANTARA_TOPICS_API_KEY;
    delete process.env.DANANTARA_TOPIC_CODE;
    delete process.env.DANANTARA_THREATS_API_BASE;
    delete process.env.DANANTARA_ACTORS_API_BASE;
  });

  it("returns the #1 detected threat + its drivers (driversSource 'threat')", async () => {
    stubByUrl({ threats: SAMPLE });
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.threat.title).toBe("Tuduhan Manipulasi Keuangan");
    expect(body.driversSource).toBe("threat");
    expect(body.drivers[0].handle).toBe("nocturnalforsa1");
    expect(body.stats.total_threats).toBe(1);
  });

  it("falls back to the /actor-intelligence roster when no threat is detected (driversSource 'roster', T19)", async () => {
    stubByUrl({ threats: EMPTY, roster: ROSTER });
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.threat).toBeNull();
    expect(body.driversSource).toBe("roster");
    expect(body.drivers.map((d: { handle: string }) => d.handle)).toContain("neg_influencer");
  });

  it("degrades to empty drivers (still 200) when both threat and roster are unavailable", async () => {
    stubByUrl({ threats: EMPTY, rosterStatus: 500 });
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.threat).toBeNull();
    expect(body.driversSource).toBe("roster");
    expect(body.drivers).toEqual([]);
  });

  it("returns 503 when no api key is configured", async () => {
    delete process.env.DANANTARA_TOPICS_API_KEY;
    const res = await GET(req());
    expect(res.status).toBe(503);
  });

  it("returns 502 when the threats upstream fails", async () => {
    stubByUrl({ threatsStatus: 500 });
    const res = await GET(req());
    expect(res.status).toBe(502);
  });

  it("sends the api_key upstream but never leaks it in the response (governance)", async () => {
    let calledUrl = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calledUrl = String(url);
        return new Response(JSON.stringify(SAMPLE), { status: 200 });
      }),
    );
    const res = await GET(req());
    const body = await res.json();
    expect(calledUrl).toContain(`api_key=${KEY}`);
    expect(JSON.stringify(body)).not.toContain(KEY);
  });
});
