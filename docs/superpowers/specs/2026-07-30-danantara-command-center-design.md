# Danantara Command Center (one-page) — design spec

- **Date:** 2026-07-30 · **Feature:** A13 (new) + A7 v46.1 + A10 v5.5 (opt-in composition props)
- **Status:** Approved (brainstorm) → implementing
- **Builds on:** A10 (Crisis Gate), A7 (CEO Command Wall)

## Context

Today the Danantara story is split across two routes: `/danantara/krisis` (A10 — the
fear-first Crisis Gate: index gauge · biggest threat · driving actors) and
`/danantara` (A7 — the analyst wall: AI brief ticker · issue board · BUMN heatboard).
Getting the whole picture means a page navigation, which on a boardroom display or in
a live demo breaks the read: the screen blanks, the feeds refetch, and the presenter
loses the room.

A13 adds a **single-page** route that stacks both blocks in one continuously
scrolling view — Crisis Gate filling the first screen, the CEO Command wall scrolling
in below it, under one shared header with one refresh button.

**Both existing routes stay exactly as they are.** A7 and A10 are signed off and
demoed; this spec's central constraint is that neither changes observable behaviour.

## Layout — `/danantara/command`

```
┌──────────────────────────────────────────┐
│ [D] Danantara ●live   [Hari ini][7d][30d] │  ← CrisisGate header
│                            [briefing] [⟳] │    (the page's only header)
├────────────┬──────────────┬──────────────┤
│  INDEKS    │  ANCAMAN     │  AKTOR       │
│  ANCAMAN   │  TERBESAR    │  PENGGERAK   │
│   ◕ 18     │  · topik 1   │  @acct  ▓▓   │
│  AMAN      │  · topik 2   │  @acct  ▓▓   │
└────────────┴──────────────┴──────────────┘
        ↓ scroll (same page, no navigation)
┌──────────────────────────────────────────┐
│ AI brief ticker · running narration ···   │  ← CeoCommand, HeaderStrip suppressed
├───────────────────┬──────────────────────┤
│   ISSUE BOARD     │   BUMN HEATBOARD     │
│  ▸ topic  ▁▂▃     │  ▸ Pertamina   72    │
│  ▸ topic  ▁▂▃     │  ▸ PLN         68    │
└───────────────────┴──────────────────────┘
```

1. **Block 1 — Crisis Gate**, `embedded`. Fills the first screen but no longer locks
   its height, so it scrolls rather than clips. Its header is the page header: brand,
   live pulse, date-range window, "View briefing" link, Refresh.
2. **Block 2 — CEO Command wall**, `showHeader={false}`. Starts at the
   `AiBriefTicker`; the duplicate `HeaderStrip` (totals · alert count · Jakarta clock)
   is dropped so the page has exactly one header and one refresh control.

## Architecture

### New

- **`app/danantara/command/page.tsx`** — `<AppShell><DanantaraCommandCenter /></AppShell>`.
  `AppShell.minimalChrome` already matches `pathname.startsWith("/danantara/")`, so the
  stripped executive chrome applies with **no** AppShell layout change.
- **`components/danantara/ceo/DanantaraCommandCenter.tsx`** — deliberately thin. It
  owns the refresh nonce and the scroll layout, nothing else:

  ```tsx
  const [nonce, setNonce] = useState(0);
  return (
    <div className="flex flex-col gap-6">
      <CrisisGate embedded refreshNonce={nonce} onRefresh={() => setNonce((n) => n + 1)} />
      <CeoCommand showHeader={false} refreshNonce={nonce} />
    </div>
  );
  ```

### Changed — four additive props, all defaulting to today's behaviour

| Prop | Component | Default | Effect when set |
|---|---|---|---|
| `embedded` | `CrisisGate` | `false` | Swaps the locked `lg:h-[calc(100dvh-7.75rem)]` for `min-h-[calc(100dvh-9rem)]` — still fills the first screen, no longer fights the page scroll |
| `showHeader` | `CeoCommand` | `true` | `false` omits `<HeaderStrip>`; the block starts at `AiBriefTicker` |
| `refreshNonce` | both | `undefined` | On **change only** (never on mount), the block refetches its own feeds with `?fresh=1` |

`CrisisGate` additionally takes an optional **`onRefresh`** callback so its existing
header refresh button can notify the container.

**The two must not both fire.** When `onRefresh` is provided the button calls *only*
`onRefresh()` — it does **not** also run its own `loadTopics(true)` / `loadThreats(true)`
/ `loadRoster(true)`. The refetch then happens exactly once, driven by the resulting
`refreshNonce` change. Otherwise a click would fetch the crisis feeds twice (once
directly, once via the nonce). When `onRefresh` is absent the button behaves exactly as
it does today: refresh its own three feeds directly, no nonce involved.

