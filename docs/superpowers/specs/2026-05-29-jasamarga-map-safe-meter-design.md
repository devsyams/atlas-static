# JasaMarga Ops Command — Live Corridor Map + Safe Meter

- **Date:** 2026-05-29
- **Status:** Approved (design)
- **Feature:** `jasamarga-ops-command` (change to existing feature)
- **Branch:** `feat/jasamarga-ops-command`

## Background (why)

The JasaMarga Tollroad Ops Command dashboard (`/jasamarga`) already aggregates
public traffic, social, news, weather, and official signals for the
Jakarta–Cikampek (Japek) corridor. Two gaps surfaced in a stakeholder review:

1. **No real map.** The corridor is shown only as a *linear* "Route Ribbon".
   Decision-makers expect to see the toll line on an actual geographic map with
   live-colored congestion and incident locations — it's the single most
   recognizable "command-center" element and it's missing.
2. **The narrative isn't strong enough.** The dashboard reports a congestion
   *load index* (high = bad), but there is no single, intuitive headline number
   that answers *"is the corridor safe right now?"*. Stakeholders want a
   memorable, high-impact gimmick.

This work adds (a) a real interactive corridor map and (b) a **Safe Meter** —
a 0–100 composite "Skor Keselamatan Koridor" — as the new headline. Both raise
the demo's impact ("amaze more") while staying within the project's
**public/online-data-only** principle.

### Data principle (non-negotiable)

Everything shown is derived from **public/online** sources (TomTom/Waze traffic,
BMKG weather, social, official `@PTJASAMARGA` posts) plus a synthetic demo
fallback. We do **not** use JasaMarga internal/JMTC systems. The stakeholder ask
to "add JasaMarga data" is honored *structurally* via a source seam (§5): a real
credentialed feed can be dropped in later with zero UI/contract changes, but the
shipped demo runs on public + synthetic data.

## Acceptance criteria (Given/When/Then)

- **AC1 — Map renders the real corridor.** Given the dashboard loads, when the
  hero view is "Peta", then an interactive Leaflet map shows the Japek toll line
  drawn on a real (dark) basemap, colored per segment by flow status.
- **AC2 — Map reflects live state.** Given live TomTom data is available, when a
  segment is congested, then its polyline segment is colored accordingly
  (green→red) and incidents appear as markers at their real coordinates.
- **AC3 — Map ⇄ Ribbon toggle.** Given the hero tile, when the user toggles
  `[ Peta | Ribbon ]`, then the view switches without losing the selected
  segment; clicking a segment in either view selects it in both.
- **AC4 — Safe Meter headline.** Given a snapshot, when the dashboard renders,
  then a prominent 0–100 "Skor Keselamatan Koridor" gauge shows the score, a
  level band (Aman/Waspada/Rawan/Bahaya), a trend arrow vs the prior reading,
  and a factor breakdown.
- **AC5 — Safe Meter is explainable.** Given the Safe Meter, when shown, then it
  lists the contributing factors (Insiden, Cuaca, Volatilitas Kecepatan,
  Sentimen) so the number is credible, not arbitrary.
- **AC6 — Safety responds to conditions.** Given more/severe incidents, worse
  weather, higher speed volatility, or more negative sentiment, when the score
  is computed, then the score is lower (monotonic per factor).
- **AC7 — Command Wall.** Given the Command Wall is opened, when it cycles, then
  it includes a full-screen Safe Meter slide and a corridor-map snapshot slide.
- **AC8 — Graceful degradation.** Given TomTom is unavailable, when the snapshot
  loads, then the map, incidents, and Safe Meter all render from the synthetic
  fallback (no blank/broken map).
- **AC9 — Source honesty.** Given the source strip, when data is synthetic vs
  live, then provenance is reported truthfully (existing behavior preserved).

## Architecture / impact analysis

> Web app currently lives at repo root under `apps/web` (pre-monorepo-migration
> layout for this feature). TS tests are vitest.

### New files
- `apps/web/components/jasamarga/CorridorMap.tsx` — Leaflet map (client,
  dynamically imported with `ssr:false`). Renders the colored corridor polyline,
  incident markers, and segment selection. Kept thin; all non-DOM logic lives in
  `geo.ts`/`safety.ts`.
- `apps/web/components/jasamarga/SafeMeter.tsx` — animated 0–100 gauge with
  level band, trend, and factor breakdown.
- `apps/web/lib/jasamarga/geo.ts` — corridor geometry: a fixed lat/lng path for
  the Japek toll line (densified from the existing `ANCHORS`), a `segmentPath()`
  helper returning the lat/lng vertices per `BASE_SEGMENTS` entry, and
  `kmToLatLng()` for placing synthetic incidents. Pure, unit-tested.
- `apps/web/lib/jasamarga/safety.ts` — `computeSafety(snapshot) → SafetyIndex`.
  Pure, unit-tested.
- `apps/web/lib/jasamarga/connector.ts` — `JasaMargaSource` interface and the
  current implementations (TomTom + synthetic). Stub `JasaMargaFeedSource` marks
  the real-feed seam.
- Tests: `apps/web/lib/jasamarga/safety.test.ts`, `geo.test.ts`.

### Changed files
- `apps/web/lib/jasamarga/types.ts` — add `SafetyIndex` + `safety` on
  `OpsSnapshot`; add optional `lat`/`lng` on `IncidentItem`.
