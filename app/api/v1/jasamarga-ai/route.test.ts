import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildSnapshot } from "@/lib/jasamarga/data";

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

function req(corridor = "japek") {
  return new Request("http://localhost/api/v1/jasamarga-ai", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(buildSnapshot(corridor)),
  });
}

const GOOD = {
  insight: { title: "Judul AI", text: "Analisis AI.", action: "Tindakan AI." },
  predictions: [1, 2, 3].map((n) => ({
    question: `Skenario ${n}?`,
    probability: 50 + n,
    answer_label: "Mungkin",
    reasoning: `Alasan ${n}.`,
    timeframe: "2 jam",
    tone: "negative",
  })),
};

beforeEach(() => {
  hasLiveAI.mockReset();
  liveJson.mockReset();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-14T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("POST /api/v1/jasamarga-ai", () => {
  it("T5/AC4 — no key configured → scripted, HTTP 200, and the LLM is never called", async () => {
    hasLiveAI.mockReturnValue(false);
    const { POST } = await loadRoute();

    const res = await POST(req());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ source: "scripted" });
    expect(liveJson).not.toHaveBeenCalled();
  });

  it("T6/AC4 — LLM throws → scripted, HTTP 200 (never a 5xx the UI must handle)", async () => {
    hasLiveAI.mockReturnValue(true);
    liveJson.mockRejectedValue(new Error("upstream down"));
    const { POST } = await loadRoute();

    const res = await POST(req());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ source: "scripted" });
  });

  it("T6b/AC4 — LLM returns a malformed payload → scripted (no partial trust)", async () => {
    hasLiveAI.mockReturnValue(true);
    liveJson.mockResolvedValue({ ...GOOD, predictions: GOOD.predictions.slice(0, 2) });
    const { POST } = await loadRoute();

    const res = await POST(req());
    await expect(res.json()).resolves.toMatchObject({ source: "scripted" });
  });

  it("T7/AC1+AC2 — valid payload → source:llm with the mapped insight + 3 predictions", async () => {
    hasLiveAI.mockReturnValue(true);
    liveJson.mockResolvedValue(GOOD);
    const { POST } = await loadRoute();

    const body = await (await POST(req())).json();
    expect(body.source).toBe("llm");
    expect(body.insight.title).toBe("Judul AI");
    expect(body.insight.action).toBe("Tindakan AI.");
    expect(body.predictions).toHaveLength(3);
    expect(body.predictions[0].probability).toBe(51);
  });

  it("T8/AC6 — two calls for the same corridor inside the TTL hit the LLM once", async () => {
    hasLiveAI.mockReturnValue(true);
    liveJson.mockResolvedValue(GOOD);
    const { POST } = await loadRoute();

    await POST(req("japek"));
    await POST(req("japek"));
    expect(liveJson).toHaveBeenCalledTimes(1);
  });

  it("T8b/AC6 — a different corridor is cached separately, so it does call the LLM", async () => {
    hasLiveAI.mockReturnValue(true);
    liveJson.mockResolvedValue(GOOD);
    const { POST } = await loadRoute();

    await POST(req("japek"));
    await POST(req("jagorawi"));
    expect(liveJson).toHaveBeenCalledTimes(2);
  });

  it("T14/AC8 — the cache holds for 1 hour by default (not 5 min)", async () => {
    hasLiveAI.mockReturnValue(true);
    liveJson.mockResolvedValue(GOOD);
    const { POST } = await loadRoute();

    await POST(req("japek"));
    // 55 minutes later the entry is still warm — a 5 min TTL would have expired.
    vi.setSystemTime(new Date(Date.now() + 55 * 60_000));
    await POST(req("japek"));
    expect(liveJson).toHaveBeenCalledTimes(1);

    // Past the hour, it refreshes.
    vi.setSystemTime(new Date(Date.now() + 10 * 60_000));
    await POST(req("japek"));
    expect(liveJson).toHaveBeenCalledTimes(2);
  });

  it("AC7 — the grounding sent to the model carries real snapshot figures, and no key leaks", async () => {
    hasLiveAI.mockReturnValue(true);
    liveJson.mockResolvedValue(GOOD);
    const { POST } = await loadRoute();

    const res = await POST(req());
    const [, user] = liveJson.mock.calls[0] as [string, string, object, number?];
    expect(user).toContain("Jakarta–Cikampek");
    expect(user).toContain("KORIDOR:");

    // Governance: the server-side key must never reach the browser payload.
    expect(JSON.stringify(await res.json())).not.toContain("sk-ant");
  });
});
