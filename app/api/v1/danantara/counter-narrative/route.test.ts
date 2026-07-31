import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CeoIssue } from "@/lib/danantara/ceo/types";

const hasLiveAI = vi.fn();
const liveJson = vi.fn();

vi.mock("@/lib/ai/engine", () => ({
  hasLiveAI: () => hasLiveAI(),
  liveJson: (...args: unknown[]) => liveJson(...args),
}));

/** Fresh module per test — the route keeps an in-process cache (AC6). */
async function loadRoute() {
  vi.resetModules();
  return import("./route");
}

function mkIssue(over: Partial<CeoIssue> & Pick<CeoIssue, "id" | "title">): CeoIssue {
  return {
    category: "kebijakan",
    relatedBumn: [],
    mentions: 1_000,
    reach: 10_000_000,
    sentiment: -40,
    history: [],
    headlines: [],
    aiLine: "Konteks singkat.",
    velocity: 0,
    status: "normal",
    rankHistory: [],
    rankDelta: 0,
    posMentions: 100,
    negMentions: 700,
    ...over,
  };
}

const ISSUES: CeoIssue[] = [
  mkIssue({ id: "t0", title: "Investasi Hilirisasi Nikel", aiLine: "Tata kelola dipertanyakan.", reach: 50_000_000 }),
  mkIssue({ id: "t1", title: "Divestasi Aset BUMN", reach: 30_000_000 }),
  mkIssue({ id: "t2", title: "Dana Pensiun Karyawan", reach: 20_000_000 }),
  mkIssue({ id: "t3", title: "Topik Kecil", reach: 1_000_000 }),
  // Positive — must never be picked.
  mkIssue({ id: "p0", title: "Topik Positif", reach: 90_000_000, posMentions: 800, negMentions: 50 }),
];

const CHANNELS = ["kol", "clipper", "grassroots"] as const;

function mkPayload(ids: string[], over: (id: string) => Record<string, unknown> = () => ({})) {
  return {
    topics: ids.map((id) => ({
      topic_id: id,
      attack_line: `Serangan ${id}.`,
      counter_angle: `Tandingan ${id}.`,
      drafts: CHANNELS.map((c) => ({
        channel: c,
        platform: "X",
        body: `Draft ${c} untuk ${id} yang siap tempel.`,
        hashtags: ["#Danantara"],
      })),
      ...over(id),
    })),
  };
}

/** The three the route should pick: top 3 negative by negative reach. */
const PICKED = ["t0", "t1", "t2"];

