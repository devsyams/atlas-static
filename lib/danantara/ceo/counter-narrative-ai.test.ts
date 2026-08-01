import { describe, expect, it } from "vitest";
import {
  COUNTER_NARRATIVE_SCHEMA,
  COUNTER_NARRATIVE_SYSTEM,
  DRAFT_CHANNELS,
  buildCounterNarrativeGrounding,
  fallbackCounterNarrative,
  parseCounterNarrative,
} from "./counter-narrative-ai";
import type { CeoIssue } from "./types";

function mkIssue(over: Partial<CeoIssue> & Pick<CeoIssue, "id" | "title">): CeoIssue {
  return {
    category: "kebijakan",
    relatedBumn: [],
    mentions: 1_000,
    reach: 10_000_000,
    sentiment: -40,
    history: Array.from({ length: 8 }, () => 1000),
    headlines: [],
    aiLine: "Konteks singkat.",
    velocity: 0,
    status: "normal",
    rankHistory: [1, 1, 1, 1, 1, 1, 1, 1],
    rankDelta: 0,
    posMentions: 200,
    negMentions: 600,
    ...over,
  };
}

const TOPICS: CeoIssue[] = [
  mkIssue({
    id: "t0",
    title: "Investasi Hilirisasi Nikel",
    aiLine: "Publik mempertanyakan tata kelola dana investasi hilirisasi.",
    reach: 50_000_000,
    mentions: 2_000,
    negMentions: 1_700,
    posMentions: 200,
    status: "escalating",
    velocity: 212,
    headlines: [
      { source: "Kompas", title: "Sorotan atas dana hilirisasi", time: "2 jam lalu" },
      { source: "CNBC Indonesia", title: "Investor menanti kejelasan", time: "4 jam lalu" },
    ],
  }),
  mkIssue({ id: "t1", title: "Divestasi Aset BUMN", reach: 30_000_000, mentions: 1_000, negMentions: 800, posMentions: 100 }),
  mkIssue({ id: "t2", title: "Dana Pensiun Karyawan", reach: 20_000_000, mentions: 800, negMentions: 600, posMentions: 90 }),
];

function mkDraft(channel: string, over: Record<string, unknown> = {}) {
  return {
    channel,
    platform: "X / Instagram",
    body: `Draft ${channel} yang siap tempel dan cukup panjang untuk lolos validasi.`,
    hashtags: ["#Danantara", "#Hilirisasi"],
    ...over,
  };
}

function mkPayloadTopic(id: string, over: Record<string, unknown> = {}) {
  return {
    topic_id: id,
    attack_line: `Framing penyerang untuk ${id}.`,
    counter_angle: `Sudut balasan untuk ${id}.`,
    drafts: DRAFT_CHANNELS.map((c) => mkDraft(c)),
    ...over,
  };
}

const VALID = { topics: TOPICS.map((t) => mkPayloadTopic(t.id)) };

