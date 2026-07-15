import { describe, expect, it } from "vitest";

import { buildOpsGrounding, parseOpsAi } from "./ai-insight";
import type { OpsSnapshot } from "./types";

/** A snapshot with distinctive numbers, so we can assert they reach the grounding. */
function snap(): OpsSnapshot {
  return {
    corridor: "japek",
    updated_at: "2026-07-14T14:00:00.000Z",
    traffic_source: "tomtom",
    weather_source: "demo",
    load_index: 6.4,
    level: "Macet",
    emoji: "🟠",
    avg_speed: 37,
    avg_delay_min: 23,
    active_incidents: 2,
    safety: {
      score: 52,
      level: "Rawan",
      emoji: "🟠",
      trend: "down",
      delta: -4,
      factors: [{ key: "insiden", label: "Insiden", penalty: 22.5 }],
      narrative: "Skor keselamatan 52/100 — Rawan.",
    },
    insight: { title: "scripted title", text: "scripted text", action: "scripted action" },
    conditions: [],
    predictions: [],
    ticker: [],
    segments: [
      { km_from: 0, km_to: 9, label: "Halim – Cikunir", speed: 68, delay_min: 2, status: "lancar" },
      { km_from: 47, km_to: 52, label: "Karawang Timur – KM 52", speed: 11, delay_min: 18, status: "lumpuh" },
    ],
    landmarks: [],
    incidents: [
      {
        id: "TT-0",
        km: "KM 50",
        direction: "arah Cikampek",
        type: "Kecelakaan",
        severity: 9.1,
        status: "Berlangsung",
        source: "TomTom Traffic",
        source_type: "traffic",
        reported: "12 mnt lalu",
        detail: "Truk terguling di lajur 1.",
      },
    ],
    top_ruas: [],
    interventions: [],
    social: { mentions_24h: 3291, negativity: 7.3, trend: [], top_posts: [] },
    official: [],
    news: [],
    forecast: [
      { hour: "15:00", load: 6.4, label: "Sekarang" },
      { hour: "17:00", load: 8.8, label: "Puncak" },
    ],
    travel_times: [],
    weather: [{ zone: "Cikarang – Karawang", condition: "Hujan lebat", temp: 24, impact: "tinggi" }],
    sources: [],
    cctv: [],
  };
}

/** A well-formed LLM payload matching OPS_AI_SCHEMA. */
function payload() {
  return {
    insight: {
      title: "Kemacetan parah di Karawang Timur – KM 52",
      text: "Kecepatan turun ke 11 km/j di Karawang Timur – KM 52 dengan tundaan 18 mnt.",
      action: "Siapkan contraflow KM 47–52.",
    },
    predictions: [
      {
        question: "Macet meluas ke Dawuan dalam 2 jam?",
        probability: 74,
        answer_label: "Mungkin",
        reasoning: "Kecepatan 11 km/j di KM 52 dan hujan lebat di Karawang.",
        timeframe: "2 jam",
        tone: "negative",
      },
      {
        question: "Sebutan negatif melewati 5.000 malam ini?",
        probability: 61,
        answer_label: "Mungkin",
        reasoning: "3.291 sebutan/24 jam dengan negativitas 7,3/10.",
        timeframe: "malam ini",
        tone: "negative",
      },
      {
        question: "Kecepatan pulih di atas 50 km/j malam ini?",
        probability: 32,
        answer_label: "Kecil",
        reasoning: "Puncak beban 8,8 diperkirakan pukul 17:00.",
        timeframe: "malam ini",
        tone: "negative",
      },
    ],
  };
}

describe("buildOpsGrounding (T1 / AC3)", () => {
  const g = buildOpsGrounding(snap());

  it("carries the corridor, headline traffic figures and safety score", () => {
    expect(g).toContain("Jakarta–Cikampek");
    expect(g).toContain("37"); // avg_speed
    expect(g).toContain("23"); // avg_delay_min
    expect(g).toContain("52"); // safety score
  });

  it("names the slowest ruas with its speed, so the model can cite it", () => {
    expect(g).toContain("Karawang Timur – KM 52");
    expect(g).toContain("11");
  });

  it("carries the incidents with type + severity + source", () => {
    expect(g).toContain("Kecelakaan");
    expect(g).toContain("9.1");
    expect(g).toContain("TomTom Traffic");
  });

  it("carries weather and sentiment", () => {
    expect(g).toContain("Hujan lebat");
    expect(g).toContain("3291");
  });
});

