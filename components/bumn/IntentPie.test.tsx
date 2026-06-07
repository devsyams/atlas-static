// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { IntentPie } from "./IntentPie";

const INTENTS = [
  { intent: "Kritik Kebijakan", deskripsi: "", impressions: 16015280, share_of_voice: 61 },
  { intent: "Berita dan Informasi", deskripsi: "", impressions: 30299, share_of_voice: 10 },
  { intent: "Promosi Investasi", deskripsi: "", impressions: 5005, share_of_voice: 3 },
  { intent: "Tanya Jawab Publik", deskripsi: "", impressions: 8201, share_of_voice: 5 },
  { intent: "Loker dan Kesempatan Kerja", deskripsi: "", impressions: 3778, share_of_voice: 1 },
];

describe("IntentPie (T7 / AC4)", () => {
  it("renders one donut segment per non-zero intent", () => {
    const { container } = render(<IntentPie intents={INTENTS} />);
    expect(container.querySelectorAll("[data-segment]")).toHaveLength(INTENTS.length);
  });

  it("labels each intent with its share-of-voice %", () => {
    render(<IntentPie intents={INTENTS} />);
    const el = screen.getByTestId("intent-pie");
    expect(el.textContent).toContain("Kritik Kebijakan");
    expect(el.textContent).toContain("61%");
    expect(el.textContent).toContain("Loker dan Kesempatan Kerja");
  });

  it("handles an empty intent list without crashing", () => {
    const { container } = render(<IntentPie intents={[]} />);
    expect(screen.getByTestId("intent-pie")).toBeInTheDocument();
    expect(container.querySelectorAll("[data-segment]")).toHaveLength(0);
  });
});