Every prop is optional and every default reproduces current behaviour, so
`/danantara` and `/danantara/krisis` render identically — asserted by regression tests
rather than assumed.

### Reuse (unchanged)

`CrisisGate` (+ `CrisisGauge`, `ThreatTopics`, `ThreatActors`), `CeoCommand`
(+ `HeaderStrip`, `AiBriefTicker`, `IssueBoard`, `BumnHeatboard`, `DetailModal`),
`crisisIndex` / `biggestThreat`, `rankBumn`. No new library code, no new BFF route, no
data-model change.

### Navigation

One entry appended to `AppShell.NAV`:

```ts
{ to: "/danantara/command", label: "Danantara Command Center", icon: LayoutDashboard, group: "Dashboards" }
```

The `Dashboards` group survives both the `minimalChrome` and the danantara-scope nav
filters, so the entry shows even on the executive pages — the same placement A10 v3.4
needed. Without it the route would be URL-only, which is the gap A10 had to fix
retroactively.

## Data flow

Unchanged and independent, by design. `CrisisGate` keeps its three fetches
(`/api/v1/danantara/topics`, `/threats`, `/actor-intelligence`); `CeoCommand` keeps its
two (`/topics`, `/bumn-board`). No shared provider, no lifted state beyond the nonce.

- **The `/topics` overlap** costs one extra browser round trip, served from the 6h
  in-memory `topics-feed` cache. Accepted: the cost is one cached request, the benefit
  is that neither signed-off component's data layer is touched.
- **Independent `live` state per block.** A `/bumn-board` outage leaves the crisis
  gauge fully live and vice versa — there is no shared failure mode, satisfying the
  graceful-degradation guardrail.
- **One refresh, both blocks.** The crisis header's Refresh bumps the container nonce,
  which fans out to both blocks; each refetches its own feeds with `?fresh=1`.

## Testing (TDD — vitest, written failing first)

New — `app/danantara/command/page.test.tsx` and
`components/danantara/ceo/DanantaraCommandCenter.test.tsx`:

| # | Case |
|---|---|
| T1 | `/danantara/command` renders both blocks inside `AppShell` (mocked, mirroring `app/danantara/page.test.tsx`) |
| T2 | Exactly one header: one `crisis-gate`, one `ceo-wall`, **zero** `ceo-header` |
| T3 | Clicking the crisis header Refresh re-hits both blocks' feeds with `fresh=1` — 5 requests across 4 distinct endpoints (`/topics` twice, once per block), and **no** endpoint fetched more than its block requires |
| T4 | A `/bumn-board` failure still renders the crisis index (independent degradation) |
| T5 | **Regression:** `<CrisisGate />` with no props keeps `lg:h-[calc(100dvh-7.75rem)]` |
| T6 | **Regression:** `<CeoCommand />` with no props still renders `ceo-header` |

T5/T6 are the load-bearing pair — they are what prove the signed-off routes are
untouched.

**Gate:** the existing 420 tests must stay green with **no edits**. If any existing
test needs changing, the props are not additive as designed — stop and revisit the
approach rather than editing the test.

## Versioning

| Feature | Version | Note |
|---|---|---|
| **A13** | v1.0 (new) | Danantara Command Center (one-page) — `/danantara/command` |
| **A7** | v46.0 → **v46.1** (MINOR) | Opt-in `showHeader` / `refreshNonce` props; no change to `/danantara` |
| **A10** | v5.4 → **v5.5** (MINOR) | Opt-in `embedded` / `refreshNonce` / `onRefresh` props; no change to `/danantara/krisis` |

`docs/study-plans/atlas/3-act.md` gains the A13 block (PM → Architecture → QA);
`_index.md` goes 30 → 31 features with a revision-history row.

## Decisions taken

- **Route `/danantara/command`.** Alternatives considered: `/danantara/board`,
  `/danantara/one`. Renaming is a one-line change in the page path plus the NAV entry.
- **Continuous scroll**, chosen over snap-scroll screens and a tab/segmented switch.
  Scroll keeps both blocks in one DOM with no mount/unmount churn — the closest thing
  to "one page" for a wall display.
- **Additive props**, chosen over a thin unmodified stack (leaves two headers, two
  refresh buttons, a height conflict) and over lifting all data into a shared provider
  (cleanest architecture, but rewrites two signed-off components and their test suites).
- **No scroll-cue chevron on block 1.** Block 1 filling the viewport does hide the fact
  there is more below; deferred as unrequested chrome, cheap to add if the demo shows
  people miss the second block.