describe("buildOpsGrounding — forward-looking, not an echo (T19 / AC20)", () => {
  it("no longer echoes the precomputed 6-hour forecast curve", () => {
    const g = buildOpsGrounding(snap());
    expect(g).not.toContain("PROYEKSI BEBAN 6 JAM");
    expect(g).not.toContain("Puncak diperkirakan");
  });

  it("always includes the current hour (WIB)", () => {
    // snap()'s updated_at is 2026-07-14T14:00:00.000Z -> 21:00 WIB (UTC+7).
    const g = buildOpsGrounding(snap());
    expect(g).toContain("JAM SEKARANG: 21:00 WIB.");
  });

  it("falls back to the real clock when updated_at isn't ISO (production's locale display string)", () => {
    // data.ts actually sets updated_at via toLocaleString("id-ID", {...}), e.g.
    // "15 Jul, 08.06" — no year, period-separated time. Date.parse() on that
    // does NOT return NaN (V8 parses it as a bogus ~2008 date instead), which
    // silently fed the LLM the wrong "now" 7h off real time. Guard against it.
    const s = snap();
    s.updated_at = "15 Jul, 08.06";
    const g = buildOpsGrounding(s);
    expect(g).not.toContain("JAM SEKARANG: 00:00 WIB.");
    expect(g).not.toContain("JAM SEKARANG: 01:00 WIB.");
  });

  it("omits the BMKG forward outlook block when weather isn't live", () => {
    const g = buildOpsGrounding(snap());
    expect(g).not.toContain("PRAKIRAAN CUACA");
  });

  it("includes the per-zone BMKG forward outlook when weather is live", () => {
    const s = snap();
    s.weather_source = "bmkg";
    s.weather = [
      {
        zone: "Cikarang – Karawang",
        condition: "Hujan lebat",
        temp: 24,
        impact: "tinggi",
        outlook: [
          { hour: "18:00", condition: "Hujan Ringan", impact: "sedang" },
          { hour: "21:00", condition: "Berawan", impact: "rendah" },
        ],
      },
    ];

    const g = buildOpsGrounding(s);
    expect(g).toContain("PRAKIRAAN CUACA (BMKG, ke depan)");
    expect(g).toContain("Cikarang – Karawang: 18:00 Hujan Ringan (dampak sedang), 21:00 Berawan (dampak rendah)");
  });

  it("omits the outlook block when weather is live but no zone carries an outlook", () => {
    const s = snap();
    s.weather_source = "bmkg";
    const g = buildOpsGrounding(s);
    expect(g).not.toContain("PRAKIRAAN CUACA");
  });
});

describe("buildOpsGrounding — real public sentiment (T16 / AC11)", () => {
  it("carries the real feed's figures and topic titles when the pulse is live", () => {
    const s = snap();
    s.social = {
      mentions_24h: 8277074,
      impressions: 8277074,
      reach: 5518049,
      negativity: 3.6,
      sentiment_pct: { positive: 5.79, negative: 35.97, neutral: 58.24 },
      trend: [],
      top_posts: [],
      source: "live",
      topics: [
        {
          title: "Kemacetan Panjang di Rest Area KM 19 Tol Jakarta-Cikampek",
          aiLine: "Keluhan antrian truk.",
          impressions: 207681,
          reach: 138454,
          sentiment: -80,
        },
      ],
    };

    const g = buildOpsGrounding(s);
    expect(g).toContain("DATA NYATA");
    expect(g).toContain("35.97% negatif");
    expect(g).toContain("Rest Area KM 19");
    expect(g).toContain("5518049"); // real reach
    expect(g).not.toContain("SENTIMEN PUBLIK (simulasi)");
  });

  it("labels the synthetic pulse as simulasi, so the model can't pass it off as real", () => {
    const g = buildOpsGrounding(snap()); // default fixture has no `source`
    expect(g).toContain("SENTIMEN PUBLIK (simulasi)");
    expect(g).not.toContain("DATA NYATA");
  });
});

describe("parseOpsAi (T2 / AC1+AC2)", () => {
  it("maps a well-formed payload to typed insight + 3 predictions", () => {
    const out = parseOpsAi(payload());
    expect(out).not.toBeNull();
    expect(out!.insight.title).toBe("Kemacetan parah di Karawang Timur – KM 52");
    expect(out!.insight.action).toBe("Siapkan contraflow KM 47–52.");
    expect(out!.predictions).toHaveLength(3);
    expect(out!.predictions[0].question).toBe("Macet meluas ke Dawuan dalam 2 jam?");
    expect(out!.predictions[0].probability).toBe(74);
    expect(out!.predictions[0].timeframe).toBe("2 jam");
    expect(out!.predictions[0].tone).toBe("negative");
  });
});

describe("parseOpsAi — probability clamping (T3 / AC2)", () => {
  it("clamps out-of-range probabilities into 0–100 and rounds to an integer", () => {
    const p = payload();
    p.predictions[0].probability = 140;
    p.predictions[1].probability = -5;
    p.predictions[2].probability = 61.7;

    const out = parseOpsAi(p);
    expect(out!.predictions[0].probability).toBe(100);
    expect(out!.predictions[1].probability).toBe(0);
    expect(out!.predictions[2].probability).toBe(62);
  });
});

