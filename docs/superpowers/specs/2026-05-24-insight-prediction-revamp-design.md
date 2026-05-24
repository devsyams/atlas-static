# Insight & Prediction revamp + Nexorus AI rebrand

Date: 2026-05-24
Branch: feat/synapse-ai

## Context

Two client notes for the MBG Crisis Dashboard:

1. **Insight** section should be more dramatic; add keywords with a clearer keyword
   font; move the standalone "Kata kunci terdeteksi" tile into the Insight section.
2. **Prediction** should become a meter, with an improved layout and a
   "powered by Nexorus" line beneath it.

Plus a directive given during brainstorming: the AI brand **Synapse → Nexorus AI**
everywhere (visible text, env vars, README, and code symbols), and predictions can
be **multiple** (each probability caps at 100%, so they are independent). Ship 3 now.

## 1. Insight widget (dramatic + keywords)

`components/crisis/InsightPanel.tsx` (new), rendered as the `insight` widget body.

- Severity-tinted gradient background + accent left-border/glow keyed to the crisis
  level color (`scoreColor(score)`).
- Uppercase gradient kicker `ANALISIS NEXORUS AI` with a pulsing dot.
- Severity ribbon (`⚠ KRISIS` / `WASPADA` / `AMAN`) derived from `level`/`score`.
- Headline enlarged `text-base → text-lg/xl`, extrabold, tight leading.
- Body paragraph (`insight.text`).
- Keywords moved in under a clear `KATA KUNCI TERDETEKSI` label; chip font bumped
  `text-[11px] → ~text-[13px] font-bold`; high-count ("hot") keywords glow red.
- Standalone `keywords` grid tile removed.

## 2. Prediction widget (meters)

`components/crisis/PredictionMeters.tsx` (new) + `ProbabilityMeter` row.

- Kicker `PREDIKSI NEXORUS AI · N skenario`.
- One forecast card per prediction (Metaculus/Mantic style): bold question; a
  large `%` with the `answer_label` and an optional `timeframe` ("7 hari"); a
  thick rounded meter bar; a footer row with "Diperbarui {updated_at}" and a
  "Mengapa prediksi ini?" toggle that expands the `reasoning`.
- Color band by probability intensity (green → amber → red); optional `tone`
  override in data for "low probability is still good news" cases.
- Footer: divider + centered `⚡ powered by Nexorus AI`.
- Renders whatever the `predictions` array holds (1/2/3+).
- `Prediction` also carries optional `timeframe?: string`; `updated_at` is
  threaded from the dashboard into each card.

## 3. Data & types

- `Prediction` gains optional `tone?: "negative" | "neutral" | "positive"`.
- `DashboardData.prediction: Prediction | null` → `predictions: Prediction[]`.
- `mbg-crisis-data-v2.json`: replace top-level `prediction` object with a
  `predictions` array of 3 mock scenarios.
- `lib/mbg/data.ts`: `predictions: (raw.predictions ?? []) as Prediction[]`.
- `lib/ai/context.ts`: grounding context iterates `d.predictions`.
- `CrisisDashboard.tsx`: remove `keywords` tile; layout key `v4 → v5`; grow
  `insight` and `prediction` default heights `h:3 → h:6` so keywords + 3 meters
  fit without scrolling.

## 4. Rebrand (Synapse → Nexorus AI, full)

- Visible strings: NeuralIgnition, AppShell, BriefingPanel, WidgetAskButton,
  ForecastWidget, DetailModal, chat route fallback.
- Code symbols: `SynapseCopilot → NexorusCopilot` (+ file rename),
  `SYNAPSE_SYSTEM → NEXORUS_SYSTEM`, persona text "Kamu adalah Synapse" → Nexorus.
- Env vars: `SYNAPSE_AI_KEY/MODEL → NEXORUS_AI_KEY/MODEL`.
- README section + env docs; CSS comment in `globals.css`.

## Verification

`npm run build` (typecheck) passes; manual visual check of the dashboard.
