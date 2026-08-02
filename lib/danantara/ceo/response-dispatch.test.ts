import { describe, expect, it } from "vitest";
import { responseCalculator } from "./counter-noise";
import { counterNarrativePlan } from "./counter-narrative";
import type { CounterNarrativeTopic } from "./counter-narrative-ai";
import { buildResponseBrief, buildWarRoomBrief, waNumber, whatsappResponseLink } from "./response-dispatch";

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
    expect(brief).not.toContain("Danantara CEO Command");
  });

  it("omits the penjelasan line cleanly when there is none", () => {
    const plan = responseCalculator(100, "basic");
    const brief = buildResponseBrief({ ...topic, aiLine: undefined }, plan);
    expect(brief).not.toContain("Nexorus AI:");
    expect(brief).toContain(topic.title);
  });
});

describe("buildWarRoomBrief (A14 — counter-narrative handoff, T35)", () => {
  const cn: CounterNarrativeTopic = {
    topicId: "t0",
    title: "Investasi Hilirisasi Nikel",
    attackLine: "Dana publik dipakai untuk investasi berisiko tanpa transparansi.",
    counterAngle: "Hilirisasi menambah nilai di dalam negeri; tata kelolanya dibuka lewat pelaporan berkala.",
    drafts: [
      { channel: "kol", platform: "X / Instagram", body: "Draft KOL berbasis data.", hashtags: ["#Danantara", "#Hilirisasi"] },
      { channel: "clipper", platform: "TikTok / Reels", body: "Hook video pendek soal nilai tambah.", hashtags: ["#Danantara"] },
      { channel: "grassroots", platform: "Facebook / WhatsApp", body: "Suara karyawan yang ikut terdampak.", hashtags: ["#Danantara"] },
    ],
  };
  const plan = counterNarrativePlan(
    { reach: 50_000_000, mentions: 2_000, posMentions: 200, negMentions: 1_700 },
    "professional",
  );

  it("carries the topic, the reading, the plan and the counts-only handoff", () => {
    const brief = buildWarRoomBrief(cn, plan);

    expect(brief).toContain(cn.title);
    expect(brief).toContain(cn.attackLine);
    expect(brief).toContain(cn.counterAngle);
    expect(brief).toContain("42.5M"); // hostile reach, fmtCount
    expect(brief).toContain("Professional");
    expect(brief).toContain(`${plan.shareOfVoicePct}%`);
    expect(brief).toContain(plan.totalPosts.toLocaleString("en-US"));
    for (const d of cn.drafts) expect(brief).not.toContain(d.body);
    // The channel split still rides along so the room knows how the total is spent.
    for (const c of plan.channels) expect(brief).toContain(c.posts.toLocaleString("en-US"));
    expect(brief).toContain("The PR/media team will craft the final channel copy.");
    expect(brief).not.toContain("Danantara CEO Command");
  });

  it("stays inside the practical wa.me?text= length ceiling", () => {
    expect(buildWarRoomBrief(cn, plan).length).toBeLessThan(1800);
  });
});
