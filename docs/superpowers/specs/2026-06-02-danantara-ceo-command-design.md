# Danantara CEO Command Wall — Design

Rebuild `/danantara` as a **zero-click, CEO-targeted** dashboard; the current interactive
"Sovereign Command" dashboard moves unchanged to **`/danantara-v2`**. Client feedback: the
dashboard's audience is the CEO, who "doesn't have time for clicking" — everything must surface
itself.

What the CEO asked for:

1. **Top 20 issues** related to Danantara, ranked, always visible.
2. **Top 20 BUMN** ranked by public sentiment, always visible.
3. **Escalation warning** — when an issue's reach/mentions grow abnormally fast, the dashboard
   raises an unmissable alarm on its own.

Decisions: responsive for **TV / laptop / phone**; escalation = **breaking-news takeover**;
curated real-world demo content (public sources only); Indonesian-language UI; no backend —
client-side simulation like the rest of this repo.

## Routes

- `app/danantara/page.tsx` — **rewritten** → renders `CeoCommand` (new) inside `AppShell`.
- `app/danantara-v2/page.tsx` — **added** → renders the existing `SovereignCommand` inside
  `AppShell` (the old dashboard, byte-for-byte behaviour, still has War Room/draggable grid).

## Data & simulation (`lib/danantara/ceo/`)

Reuses the existing Danantara data layer (`lib/danantara/types.ts` already models
`NarrativeIssue`, `VoiceShare`, `CrisisSignal` with velocity, and the 20-BUMN `Holding`
universe in `data.ts`). New files:

- `types.ts` — `CeoIssue` (id, title, category, related BUMN, mentions, reach, sentiment,
  velocity %, mention history, headlines[], aiLine, status `normal|rising|escalating`),
  `BumnSentiment` (BUMN ref → net sentiment −100..100, mentions, trend spark, top issue),
  `EscalationEvent`, `CeoSnapshot` (the full board state).
- `data.ts` — 20 curated issues grounded in real public Danantara coverage (governance,
  dividend policy, fund consolidation, BUMN restructuring, foreign deals…) with Indonesian
  titles + real outlet names (Kompas, Detik, CNBC Indonesia, Bisnis, X); 20 BUMN sentiment
  rows built from the existing `Holding` universe (Pertamina, PLN, BRI, Mandiri, Telkom,
  Garuda, MIND ID, Pelindo, KAI, Pupuk…).
- `engine.ts` — **pure functions** (all unit-tested):
  - `tick(snapshot, seed)` — advance one simulation step: mentions/reach random-walk, sentiment
    drift, re-rank.
  - `velocity(history, window)` — % growth of mentions over the rolling window; the window is
    the **last 6 ticks** (labelled as "2 jam terakhir" in the UI).
  - `statusOf(issue)` — ladder: `normal` → `rising` (velocity > +80%) → `escalating`
    (velocity > +200% **and** reach > **5 M** estimated audience); cooldown back down when
    velocity drops below the rising threshold.
  - `rankIssues(issues)` — descending by reach; `rankBumn(rows)` — **most-negative sentiment
    first** (the CEO's job is spotting problems, so problems lead).
  - `spotlightQueue(snapshot)` — rotation order; an `escalating` issue pins to front.
  - `scriptedArcs` — deterministic escalation arcs: one fires ~60 s after load, a second
    ~4 min in, so a live demo always shows the takeover. Presenter hotkey `E` force-fires one.

## Components (`components/danantara/ceo/`, all client)

- `CeoCommand.tsx` — orchestrator: owns the simulation clock (one `setInterval`, ~4 s),
  snapshot state, escalation events, responsive layout. **No widget requires interaction.**
- `HeaderStrip.tsx` — Danantara identity, LIVE badge, total mentions, net sentiment, active
  alert count, Jakarta clock.
- `IssueBoard.tsx` — top-20 issues ranked board; animated re-ranking (FLIP/`layout` animation),
  per-row sparkline, velocity %, status badge.
- `BumnHeatboard.tsx` — top-20 BUMN sentiment heatmap tiles (green↔red), Δ + spark per tile.
- `Spotlight.tsx` — center auto-rotating deep-dive (~10 s/issue): mention trend chart, top
  headlines, AI one-liner, related-BUMN chips; pins on escalation.
- `BreakingTakeover.tsx` — full-screen red interrupt (~5 s): issue title, rolling mention
  counter, velocity figure, siren pulse; then collapses into the pinned spotlight.
- `AiBriefTicker.tsx` — bottom narration strip; deterministic scripted lines composed from
  the live snapshot (reuses the `lib/ai/scripted.ts` pattern — graceful degradation, no live
  LLM dependency).

Responsive: TV/laptop = 3-column wall (issues | spotlight | BUMN) + header/ticker; phone =
header → spotlight hero → issues list → BUMN grid, stacked.

## Styling

Existing dark oklch command-center tokens (`.panel`, `bg-card/60`, `border-border`,
success/warning/destructive tints). Escalation uses the destructive/deep-red palette with
pulse/siren animations. Number roll-ups and re-rank transitions via CSS transforms +
`framer-motion`-free FLIP (no new deps).

## Testing (vitest, TDD)

All engine logic is pure and tested first: ranking, velocity windowing, status-ladder
transitions + cooldown, scripted-arc firing tick, spotlight queue pinning, tick monotonicity
/ bounds. Component smoke tests for: takeover renders on `escalating`, board renders 20 rows,
heatboard renders 20 tiles.

## Out of scope

- No changes to any existing `components/danantara/*` or `lib/danantara/*.ts` root files.
- No DB/API work (this repo is the static demo); production wiring is feature A1/A2.
- `/danantara-v2` gets no enhancements — it is a pure move.
