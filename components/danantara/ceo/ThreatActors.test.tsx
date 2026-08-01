// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
