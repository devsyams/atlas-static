# JasaMarga Map + Safe Meter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a live interactive corridor map (Leaflet) and a 0–100 "Safe Meter" headline gauge to the JasaMarga Ops Command dashboard, with cinematic gimmick animations meant to make the demo screenshot-and-share worthy.

**Architecture:** Extend the existing `OpsSnapshot` contract with a `safety` block and per-incident coordinates. Add pure, tested helpers (`safety.ts`, `geo.ts`), two client components (`SafeMeter`, `CorridorMap` — vanilla Leaflet, dynamically imported `ssr:false`), and a thin `JasaMargaSource` seam so a real feed can plug in later. Everything reuses the existing TomTom + synthetic data path; nothing in the working dashboard is rewritten.

**Tech Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Leaflet 1.9 (already installed) · vitest (node env) · canvas 2D for the gauge.

**Spec:** `docs/superpowers/specs/2026-05-29-jasamarga-map-safe-meter-design.md`

**Conventions for every command below:** run from the web app dir. Prefix with `cd apps/web &&`. Tests: `pnpm exec vitest run <file>`. Typecheck: `pnpm typecheck`. Commit from repo root with the existing message style.

---

## Task 1: Contract types

**Files:**
- Modify: `apps/web/lib/jasamarga/types.ts`

- [ ] **Step 1: Add the Safety types and extend the contract**

In `apps/web/lib/jasamarga/types.ts`, add these interfaces (place them just above `export interface OpsSnapshot`):

```ts
/** One contributing factor to the corridor Safe Meter (points subtracted from 100). */
export interface SafetyFactor {
  key: "insiden" | "cuaca" | "volatilitas" | "sentimen";
  label: string;
  penalty: number; // points removed from a perfect 100
}

/** Composite corridor safety headline ("Skor Keselamatan"). Higher = safer. */
export interface SafetyIndex {
  score: number; // 0–100
  level: "Aman" | "Waspada" | "Rawan" | "Bahaya";
  emoji: string;
  trend: "up" | "down" | "flat"; // up = improving (safer) vs prior reading
  delta: number; // score change vs prior reading
  factors: SafetyFactor[];
  narrative: string; // one-line plain-language summary
}
```

Add `lat`/`lng` to `IncidentItem` (after the existing `lanes_blocked?` line):

```ts
  lanes_blocked?: number; // only when the public report states it
  lat?: number; // map coordinate (TomTom-supplied or derived from km)
  lng?: number;
  detail: string;
```

Add `safety` to `OpsSnapshot` (after the `active_incidents` line):

```ts
  active_incidents: number;
  safety: SafetyIndex;
  insight: OpsInsight;
```

- [ ] **Step 2: Verify it typechecks (will fail until later tasks fill `safety`)**

Run: `cd apps/web && pnpm typecheck`
Expected: a type error in `data.ts` (`buildSnapshot` return is missing `safety`). That's expected — Task 4 fills it. Do **not** fix it here.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/jasamarga/types.ts
git commit -m "feat(jasamarga): add SafetyIndex contract + incident coordinates

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Safe Meter computation (`computeSafety`)

**Files:**
- Create: `apps/web/lib/jasamarga/safety.ts`
- Test: `apps/web/lib/jasamarga/safety.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/lib/jasamarga/safety.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { computeSafety, safetyBand, safetyColor } from "./safety";
import type { IncidentItem, RouteSegment, WeatherZone } from "./types";

const seg = (speed: number): RouteSegment => ({
  km_from: 0, km_to: 9, label: "x", speed, delay_min: 0, status: "lancar",
});
const incident = (severity: number, lanes = 0): IncidentItem => ({
  id: "i", km: "KM 10", direction: "x", type: "Kecelakaan", severity,
  status: "Berlangsung", source: "x", source_type: "traffic", reported: "now",
  lanes_blocked: lanes, detail: "x",
});
const clearWeather: WeatherZone[] = [{ zone: "z", condition: "Cerah", temp: 30, impact: "rendah" }];
const uniformSegments = [seg(70), seg(70), seg(70), seg(70)];

describe("safetyBand", () => {
  it("maps score to band at the boundaries", () => {
    expect(safetyBand(100).level).toBe("Aman");
    expect(safetyBand(80).level).toBe("Aman");
    expect(safetyBand(79).level).toBe("Waspada");
    expect(safetyBand(60).level).toBe("Waspada");
    expect(safetyBand(59).level).toBe("Rawan");
    expect(safetyBand(40).level).toBe("Rawan");
    expect(safetyBand(39).level).toBe("Bahaya");
    expect(safetyBand(0).level).toBe("Bahaya");
  });
});

describe("computeSafety", () => {
  it("returns a high, safe score for a clean corridor", () => {
    const r = computeSafety(uniformSegments, [], clearWeather, 1);
    expect(r.score).toBeGreaterThanOrEqual(80);
    expect(r.level).toBe("Aman");
    expect(r.factors).toHaveLength(4);
    expect(r.factors.map((f) => f.key)).toEqual(["insiden", "cuaca", "volatilitas", "sentimen"]);
  });

  it("drops the score when a severe incident is present (monotonic in incidents)", () => {
    const base = computeSafety(uniformSegments, [], clearWeather, 1).score;
    const withIncident = computeSafety(uniformSegments, [incident(9, 2)], clearWeather, 1).score;
    expect(withIncident).toBeLessThan(base);
  });

  it("drops the score for worse weather and worse sentiment", () => {
    const base = computeSafety(uniformSegments, [], clearWeather, 1).score;
    const badWeather = computeSafety(uniformSegments, [], [{ zone: "z", condition: "Hujan lebat", temp: 25, impact: "tinggi" }], 1).score;
    const badMood = computeSafety(uniformSegments, [], clearWeather, 9).score;
    expect(badWeather).toBeLessThan(base);
    expect(badMood).toBeLessThan(base);
  });

  it("penalizes speed volatility (sharp localized slowdowns)", () => {
    const calm = computeSafety(uniformSegments, [], clearWeather, 1).score;
    const volatile = computeSafety([seg(80), seg(8), seg(75), seg(10)], [], clearWeather, 1).score;
    expect(volatile).toBeLessThan(calm);
  });

  it("clamps to [0,100] under extreme conditions", () => {
    const incidents = Array.from({ length: 12 }, () => incident(10, 3));
    const r = computeSafety([seg(90), seg(4)], incidents, [{ zone: "z", condition: "Banjir", temp: 24, impact: "tinggi" }], 10);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.level).toBe("Bahaya");
  });

  it("derives trend from the previous score", () => {
    expect(computeSafety(uniformSegments, [], clearWeather, 1, 50).trend).toBe("up");   // now ~95 > 50
    expect(computeSafety(uniformSegments, [], clearWeather, 1, 99).trend).toBe("down"); // now ~95 < 99
    const r = computeSafety(uniformSegments, [], clearWeather, 1);
    expect(computeSafety(uniformSegments, [], clearWeather, 1, r.score).trend).toBe("flat");
  });

  it("safetyColor returns a non-empty oklch string", () => {
    expect(safetyColor(90)).toContain("oklch");
    expect(safetyColor(20)).toContain("oklch");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm exec vitest run lib/jasamarga/safety.test.ts`
