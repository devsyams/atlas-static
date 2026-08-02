import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActorRosterApiResponse } from "@/lib/danantara/ceo/actor-roster-source";
import { MOCK_ACTORS } from "@/lib/bgn/mock/fixtures";
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

let mockDir = "";
const writeMock = (name: string, data: unknown) => {
  writeFileSync(join(mockDir, name), JSON.stringify(data));
};

describe("GET /api/v1/danantara/actor-intelligence (T21 / AC11)", () => {
  beforeEach(() => {
    process.env.DANANTARA_ACTORS_API_BASE = "https://api.example.io/actor-intelligence";
    process.env.DANANTARA_TOPICS_API_KEY = KEY;
    process.env.DANANTARA_TOPIC_CODE = "danantara_main";
    mockDir = mkdtempSync(join(tmpdir(), "atlas-actor-mock-"));
    process.env.DANANTARA_LOCAL_MOCK_DIR = mockDir;
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.DANANTARA_TOPICS_API_KEY;
    delete process.env.DANANTARA_TOPIC_CODE;
    delete process.env.DANANTARA_ACTORS_API_BASE;
    delete process.env.DANANTARA_LOCAL_MOCK_DIR;
    if (mockDir) rmSync(mockDir, { recursive: true, force: true });
    mockDir = "";
  });

  it("returns the mapped roster on a successful upstream fetch (with avatars)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(ROSTER), { status: 200 })));
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.actors.map((a: { handle: string }) => a.handle)).toContain("neg_influencer");
    expect(body.actors[0].avatarUrl).toBe("data:image/jpg;base64,AAAA");
  });

  it("returns the local dev mock file when DANANTARA_LOCAL_MOCK_DIR is set", async () => {
    writeMock("actor-intelligence.json", {
      actors: [{ handle: "local_mock_actor", platform: "twitter", riskLevel: "high" }],
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.actors).toHaveLength(1);
    expect(body.actors[0].handle).toBe("local_mock_actor");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 503 when no api key is configured", async () => {
    delete process.env.DANANTARA_TOPICS_API_KEY;
    const res = await GET(req());
    expect(res.status).toBe(503);
  });

  it("returns 503 when no upstream base is configured (A10 v9.0 — GARUDA default retired)", async () => {
    delete process.env.DANANTARA_ACTORS_API_BASE;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await GET(req());
    expect(res.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
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

  it("serves the captured OpenGate roster on ?static=1 without hitting the upstream (A10 v10.0 / AC12, prod-safe)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    try {
      const res = await GET(new Request("http://localhost/api/v1/danantara/actor-intelligence?static=1"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.actors).toHaveLength(10); // captured Twitter/X actors
      expect(body.actors[0].handle).toBe("LambeSahamjja");
      expect(body.actors[0].intel.riskAssessment).toBeTruthy(); // popup payload rides along
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("serves the BGN mock roster on ?mock=1 without hitting the upstream (A13 v4.0, prod-safe)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    try {
      const res = await GET(new Request("http://localhost/api/v1/danantara/actor-intelligence?mock=1"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.actors).toHaveLength(MOCK_ACTORS.actors.length);
      expect(body.actors.map((a: { handle: string }) => a.handle)).toEqual(
        MOCK_ACTORS.actors.map((a) => a.handle),
      );
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
