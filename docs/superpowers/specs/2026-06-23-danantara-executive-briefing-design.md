# Danantara Executive Briefing — design spec

- **Date:** 2026-06-23 · **Feature:** A11 (new) + A10 v3.3 (the `/krisis` gate goes English + links here)
- **Status:** Approved (brainstorm) → implementing
- **Builds on:** A10 (Crisis Gate), A8 dashboard components, A9 response calculator, P8 Nexorus deep-link

## Context

`/danantara/krisis` is the CEO's one-glance alarm. When he wants more — *"okay it's
ELEVATED, now tell me the whole story"* — he needs a clean drill-down, not the dense
analyst wall at `/danantara` (A7). A11 adds a new **Executive Briefing** at
`/danantara/brief`, driven **only** by `danantara_main` (the Danantara-wide topics
feed), with a top-down narrative layout built for a time-poor 60-year-old CEO.

`/krisis`'s "View briefing" repoints from `/danantara` → `/danantara/brief`. The old
`/danantara` wall is **untouched** and still reachable. **English chrome
throughout; topic titles/content stay Indonesian** (the real feed data) — same rule
applied to `/krisis` (A10 v3.3).

## Layout — top-down briefing (`/danantara/brief`)

1. **Header** — Danantara logo · "MEDIA BRIEFING" eyebrow · a small **threat-level
   chip** (the same `crisisIndex` band as `/krisis`, for continuity) · LIVE + WIB
   time · Refresh.
2. **Verdict hero** — one plain-English **briefing line** composed from the data
   ("Public sentiment is broadly positive (58%), driven by «‹topic›»; the main
   concern is «‹topic›».") + the sentiment split **bar** (`SentimentBreakdown`) +
   KPI tiles: **Total Reach · Impressions · Topics**.
3. **What's driving it** — two side-by-side cards: **⊕ Biggest win** (`topWin`) and
   **⊖ Biggest concern** (`biggestThreat`), each title (Indonesian) + AI read +
   click-through to `DetailModal`.
4. **Share of voice** — `IntentShare` leaderboard.
5. **All topics** — ranked `TopicCard` list; click → `DetailModal` (sentiment, AI
   analysis, A9 response calculator for negatives, P8 Nexorus deep-link).

## Architecture

- **Reuse:** the topics fetch (`/api/v1/danantara/topics`, no code → `danantara_main`);
  `SentimentBreakdown`, `SentimentPie`, `TopicCard` (+`TopicCardSkeleton`),
  `IntentShare`, `DetailModal` (state `{ tickCount:0, issues, bumn:[] }`,
  selection `{ type:"issue", id }`); `crisisIndex` / `biggestThreat`.
- **New, pure + tested:** `lib/danantara/ceo/briefing.ts` —
  `dominantTone(summary)` → `{ tone: "positive"|"negative"|"neutral", pct }`;
  `topWin(issues)` → loudest **net-positive** topic by `reach × positive fraction`
  (mirror of `biggestThreat`), `null` when none. + `briefing.test.ts`.
- **New UI:** `components/danantara/brief/DanantaraBrief.tsx` (page component:
  fetch + states + layout) and `app/danantara/brief/page.tsx`
  (`<AppShell><DanantaraBrief/></AppShell>`). Minimal chrome already covers
  `/danantara/*`. + `DanantaraBrief.test.tsx`.
- **Change (A10 v3.3):** `crisis.ts` band ladder Indonesian → **English**
  (`Low | Guarded | Elevated | Severe`, thresholds/colours unchanged);
  `CrisisGate.tsx` chrome → English (title "Danantara Threat Index", "Top Threat",
  "View briefing", "Refresh", "Data unavailable") and its link → `/danantara/brief`;
  `CrisisGauge.tsx` end labels → `0 · LOW` / `SEVERE · 100`. Topic titles stay
  Indonesian. Update `crisis.test.ts` + `CrisisGate.test.tsx`.

**Data-model / API changes:** none — reuses the existing topics BFF; no DB/LLM.

## States & UX

- **Loading** → topic skeletons + muted verdict.
- **Offline** (upstream fail / empty) → "Data unavailable" graceful state (no crash).
- The briefing **scrolls** (it's the detail view; the one-screen rule is the
  `/krisis` gate's, not here). Responsive down to mobile.

## Risks

- Verdict line must stay credible — composed only from real summary/topic data, no
  invented claims; the topic titles it quotes are the real feed titles.
- `topWin` vs `biggestThreat` use the same negative/positive test as the wall so the
  "win" and "concern" are classified consistently.

## Acceptance criteria (summary — full set in the A11 study plan)

- `/danantara/brief` renders from `danantara_main` only: verdict hero (line + bar +
  KPIs), the two driver cards, `IntentShare`, and the topic list; topic click opens
  `DetailModal`.
- English chrome, Indonesian topic content; graceful loading + offline.
- `/krisis` chrome is English (LOW/GUARDED/ELEVATED/SEVERE) and "View briefing"
  links to `/danantara/brief`; topic title stays Indonesian.
