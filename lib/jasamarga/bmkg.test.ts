import { describe, expect, it } from "vitest";

import { CORRIDORS } from "./corridors";
import { buildSnapshot } from "./data";
import { mapBmkgZone, pickCurrent, weatherImpact, type BmkgForecast } from "./bmkg";

/** Shaped after the real api.bmkg.go.id payload. */
function entry(over: Partial<BmkgForecast> = {}): BmkgForecast {
  return {
    datetime: "2026-07-15T00:00:00Z",
    t: 26,
    weather: 3,
    weather_desc: "Berawan",
    ...over,
  } as BmkgForecast;
}

function payload(entries: BmkgForecast[]) {
  return { lokasi: { kotkab: "Bekasi" }, data: [{ cuaca: [entries] }] };
}

describe("corridor BMKG registry (T20 / AC16)", () => {
  it("every corridor has one verified adm4 zone per weather zone, in the same order", () => {
    for (const c of CORRIDORS) {
      expect(c.bmkg, c.id).toHaveLength(c.weather.length);
      expect(c.bmkg.map((z) => z.zone), c.id).toEqual(c.weather.map((w) => w.zone));
      for (const z of c.bmkg) {
        // Kemendagri village code: PP.KK.CC.VVVV — anything else BMKG rejects.
        expect(z.adm4, `${c.id}/${z.zone}`).toMatch(/^\d{2}\.\d{2}\.\d{2}\.\d{4}$/);
      }
    }
  });
});

describe("buildSnapshot weather override (T21 / AC17+AC18)", () => {
  const live = [
    { zone: "Jakarta – Bekasi", condition: "Hujan Lebat", temp: 23, impact: "tinggi" as const },
    { zone: "Cikarang – Karawang", condition: "Hujan Lebat", temp: 23, impact: "tinggi" as const },
    { zone: "Cikampek", condition: "Hujan Lebat", temp: 23, impact: "tinggi" as const },
  ];

  it("uses the real BMKG zones, and the Safe Meter's weather penalty follows them", () => {
    const s = buildSnapshot("japek", undefined, undefined, null, live);
    expect(s.weather_source).toBe("bmkg");
    expect(s.weather).toEqual(live);

    // The static Japek fallback's worst impact is "sedang"; real is "tinggi", so
    // the penalty must be strictly larger — proving it isn't a hardcoded constant.
    const wx = (snap: ReturnType<typeof buildSnapshot>) =>
      snap.safety.factors.find((f) => f.key === "cuaca")!.penalty;
    expect(wx(s)).toBeGreaterThan(wx(buildSnapshot("japek", undefined, undefined, null, null)));
  });

  it("falls back to the corridor's static zones when BMKG is unavailable", () => {
    const s = buildSnapshot("japek", undefined, undefined, null, null);
    expect(s.weather_source).toBe("demo");
    expect(s.weather).toEqual(CORRIDORS[0].weather);
  });
});

describe("weatherImpact (T17 / AC17)", () => {
  it("treats heavy rain and thunderstorms as high impact", () => {
    expect(weatherImpact(63, "Hujan Lebat")).toBe("tinggi");
    expect(weatherImpact(95, "Hujan Petir")).toBe("tinggi");
    expect(weatherImpact(97, "Hujan Petir")).toBe("tinggi");
  });

  it("treats light/moderate rain, fog and haze as medium impact", () => {
    expect(weatherImpact(60, "Hujan Ringan")).toBe("sedang");
    expect(weatherImpact(61, "Hujan Sedang")).toBe("sedang");
    expect(weatherImpact(45, "Kabut")).toBe("sedang");
    expect(weatherImpact(5, "Udara Kabur")).toBe("sedang");
  });

  it("treats clear and cloudy as low impact", () => {
    expect(weatherImpact(0, "Cerah")).toBe("rendah");
    expect(weatherImpact(1, "Cerah Berawan")).toBe("rendah");
    expect(weatherImpact(3, "Berawan")).toBe("rendah");
    expect(weatherImpact(4, "Berawan Tebal")).toBe("rendah");
  });

  it("falls back to the description when the code is unknown", () => {
    expect(weatherImpact(999, "Hujan Lebat Disertai Petir")).toBe("tinggi");
    expect(weatherImpact(999, "Hujan Ringan")).toBe("sedang");
    expect(weatherImpact(999, "Sesuatu yang lain")).toBe("rendah");
  });
});

describe("pickCurrent (T18 / AC16)", () => {
  const series = [
    entry({ datetime: "2026-07-15T00:00:00Z", t: 24 }),
    entry({ datetime: "2026-07-15T03:00:00Z", t: 27 }),
    entry({ datetime: "2026-07-15T06:00:00Z", t: 31 }),
  ];

  it("picks the slot covering 'now' — the latest one at or before it", () => {
    const now = Date.parse("2026-07-15T04:30:00Z");
    expect(pickCurrent(series, now)?.t).toBe(27);
  });

  it("picks the slot exactly on the boundary", () => {
    expect(pickCurrent(series, Date.parse("2026-07-15T06:00:00Z"))?.t).toBe(31);
  });

  it("falls back to the first slot when every forecast is still in the future", () => {
    expect(pickCurrent(series, Date.parse("2026-07-14T22:00:00Z"))?.t).toBe(24);
  });

  it("uses the last slot when now is past the end of the series", () => {
    expect(pickCurrent(series, Date.parse("2026-07-16T00:00:00Z"))?.t).toBe(31);
  });

  it("returns null for an empty series", () => {
    expect(pickCurrent([], Date.now())).toBeNull();
  });
});

describe("mapBmkgZone (T19 / AC16+AC18)", () => {
  const now = Date.parse("2026-07-15T04:00:00Z");

  it("maps a real payload onto the dashboard's WeatherZone", () => {
    const z = mapBmkgZone(
      payload([entry({ datetime: "2026-07-15T03:00:00Z", t: 24, weather: 60, weather_desc: "Hujan Ringan" })]),
      "Cikarang – Karawang",
      now,
    );
    expect(z).toEqual({
      zone: "Cikarang – Karawang",
      condition: "Hujan Ringan",
      temp: 24,
      impact: "sedang",
    });
  });

  it("rounds the temperature to a whole degree", () => {
    const z = mapBmkgZone(payload([entry({ t: 26.7 })]), "Cikampek", now);
    expect(z?.temp).toBe(27);
  });

  it("returns null on a malformed / empty payload so the caller keeps the static zone", () => {
    expect(mapBmkgZone(null, "Cikampek", now)).toBeNull();
    expect(mapBmkgZone({}, "Cikampek", now)).toBeNull();
    expect(mapBmkgZone({ data: [] }, "Cikampek", now)).toBeNull();
    expect(mapBmkgZone(payload([]), "Cikampek", now)).toBeNull();
  });

  it("flattens BMKG's day-grouped series (it nests forecasts per day)", () => {
    const grouped = {
      data: [
        {
          cuaca: [
            [entry({ datetime: "2026-07-15T00:00:00Z", t: 20 })],
            [entry({ datetime: "2026-07-15T03:00:00Z", t: 29, weather_desc: "Cerah" })],
          ],
        },
      ],
    };
    expect(mapBmkgZone(grouped, "Cikampek", now)?.temp).toBe(29);
  });
});
