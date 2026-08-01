# Board-Level Threat-Index Response Simulator

- **Status:** Draft / Proposal — *not implemented*
- **Scope:** Replace the `Projected Share of Voice` section in `CounterNarrativeWarRoom`
- **Related areas:** A9 `CounterNoisePanel`, A10 `crisisIndex`, A14 `CounterNarrativeWarRoom`
- **Date:** 2026-08-01

> This is a proposed target design, not current behavior.

## Context

Today the war room shows:

1. the **top 3 negative topics** as cards
2. a **Projected Share of Voice** bar based on per-topic reach plans

That SOV section is useful mathematically, but it does not match the board’s own high-level threat framing.

The proposed change is to keep the topic cards, but replace the SOV section with a **board-level response simulator** driven by the overall **Threat Index**.

The output should still feel familiar:
- KOL posts
- clipper captions
- grassroots / homeless actions
- modeled impact / projected outcome

## Current behavior

### `CounterNarrativeWarRoom`
- fetches `/topics`
- selects top 3 negative topics
- computes `counterNarrativePlan(t, tier)` for each topic
- renders:
  - `ShareOfVoiceBar`
  - `CounterTopicCard` × 3

### `counter-narrative.ts`
- per-topic reach model
- `aggregateWarRoom(plans)` sums the three per-topic plans
- resulting output is **projected share of voice**

### `crisis.ts`
- `crisisIndex(issues, summary)` returns a **0–100 board-level threat score**
- used in `CrisisGate`, not in the war room

### `counter-noise.ts` / `CounterNoisePanel.tsx`
- a simpler calculator the user already understands
- output is:
  - total actions
  - KOL
  - clipper
  - homeless / grassroots

## Proposed target behavior

Replace `ShareOfVoiceBar` with a **Threat Index Response Simulator**.

### Keep
- 3 per-topic war-room cards
- current topic selection logic
- current per-topic narrative context

### Change
- the bottom section becomes a **board-level calculator**
- input is the **overall Threat Index**
- output remains familiar:
  - total actions
  - KOL posts
  - clipper captions
  - grassroots / homeless actions
  - projected reach / impact
  - **post-response Threat Index**

## Design principle

The **Threat Index** is a **control signal**, not a volume signal.

So the simulator should use it to answer:

> “How aggressive should the response be?”

not:

> “How many posts are in the feed?”

That means the calculator needs two parts:

1. **Threat Index → multiplier**
2. **Negative volume baseline → response counts**

## Recommended model

```text
Threat Index -> response multiplier
All negative topics -> volume anchor
tier -> additional intensity control
volume anchor × multiplier × tier -> total actions
total actions -> channel split
channel split + modeled effect -> post-response Threat Index
```

This keeps the board-level story coherent:

- the **topics** explain what is bad
- the **Threat Index** says how bad it is
- the **simulator** says how much response to deploy

## Calculator shape

A pure helper could look like:

```ts
boardThreatResponsePlan(
  issues: CeoIssue[],
  summary: TopicsSummary | null,
  tier: ResponseTier
)
```

### Internally
1. compute `reading = crisisIndex(issues, summary)`
2. compute the negative-topic volume anchor from **all negative topics**
3. map `reading.score` to a multiplier
4. apply tier as an additional multiplier
5. compute total actions
6. split into:
   - KOL
   - Clipper
   - Grassroots / Homeless
7. compute:
   - projected reach
   - post-response Threat Index

## Suggested interpretation of the Threat Index multiplier

A simple mapping could be band-based or continuous.

### Example band-based mapping
- **Low / Aman** → `1.0x`
- **Guarded / Waspada** → `1.5x`
- **Elevated / Siaga** → `2.0x`
- **Severe / Awas** → `2.5x` or higher

### Tier remains as a second multiplier
- `basic`
- `professional`
- `enterprise`

So final intensity is something like:

```text
total intensity = threatMultiplier × tierMultiplier
```

## Negative volume baseline

Use **all negative topics**.

