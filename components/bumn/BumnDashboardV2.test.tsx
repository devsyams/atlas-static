// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CeoIssue } from "@/lib/danantara/ceo/types";
import { BumnDashboardV2 } from "./BumnDashboardV2";

function issue(over: Partial<CeoIssue> & Pick<CeoIssue, "id" | "title">): CeoIssue {
  return {
    category: "kebijakan",
    relatedBumn: [],
    mentions: 1000,
    reach: 9_000_000,
    sentiment: -40,
    history: Array.from({ length: 8 }, () => 1000),
    headlines: [],
    aiLine: "",
    velocity: 0,
    status: "normal",
    rankHistory: [1, 1, 1, 1, 1, 1, 1, 1],
    rankDelta: 0,
    posMentions: 200,
    negMentions: 600,
    ...over,
  };
}

// One topic per dominant tone: negative (600/1000 neg), positive, neutral.
const MIXED = {
  issues: [
    issue({ id: "neg1", title: "Topik Negatif PLN", posMentions: 200, negMentions: 600 }),
    issue({ id: "pos1", title: "Topik Positif PLN", posMentions: 700, negMentions: 100 }),
    issue({ id: "neu1", title: "Topik Netral PLN", posMentions: 100, negMentions: 100, mentions: 1000 }),
  ],
  summary: { total_impressions: 1000, total_reach: 9_000_000, percentage: { positive: 20, negative: 60, neutral: 20 } },
  intent: [{ intent: "Kritik Kebijakan", deskripsi: "", impressions: 100, share_of_voice: 61 }],
  meta: { topic: "danantara_pln", startdate: "2026-05-31", enddate: "2026-06-07" },
};

const NEGATIVE_ONLY = {
  ...MIXED,
  issues: [issue({ id: "neg1", title: "Topik Negatif PLN", posMentions: 200, negMentions: 600 })],
};

describe("BumnDashboardV2 (A8 v4.0 / AC10)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("clusters topics by tone — Negative section first, Positive after, Neutral trailing (AC10b)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(MIXED), { status: 200 })));
    render(<BumnDashboardV2 name="PLN" topicCode="danantara_pln" />);

    await waitFor(() => expect(screen.getAllByText("Topik Negatif PLN").length).toBeGreaterThan(0));
    const neg = screen.getByTestId("bumn-cluster-negative");
    const pos = screen.getByTestId("bumn-cluster-positive");
    const neu = screen.getByTestId("bumn-cluster-neutral");
    expect(neg.compareDocumentPosition(pos) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(pos.compareDocumentPosition(neu) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Each topic lands in its own tone cluster.
    expect(neg.textContent).toContain("Topik Negatif PLN");
    expect(pos.textContent).toContain("Topik Positif PLN");
    expect(neu.textContent).toContain("Topik Netral PLN");
  });

  it("an empty Positive cluster still anchors with a placeholder; Neutral cluster is omitted when empty", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(NEGATIVE_ONLY), { status: 200 })));
    render(<BumnDashboardV2 name="PLN" topicCode="danantara_pln" />);

    await waitFor(() => expect(screen.getAllByText("Topik Negatif PLN").length).toBeGreaterThan(0));
    const pos = screen.getByTestId("bumn-cluster-positive");
    expect(pos.textContent).toMatch(/no positive topics/i);
    expect(screen.queryByTestId("bumn-cluster-neutral")).not.toBeInTheDocument();
  });

  it("renders the split summary; clicking its Positive box scrolls the Positive cluster into view (AC10a/c)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(MIXED), { status: 200 })));
    const scrollSpy = vi.fn();
    Element.prototype.scrollIntoView = scrollSpy;
    render(<BumnDashboardV2 name="PLN" topicCode="danantara_pln" />);

    await waitFor(() => expect(screen.getByTestId("sentiment-summary-split")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("summary-box-positive"));
    expect(scrollSpy).toHaveBeenCalled();
  });

  it("keeps the v1 header, intent leaderboard, and calls the BFF with the BUMN's code", async () => {
    let calledUrl = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calledUrl = String(url);
        return new Response(JSON.stringify(MIXED), { status: 200 });
      }),
    );
    render(<BumnDashboardV2 name="PLN" topicCode="danantara_pln" />);

    await waitFor(() => expect(screen.getByTestId("intent-share")).toBeInTheDocument());
    expect(calledUrl).toContain("code=danantara_pln");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("PLN");
  });
});
