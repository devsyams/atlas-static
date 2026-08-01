// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setAiEnabled } from "@/lib/ai-settings";
import { boardThreatResponsePlan } from "@/lib/danantara/ceo/board-threat-simulator";
import { responseCalculator } from "@/lib/danantara/ceo/counter-noise";
import type { CeoIssue } from "@/lib/danantara/ceo/types";
import { CounterNarrativeWarRoom } from "./CounterNarrativeWarRoom";

function mkIssue(over: Partial<CeoIssue> & Pick<CeoIssue, "id" | "title">): CeoIssue {
  return {
    category: "kebijakan",
    relatedBumn: [],
    mentions: 1_000,
    reach: 10_000_000,
    sentiment: -40,
    history: [],
    headlines: [],
    aiLine: "Konteks singkat topik ini.",
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
  mkIssue({ id: "t0", title: "Investasi Hilirisasi Nikel", reach: 50_000_000, negMentions: 18_000, posMentions: 1_200 }),
  mkIssue({ id: "t1", title: "Divestasi Aset BUMN", reach: 30_000_000, negMentions: 16_000, posMentions: 1_100 }),
  mkIssue({ id: "t2", title: "Dana Pensiun Karyawan", reach: 20_000_000, negMentions: 15_000, posMentions: 900 }),
  mkIssue({ id: "t3", title: "Topik Kecil", reach: 2_000_000, negMentions: 9_000, posMentions: 500 }),
  mkIssue({ id: "p0", title: "Topik Positif", reach: 90_000_000, posMentions: 800, negMentions: 50 }),
];

const CHANNELS = ["kol", "clipper", "grassroots"] as const;
const PICKED = ["t0", "t1", "t2"];
const SUMMARY = {
  total_impressions: 1_234_567,
  total_reach: 123_456_789,
  percentage: { positive: 18, negative: 67, neutral: 15 },
};

const LLM_PAYLOAD = {
  source: "llm",
  topics: PICKED.map((id, i) => ({
    topicId: id,
    title: ISSUES[i].title,
    attackLine: `LLM serangan ${id}`,
    counterAngle: `LLM tandingan ${id}`,
    drafts: CHANNELS.map((c) => ({
      channel: c,
      platform: "X / Instagram",
      body: `LLM draft ${c} untuk ${id}`,
      hashtags: ["#Danantara", `#${id}`],
    })),
  })),
};

/** Route the fetch mock; `ai` may be a payload, a status, or a never-settling promise. */
function stubFetch({
  topicsStatus = 200,
  ai = { source: "scripted" } as unknown,
  aiHangs = false,
}: { topicsStatus?: number; ai?: unknown; aiHangs?: boolean } = {}) {
  const fetchMock = vi.fn(async (url: string) => {
    const u = String(url);
    if (u.includes("counter-narrative")) {
      if (aiHangs) return new Promise<Response>(() => {});
      return new Response(JSON.stringify(ai), { status: 200 });
    }
    return new Response(JSON.stringify({ issues: ISSUES, summary: SUMMARY }), { status: topicsStatus });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/**
 * Push past MIN_SHOW_MS so the section reveals (jsdom starts already "in view").
 *
 * Interleaved on purpose: the terminal's timers are only scheduled once the topics
 * fetch has resolved, so a single up-front advance would fire before they exist.
 */
async function settle(ms = 4_000) {
  for (let i = 0; i < 6; i++) {
    await act(async () => {
      vi.advanceTimersByTime(ms / 6);
      await Promise.resolve();
    });
  }
}

const writeText = vi.fn<(text: string) => Promise<void>>(async () => {});

describe("CounterNarrativeWarRoom (A14)", () => {
  beforeEach(() => {
    // `shouldAdvanceTime` keeps the real clock moving so testing-library's `waitFor`
    // still polls, while `advanceTimersByTime` drives the terminal's own timeouts.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setAiEnabled(true);
    writeText.mockClear();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("renders the deterministic fallback when the AI is scripted (T24)", async () => {
    stubFetch();
    render(<CounterNarrativeWarRoom />);
    await settle();

    await waitFor(() => expect(screen.getByTestId("war-room-topics")).toBeInTheDocument());
    expect(screen.getAllByTestId(/^counter-topic-/)).toHaveLength(3);
    expect(screen.getByTestId("war-room-source").textContent).toContain("Simulated");

    const drafts = screen.getAllByTestId(/^draft-(kol|clipper|grassroots)$/);
    expect(drafts).toHaveLength(9);
    for (const d of drafts) expect(d.textContent?.trim()).not.toBe("");
  });

  it("shows the model's own copy and badge when the AI is live (T25)", async () => {
    stubFetch({ ai: LLM_PAYLOAD });
    render(<CounterNarrativeWarRoom />);
    await settle();

    await waitFor(() => expect(screen.getByTestId("war-room-source").textContent).toContain("Nexorus AI"));
    expect(screen.getByTestId("attack-t0").textContent).toBe("LLM serangan t0");
    expect(screen.getByTestId("angle-t0").textContent).toBe("LLM tandingan t0");
    expect(screen.getByText("LLM draft kol untuk t0")).toBeInTheDocument();
    expect(screen.getByText("LLM draft grassroots untuk t2")).toBeInTheDocument();
  });

  it("shows all three tiers at once with no tier toggle, computed client-side (T26)", async () => {
    stubFetch();
    render(<CounterNarrativeWarRoom />);
    await settle();
    await waitFor(() => expect(screen.getByTestId("board-simulator")).toBeInTheDocument());

    // v2.0: the tier is no longer an interactive control — the toggle is gone.
    expect(screen.queryByTestId("war-tier-basic")).not.toBeInTheDocument();
    expect(screen.queryByTestId("war-tier-professional")).not.toBeInTheDocument();
    expect(screen.queryByTestId("war-tier-enterprise")).not.toBeInTheDocument();

    // All three tiers render simultaneously as comparison cards.
    expect(screen.getByTestId("tier-card-enterprise")).toBeInTheDocument();
    expect(screen.getByTestId("tier-card-professional")).toBeInTheDocument();
    expect(screen.getByTestId("tier-card-basic")).toBeInTheDocument();

    // The counter-topic cards stay (fixed to Professional volume).
    expect(screen.getAllByTestId(/^counter-topic-/)).toHaveLength(3);
  });

  it("renders the three-tier comparison with a Threat Index headline (T27)", async () => {
    stubFetch();
    render(<CounterNarrativeWarRoom />);
    await settle();
    await waitFor(() => expect(screen.getByTestId("board-simulator")).toBeInTheDocument());

    const plan = boardThreatResponsePlan(ISSUES, SUMMARY, "professional");
    const anchor = plan.volumeAnchor;

    // The old single-tier metric grid and the SOV bar are gone.
    expect(screen.queryByTestId("sov-bar")).not.toBeInTheDocument();
    expect(screen.queryByTestId("board-total-actions")).not.toBeInTheDocument();
    expect(screen.queryByTestId("board-grassroots")).not.toBeInTheDocument();

    // Threat Index headline: now → modeled post-response (at Professional, the default).
    expect(screen.getByTestId("board-threat-index").textContent).toContain(String(plan.threatIndex));
    expect(screen.getByTestId("board-post-response").textContent).toContain(String(plan.postResponseThreatIndex));

    // Each tier card carries its own counter-actions + Clipper / Homeless / KOL split.
    for (const tier of ["basic", "professional", "enterprise"] as const) {
      const ca = responseCalculator(anchor, tier);
      expect(screen.getByTestId(`tier-actions-${tier}`).textContent).toContain(ca.counterActions.toLocaleString("en-US"));
      expect(screen.getByTestId(`tier-${tier}-clipper`).textContent).toContain(ca.clipper.toLocaleString("en-US"));
      expect(screen.getByTestId(`tier-${tier}-homeless`).textContent).toContain(ca.homeless.toLocaleString("en-US"));
      expect(screen.getByTestId(`tier-${tier}-kol`).textContent).toContain(ca.kol.toLocaleString("en-US"));
    }

    // Professional is badged DEFAULT; every card shows its ×N NOISE pill.
    expect(screen.getByTestId("tier-card-professional").textContent).toContain("DEFAULT");
    expect(screen.getByTestId("tier-card-enterprise").textContent).toContain("5× NOISE");
    expect(screen.getByTestId("tier-card-professional").textContent).toContain("3× NOISE");
    expect(screen.getByTestId("tier-card-basic").textContent).toContain("1× NOISE");
  });

  it("scales counter-actions 1× / 3× / 5× across Basic / Professional / Enterprise (T37)", async () => {
    stubFetch();
    render(<CounterNarrativeWarRoom />);
    await settle();
    await waitFor(() => expect(screen.getByTestId("board-simulator")).toBeInTheDocument());

    const actions = (tier: string) =>
      Number(screen.getByTestId(`tier-actions-${tier}`).textContent!.replace(/[^\d]/g, ""));
    const basic = actions("basic");
    expect(basic).toBeGreaterThan(0);
    expect(actions("professional")).toBe(basic * 3);
    expect(actions("enterprise")).toBe(basic * 5);
  });

  it("copies body + hashtags to the clipboard from every draft (T28)", async () => {
    stubFetch({ ai: LLM_PAYLOAD });
    render(<CounterNarrativeWarRoom />);
    await settle();
    await waitFor(() => expect(screen.getAllByTestId(/^copy-/)).toHaveLength(9));

    for (const btn of screen.getAllByTestId(/^copy-/)) {
      await act(async () => {
        fireEvent.click(btn);
      });
    }
    expect(writeText).toHaveBeenCalledTimes(9);

    const written = writeText.mock.calls.map((c) => String(c[0]));
    expect(written[0]).toBe("LLM draft kol untuk t0\n\n#Danantara #t0");
    for (const text of written) {
      const [body, tags] = text.split("\n\n");
      expect(body.trim()).not.toBe("");
      expect(tags.split(" ").every((t) => t.startsWith("#"))).toBe(true);
    }
  });

  it("holds the terminal while the model is working, then reveals (T29)", async () => {
    let release!: (r: Response) => void;
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("counter-narrative")) {
        return new Promise<Response>((res) => {
          release = res;
        });
      }
      return new Response(JSON.stringify({ issues: ISSUES }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CounterNarrativeWarRoom />);
    await settle();

    // Past MIN_SHOW_MS but the answer hasn't landed — the terminal is still up.
    expect(screen.getByTestId("war-room-analyzing")).toBeInTheDocument();
    expect(screen.queryByTestId("war-room-topics")).not.toBeInTheDocument();

    await act(async () => {
      release(new Response(JSON.stringify(LLM_PAYLOAD), { status: 200 }));
    });
    await waitFor(() => expect(screen.getByTestId("war-room-topics")).toBeInTheDocument());
    expect(screen.queryByTestId("war-room-analyzing")).not.toBeInTheDocument();
  });

  it("reveals the fallback anyway if the model never answers (T30)", async () => {
    stubFetch({ aiHangs: true });
    render(<CounterNarrativeWarRoom />);
    await settle();
    expect(screen.getByTestId("war-room-analyzing")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(31_000); // past MAX_WAIT_MS
    });

    await waitFor(() => expect(screen.getByTestId("war-room-topics")).toBeInTheDocument());
    expect(screen.getAllByTestId(/^counter-topic-/)).toHaveLength(3);
    expect(screen.getByTestId("war-room-source").textContent).toContain("Simulated");
  });

  it("never calls the AI route when the kill switch is off (T31)", async () => {
    setAiEnabled(false);
    const fetchMock = stubFetch();
    render(<CounterNarrativeWarRoom />);
    await settle();

    await waitFor(() => expect(screen.getByTestId("war-room-topics")).toBeInTheDocument());
    expect(fetchMock.mock.calls.map((c) => String(c[0])).filter((u) => u.includes("counter-narrative"))).toHaveLength(0);
    expect(screen.getAllByTestId(/^counter-topic-/)).toHaveLength(3);
  });

  const TINY_TEXT = /text-(?:xs|sm)(?![\w-])|text-\[(?:[1-9]|1[0-5])(?:\.\d+)?px\]/;
  it("renders no text smaller than 16px (T32 — A7 AC15 floor)", async () => {
    stubFetch({ ai: LLM_PAYLOAD });
    const { container } = render(<CounterNarrativeWarRoom />);
    await settle();
    await waitFor(() => expect(screen.getByTestId("war-room-topics")).toBeInTheDocument());

    const offenders = [...container.querySelectorAll("*")]
      .map((el) => el.getAttribute("class") ?? "")
      .filter((c) => TINY_TEXT.test(c));
    expect(offenders).toEqual([]);
  });

  it("degrades to its own offline state when the topics feed fails (T33)", async () => {
    stubFetch({ topicsStatus: 502 });
    render(<CounterNarrativeWarRoom />);
    await settle();

    await waitFor(() => expect(screen.getByTestId("war-room-offline")).toBeInTheDocument());
    expect(screen.queryByTestId("war-room-topics")).not.toBeInTheDocument();
  });

  it("shows exactly the top 3 negative topics, ranked in order (T34)", async () => {
    stubFetch();
    render(<CounterNarrativeWarRoom />);
    await settle();
    await waitFor(() => expect(screen.getByTestId("war-room-topics")).toBeInTheDocument());

    const cards = screen.getAllByTestId(/^counter-topic-/);
    expect(cards.map((c) => c.getAttribute("data-testid"))).toEqual(PICKED.map((id) => `counter-topic-${id}`));
    expect(screen.queryByTestId("counter-topic-p0")).not.toBeInTheDocument();
    expect(screen.queryByTestId("counter-topic-t3")).not.toBeInTheDocument();
    expect(screen.getByText("01")).toBeInTheDocument();
    expect(screen.getByText("03")).toBeInTheDocument();
  });
});