That means the simulator is sized off the full board picture, not only the 3 cards shown in the war room.

This is important because:
- the cards are a **presentation slice**
- the simulator is a **board-level response**
- the full negative set better matches the overall threat index

## Post-response Threat Index

This should be a modeled outcome, not a claim of certainty.

The panel can show something like:

- **Threat Index now:** 67
- **Projected threat after response:** 54

or

- **Projected threat reduction:** −13 points

This gives the simulator a more useful boardroom outcome than SOV.

## UI changes

### Keep
- the 3 topic cards

### Replace
- `ShareOfVoiceBar`

### Add
A new board-level calculator panel, likely with:

- Threat Index header
- response multiplier / posture
- total actions
- KOL / clipper / grassroots breakdown
- projected reach
- post-response Threat Index

### Visual tone
It should feel similar to `CounterNoisePanel`:
- the familiar deploy/count style
- clear channel breakdown
- count-up reveal
- board-friendly summary language

## Data flow changes

### Current
`useCounterNarrative`
- fetches `/topics`
- keeps only `issues`
- picks top 3 topics
- renders per-topic plans + SOV bar

### Proposed
`useCounterNarrative`
- fetches `/topics`
- keeps both `issues` and `summary`
- computes `crisisIndex(issues, summary)`
- passes that reading into the new simulator

The topic cards still use the top 3 topics.  
The simulator uses **all negative topics** and the board-level Threat Index.

## Implementation notes

### Reuse
- `crisisIndex` from `lib/danantara/ceo/crisis.ts`
- tier vocabulary from `counter-noise.ts`
- channel split logic from `counter-noise.ts` / `counter-narrative.ts`
- largest-remainder splitting so counts sum cleanly

### Keep pure
The new board simulator should stay deterministic and testable.

### Keep the current topic cards
Do not convert the whole war room into a board calculator.  
The cards remain topic-centric; only the bottom summary changes.

## Non-goals

- Do not remove the three topic cards
- Do not rewrite `CounterNoisePanel`
- Do not change the `crisisIndex` formula itself
- Do not add persistence or backend routes
- Do not introduce real media-planning data

## Risks / open questions

1. **Threat-to-multiplier curve**
   - linear or banded?
   - banded is likely easier for the boardroom to read

2. **How should post-response Threat Index be modeled?**
   - fixed reduction curve?
   - tier-adjusted reduction?
   - response-size-adjusted reduction?

3. **Should the panel show exact reduction points or a remaining band?**
   - points are more precise
   - band is more executive-friendly

## Acceptance criteria

- The war room still renders the **3 topic cards**
- The SOV bar is replaced by a **Threat Index-driven response simulator**
- The simulator uses:
  - overall Threat Index
  - all negative topics as the volume anchor
  - tier selection as an intensity control
- The output includes:
  - total counter-actions
  - KOL posts
  - clipper captions
  - grassroots / homeless actions
  - projected reach
  - post-response Threat Index
- The threat-index value matches `CrisisGate`

## Test plan

### Unit tests
- Threat Index maps to multiplier correctly
- all negative topics contribute to the volume anchor
- tier changes affect total actions
- channel split sums to total actions
- post-response Threat Index is deterministic and bounded

### Component tests
- war room still renders 3 cards
- SOV bar is gone
- new simulator panel appears
- tier switching recomputes the panel
- loading / empty / offline behavior remains stable

## Suggested file impact

### Likely change
- `components/danantara/ceo/CounterNarrativeWarRoom.tsx`
- `components/danantara/ceo/useCounterNarrative.ts`
- `components/danantara/ceo/ShareOfVoiceBar.tsx` → retire or replace
- `lib/danantara/ceo/crisis.ts`
- new helper in `lib/danantara/ceo/`

### Likely reuse
- `lib/danantara/ceo/counter-noise.ts`
- `lib/danantara/ceo/counter-narrative.ts`
- `components/danantara/ceo/CounterNoisePanel.tsx` for UX pattern