function post(body: unknown, query = "") {
  return new Request(`http://localhost/api/v1/danantara/counter-narrative${query}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/danantara/counter-narrative (A14)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-30T09:00:00Z"));
    hasLiveAI.mockReturnValue(true);
    liveJson.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns scripted without calling the model when there is no key (T15)", async () => {
    hasLiveAI.mockReturnValue(false);
    const { POST } = await loadRoute();
    const res = await POST(post({ issues: ISSUES }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ source: "scripted" });
    expect(liveJson).not.toHaveBeenCalled();
  });

  it("returns 200 scripted when the model throws — never a 5xx (T16)", async () => {
    liveJson.mockRejectedValue(new Error("upstream on fire"));
    const { POST } = await loadRoute();
    const res = await POST(post({ issues: ISSUES }));

    expect(res.status).toBe(200);
    expect((await res.json()).source).toBe("scripted");
  });

  it("rejects a malformed payload wholesale — no partial trust (T17)", async () => {
    liveJson.mockResolvedValue(mkPayload(PICKED, () => ({ drafts: [{ channel: "kol", platform: "X", body: "solo", hashtags: [] }] })));
    const { POST } = await loadRoute();
    const res = await POST(post({ issues: ISSUES }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ source: "scripted" });
  });

  it("returns the parsed drafts for the top 3 negative topics (T18)", async () => {
    liveJson.mockResolvedValue(mkPayload(PICKED));
    const { POST } = await loadRoute();
    const res = await POST(post({ issues: ISSUES }));
    const body = await res.json();

    expect(body.source).toBe("llm");
    expect(body.topics).toHaveLength(3);
    expect(body.topics.map((t: { topicId: string }) => t.topicId)).toEqual(PICKED);
    expect(body.topics[0].title).toBe("Investasi Hilirisasi Nikel");
    for (const t of body.topics) {
      expect(t.drafts).toHaveLength(3);
      expect(t.drafts.map((d: { channel: string }) => d.channel)).toEqual([...CHANNELS]);
    }
  });

  it("caches on the topic-set content: same set hits, different set misses (T19)", async () => {
    liveJson.mockResolvedValue(mkPayload(PICKED));
    const { POST } = await loadRoute();

    await POST(post({ issues: ISSUES }));
    await POST(post({ issues: [...ISSUES].reverse() })); // same 3 picked, different input order
    expect(liveJson).toHaveBeenCalledTimes(1);

    // A genuinely different top-3 must earn a new call.
    const shifted = [...ISSUES, mkIssue({ id: "t9", title: "Isu Baru Terbesar", reach: 99_000_000 })];
    liveJson.mockResolvedValue(mkPayload(["t9", "t0", "t1"]));
    await POST(post({ issues: shifted }));
    expect(liveJson).toHaveBeenCalledTimes(2);
  });

  it("serves the cache for 6 hours, then refetches (T20)", async () => {
    liveJson.mockResolvedValue(mkPayload(PICKED));
    const { POST } = await loadRoute();

    await POST(post({ issues: ISSUES }));
    vi.advanceTimersByTime(355 * 60_000); // 5h55m — still warm
    await POST(post({ issues: ISSUES }));
    expect(liveJson).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(10 * 60_000); // past 6h
    await POST(post({ issues: ISSUES }));
    expect(liveJson).toHaveBeenCalledTimes(2);
  });

  it("honours ?fresh=1 but floors it at 60s so Refresh can't be hammered (T21)", async () => {
    liveJson.mockResolvedValue(mkPayload(PICKED));
    const { POST } = await loadRoute();

    await POST(post({ issues: ISSUES }));
    expect(liveJson).toHaveBeenCalledTimes(1);

    // Two rapid fresh clicks inside the floor → still one call.
    await POST(post({ issues: ISSUES }, "?fresh=1"));
    await POST(post({ issues: ISSUES }, "?fresh=1"));
    expect(liveJson).toHaveBeenCalledTimes(1);

    // Past the floor, fresh genuinely bypasses the 6 h cache.
    vi.advanceTimersByTime(61_000);
    await POST(post({ issues: ISSUES }, "?fresh=1"));
    expect(liveJson).toHaveBeenCalledTimes(2);
  });

  it("never calls the model when there is nothing to counter, or the body is junk (T22)", async () => {
    const { POST } = await loadRoute();

    const positivesOnly = await POST(post({ issues: [ISSUES[4]] }));
    expect(await positivesOnly.json()).toEqual({ source: "scripted" });

    expect((await (await POST(post({ issues: [] }))).json()).source).toBe("scripted");
    expect((await (await POST(post({ nope: true }))).json()).source).toBe("scripted");

    const bad = new Request("http://localhost/api/v1/danantara/counter-narrative", { method: "POST", body: "{oops" });
    expect((await (await POST(bad)).json()).source).toBe("scripted");

    expect(liveJson).not.toHaveBeenCalled();
  });

  it("grounds the model in the real topics and never leaks the key (T23)", async () => {
    liveJson.mockResolvedValue(mkPayload(PICKED));
    const { POST } = await loadRoute();
    const res = await POST(post({ issues: ISSUES }));

    const [system, user] = liveJson.mock.calls[0] as [string, string, object, number?];
    expect(user).toContain("Investasi Hilirisasi Nikel");
    expect(user).toContain("Tata kelola dipertanyakan.");
    expect(user).toContain("topic_id: t0");
    expect(user).not.toContain("Topik Positif"); // positives are never grounded
    expect(system).toMatch(/Nexorus AI/);

    expect(JSON.stringify(await res.json())).not.toContain("sk-ant");
  });
});
