# MBG Crisis Dashboard widgets → Command Center — Design

Port the widgets in `E:\Code\Work\RnD\WidgetFactory\widget.mock.html` (Indonesian "MBG Crisis
Dashboard", light theme) into the atlas-static Next.js app with the **same behaviour** but our
dark oklch command-center styling. **Replaces `/`** (the Command Center).

Decisions: text stays **Indonesian**; vendor "Gemini" → **"AI engine"**; data via **`/api/v1/*`**
route handlers (API-first); dark map basemap.

## Data & API
- `lib/mbg/data.ts` — canned dashboard data (articles, per-city aggregation, coords/provinces) +
  `articleDetail()` derivation. `lib/mbg/types.ts` types. `lib/mbg/colors.ts` `scoreColor` /
  `badgeClass` / `markerRadius` mapped to our tokens (success / warning / destructive / deep-red).
- `app/api/v1/mbg-crisis/route.ts` — GET → dashboard JSON (small delay to keep loading flash).
- `app/api/v1/article-detail/route.ts` — GET (query params) → per-article detail.

## Components (`components/crisis/`, mostly client)
- `CrisisDashboard.tsx` — orchestrator: state `data` / `selectedCityKey` / live-status / modal;
  `loadData()` on mount + 30-min auto-refresh; `selectCity` / `clearSelection` / `openDetail` /
  `closeDetail`; city-filtered article slice (max 8). Renders header (eyebrow/title/copy/live
  badge), Insight + Prediction cards, two-column shell (map | sidebar).
- `IncidentMap.tsx` — Leaflet via `next/dynamic` (ssr:false), dark CARTO basemap; per-city
  translucent circle + circleMarker colored by severity, sized by heat; popups; click →
  onSelectCity; flyTo on selection; fitBounds to Indonesia; unavailable fallback.
- `ScoreGauge.tsx` — canvas half-circle gauge + needle (from `drawGauge`), themed, retina-scaled.
- `SummaryCards.tsx`, `AiStatusCard.tsx` (ready/partial/unavailable), `TopCities.tsx`,
  `Keywords.tsx` (hot ≥2), `ArticleList.tsx` (score badges → modal), `DetailModal.tsx`
  (spinner → tags/summary/forecast-bar/signals; Esc + overlay-click close).

## Styling
All onto our tokens: `.panel` / `bg-card/60` / `border-border`; chips & filter buttons
`bg-background/40` (active → `primary/10` + `primary/30`); badges/keywords/forecast bars in
success/warning/destructive tints; gauge + markers use the same palette. Selection sync,
filtering, flyTo, modal fetch, and refresh preserved 1:1.

## Deps
`leaflet` + `@types/leaflet`; leaflet dark overrides added to `globals.css`.
