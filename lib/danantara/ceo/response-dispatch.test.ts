import { describe, expect, it } from "vitest";
import { responseCalculator } from "./counter-noise";
import { buildResponseBrief, waNumber, whatsappResponseLink } from "./response-dispatch";

const topic = {
  title: "Outlook Negatif Moody's terhadap Peringkat Kredit Baa2 Danantara",
  reach: 9_800_000,
  mentions: 14_700_000,
  posMentions: 1_470_000,
  negMentions: 11_025_000, // 75% negative
  aiLine: "Moody's menurunkan outlook Danantara; pasar bereaksi negatif.",
};

describe("response-dispatch (A9 v3.0 — WhatsApp handoff)", () => {
  it("waNumber strips non-digits to the wa.me format", () => {
    expect(waNumber("+62 812-3456-7890")).toBe("6281234567890");
  });

  it("whatsappResponseLink builds a wa.me click-to-chat URL with the encoded message", () => {
    const url = whatsappResponseLink("+62 812 3456 7890", "Hello world & co");
    expect(url.startsWith("https://wa.me/6281234567890?text=")).toBe(true);
    const text = decodeURIComponent(url.split("text=")[1]);
    expect(text).toBe("Hello world & co");
  });

  it("buildResponseBrief includes the topic, sentiment, reach, the penjelasan and the plan", () => {
    const plan = responseCalculator(1498, "professional");
    const brief = buildResponseBrief(topic, plan);
    expect(brief).toContain(topic.title);
    expect(brief).toContain("Negative 75%");
    expect(brief).toContain("9.8M"); // reach
    expect(brief).toContain("14.7M"); // impressions
    expect(brief).toContain(topic.aiLine); // the Nexorus AI penjelasan
    expect(brief).toContain("Professional");
    expect(brief).toContain("2,247"); // clipper
    expect(brief).toContain("1,348"); // kol
    expect(brief).toContain("899"); // homeless
    expect(brief).toContain("4,494"); // total
  });

  it("omits the penjelasan line cleanly when there is none", () => {
    const plan = responseCalculator(100, "basic");
    const brief = buildResponseBrief({ ...topic, aiLine: undefined }, plan);
    expect(brief).not.toContain("Nexorus AI:");
    expect(brief).toContain(topic.title);
  });
});