Expected: FAIL — `Failed to resolve import "./safety"` / `computeSafety is not a function`.

- [ ] **Step 3: Write the implementation**

Create `apps/web/lib/jasamarga/safety.ts`:

```ts
import type { IncidentItem, RouteSegment, SafetyFactor, SafetyIndex, WeatherZone } from "./types";
import { loadColor } from "./ui";

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const round1 = (n: number) => +n.toFixed(1);

const WEATHER_PENALTY: Record<WeatherZone["impact"], number> = { rendah: 2, sedang: 8, tinggi: 16 };

/** 0–100 score → level band + emoji. */
export function safetyBand(score: number): { level: SafetyIndex["level"]; emoji: string } {
  if (score >= 80) return { level: "Aman", emoji: "🟢" };
  if (score >= 60) return { level: "Waspada", emoji: "🟡" };
  if (score >= 40) return { level: "Rawan", emoji: "🟠" };
  return { level: "Bahaya", emoji: "🔴" };
}

/** Color for a safety score, reusing the flow palette (inverted: high score = green). */
export function safetyColor(score: number): string {
  return loadColor((100 - score) / 10);
}

/**
 * Composite corridor Safe Meter from public signals. Starts at 100 and subtracts
 * weighted penalties for incidents, weather, speed volatility, and public mood.
 * Pure + deterministic given its inputs (+ optional prior score for the trend).
 */
export function computeSafety(
  segments: RouteSegment[],
  incidents: IncidentItem[],
  weather: WeatherZone[],
  negativity: number,
  prevScore?: number,
): SafetyIndex {
  // Insiden — severity-weighted, with a bump per blocked lane. Capped so a few
  // bad incidents dominate without single-handedly zeroing the score.
  const incidentPenalty = clamp(
    incidents.reduce((a, inc) => a + (inc.severity / 10) * 6 + (inc.lanes_blocked ?? 0) * 3, 0),
    0,
    45,
  );

  // Cuaca — worst BMKG impact across the corridor zones.
  const weatherPenalty = weather.reduce((max, w) => Math.max(max, WEATHER_PENALTY[w.impact]), 0);

  // Volatilitas Kecepatan — stddev of segment speeds; sharp localized drops are
  // riskier than a uniformly slow (but predictable) corridor.
  const speeds = segments.map((s) => s.speed);
  const mean = speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;
  const variance = speeds.length ? speeds.reduce((a, s) => a + (s - mean) ** 2, 0) / speeds.length : 0;
  const volatilityPenalty = clamp(Math.sqrt(variance) * 0.8, 0, 20);

  // Sentimen Publik — scaled from social negativity (0–10).
  const sentimenPenalty = clamp(negativity * 1.2, 0, 12);

  const factors: SafetyFactor[] = [
    { key: "insiden", label: "Insiden", penalty: round1(incidentPenalty) },
    { key: "cuaca", label: "Cuaca", penalty: round1(weatherPenalty) },
    { key: "volatilitas", label: "Volatilitas Kecepatan", penalty: round1(volatilityPenalty) },
    { key: "sentimen", label: "Sentimen Publik", penalty: round1(sentimenPenalty) },
  ];

  const score = Math.round(clamp(100 - factors.reduce((a, f) => a + f.penalty, 0), 0, 100));
  const { level, emoji } = safetyBand(score);
  const delta = prevScore == null ? 0 : score - prevScore;
  const trend = delta > 1 ? "up" : delta < -1 ? "down" : "flat";

  const top = [...factors].sort((a, b) => b.penalty - a.penalty)[0];
  const narrative =
    top.penalty < 4
      ? `Koridor relatif aman (${score}/100). Tidak ada faktor risiko menonjol.`
      : `Skor keselamatan ${score}/100 — ${level}. Faktor dominan: ${top.label.toLowerCase()}.`;

  return { score, level, emoji, trend, delta, factors, narrative };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm exec vitest run lib/jasamarga/safety.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/jasamarga/safety.ts apps/web/lib/jasamarga/safety.test.ts
git commit -m "feat(jasamarga): computeSafety — composite corridor Safe Meter

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Corridor geometry (`geo.ts`)

**Files:**
- Create: `apps/web/lib/jasamarga/geo.ts`
- Test: `apps/web/lib/jasamarga/geo.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/lib/jasamarga/geo.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ANCHORS, corridorPath, kmToLatLng, segmentPath } from "./geo";

