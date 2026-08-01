import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ThreatsApiResponse } from "@/lib/danantara/ceo/threats-source";
import { MOCK_THREATS } from "@/lib/bgn/mock/fixtures";
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
        top_impact_posts: [],
      },
    ],
  },
};

const EMPTY: ThreatsApiResponse = {
  success: true,
  status_code: 200,
  meta: { topic: "danantara_main" },
  data: { stats: { total_threats: 0, high_severity: 0, medium_severity: 0, low_severity: 0 }, threats: [] },
};

const KEY = "SUPER-SECRET-KEY";
const req = (fresh = false) => new Request(`http://localhost/api/v1/danantara/threats${fresh ? "?fresh=1" : ""}`);

let mockDir = "";
const writeMock = (name: string, data: unknown) => {
  writeFileSync(join(mockDir, name), JSON.stringify(data));
};

describe("GET /api/v1/danantara/threats (T13 / AC8)", () => {
  beforeEach(() => {
    process.env.DANANTARA_TOPICS_API_KEY = KEY;
    process.env.DANANTARA_TOPIC_CODE = "danantara_main";
    mockDir = mkdtempSync(join(tmpdir(), "atlas-threats-mock-"));
    process.env.DANANTARA_LOCAL_MOCK_DIR = mockDir;
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.DANANTARA_TOPICS_API_KEY;
    delete process.env.DANANTARA_TOPIC_CODE;
    delete process.env.DANANTARA_THREATS_API_BASE;
    delete process.env.DANANTARA_LOCAL_MOCK_DIR;
    if (mockDir) rmSync(mockDir, { recursive: true, force: true });
    mockDir = "";
  });

  it("returns the #1 detected threat + stats on a successful upstream fetch", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(SAMPLE), { status: 200 })));
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.threat.title).toBe("Tuduhan Manipulasi Keuangan");
    expect(body.stats.total_threats).toBe(1);
  });

  it("returns the local dev mock file when DANANTARA_LOCAL_MOCK_DIR is set", async () => {
    writeMock("threats.json", {
      threat: { ...SAMPLE.data.threats[0], title: "Local mock threat" },
      stats: SAMPLE.data.stats,
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.threat.title).toBe("Local mock threat");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a null threat when the feed detects none (calm period)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(EMPTY), { status: 200 })));
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.threat).toBeNull();
    expect(body.stats.total_threats).toBe(0);
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
        return new Response(JSON.stringify(SAMPLE), { status: 200 });
      }),
    );
    const res = await GET(req());
    const body = await res.json();
    expect(calledUrl).toContain(`api_key=${KEY}`);
    expect(JSON.stringify(body)).not.toContain(KEY);
  });

  it("serves the BGN mock threat on ?mock=1 without hitting the upstream (A13 v4.0, prod-safe)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    try {
      const res = await GET(new Request("http://localhost/api/v1/danantara/threats?mock=1"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.threat.title).toBe(MOCK_THREATS.threat?.title);
      expect(body.stats.total_threats).toBe(MOCK_THREATS.stats.total_threats);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