describe("counter-narrative-ai — grounding + prompt (A14 AC4)", () => {
  it("carries every citable figure and nothing the model may not cite (T9)", () => {
    const g = buildCounterNarrativeGrounding(TOPICS);

    // Identity + the feed's own Indonesian penjelasan.
    expect(g).toContain("topic_id: t0");
    expect(g).toContain("Investasi Hilirisasi Nikel");
    expect(g).toContain("Publik mempertanyakan tata kelola dana investasi hilirisasi.");

    // The figures the drafts are allowed to quote.
    expect(g).toContain("50.000.000"); // total reach, id-ID grouping
    expect(g).toContain("2.000"); // impressions
    expect(g).toContain("85%"); // negative share (1700/2000)
    expect(g).toContain("42.500.000"); // derived hostile reach
    expect(g).toContain("escalating");

    // Headlines — the only verbatim hostile language available to the model.
    expect(g).toContain("Sorotan atas dana hilirisasi");
    expect(g).toContain("Kompas");

    // All three topics are grounded, in order.
    expect(g.indexOf("t0")).toBeLessThan(g.indexOf("t1"));
    expect(g).toContain("Dana Pensiun Karyawan");
  });

  it("states the hard rules, including the content-governance ones (T10)", () => {
    const s = COUNTER_NARRATIVE_SYSTEM;
    expect(s).toMatch(/HANYA/); // only grounded facts
    expect(s).toMatch(/[Jj]angan mengarang/); // no fabricated statistics
    expect(s).toMatch(/2-3 kalimat/); // counter narrative should read like a short paragraph
    expect(s).toMatch(/280/); // kol length cap
    expect(s).toMatch(/150/); // clipper length cap
    expect(s).toMatch(/200/); // grassroots length cap
    expect(s).toMatch(/Bahasa Indonesia/);
    // Disclosed amplification — no impersonation, no targeting individuals.
    expect(s).toMatch(/tidak terafiliasi|warga netral|media independen/);
    expect(s).toMatch(/individu|akun tertentu/);
    expect(s).toMatch(/keterbukaan|disclosure|BERBAYAR/);

    // The schema is a well-formed structured-output contract.
    expect(COUNTER_NARRATIVE_SCHEMA.additionalProperties).toBe(false);
    expect((COUNTER_NARRATIVE_SCHEMA.required as string[]).includes("topics")).toBe(true);
  });
});

describe("counter-narrative-ai — parsing (A14 AC5)", () => {
  it("maps a valid payload back into grounding order even when the model shuffles (T11)", () => {
    const shuffled = { topics: [mkPayloadTopic("t2"), mkPayloadTopic("t0"), mkPayloadTopic("t1")] };
    const out = parseCounterNarrative(shuffled, TOPICS);

    expect(out).not.toBeNull();
    expect(out!.topics.map((t) => t.topicId)).toEqual(["t0", "t1", "t2"]);
    expect(out!.topics[0].title).toBe("Investasi Hilirisasi Nikel");
    expect(out!.topics[0].drafts.map((d) => d.channel)).toEqual([...DRAFT_CHANNELS]);
    expect(out!.topics[0].attackLine).toBe("Framing penyerang untuk t0.");
  });

  it("rejects the WHOLE payload on any structural problem — no partial trust (T12)", () => {
    expect(parseCounterNarrative(null, TOPICS)).toBeNull();
    expect(parseCounterNarrative({}, TOPICS)).toBeNull();

    // Wrong topic count.
    expect(parseCounterNarrative({ topics: VALID.topics.slice(0, 2) }, TOPICS)).toBeNull();

    // Unknown topic id.
    expect(
      parseCounterNarrative({ topics: [mkPayloadTopic("t0"), mkPayloadTopic("t1"), mkPayloadTopic("ghost")] }, TOPICS),
    ).toBeNull();

    // Duplicate topic id — this is what would join drafts to the wrong card.
    expect(
      parseCounterNarrative({ topics: [mkPayloadTopic("t0"), mkPayloadTopic("t0"), mkPayloadTopic("t1")] }, TOPICS),
    ).toBeNull();

    // Two drafts instead of three.
    const twoDrafts = { topics: [mkPayloadTopic("t0", { drafts: [mkDraft("kol"), mkDraft("clipper")] }), mkPayloadTopic("t1"), mkPayloadTopic("t2")] };
    expect(parseCounterNarrative(twoDrafts, TOPICS)).toBeNull();

    // Duplicate channel (kol twice, grassroots missing).
    const dupChannel = {
      topics: [mkPayloadTopic("t0", { drafts: [mkDraft("kol"), mkDraft("kol"), mkDraft("clipper")] }), mkPayloadTopic("t1"), mkPayloadTopic("t2")],
    };
    expect(parseCounterNarrative(dupChannel, TOPICS)).toBeNull();

    // Empty body / empty angle.
    const emptyBody = {
      topics: [mkPayloadTopic("t0", { drafts: [mkDraft("kol", { body: "   " }), mkDraft("clipper"), mkDraft("grassroots")] }), mkPayloadTopic("t1"), mkPayloadTopic("t2")],
    };
    expect(parseCounterNarrative(emptyBody, TOPICS)).toBeNull();
    expect(parseCounterNarrative({ topics: [mkPayloadTopic("t0", { counter_angle: "" }), mkPayloadTopic("t1"), mkPayloadTopic("t2")] }, TOPICS)).toBeNull();

    // Over-long body is REJECTED, never truncated — a half sentence must not reach a copy box.
    const longBody = {
      topics: [mkPayloadTopic("t0", { drafts: [mkDraft("kol", { body: "x".repeat(401) }), mkDraft("clipper"), mkDraft("grassroots")] }), mkPayloadTopic("t1"), mkPayloadTopic("t2")],
    };
    expect(parseCounterNarrative(longBody, TOPICS)).toBeNull();
  });

  it("normalises cosmetics without rejecting (T13)", () => {
    const messy = {
      topics: [
        mkPayloadTopic("t0", {
          drafts: [
            mkDraft("kol", { hashtags: ["Danantara", " #Hilir isasi ", "", "#a", "#b", "#c", "#d", "#e"], platform: "" }),
            mkDraft("clipper", { body: "  Body dengan spasi berlebih di ujung.  " }),
            mkDraft("grassroots"),
          ],
        }),
        mkPayloadTopic("t1"),
        mkPayloadTopic("t2"),
      ],
    };

    const out = parseCounterNarrative(messy, TOPICS);
    expect(out).not.toBeNull();

    const [kol, clipper] = out!.topics[0].drafts;
    expect(kol.hashtags.every((h) => h.startsWith("#"))).toBe(true);
    expect(kol.hashtags.every((h) => !/\s/.test(h))).toBe(true);
    expect(kol.hashtags).toContain("#Danantara");
    expect(kol.hashtags.length).toBeLessThanOrEqual(6);
    expect(kol.platform).toBeTruthy(); // defaulted from the channel
    expect(clipper.body).toBe("Body dengan spasi berlebih di ujung.");
  });
});