describe("corridor geometry", () => {
  it("has one anchor per base segment", () => {
    expect(ANCHORS).toHaveLength(10);
    for (const [lat, lng] of ANCHORS) {
      expect(lat).toBeLessThan(0); // southern hemisphere
      expect(lng).toBeGreaterThan(106);
      expect(lng).toBeLessThan(108);
    }
  });

  it("kmToLatLng stays within the corridor bbox and clamps out-of-range km", () => {
    for (const km of [-50, 0, 36, 72, 999]) {
      const [lat, lng] = kmToLatLng(km);
      expect(lat).toBeGreaterThan(-6.5);
      expect(lat).toBeLessThan(-6.2);
      expect(lng).toBeGreaterThan(106.8);
      expect(lng).toBeLessThan(107.5);
    }
  });

  it("longitude increases monotonically from Halim (km0) to Cikampek (km72)", () => {
    const samples = [0, 18, 36, 54, 72].map((km) => kmToLatLng(km)[1]);
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeGreaterThan(samples[i - 1]);
    }
  });

  it("segmentPath returns an ordered vertex list for each segment", () => {
    for (let i = 0; i < 10; i++) {
      const path = segmentPath(i);
      expect(path.length).toBeGreaterThanOrEqual(2);
      for (const p of path) expect(p).toHaveLength(2);
    }
  });

  it("corridorPath is one continuous ordered polyline", () => {
    const path = corridorPath();
    expect(path.length).toBeGreaterThan(10);
    const lngs = path.map((p) => p[1]);
    expect(lngs[lngs.length - 1]).toBeGreaterThan(lngs[0]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm exec vitest run lib/jasamarga/geo.test.ts`
Expected: FAIL — `Failed to resolve import "./geo"`.

- [ ] **Step 3: Write the implementation**

Create `apps/web/lib/jasamarga/geo.ts`:

```ts
import { BASE_SEGMENTS } from "./data";

export type LatLng = [number, number];

/**
 * One on-toll [lat,lng] per BASE_SEGMENTS entry (same order). Sampled from the
 * TomTom routing polyline for Halim→Cikampek at each segment midpoint and
 * verified to snap to the motorway. This is the single source of corridor
 * geometry — `tomtom.ts` imports these for flow sampling too.
 */
export const ANCHORS: LatLng[] = [
  [-6.2555, 106.935],
  [-6.24922, 106.98167],
  [-6.27482, 107.04962],
  [-6.29894, 107.11235],
  [-6.33, 107.16787],
  [-6.35472, 107.2384],
  [-6.35106, 107.31013],
  [-6.37793, 107.37669],
  [-6.42409, 107.42822],
  [-6.40123, 107.44586],
];

const HALIM: LatLng = [-6.2516, 106.9094]; // ≈ KM0, GT Halim Utama
const CIKAMPEK: LatLng = [-6.4015, 107.4528]; // ≈ KM72, GT Cikampek Utama

const mid = (a: LatLng, b: LatLng): LatLng => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

/** Segment boundary points: bound[i] = start of segment i, bound[i+1] = its end. */
function boundaries(): LatLng[] {
  const b: LatLng[] = [HALIM];
  for (let i = 0; i < ANCHORS.length - 1; i++) b.push(mid(ANCHORS[i], ANCHORS[i + 1]));
  b.push(CIKAMPEK);
  return b; // length ANCHORS.length + 1
}

/** Vertices for one segment: [start, anchor, end]. */
export function segmentPath(i: number): LatLng[] {
  const b = boundaries();
  return [b[i], ANCHORS[i], b[i + 1]];
}

/** The whole corridor as one ordered polyline (start → anchors → end). */
export function corridorPath(): LatLng[] {
  const b = boundaries();
  const path: LatLng[] = [];
  for (let i = 0; i < ANCHORS.length; i++) path.push(b[i], ANCHORS[i]);
  path.push(b[ANCHORS.length]);
  return path;
}

/** Interpolate a [lat,lng] for a KM marker along the corridor (for incidents). */
export function kmToLatLng(km: number): LatLng {
  const clamped = Math.max(0, Math.min(72, km));
  let i = BASE_SEGMENTS.findIndex((s) => clamped >= s.km_from && clamped <= s.km_to);
  if (i < 0) i = BASE_SEGMENTS.length - 1;
  const s = BASE_SEGMENTS[i];
  const b = boundaries();
  const span = s.km_to - s.km_from || 1;
  const frac = (clamped - s.km_from) / span;
  const a = b[i];
  const c = b[i + 1];
  return [a[0] + (c[0] - a[0]) * frac, a[1] + (c[1] - a[1]) * frac];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm exec vitest run lib/jasamarga/geo.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/jasamarga/geo.ts apps/web/lib/jasamarga/geo.test.ts
git commit -m "feat(jasamarga): corridor geometry helpers for the map

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Wire safety + incident coordinates into `buildSnapshot`

**Files:**
- Modify: `apps/web/lib/jasamarga/data.ts`
- Test: `apps/web/lib/jasamarga/data.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/lib/jasamarga/data.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildSnapshot } from "./data";

describe("buildSnapshot — safety + map coordinates", () => {
  it("includes a complete SafetyIndex", () => {
    const snap = buildSnapshot();
    expect(snap.safety).toBeDefined();
    expect(snap.safety.score).toBeGreaterThanOrEqual(0);
    expect(snap.safety.score).toBeLessThanOrEqual(100);
    expect(snap.safety.factors).toHaveLength(4);
    expect(["Aman", "Waspada", "Rawan", "Bahaya"]).toContain(snap.safety.level);
    expect(typeof snap.safety.narrative).toBe("string");
  });

  it("gives every incident a map coordinate", () => {
    const snap = buildSnapshot();
    for (const inc of snap.incidents) {
      expect(typeof inc.lat).toBe("number");
      expect(typeof inc.lng).toBe("number");
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm exec vitest run lib/jasamarga/data.test.ts`
Expected: FAIL — `snap.safety` is undefined / incidents lack `lat`.

- [ ] **Step 3: Implement — add imports**

In `apps/web/lib/jasamarga/data.ts`, extend the top imports. Change line 1–2 from:

```ts
import type { ForecastHour, IncidentItem, OpsInsight, OpsSnapshot, RouteSegment, RuasLoad } from "./types";
import { loadLevel, speedStatus } from "./ui";
```

to:

```ts
import type { ForecastHour, IncidentItem, OpsInsight, OpsSnapshot, RouteSegment, RuasLoad, WeatherZone } from "./types";
import { loadLevel, speedStatus } from "./ui";
import { computeSafety } from "./safety";
import { kmToLatLng } from "./geo";

/** Parse a leading KM number out of an incident label ("KM 52+400" → 52). */
function kmOf(label: string): number {
  const m = label.match(/(\d+)/);
  return m ? +m[1] : 0;
}

/** Ensure every incident carries a map coordinate (live ones already do). */
function withCoords(incidents: IncidentItem[]): IncidentItem[] {
  return incidents.map((inc) => {
    if (inc.lat != null && inc.lng != null) return inc;
    const [lat, lng] = kmToLatLng(kmOf(inc.km));
    return { ...inc, lat, lng };
  });
}

/** Last computed safety score, kept in-process so the trend arrow is meaningful. */
let lastSafetyScore: number | undefined;
```

- [ ] **Step 4: Implement — add coordinates, extract weather, compute safety**

In `buildSnapshot`, find this line (~161):

```ts
  const incidents: IncidentItem[] = liveIncidents !== undefined ? liveIncidents : SYNTHETIC_INCIDENTS;
```

Replace it with:

```ts
  const incidents: IncidentItem[] = withCoords(liveIncidents !== undefined ? liveIncidents : SYNTHETIC_INCIDENTS);
```

Then find the `const insight = deriveInsight(...)` line (~183) and insert the weather + safety computation **above** it:

```ts
  const weather: WeatherZone[] = [
    { zone: "Jakarta – Bekasi", condition: "Cerah berawan", temp: 31, impact: "rendah" },
    { zone: "Cikarang – Karawang", condition: "Hujan ringan", temp: 27, impact: "sedang" },
    { zone: "Cikampek", condition: "Berawan", temp: 29, impact: "rendah" },
  ];

  const safety = computeSafety(segments, incidents, weather, negativity, lastSafetyScore);
  lastSafetyScore = safety.score;

  const insight = deriveInsight(segments, incidents, level, avg_delay_min, mentions_24h);
```

- [ ] **Step 5: Implement — put `safety` and `weather` into the returned object**

In the returned object, add `safety` right after `active_incidents` (~195):

```ts
    active_incidents: incidents.length,
    safety,
    insight,
```

And replace the inline `weather: [ ... ]` array (~376–380) with the extracted constant:

```ts
    weather,
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd apps/web && pnpm exec vitest run lib/jasamarga/data.test.ts`
Expected: PASS.

- [ ] **Step 7: Verify the whole contract typechecks now**

Run: `cd apps/web && pnpm typecheck`
Expected: PASS (the Task 1 error is resolved — `buildSnapshot` now returns `safety`).

- [ ] **Step 8: Commit**

```bash
git add apps/web/lib/jasamarga/data.ts apps/web/lib/jasamarga/data.test.ts
git commit -m "feat(jasamarga): compute Safe Meter + incident coords in snapshot

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Populate live incident coordinates (TomTom)

**Files:**
- Modify: `apps/web/lib/jasamarga/tomtom.ts`

- [ ] **Step 1: Add lat/lng to the mapped TomTom incident**

In `apps/web/lib/jasamarga/tomtom.ts`, `mapIncident` already parses `coord` as `[lon, lat]`. Add the coordinate to the returned object. Find the `return {` block in `mapIncident` (~180) and add `lat`/`lng` after `km`:

```ts
  return {
    id: `TT-${i}`,
    km: `KM ${km}`,
    lat: coord[1],
    lng: coord[0],
    direction: p.roadNumbers?.includes("AH2") ? "Tol Japek (AH2)" : p.from ?? "Koridor Japek",
```

- [ ] **Step 2: Verify typecheck**

Run: `cd apps/web && pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/jasamarga/tomtom.ts
git commit -m "feat(jasamarga): carry live TomTom incident coordinates

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: JasaMarga source seam

**Files:**
- Create: `apps/web/lib/jasamarga/connector.ts`
- Modify: `apps/web/app/api/v1/jasamarga-ops/route.ts`

- [ ] **Step 1: Create the connector**

Create `apps/web/lib/jasamarga/connector.ts`:

```ts
import type { IncidentItem, RouteSegment } from "./types";
import { getLiveTraffic } from "./tomtom";

export interface CorridorTraffic {
  segments: RouteSegment[];
  incidents: IncidentItem[];
}

/**
 * A pluggable source for live corridor traffic. Today the demo uses public
 * traffic (TomTom). When JasaMarga grants a credentialed feed, implement this
 * interface and swap `defaultSource()` — no UI or contract changes required.
 */
export interface JasaMargaSource {
  id: string;
  label: string;
  fetchTraffic(): Promise<CorridorTraffic | null>;
}

/** Public traffic via TomTom — live when TOMTOM_API_KEY is set, else null. */
export class TomTomSource implements JasaMargaSource {
  id = "tomtom";
  label = "TomTom Traffic (publik)";
  constructor(private readonly key?: string) {}
  fetchTraffic(): Promise<CorridorTraffic | null> {
    return this.key ? getLiveTraffic(this.key) : Promise.resolve(null);
  }
}

/**
 * SEAM: a real JasaMarga / JMTC feed plugs in here. Returns null until wired,
 * so the route falls back to the synthetic snapshot (graceful degradation).
 */
export class JasaMargaFeedSource implements JasaMargaSource {
  id = "jasamarga";
  label = "JasaMarga Feed (belum tersedia)";
  fetchTraffic(): Promise<CorridorTraffic | null> {
    return Promise.resolve(null);
  }
}

/** The source the API route uses. Swap this when a real feed is available. */
export function defaultSource(): JasaMargaSource {
  return new TomTomSource(process.env.TOMTOM_API_KEY);
}
```

- [ ] **Step 2: Route through the seam**

Replace the body of `apps/web/app/api/v1/jasamarga-ops/route.ts`'s `GET` with the connector. Change:

```ts
import { buildSnapshot } from "@/lib/jasamarga/data";
import { getLiveTraffic } from "@/lib/jasamarga/tomtom";
```

to:

```ts
import { buildSnapshot } from "@/lib/jasamarga/data";
import { defaultSource } from "@/lib/jasamarga/connector";
```

and change the `GET` body:

```ts
export async function GET() {
  const live = await defaultSource().fetchTraffic();
  return NextResponse.json(buildSnapshot(live?.segments, live?.incidents));
}
```

- [ ] **Step 3: Verify typecheck**

Run: `cd apps/web && pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/jasamarga/connector.ts apps/web/app/api/v1/jasamarga-ops/route.ts
git commit -m "feat(jasamarga): source seam for a future real feed

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Map + Safe Meter animations (globals.css)

**Files:**
- Modify: `apps/web/app/globals.css`

- [ ] **Step 1: Append the keyframes and Leaflet theming**

Add to the end of `apps/web/app/globals.css`:

```css
/* ── JasaMarga map + Safe Meter gimmicks ───────────────────────────── */

/* Pulsing incident pin on the corridor map */
@keyframes jm-pin-pulse {
  0% { transform: scale(0.6); opacity: 0.9; }
  70% { transform: scale(2.4); opacity: 0; }
  100% { transform: scale(2.4); opacity: 0; }
}
.jm-pin {
  position: relative;
  width: 14px;
  height: 14px;
}
.jm-pin::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 9999px;
  background: var(--jm-pin-color, oklch(0.62 0.22 25));
  animation: jm-pin-pulse 1.8s ease-out infinite;
}
.jm-pin::after {
  content: "";
  position: absolute;
  inset: 3px;
  border-radius: 9999px;
  background: var(--jm-pin-color, oklch(0.62 0.22 25));
  box-shadow: 0 0 8px 2px var(--jm-pin-color, oklch(0.62 0.22 25));
}

/* Dark Leaflet container so attribution/controls fit the theme */
.jm-map .leaflet-container {
  background: oklch(0.16 0.02 260);
  font: inherit;
}
.jm-map .leaflet-control-attribution {
  background: oklch(0.16 0.02 260 / 0.7);
  color: oklch(0.7 0.02 240);
}
.jm-map .leaflet-control-attribution a { color: oklch(0.8 0.06 280); }

/* Safe Meter sheen sweep on the gauge card */
@keyframes jm-sheen {
  0% { transform: translateX(-120%); }
  100% { transform: translateX(220%); }
}
.jm-sheen::after {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: 40%;
  background: linear-gradient(100deg, transparent, oklch(1 0 0 / 0.06), transparent);
  animation: jm-sheen 4.5s ease-in-out infinite;
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .jm-pin::before { animation: none; }
  .jm-sheen::after { animation: none; }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/globals.css
git commit -m "feat(jasamarga): map pin + Safe Meter animation styles

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Safe Meter component

**Files:**
- Create: `apps/web/components/jasamarga/SafeMeter.tsx`

> No unit test (vitest runs node env and only collects `lib/**`/`app/**` `.test.ts`). All scoring logic is already covered in Task 2; this component only renders it. Verified manually in Task 12.

- [ ] **Step 1: Create the component**

Create `apps/web/components/jasamarga/SafeMeter.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";
import { ShieldCheck, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { CountUp } from "@/components/crisis/CountUp";
import { safetyColor } from "@/lib/jasamarga/safety";
import type { SafetyIndex } from "@/lib/jasamarga/types";
import { cn } from "@/lib/utils";

const W = 280;
const H = 150;

/** Animated semicircular 0–100 gauge that sweeps to the score on mount/change. */
function Gauge({ score }: { score: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const start = performance.now();
    const duration = reduce ? 0 : 1200;
    const draw = (value: number) => {
      const cx = W / 2;
      const cy = 132;
      const r = 96;
      const lw = 16;
      ctx.clearRect(0, 0, W, H);
      const a0 = Math.PI;
      const a1 = 2 * Math.PI;
      const pct = Math.max(0, Math.min(1, value / 100));
      // track
      ctx.beginPath();
      ctx.arc(cx, cy, r, a0, a1);
      ctx.lineWidth = lw;
      ctx.strokeStyle = "oklch(0.32 0.03 265 / 0.45)";
      ctx.lineCap = "round";
      ctx.stroke();
      // value arc
      ctx.beginPath();
      ctx.arc(cx, cy, r, a0, a0 + pct * Math.PI);
      ctx.lineWidth = lw;
      ctx.strokeStyle = safetyColor(value);
      ctx.lineCap = "round";
      ctx.shadowBlur = 16;
      ctx.shadowColor = safetyColor(value);
      ctx.stroke();
      ctx.shadowBlur = 0;
      // needle
      const ang = a0 + pct * Math.PI;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + (r - lw) * Math.cos(ang), cy + (r - lw) * Math.sin(ang));
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = "oklch(0.92 0.02 240)";
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, 2 * Math.PI);
      ctx.fillStyle = "oklch(0.92 0.02 240)";
      ctx.fill();
    };

    if (duration === 0) {
      draw(score);
      return;
    }
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      draw(score * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [score]);

  return <canvas ref={ref} className="block" />;
}

function TrendIcon({ trend }: { trend: SafetyIndex["trend"] }) {
  if (trend === "up") return <TrendingUp className="h-3.5 w-3.5 text-success" />;
  if (trend === "down") return <TrendingDown className="h-3.5 w-3.5 text-destructive" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

export function SafeMeter({ safety }: { safety: SafetyIndex }) {
  const color = safetyColor(safety.score);
  const maxPenalty = Math.max(1, ...safety.factors.map((f) => f.penalty));

  return (
    <div className="jm-sheen relative flex h-full flex-col items-center overflow-hidden p-2">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Skor Keselamatan Koridor
      </div>

      <div className="relative mt-1">
        <Gauge score={safety.score} />
        <div className="pointer-events-none absolute inset-x-0 bottom-1 flex flex-col items-center">
          <div className="text-[44px] font-extrabold leading-none tabular-nums" style={{ color }}>
            <CountUp value={safety.score} />
          </div>
          <div className="text-[10px] font-semibold text-muted-foreground">/ 100</div>
        </div>
      </div>

      <div className="mt-1 flex items-center gap-2">
        <span
          className="rounded-full px-3 py-1 text-sm font-bold"
          style={{ color, background: "color-mix(in oklab, currentColor 14%, transparent)" }}
        >
          {safety.emoji} {safety.level}
        </span>
        <span className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
          <TrendIcon trend={safety.trend} />
          {safety.delta > 0 ? `+${safety.delta}` : safety.delta} vs 1j lalu
        </span>
      </div>

      <p className="mt-2 text-center text-[11px] leading-snug text-muted-foreground">{safety.narrative}</p>

      <div className="mt-2 w-full space-y-1">
        {safety.factors.map((f) => (
          <div key={f.key} className="flex items-center gap-2 text-[10px]">
            <span className="w-28 shrink-0 truncate text-muted-foreground">{f.label}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-background/60">
              <div
                className={cn("h-full rounded-full transition-[width] duration-700")}
                style={{ width: `${(f.penalty / maxPenalty) * 100}%`, background: safetyColor(100 - f.penalty * 4) }}
              />
            </div>
            <span className="w-8 shrink-0 text-right tabular-nums text-muted-foreground">−{f.penalty}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd apps/web && pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/jasamarga/SafeMeter.tsx
git commit -m "feat(jasamarga): Safe Meter gauge component

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Corridor map component (vanilla Leaflet)

**Files:**
- Create: `apps/web/components/jasamarga/CorridorMap.tsx`

> Uses Leaflet imperatively (not react-leaflet) and `await import("leaflet")` inside an effect so it never runs during SSR. Read `node_modules/next/dist/docs` for any `next/dynamic` specifics before wiring it in Task 10 (per AGENTS.md). Logic-free rendering; verified manually in Task 12.

- [ ] **Step 1: Create the component**

Create `apps/web/components/jasamarga/CorridorMap.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";
import type { FeatureGroup, Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { IncidentItem, RouteSegment } from "@/lib/jasamarga/types";
import { corridorPath, segmentPath } from "@/lib/jasamarga/geo";
import { FLOW_COLORS } from "@/lib/jasamarga/ui";

interface Props {
  segments: RouteSegment[];
  incidents: IncidentItem[];
  selected: number | null;
  onSelect: (i: number | null) => void;
}

export function CorridorMap({ segments, incidents, selected, onSelect }: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const groupRef = useRef<FeatureGroup | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const LRef = useRef<any>(null);

  // Init the map once.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const L = await import("leaflet");
      if (cancelled || !elRef.current || mapRef.current) return;
      LRef.current = L;
      const map = L.map(elRef.current, {
        zoomControl: true,
        attributionControl: true,
        scrollWheelZoom: false,
      });
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: "&copy; OpenStreetMap, &copy; CARTO",
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(map);
      map.fitBounds(corridorPath(), { padding: [28, 28] });
      groupRef.current = L.featureGroup().addTo(map);
      mapRef.current = map;
      // Draw the first frame now that the map exists.
      drawRef.current?.();
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      groupRef.current = null;
    };
  }, []);

  // Keep the latest draw() in a ref so the init effect can call it once.
  const drawRef = useRef<(() => void) | null>(null);
  drawRef.current = () => {
    const L = LRef.current;
    const group = groupRef.current;
    if (!L || !group) return;
    group.clearLayers();

    segments.forEach((seg, i) => {
      const isSel = selected === i;
      L.polyline(segmentPath(i), {
        color: FLOW_COLORS[seg.status],
        weight: isSel ? 9 : 6,
        opacity: isSel ? 1 : 0.85,
        lineCap: "round",
      })
        .on("click", () => onSelect(isSel ? null : i))
        .bindTooltip(`${seg.label} · ${seg.speed} km/j · +${seg.delay_min} mnt`, { sticky: true })
        .addTo(group);
    });

    incidents.forEach((inc) => {
      if (inc.lat == null || inc.lng == null) return;
      const color = inc.severity >= 7 ? FLOW_COLORS.lumpuh : inc.severity >= 4 ? FLOW_COLORS.macet : FLOW_COLORS.padat;
      const icon = L.divIcon({
        className: "",
        html: `<div class="jm-pin" style="--jm-pin-color:${color}"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      L.marker([inc.lat, inc.lng], { icon })
        .bindPopup(
          `<strong>${inc.type}</strong> · ${inc.km}<br/>${inc.status} · sumber ${inc.source}` +
            (inc.lanes_blocked ? `<br/>${inc.lanes_blocked} lajur tertutup` : ""),
        )
        .addTo(group);
    });
  };

  // Redraw whenever data or selection changes.
  useEffect(() => {
    drawRef.current?.();
    if (selected != null && mapRef.current && LRef.current) {
      const pts = segmentPath(selected);
      mapRef.current.panTo(pts[1], { animate: true });
    }
  }, [segments, incidents, selected]);

  return <div className="jm-map h-full w-full"><div ref={elRef} className="h-full w-full" /></div>;
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd apps/web && pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/jasamarga/CorridorMap.tsx
git commit -m "feat(jasamarga): interactive corridor map (Leaflet)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Integrate map toggle + Safe Meter into OpsCommand

**Files:**
- Modify: `apps/web/components/jasamarga/OpsCommand.tsx`

- [ ] **Step 1: Add imports + dynamic map**

At the top of `apps/web/components/jasamarga/OpsCommand.tsx`, after the existing imports, add the dynamic import and the new icons. Add `Map as MapIcon, ShieldCheck` to the existing `lucide-react` import list, and add:

```tsx
import dynamic from "next/dynamic";
import { SafeMeter } from "./SafeMeter";

const CorridorMap = dynamic(() => import("./CorridorMap").then((m) => m.CorridorMap), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-[12px] text-muted-foreground">Memuat peta…</div>,
});
```

- [ ] **Step 2: Add the hero view-toggle state**

Inside `OpsCommand`, next to the other `useState` calls (~line 60), add:

```tsx
  const [heroView, setHeroView] = useState<"peta" | "ribbon">("peta");
```

- [ ] **Step 3: Make the hero tile toggle between map and ribbon**

Replace the hero `<Tile ...>` block (the one titled `Live Network Ribbon`, ~lines 152–180) with this — it adds the `[ Peta | Ribbon ]` switch in `headerRight` and renders the map or the ribbon:

```tsx
        <Tile
          title={`Live Network — ${data?.corridor ?? "Jakarta–Cikampek"}`}
          icon={heroView === "peta" ? MapIcon : Route}
          className="lg:col-span-12"
          headerRight={
            <div className="flex items-center gap-2">
              {seg ? (
                <span className="text-[10px] text-primary">
                  {seg.label} · {seg.speed} km/j · +{seg.delay_min} mnt
                </span>
              ) : (
                <span className={cn("text-[10px]", data?.traffic_source === "tomtom" ? "text-success" : "text-muted-foreground")}>
                  {data?.traffic_source === "tomtom" ? "● TomTom live" : "Simulasi"} · klik segmen
                </span>
              )}
              <div className="flex overflow-hidden rounded-md border border-border/60 text-[10px] font-bold">
                {(["peta", "ribbon"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setHeroView(v)}
                    className={cn("px-2 py-0.5 capitalize", heroView === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          }
          bodyClassName="p-0"
          style={{ height: 380 }}
        >
          {data ? (
            heroView === "peta" ? (
              <CorridorMap
                segments={data.segments}
                incidents={data.incidents}
                selected={selectedSegment}
                onSelect={setSelectedSegment}
              />
            ) : (
              <div className="p-3">
                <RouteRibbon
                  segments={data.segments}
                  landmarks={data.landmarks}
                  incidents={data.incidents}
                  selected={selectedSegment}
                  onSelect={setSelectedSegment}
                />
              </div>
            )
          ) : (
            <Empty state={live} />
          )}
        </Tile>
```

- [ ] **Step 4: Add the Safe Meter tile as the headline**

Insert a new `<Tile>` immediately **after** the hero tile and **before** the `Indeks Kemacetan` tile (~line 183):

```tsx
        {/* Safe Meter — the headline gimmick */}
        <Tile title="Safe Meter" icon={ShieldCheck} className="lg:col-span-4" tileClassName="border-primary/40" bodyClassName="p-0">
          {data ? <SafeMeter safety={data.safety} /> : <Empty state={live} />}
        </Tile>
```

Leave the existing tile widths unchanged. The new headline row becomes `Safe Meter` (col-span-4) + `Indeks Kemacetan` (col-span-3) + `AI Ops Insight` (col-span-5) = **12**, which fills the row exactly; `Prediksi Kemacetan` (col-span-4) and everything after flow to the next rows naturally in the 12-column grid. Confirm the layout visually in Task 12.

- [ ] **Step 5: Verify typecheck**

Run: `cd apps/web && pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/jasamarga/OpsCommand.tsx
git commit -m "feat(jasamarga): map/ribbon toggle + Safe Meter headline

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Safe Meter on the Command Wall

**Files:**
- Modify: `apps/web/components/jasamarga/CommandWall.tsx`

- [ ] **Step 1: Add a Safe Meter slide**

In `apps/web/components/jasamarga/CommandWall.tsx`, import the color helper at the top:

```tsx
import { safetyColor } from "@/lib/jasamarga/safety";
```

Then in `buildSlides`, insert a new slide right after the first slide (`label: "Indeks Beban"` block, just before `slides.push({ label: "Insight Utama", ... })`):

```tsx
  slides.push({
    label: "Safe Meter",
    render: () => {
      const c = safetyColor(d.safety.score);
      return (
        <div className="mx-auto max-w-4xl text-center">
          <div className="text-2xl font-bold uppercase tracking-[0.2em] text-muted-foreground">Skor Keselamatan Koridor</div>
          <div className="mt-4 text-[12rem] font-extrabold leading-none tabular-nums" style={{ color: c }}>
            {d.safety.score}
            <span className="text-6xl text-muted-foreground">/100</span>
          </div>
          <div className="mt-2 text-5xl font-bold" style={{ color: c }}>
            {d.safety.emoji} {d.safety.level}
          </div>
          <p className="mx-auto mt-6 max-w-2xl text-2xl leading-relaxed text-muted-foreground">{d.safety.narrative}</p>
          <div className="mx-auto mt-8 flex max-w-3xl flex-wrap justify-center gap-3">
            {d.safety.factors.map((f) => (
              <span key={f.key} className="rounded-xl border border-border/60 bg-card/40 px-5 py-3 text-xl text-muted-foreground">
                {f.label}: <span className="font-bold text-foreground">−{f.penalty}</span>
              </span>
            ))}
          </div>
        </div>
      );
    },
  });
```

- [ ] **Step 2: Verify typecheck**

Run: `cd apps/web && pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/jasamarga/CommandWall.tsx
git commit -m "feat(jasamarga): Safe Meter slide on the Command Wall

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the whole test suite**

Run: `cd apps/web && pnpm test`
Expected: PASS, including `lib/jasamarga/safety.test.ts`, `geo.test.ts`, `data.test.ts`.

- [ ] **Step 2: Typecheck + lint**

Run: `cd apps/web && pnpm typecheck && pnpm lint`
Expected: PASS (no type errors; lint clean).

- [ ] **Step 3: Manual run — verify the demo (use the `run` skill or `pnpm dev`)**

Run: `cd apps/web && pnpm dev`, open `/jasamarga`. Confirm, with a screenshot:
- The hero shows the **map by default** with the colored Japek corridor and pulsing incident pins; the `[ Peta | Ribbon ]` toggle switches views and the selected segment stays in sync.
- The **Safe Meter** tile shows an animated gauge sweeping to the score, a level pill, a trend arrow, and the 4-factor breakdown.
- Open the **Command Wall** → the Safe Meter slide appears and cycles.
- Stop the server (Ctrl+C) when done.

- [ ] **Step 4: Final review commit (if any fixups were needed)**

```bash
git add -A
git commit -m "chore(jasamarga): verification fixups for map + Safe Meter

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-review notes (author)

- **Spec coverage:** AC1–AC3 → Tasks 9–10 (map + toggle + sync); AC4–AC5 → Tasks 2, 8 (gauge + factors); AC6 → Task 2 monotonicity tests; AC7 → Task 11; AC8 → existing synthetic fallback preserved (Tasks 4–6, connector returns null gracefully); AC9 → source strip untouched.
- **Type consistency:** `SafetyIndex`/`SafetyFactor` defined in Task 1 are used identically in Tasks 2, 4, 8, 11; `computeSafety(segments, incidents, weather, negativity, prevScore?)` signature matches all call sites; `safetyColor`/`safetyBand` names consistent; `segmentPath`/`corridorPath`/`kmToLatLng`/`ANCHORS` names consistent across geo + map.
- **No placeholders:** the `JasaMargaFeedSource` returning `null` is an intentional, working seam (graceful fallback), not an unfinished step.
- **YAGNI:** chose vanilla Leaflet (already installed) over adding `react-leaflet`; single composite Safe Meter (no per-segment scoring); Japek corridor only.
