// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import captured from "@/lib/bgn/mock/actor-intelligence.json";
import { mapCapturedRoster } from "@/lib/danantara/ceo/actor-intel";
import type { ThreatDriver } from "@/lib/danantara/ceo/threats-source";
import { ThreatActors } from "./ThreatActors";

function mkDriver(over: Partial<ThreatDriver> = {}): ThreatDriver {
  return {
    handle: "some_actor",
    platform: "twitter",
    followers: 12_000,
    credibility: 7,
    riskLevel: "high",
    accountType: "Negative Critic",
    bot: false,
    engagement: 0,
    note: "",
    ...over,
  };
}

describe("ThreatActors — Kredibilitas chip (A10 v9.1)", () => {
  it("shows the chip when the actor has been analyzed (credibility > 0)", () => {
    render(<ThreatActors drivers={[mkDriver({ credibility: 7 })]} caption="Aktor kunci" loading={false} />);
    expect(screen.getByText(/Kredibilitas/)).toBeInTheDocument();
  });

  it("shows the chip at credibility 0 when a classification exists (a genuinely-scored 0)", () => {
    render(
      <ThreatActors
        drivers={[mkDriver({ credibility: 0, accountType: "Complainer" })]}
        caption="Aktor kunci"
        loading={false}
      />,
    );
    expect(screen.getByText(/Kredibilitas/)).toBeInTheDocument();
  });

  it("hides the chip for an unanalyzed actor (credibility 0 AND empty classification — enrichment off)", () => {
    render(
      <ThreatActors
        drivers={[mkDriver({ credibility: 0, accountType: "" })]}
        caption="Aktor kunci"
        loading={false}
      />,
    );
    // TrawlDeck serves credibility_score 0 + account_classification "" while the
    // engine's paid actor-intel enrichment flag is off — "Kredibilitas 0/10" would
    // read as a real (terrible) score, so the chip is suppressed until analyzed.
    expect(screen.getByText("@some_actor")).toBeInTheDocument();
    expect(screen.queryByText(/Kredibilitas/)).not.toBeInTheDocument();
  });
});

describe("ThreatActors — captured roster + detail popup (A10 v10.0, T28/T29)", () => {
  const capturedDrivers = mapCapturedRoster(captured);

  it("renders ALL captured actors in one list — no Human/Bot bands — with classification, influence + sentiment (T28)", () => {
    render(<ThreatActors drivers={capturedDrivers} caption="Aktor kunci" loading={false} />);
    // every captured actor is on the card list
    for (const d of capturedDrivers) {
      expect(screen.getByText(`@${d.handle}`)).toBeInTheDocument();
    }
    // the static Human/Bot band headers are gone — replaced by classification-type groups
    expect(screen.queryByText("Human Actor")).not.toBeInTheDocument();
    expect(screen.queryByText("Bot Actor")).not.toBeInTheDocument();
    expect(screen.getByTestId("actor-group-influencer")).toBeInTheDocument();
    expect(screen.getByTestId("actor-group-media")).toBeInTheDocument();
    expect(screen.getByTestId("actor-group-person")).toBeInTheDocument();
    // e.g. @ARSIPAJA (classification "News Media") files under the News Media group
    expect(screen.getByTestId("actor-group-media").textContent).toContain("@ARSIPAJA");
    expect(screen.getByTestId("actor-group-person").textContent).toContain("@dennyindrayana");
    // the JSON's own classification labels the cards (e.g. profesor_saham → Influencer)
    expect(screen.getAllByText(/Influencer\/News Media/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Real Person\/Complainer/i).length).toBeGreaterThan(0);
    // influence + sentiment ride on the cards (matcher spans styled sub-elements)
    expect(
      screen.getAllByText((_, el) => el?.textContent?.replace(/\s+/g, " ").includes("Pengaruh 8/10") ?? false).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("-7.5").length).toBeGreaterThan(0);
  });

  it("keeps the legacy 2×2 human/bot split for a live (intel-less) roster (regression)", () => {
    const live: ThreatDriver[] = [
      mkDriver({ handle: "human_a" }),
      mkDriver({ handle: "human_b" }),
      mkDriver({ handle: "human_c" }),
      mkDriver({ handle: "buzzer_x", bot: true }),
    ];
    render(<ThreatActors drivers={live} caption="Aktor kunci" loading={false} />);
    expect(screen.getByText("Human Actor")).toBeInTheDocument();
    expect(screen.getByText("Bot Actor")).toBeInTheDocument();
    expect(screen.getByText("@human_a")).toBeInTheDocument();
    expect(screen.getByText("@human_b")).toBeInTheDocument();
    expect(screen.queryByText("@human_c")).not.toBeInTheDocument(); // 2-cap holds
    expect(screen.getByText("@buzzer_x")).toBeInTheDocument();
  });

  it("opens the ActorDetailModal with the analysis sections on click; Esc closes it (T28)", () => {
    render(<ThreatActors drivers={capturedDrivers} caption="Aktor kunci" loading={false} />);
    fireEvent.click(screen.getByRole("button", { name: /@LambeSahamjja/ }));

    expect(screen.getByTestId("actor-detail")).toBeInTheDocument();
    expect(screen.getByText("Risk Assessment")).toBeInTheDocument();
    expect(screen.getByText("Recommended Actions")).toBeInTheDocument();
    expect(screen.getByText(/Pantau secara ketat semua unggahannya/)).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("actor-detail")).not.toBeInTheDocument();
  });

  it("renders a driver without intel as a plain, non-clickable card (T29)", () => {
    render(<ThreatActors drivers={[mkDriver({ handle: "plain_actor" })]} caption="Aktor kunci" loading={false} />);
    expect(screen.getByText("@plain_actor")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /@plain_actor/ })).not.toBeInTheDocument();
  });
});