describe("counter-narrative-ai — deterministic fallback (A14 AC7)", () => {
  it("is presentable Indonesian content built from each topic's own data (T14)", () => {
    const out = fallbackCounterNarrative(TOPICS);

    expect(out.topics).toHaveLength(3);
    for (const [i, t] of out.topics.entries()) {
      expect(t.topicId).toBe(TOPICS[i].id);
      expect(t.attackLine.trim()).not.toBe("");
      expect(t.counterAngle.trim()).not.toBe("");
      expect(t.drafts).toHaveLength(3);
      expect(t.drafts.map((d) => d.channel)).toEqual([...DRAFT_CHANNELS]);
      for (const d of t.drafts) {
        expect(d.body.trim()).not.toBe("");
        expect(d.body).toContain(TOPICS[i].title); // grounded in its own topic
        expect(d.hashtags.length).toBeGreaterThanOrEqual(2);
        expect(d.hashtags.every((h) => h.startsWith("#"))).toBe(true);
      }
    }

    // Uses the feed's real penjelasan when it has one.
    expect(out.topics[0].attackLine).toContain("tata kelola");

    // Deterministic — the same input renders the same content on every tick.
    expect(fallbackCounterNarrative(TOPICS)).toEqual(out);
  });

  it("honours the same per-channel length caps as the live prompt (T14)", () => {
    const caps: Record<string, number> = { kol: 280, clipper: 150, grassroots: 200 };
    const long = mkIssue({
      id: "long",
      title: "Restrukturisasi Menyeluruh Portofolio Investasi Strategis Badan Usaha Milik Negara Sektor Energi",
      aiLine: "",
    });
    for (const d of fallbackCounterNarrative([long]).topics[0].drafts) {
      expect(d.body.length).toBeLessThanOrEqual(caps[d.channel]);
    }
  });
});