- `apps/web/lib/jasamarga/tomtom.ts` — populate incident `lat`/`lng` from the
  TomTom coordinate already parsed (`firstCoord`); export the corridor path or
  reuse `ANCHORS` from `geo.ts` (single source of geometry).
- `apps/web/lib/jasamarga/data.ts` — give synthetic incidents `lat`/`lng` via
  `kmToLatLng`; no behavior change otherwise.
- `apps/web/app/api/v1/jasamarga-ops/route.ts` — compute `safety` and attach to
  the snapshot (via the connector); thread previous score for the trend.
- `apps/web/components/jasamarga/OpsCommand.tsx` — add the `[ Peta | Ribbon ]`
  toggle to the hero tile; mount `SafeMeter` as a prominent top-row tile.
- `apps/web/components/jasamarga/CommandWall.tsx` — add Safe Meter + map slides.
- `apps/web/app/api/v1/jasamarga-ops/briefing/route.ts` — fold the Safe Meter
  score into the AI briefing narrative (optional, low-risk).
- `package.json` — add `leaflet`, `react-leaflet`, `@types/leaflet`.

### Data model / contract changes
```ts
export interface SafetyFactor {
  key: "insiden" | "cuaca" | "volatilitas" | "sentimen";
  label: string;
  penalty: number;   // points subtracted from 100
}
export interface SafetyIndex {
  score: number;     // 0–100, higher = safer
  level: "Aman" | "Waspada" | "Rawan" | "Bahaya";
  emoji: string;
  trend: "up" | "down" | "flat";
  delta: number;     // vs prior reading
  factors: SafetyFactor[];
  narrative: string; // one-line plain-language summary
}
// OpsSnapshot gains:  safety: SafetyIndex
// IncidentItem gains: lat?: number; lng?: number
```

## Safe Meter computation (`computeSafety`)

Score = `clamp(100 − Σ penalties, 0, 100)`, higher = safer. Penalties (weights
tuned so a clean corridor ≈ 90+, a multi-incident jam ≈ 30–50):

- **Insiden** (heaviest): Σ over incidents of `severity/10 × base`, with a bump
  per `lanes_blocked`; capped.
- **Cuaca**: max BMKG impact across zones → rendah/sedang/tinggi penalty.
- **Volatilitas Kecepatan**: dispersion of `(freeFlow − speed)/freeFlow` across
  segments — sharp localized drops are riskier than uniform slow flow.
- **Sentimen**: scaled from `social.negativity` (0–10).

Bands: **≥80 Aman**, **60–79 Waspada**, **40–59 Rawan**, **<40 Bahaya**.
Trend/delta computed vs the previous in-process reading (deterministic synthetic
seed in fallback so it doesn't flicker).

## Map design

- **Library:** `react-leaflet` + `leaflet`, imported via
  `next/dynamic` with `ssr:false`. Read in-repo Next.js docs before coding
  (`AGENTS.md`).
- **Basemap:** CARTO `dark_all` raster tiles (free, attribution-only) to match
  the dark theme; OSM default is the fallback. Attribution shown.
- **Corridor:** one `Polyline` per segment, colored by `loadColor`/status;
  selected segment emphasized (weight/opacity). Auto-fit to corridor bounds.
- **Incidents:** `CircleMarker`/`DivIcon` pulsing pins at real coords; popup =
  incident detail; click selects the nearest segment.
- **Interaction:** map and ribbon share `selectedSegment`. No layout shift on
  toggle.

## UI quality bar ("amaze")

Build with the `frontend-design` skill at implementation time. Targets:
distinctive, production-grade, not generic. Smooth gauge needle + count-up
animation, pulsing incident pins, subtle map fly-to on segment select, cohesive
with the existing dark/gradient command-center aesthetic. Respect
`prefers-reduced-motion`.

## Error handling / degradation
- Leaflet load failure or no `window` → tile falls back to the Ribbon view (the
  toggle still works); never a blank hero.
- TomTom failure → synthetic snapshot already drives everything (AC8); incidents
  get synthetic coords from `kmToLatLng`.
- `computeSafety` is total (no throws); missing inputs contribute 0 penalty.

## Testing (TDD, vitest)
- `safety.test.ts`: band boundaries (79→Waspada, 80→Aman, etc.); monotonicity
  per factor (AC6); clamp at 0/100; factor list completeness (AC5); trend sign.
- `geo.test.ts`: `kmToLatLng` endpoints map near Halim/Cikampek anchors and is
  monotonic in km; `segmentPath()` returns a vertex list per segment in order.
- Incident coordinate population (synthetic + TomTom mapping) covered via the
  data/connector layer.
- Map component itself is exercised manually (Leaflet/DOM) — logic is in tested
  pure helpers.

## Out of scope
- Real JasaMarga/JMTC credentialed feed (seam only; separate effort).
- Per-segment safety scoring (chose a single composite headline).
- National toll-network overview map (chose the Japek corridor).

## Risks
- **R1 — SSR/Leaflet:** must dynamic-import with `ssr:false`; verify against the
  repo's non-standard Next.js. *Mitigation:* ribbon fallback + early manual run.
- **R2 — Tile provider limits:** CARTO/OSM are rate-limited. *Mitigation:*
  attribution + low zoom range; acceptable for a demo.
- **R3 — Safety weights feel arbitrary:** *Mitigation:* visible factor breakdown
  + tuned so common scenarios land in intuitive bands.
