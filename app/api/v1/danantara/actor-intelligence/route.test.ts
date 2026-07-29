import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActorRosterApiResponse } from "@/lib/danantara/ceo/actor-roster-source";
import { GET } from "./route";

const ROSTER: ActorRosterApiResponse = {
  success: true,
  status_code: 200,
  meta: { topic: "danantara_main" },
  data: [
    { username: "neg_influencer", platform: "twitter", follower_count: "1,200,000", influence_score: 9, credibility_score: 7, sentiment_score: -8, risk_level: "high", account_classification: "Negative Critic", profile_picture: "data:image/jpg;base64,AAAA" },
  ],
};

const KEY = "SUPER-SECRET-KEY";
const req = (fresh = false) => new Request(`http://localhost/api/v1/danantara/actor-intelligence${fresh ? "?fresh=1" : ""}`);

describe("GET /api/v1/danantara/actor-intelligence (T21 / AC11)", () => {
  beforeEach(() => {
    process.env.DANANTARA_TOPICS_API_KEY = KEY;
    process.env.DANANTARA_TOPIC_CODE = "danantara_main";
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.DANANTARA_TOPICS_API_KEY;
    delete process.env.DANANTARA_TOPIC_CODE;
    delete process.env.DANANTARA_ACTORS_API_BASE;
  });

  it("returns the mapped roster on a successful upstream fetch (with avatars)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(ROSTER), { status: 200 })));
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.actors.map((a: { handle: string }) => a.handle)).toContain("neg_influencer");
    expect(body.actors[0].avatarUrl).toBe("data:image/jpg;base64,AAAA");
  });

  it("returns 503 when no api key is configured", async () => {
    delete process.env.DANANTARA_TOPICS_API_KEY;
    const res = await GET(req());
    expect(res.status).toBe(503);
  });

  it("returns 502 when the upstream fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 500 })));
    const res = await GET(req());
    expect(res.status).toBe(502);
  });

  it("sends the api_key upstream but never leaks it in the response (governance)", async () => {
    let calledUrl = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calledUrl = String(url);
        return new Response(JSON.stringify(ROSTER), { status: 200 });
      }),
    );
    const res = await GET(req());
    const body = await res.json();
    expect(calledUrl).toContain(`api_key=${KEY}`);
    expect(JSON.stringify(body)).not.toContain(KEY);
  });
});