describe("parseOpsAi — rejects malformed payloads (T4 / AC4)", () => {
  it("returns null when there are not exactly 3 predictions", () => {
    const p = payload();
    p.predictions = p.predictions.slice(0, 2);
    expect(parseOpsAi(p)).toBeNull();
  });

  it("returns null when a prediction is missing its question", () => {
    const p = payload();
    // @ts-expect-error — deliberately malformed
    delete p.predictions[1].question;
    expect(parseOpsAi(p)).toBeNull();
  });

  it("returns null when the insight title is empty", () => {
    const p = payload();
    p.insight.title = "   ";
    expect(parseOpsAi(p)).toBeNull();
  });

  it("returns null when a probability is not a number", () => {
    const p = payload();
    // @ts-expect-error — deliberately malformed
    p.predictions[0].probability = "tinggi";
    expect(parseOpsAi(p)).toBeNull();
  });

  it("returns null for junk input (null / string / empty object)", () => {
    expect(parseOpsAi(null)).toBeNull();
    expect(parseOpsAi("nope")).toBeNull();
    expect(parseOpsAi({})).toBeNull();
  });
});

/** A well-formed 6-point forecast matching the OPS_AI_SCHEMA `forecast` block. */
function forecastPoints() {
  return [
    { hour: "15:00", load: 6.4 },
    { hour: "16:00", load: 7.06 },
    { hour: "17:00", load: 8.8 },
    { hour: "18:00", load: 7.9 },
    { hour: "19:00", load: 6.0 },
    { hour: "20:00", load: 5.2 },
  ];
}

describe("parseOpsAi — forecast projection (T17 / AC19+AC20)", () => {
  it("maps a well-formed 6-point forecast, rounds load to 1 decimal, and labels Sekarang/Puncak", () => {
    const p = payload() as ReturnType<typeof payload> & { forecast?: unknown };
    p.forecast = forecastPoints();

    const out = parseOpsAi(p);
    expect(out).not.toBeNull();
    expect(out!.forecast).toHaveLength(6);
    expect(out!.forecast![0]).toEqual({ hour: "15:00", load: 6.4, label: "Sekarang" });
    expect(out!.forecast![1]).toEqual({ hour: "16:00", load: 7.1 }); // rounded, no label
    expect(out!.forecast![2]).toEqual({ hour: "17:00", load: 8.8, label: "Puncak" });
    expect(out!.forecast![3].label).toBeUndefined();
  });

  it("labels only Sekarang (no Puncak) when the current hour is already the max", () => {
    const p = payload() as ReturnType<typeof payload> & { forecast?: unknown };
    p.forecast = [
      { hour: "15:00", load: 9.0 },
      { hour: "16:00", load: 7.0 },
      { hour: "17:00", load: 6.0 },
      { hour: "18:00", load: 5.0 },
      { hour: "19:00", load: 4.0 },
      { hour: "20:00", load: 3.0 },
    ];

    const out = parseOpsAi(p);
    expect(out!.forecast![0]).toEqual({ hour: "15:00", load: 9, label: "Sekarang" });
    expect(out!.forecast!.some((f) => f.label === "Puncak")).toBe(false);
  });
});

describe("parseOpsAi — bad forecast drops to undefined without poisoning insight/predictions (T18 / AC21)", () => {
  it("drops the forecast when it isn't exactly 6 points", () => {
    const p = payload() as ReturnType<typeof payload> & { forecast?: unknown };
    p.forecast = forecastPoints().slice(0, 5);

    const out = parseOpsAi(p);
    expect(out).not.toBeNull();
    expect(out!.forecast).toBeUndefined();
    expect(out!.insight.title).toBe("Kemacetan parah di Karawang Timur – KM 52");
    expect(out!.predictions).toHaveLength(3);
  });

  it("drops the forecast when a load is above 10", () => {
    const p = payload() as ReturnType<typeof payload> & { forecast?: unknown };
    const pts = forecastPoints();
    pts[2].load = 12;
    p.forecast = pts;

    const out = parseOpsAi(p);
    expect(out).not.toBeNull();
    expect(out!.forecast).toBeUndefined();
    expect(out!.predictions).toHaveLength(3);
  });

  it("drops the forecast when a load is below 0.5", () => {
    const p = payload() as ReturnType<typeof payload> & { forecast?: unknown };
    const pts = forecastPoints();
    pts[0].load = 0.2;
    p.forecast = pts;

    expect(parseOpsAi(p)!.forecast).toBeUndefined();
  });

  it("drops the forecast when an hour is empty", () => {
    const p = payload() as ReturnType<typeof payload> & { forecast?: unknown };
    const pts = forecastPoints();
    pts[3].hour = "   ";
    p.forecast = pts;

    expect(parseOpsAi(p)!.forecast).toBeUndefined();
  });

  it("drops the forecast when absent entirely, still returning insight/predictions", () => {
    const out = parseOpsAi(payload());
    expect(out).not.toBeNull();
    expect(out!.forecast).toBeUndefined();
  });

  it("drops the forecast when it isn't an array", () => {
    const p = payload() as ReturnType<typeof payload> & { forecast?: unknown };
    p.forecast = "nope";
    expect(parseOpsAi(p)!.forecast).toBeUndefined();
  });
});
