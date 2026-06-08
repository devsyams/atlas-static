// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { IntentShare } from "./IntentShare";

const INTENTS = [
  { intent: "Kritik Kebijakan", deskripsi: "", impressions: 16015280, share_of_voice: 61 },
  { intent: "Berita dan Informasi", deskripsi: "", impressions: 30299, share_of_voice: 10 },
  { intent: "Promosi Investasi", deskripsi: "", impressions: 5005, share_of_voice: 3 },
  { intent: "Tanya Jawab Publik", deskripsi: "", impressions: 8201, share_of_voice: 5 },
  { intent: "Loker dan Kesempatan Kerja", deskripsi: "", impressions: 3778, share_of_voice: 1 },
];

describe("IntentShare leaderboard (T7 / AC4 · v3.5)", () => {
  it("renders one ranked bar per non-zero intent", () => {
    const { container } = render(<IntentShare intents={INTENTS} />);
    expect(container.querySelectorAll("[data-bar]")).toHaveLength(INTENTS.length);
  });

  it("orders the bars by share-of-voice, leader first", () => {
    const { container } = render(<IntentShare intents={INTENTS} />);
    const order = [...container.querySelectorAll("[data-bar]")].map((el) => el.getAttribute("data-bar"));
    expect(order[0]).toBe("Kritik Kebijakan"); // 61% — the dominant intent
    expect(order[order.length - 1]).toBe("Loker dan Kesempatan Kerja"); // 1% — last
  });

  it("labels each intent with its share-of-voice % and impressions", () => {
    render(<IntentShare intents={INTENTS} />);
    const el = screen.getByTestId("intent-share");
    expect(el.textContent).toContain("Kritik Kebijakan");
    expect(el.textContent).toContain("61%");
    expect(el.textContent).toContain("16M"); // leader impressions (fmtCount)
    expect(el.textContent).toContain("Loker dan Kesempatan Kerja");
  });

  it("scales each bar to the leader so the top intent fills the track", () => {
    const { container } = render(<IntentShare intents={INTENTS} />);
    const bars = [...container.querySelectorAll("[data-bar] .intent-bar")] as HTMLElement[];
    expect(bars[0].style.width).toBe("100%"); // leader = full width
    // A tiny share still renders a visible sliver (floored), never 0.
    expect(parseFloat(bars[bars.length - 1].style.width)).toBeGreaterThan(0);
  });

  it("handles an empty intent list without crashing", () => {
    const { container } = render(<IntentShare intents={[]} />);
    expect(screen.getByTestId("intent-share")).toBeInTheDocument();
    expect(container.querySelectorAll("[data-bar]")).toHaveLength(0);
  });
});
