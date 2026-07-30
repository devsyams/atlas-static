# Danantara Command Center (A13) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/danantara/command` — a single continuously scrolling page that stacks the A10 Crisis Gate and the A7 CEO Command wall under one header with one refresh button, with no route hop between them.

**Architecture:** No new data layer and no new BFF route. A thin new container component (`DanantaraCommandCenter`) composes the two **existing** components via four **opt-in props** (`embedded`, `showHeader`, `refreshNonce`, `onRefresh`) that all default to today's behaviour, so `/danantara` and `/danantara/krisis` keep rendering identically. Each block keeps its own fetches and its own `live` state, so one feed failing degrades only its own block.

**Tech Stack:** Next.js 16.2.6 (App Router, Turbopack), React 19.2.4, TypeScript, Tailwind v4, vitest 4.1.8 + @testing-library/react (jsdom).

**Spec:** `docs/superpowers/specs/2026-07-30-danantara-command-center-design.md`

## Global Constraints

- **Study plan first.** Per `CLAUDE.md` no feature code is written before the study-plan block exists. Task 1 is that gate — do not start Task 2 until Task 1 is committed.
- **Every new prop is optional and defaults to current behaviour.** `embedded = false`, `showHeader = true`, `refreshNonce` / `onRefresh` `undefined`.
- **No existing test may be edited.** Adding new `it(...)` blocks to an existing test file is fine; changing an existing test's code is a signal the props are not additive — stop and re-check the approach with the requester.
- **Test baseline: 420 tests across 53 files.** Verified on `main` at plan time by three consecutive full runs.
- **Known load-flaky test — not a regression you caused.** `components/danantara/ceo/CrisisGate.test.tsx` → *"keeps panel 3 (roster) alive when the /threats feed itself fails (AC9/AC11)"* failed on 2 of 3 baseline full-suite runs (a `waitFor` timeout under parallel load, `CrisisGate.test.tsx:159`) and passes 7/7 in isolation. If it fails during this work, re-run that file alone (`npx vitest run components/danantara/ceo/CrisisGate.test.tsx`) to confirm before treating it as a break. Task 7 optionally de-flakes it.
- **No hardcoded LLM provider/model, no client-side secrets, no direct DB access.** This feature adds no AI call, no secret, no query — the guardrails are satisfied by adding nothing.
- **Chrome is English; topic titles/content stay Indonesian** (existing A10/A11 rule — inherited, no new copy).
- **Commands:** tests `npm test`, single file `npx vitest run <path>`, types `npx tsc --noEmit`, lint `npm run lint`, dev server `npm run dev`.

## File Structure

| File | Responsibility |
|---|---|
| `docs/study-plans/atlas/3-act.md` | **modify** — add the A13 block (PM → Architecture → QA → Revision history); add revision rows to A7 and A10 |
| `docs/study-plans/atlas/_index.md` | **modify** — A13 row, totals 30→31 / act 12→13, index revision row |
| `components/danantara/ceo/CrisisGate.tsx` | **modify** — accept `embedded` / `refreshNonce` / `onRefresh`; nothing else changes |
| `components/danantara/ceo/CrisisGate.test.tsx` | **modify (additive)** — 4 new tests: no-props height regression, `embedded`, `refreshNonce`, `onRefresh` delegation |
| `components/danantara/ceo/CeoCommand.tsx` | **modify** — accept `showHeader` / `refreshNonce`; nothing else changes |
| `components/danantara/ceo/CeoCommand.test.tsx` | **modify (additive)** — 3 new tests: no-props header regression, `showHeader={false}`, `refreshNonce` |
| `components/danantara/ceo/DanantaraCommandCenter.tsx` | **create** — the container: owns the refresh nonce + the scroll layout, nothing else |
| `components/danantara/ceo/DanantaraCommandCenter.test.tsx` | **create** — single-header, one-refresh-both-blocks, independent degradation |
| `app/danantara/command/page.tsx` | **create** — `<AppShell><DanantaraCommandCenter /></AppShell>` |
| `app/danantara/command/page.test.tsx` | **create** — renders the container inside AppShell |
| `components/layout/AppShell.tsx` | **modify** — one `NAV` entry so the route is menu-reachable |
| `components/layout/AppShell.test.tsx` | **modify (additive)** — 2 new tests: the nav link survives the minimal-chrome + scope filters |

---

### Task 1: Study-plan gate (A13 v1.0 + A7/A10 revision rows)

**This is the mandatory `CLAUDE.md` gate. No feature code until this is committed.**

**Files:**
- Modify: `docs/study-plans/atlas/3-act.md` (insert A13 after the A12 block at end of file; add rows to A7 + A10 revision histories)
- Modify: `docs/study-plans/atlas/_index.md:44` (feature table), totals line, index revision history

**Interfaces:**
- Consumes: nothing.
- Produces: the A13 acceptance-criteria IDs (`AC1`–`AC6`) and test IDs (`T1`–`T8`) that Tasks 2–6 reference in test names.

- [ ] **Step 1: Append the A13 block to `docs/study-plans/atlas/3-act.md`**

Add at the end of the file (after the A12 block), matching the A11 block's structure exactly:

````markdown
---

### A13. Danantara Command Center (one-page)

- **Version:** 1.0 · **Stage:** 3-act · **Sprint:** demo · **Status:** In progress · **Spec ref:** `docs/superpowers/specs/2026-07-30-danantara-command-center-design.md` · **Owner:** Dev A

#### PM
**Background (why):** The Danantara story is split across two routes — `/danantara/krisis` (A10, the fear-first Crisis Gate: index gauge · biggest threat · driving actors) and `/danantara` (A7, the analyst wall: AI brief ticker · issue board · BUMN heatboard). Seeing the whole picture means a page navigation, which on a boardroom display or in a live demo breaks the read: the screen blanks, the feeds refetch, and the presenter loses the room. A13 adds a **single-page** route, `/danantara/command`, that stacks both blocks in one continuously scrolling view under one header and one refresh button. **Both existing routes stay exactly as they are** — A7 and A10 are signed off and demoed, so the central constraint is that neither changes observable behaviour.

**Acceptance criteria (Given / When / Then):**
- **AC1** — *Given* the live Danantara feeds, *When* `/danantara/command` loads, *Then* it renders the A10 Crisis Gate filling the first screen and the A7 CEO Command wall below it, both inside `AppShell`'s minimal executive chrome, on one page with **no route navigation** between them.
- **AC2** — *Given* the page, *When* rendered, *Then* it shows **exactly one header** — the Crisis Gate's (brand · live pulse · date-range window · "View briefing" · Refresh); the CEO wall's `HeaderStrip` is suppressed and its block starts at the `AiBriefTicker`.
- **AC3** — *Given* the page, *When* the user scrolls, *Then* the CEO wall scrolls into view continuously (the Crisis Gate fills the first screen but does not lock the page height or clip).
- **AC4** — *Given* the page, *When* the single Refresh is clicked, *Then* **both** blocks refetch their own feeds with `?fresh=1` — 5 requests across 4 distinct endpoints (`/topics` once per block, plus `/threats`, `/actor-intelligence`, `/bumn-board`) — and **no endpoint is fetched more than its block requires** (no double-fetch from the refresh handler and the nonce both firing).
- **AC5** — *Given* one upstream feed fails, *When* the page loads, *Then* only that block degrades: a `/bumn-board` outage still leaves the crisis index live, and vice versa. There is no shared failure mode.
- **AC6** — *Given* the new route, *Then* it is reachable from the `AppShell` gear menu ("Danantara Command Center", **Dashboards** group) and the entry survives both the `minimalChrome` and the danantara-scope nav filters — never URL-only.

#### Architecture
**Impact — files add/change:**
- `add` `components/danantara/ceo/DanantaraCommandCenter.tsx` — thin container: owns a `refreshNonce` and the scroll layout only. + `DanantaraCommandCenter.test.tsx`.
- `add` `app/danantara/command/page.tsx` — `<AppShell><DanantaraCommandCenter/></AppShell>`. + `page.test.tsx`.
- `change` `components/danantara/ceo/CrisisGate.tsx` (**A10 v5.5**) — opt-in `embedded` (drops the `lg:h-[calc(100dvh-7.75rem)]` lock for `min-h-[calc(100dvh-9rem)]`), `refreshNonce` (refetch on change only, never on mount), `onRefresh` (when provided the header button calls *only* it, so the nonce drives a single refetch).
- `change` `components/danantara/ceo/CeoCommand.tsx` (**A7 v46.1**) — opt-in `showHeader` (`false` omits `HeaderStrip`), `refreshNonce` (as above).
- `change` `components/layout/AppShell.tsx` — one `NAV` entry (`/danantara/command`, `LayoutDashboard`, Dashboards group). `minimalChrome` already matches `pathname.startsWith("/danantara/")` — no layout change needed.

**Data-model / API changes:** **none.** No new BFF route, no DB, no LLM, no new secret.

**Reuse:** `CrisisGate` (+`CrisisGauge`, `ThreatTopics`, `ThreatActors`), `CeoCommand` (+`HeaderStrip`, `AiBriefTicker`, `IssueBoard`, `BumnHeatboard`, `DetailModal`), `crisisIndex`/`biggestThreat`, `rankBumn`, the existing 4 BFF routes.

**Risks:** (1) *Regression on signed-off routes* — mitigated by every prop defaulting to current behaviour plus two explicit no-props regression tests (T5/T7). (2) *Double-fetch on refresh* — the `onRefresh` + nonce paths are mutually exclusive by construction and asserted by an exact request count (T4). (3) *The suppressed `HeaderStrip` drops the Jakarta clock, total mentions and alert count*, which appear nowhere else on the page — accepted by the client for this layout. (4) *`/topics` is fetched twice* (once per block) — accepted: served from the 6 h `topics-feed` cache, and the alternative (a shared provider) would rewrite two signed-off components.

#### QA
| # | Maps to | Test case | Type |
|---|---|---|---|
| T1 | AC1 | `/danantara/command` renders the Command Center inside `AppShell` (both mocked) | component |
| T2 | AC1 | the container renders one `crisis-gate` **and** one `ceo-wall` from seeded feeds | component |
| T3 | AC2 | the container renders **zero** `ceo-header` — a single header on the page | component |
| T4 | AC4 | one Refresh click → exactly 5 `fresh=1` requests: `/topics` ×2, `/threats`, `/actor-intelligence`, `/bumn-board` (exact count guards against a double-fetch) | component |
| T5 | AC5 | `/bumn-board` 502 → the crisis index still renders a number; the wall still mounts | component |
| T6 | AC3 | `CrisisGate embedded` drops `lg:h-[calc(100dvh-7.75rem)]` and carries `min-h-[calc(100dvh-9rem)]` | component |
| T7 | AC2 | **regression:** `<CrisisGate />` with no props keeps `lg:h-[calc(100dvh-7.75rem)]`; `<CeoCommand />` with no props still renders `ceo-header` (the signed-off routes are untouched) | component |
| T8 | AC6 | the gear-menu link points at `/danantara/command` and survives the `minimalChrome` + danantara-scope filters | component |

**Governance edge cases:** public demo route like A7/A8/A10/A11 (no `requireRole`) — no new secret, no new endpoint, no LLM/cost, so the API-first / secrets / model-agnostic guardrails are satisfied by adding nothing. Graceful degradation per-block (AC5). The existing 420 tests must stay green **unedited**; note the known load-flaky `CrisisGate` roster test.

#### Revision history
| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-07-30 | Initial plan — **one-page `/danantara/command`**: the A10 Crisis Gate stacked over the A7 CEO wall, continuous scroll, one header, one refresh. Composed via four **opt-in** props on the two existing components (`embedded`/`showHeader`/`refreshNonce`/`onRefresh`), all defaulting to current behaviour so `/danantara` + `/danantara/krisis` stay byte-identical; no new BFF route, no shared data provider. From client request ("make it a Single Page Application"). Spec `2026-07-30-danantara-command-center-design.md`; 30→31 features. Status → In progress |
````

- [ ] **Step 2: Add the A7 and A10 revision rows in the same file**

Append to the **A7** revision-history table (and bump its header `**Version:** 46.0` → `46.1`):

```markdown
| 46.1 | 2026-07-30 | **MINOR (A13 support)** — `CeoCommand` accepts two **opt-in** props: `showHeader` (default `true`; `false` omits `HeaderStrip`) and `refreshNonce` (refetch both feeds with `fresh=1` when the value *changes*, never on mount). Consumed only by the new A13 one-page container; `/danantara` passes neither, so the wall is unchanged. Regression test asserts the no-props render still shows `ceo-header` |
```

Append to the **A10** revision-history table (and bump its header `**Version:** 5.4` → `5.5`):

```markdown
| 5.5 | 2026-07-30 | **MINOR (A13 support)** — `CrisisGate` accepts three **opt-in** props: `embedded` (default `false`; swaps the `lg:h-[calc(100dvh-7.75rem)]` one-screen lock for `min-h-[calc(100dvh-9rem)]` so it can sit in a scrolling page), `refreshNonce` (refetch all three feeds when the value *changes*, never on mount) and `onRefresh` (when provided the header Refresh calls **only** it, so the nonce drives a single refetch and nothing double-fetches). Consumed only by the new A13 one-page container; `/danantara/krisis` passes none, so the gate is unchanged. Regression test asserts the no-props render keeps the height lock |
```

- [ ] **Step 3: Update `docs/study-plans/atlas/_index.md`**

Add after the A12 row in the feature table:

```markdown
| **A13** | Danantara Command Center (one-page) | 3-act | demo | — | 1.0 | In progress |
```

Change the totals line from:

```markdown
**Totals:** 30 features · 8 platform · 5 watch · 5 understand · 12 act.
```

to:

```markdown
**Totals:** 31 features · 8 platform · 5 watch · 5 understand · 13 act.
```

Append to the index revision history (the last row is `1.110`):

```markdown
| 1.111 | 2026-07-30 | Added **A13 (Danantara Command Center, one-page)** at v1.0 In progress — new `/danantara/command` stacks the A10 Crisis Gate over the A7 CEO wall in one continuously scrolling page (one header, one refresh, no route hop), composed via four opt-in props that default to current behaviour so `/danantara` + `/danantara/krisis` stay byte-identical. A7 → v46.1, A10 → v5.5 (MINOR, props only). From client request ("make it a Single Page Application"); 30→31 features |
```

- [ ] **Step 4: Verify the docs are coherent**

Run: `grep -n "A13\|31 features\|1.111" docs/study-plans/atlas/_index.md`
Expected: the A13 row, the updated totals line, and the new revision row all present.

Run: `grep -n "^### A13\|^| 46.1\|^| 5.5" docs/study-plans/atlas/3-act.md`
Expected: three hits — the A13 heading and the two new revision rows.

- [ ] **Step 5: Commit**

```bash
git add docs/study-plans/atlas/3-act.md docs/study-plans/atlas/_index.md
git commit -m "docs(a13): study plan for Danantara Command Center (one-page)"
```

---

### Task 2: `CrisisGate` opt-in props (A10 v5.5)

**Files:**
- Modify: `components/danantara/ceo/CrisisGate.tsx` (signature at :76, section className at :168-171, refresh button at :247-260)
- Test: `components/danantara/ceo/CrisisGate.test.tsx` (append new `it` blocks inside the existing `describe`; **do not touch existing tests**)

**Interfaces:**
- Consumes: nothing.
- Produces: `CrisisGate({ embedded?: boolean; refreshNonce?: number; onRefresh?: () => void })`. Task 4 passes `embedded`, `refreshNonce` and `onRefresh`.

- [ ] **Step 1: Write the failing tests**

Append inside the existing `describe("CrisisGate (A10 — fear-first landing)", ...)` block. The file already provides `stubFetch()` — reuse it.

```tsx
  // A13 (v5.5) — the props are opt-in; the no-props render must not change.
  it("without props keeps its locked one-screen height — /danantara/krisis unchanged (T7)", async () => {
    stubFetch();
    render(<CrisisGate />);
    await waitFor(() => expect(screen.getByTestId("crisis-gate")).toBeInTheDocument());
    expect(screen.getByTestId("crisis-gate").className).toContain("lg:h-[calc(100dvh-7.75rem)]");
  });

  it("embedded drops the height lock so a page can scroll past it (T6)", async () => {
    stubFetch();
    render(<CrisisGate embedded />);
    await waitFor(() => expect(screen.getByTestId("crisis-gate")).toBeInTheDocument());
    const cls = screen.getByTestId("crisis-gate").className;
    expect(cls).not.toContain("lg:h-[calc(100dvh-7.75rem)]");
    expect(cls).toContain("min-h-[calc(100dvh-9rem)]");
    // overflow-hidden must stay: the crisis-breathe scale(1.06) on the ambient glow
    // would otherwise bleed past the section's edge onto the page below it.
    expect(cls).toContain("overflow-hidden");
  });

  it("refetches all three feeds when refreshNonce changes, and not on mount (T4 support)", async () => {
    stubFetch();
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const { rerender } = render(<CrisisGate refreshNonce={0} />);
    await waitFor(() => expect(screen.getByTestId("crisis-gate")).toBeInTheDocument());
    // Mount with a nonce present must NOT double-fetch: 3 feeds, 3 calls, none fresh.
    expect(fetchMock.mock.calls.filter((c) => String(c[0]).includes("fresh=1"))).toHaveLength(0);

    fetchMock.mockClear();
    rerender(<CrisisGate refreshNonce={1} />);
    await waitFor(() => {
      const fresh = fetchMock.mock.calls.map((c) => String(c[0])).filter((u) => u.includes("fresh=1"));
      expect(fresh).toHaveLength(3);
    });
  });

  it("with onRefresh the header button delegates instead of fetching itself (T4 support)", async () => {
    stubFetch();
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const onRefresh = vi.fn();
    render(<CrisisGate onRefresh={onRefresh} />);
    await waitFor(() => expect(screen.getByTestId("crisis-gate")).toBeInTheDocument());

    fetchMock.mockClear();
    fireEvent.click(screen.getByLabelText("Refresh"));

    expect(onRefresh).toHaveBeenCalledTimes(1);
    // The container owns the refetch (via the nonce) — the button must not also fetch.
    expect(fetchMock.mock.calls.filter((c) => String(c[0]).includes("fresh=1"))).toHaveLength(0);
  });
```

Add `fireEvent` to the existing import on line 2:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run components/danantara/ceo/CrisisGate.test.tsx`
Expected: FAIL — 4 new tests fail. The `embedded` test fails because the class is unconditional; the `refreshNonce` / `onRefresh` tests fail on the unknown props (TS) and because the button always fetches. The 7 existing tests must still PASS.

- [ ] **Step 3: Add the props to the implementation**

Change the signature at `components/danantara/ceo/CrisisGate.tsx:76`:

```tsx
export function CrisisGate({
  embedded = false,
  refreshNonce,
  onRefresh,
}: {
  /** Sit inside a scrolling page (A13) instead of locking to one screen. */
  embedded?: boolean;
  /** Parent-driven refresh: refetch when this value *changes* (never on mount). */
  refreshNonce?: number;
  /** When provided, the header Refresh delegates to the parent instead of fetching. */
  onRefresh?: () => void;
} = {}) {
```

Add the nonce effect immediately after the existing initial-load effect (currently :149-153):

```tsx
  // A13: parent-driven refresh. Fires only when the nonce *changes*, so mounting
  // with a nonce already present never double-fetches the initial load.
  const nonceRef = useRef(refreshNonce);
  useEffect(() => {
    if (refreshNonce === undefined || nonceRef.current === refreshNonce) return;
    nonceRef.current = refreshNonce;
    setRefreshing(true);
    loadTopics(true);
    loadThreats(true);
    loadRoster(true);
  }, [refreshNonce, loadTopics, loadThreats, loadRoster]);
```

Replace the `<section>` className (:168-171) with the conditional:

```tsx
    <section
      data-testid="crisis-gate"
      className={
        embedded
          ? "relative flex min-h-[calc(100dvh-9rem)] flex-col gap-4 overflow-hidden lg:min-h-[28rem]"
          : "relative flex min-h-[calc(100dvh-7.75rem)] flex-col gap-4 overflow-hidden lg:h-[calc(100dvh-7.75rem)] lg:min-h-[28rem]"
      }
    >
```

`overflow-hidden` is kept in **both** branches — dropping only the height lock, not the
clip. The ambient-glow div is `absolute inset-0`, and at Elevated/Severe crisis levels
it gets `crisis-breathe`, whose keyframes (`app/globals.css` ~line 713) include
`transform: scale(1.06)`; a CSS transform paints outside its layout box, so without
`overflow-hidden` the glow could bleed past the section onto the sibling block below it
in the combined page — worst exactly when the crisis level is worst.

Replace the refresh button's `onClick` (:249-254) with the delegating version:

```tsx
            onClick={() => {
              // A13: when a parent owns refresh, bumping its nonce drives the refetch —
              // firing both paths would fetch every feed twice.
              if (onRefresh) {
                onRefresh();
                return;
              }
              setRefreshing(true);
              loadTopics(true);
              loadThreats(true);
              loadRoster(true);
            }}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run components/danantara/ceo/CrisisGate.test.tsx`
Expected: PASS — 11 tests (7 existing + 4 new).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 6: Commit**

```bash
git add components/danantara/ceo/CrisisGate.tsx components/danantara/ceo/CrisisGate.test.tsx
git commit -m "feat(a10): opt-in embedded/refreshNonce/onRefresh props on CrisisGate (v5.5)"
```

---

### Task 3: `CeoCommand` opt-in props (A7 v46.1)

**Files:**
- Modify: `components/danantara/ceo/CeoCommand.tsx` (signature at :22, header render at :89-97)
- Test: `components/danantara/ceo/CeoCommand.test.tsx` (append new `it` blocks; **do not touch existing tests**)

**Interfaces:**
- Consumes: nothing.
- Produces: `CeoCommand({ showHeader?: boolean; refreshNonce?: number })`. Task 4 passes `showHeader={false}` and `refreshNonce`.

- [ ] **Step 1: Write the failing tests**

Append inside the existing `describe("CeoCommand — live wall (v37.0)", ...)`. The file already provides `stubFetch()`.

```tsx
  // A13 (v46.1) — the props are opt-in; the no-props render must not change.
  it("without props still renders the header strip — /danantara unchanged (T7)", async () => {
    stubFetch();
    render(<CeoCommand />);
    await waitFor(() => expect(screen.getByTestId("ceo-header")).toBeInTheDocument());
  });

  it("showHeader={false} suppresses the header strip (T3)", async () => {
    stubFetch();
    render(<CeoCommand showHeader={false} />);
    await waitFor(() => expect(screen.getByTestId("ceo-wall")).toBeInTheDocument());
    expect(screen.queryByTestId("ceo-header")).not.toBeInTheDocument();
  });

  it("refetches both feeds when refreshNonce changes, and not on mount (T4 support)", async () => {
    stubFetch();
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const { rerender } = render(<CeoCommand refreshNonce={0} />);
    await waitFor(() => expect(screen.getByTestId("ceo-wall")).toBeInTheDocument());
    expect(fetchMock.mock.calls.filter((c) => String(c[0]).includes("fresh=1"))).toHaveLength(0);

    fetchMock.mockClear();
    rerender(<CeoCommand refreshNonce={1} />);
    await waitFor(() => {
      const fresh = fetchMock.mock.calls.map((c) => String(c[0])).filter((u) => u.includes("fresh=1"));
      expect(fresh).toHaveLength(2);
    });
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run components/danantara/ceo/CeoCommand.test.tsx`
Expected: FAIL — the 3 new tests fail (unknown props; the header always renders). The 11 existing tests must still PASS.

- [ ] **Step 3: Add the props to the implementation**

Change the signature at `components/danantara/ceo/CeoCommand.tsx:22`:

```tsx
export function CeoCommand({
  showHeader = true,
  refreshNonce,
}: {
  /** A13 embeds this wall under the Crisis Gate's header — pass `false` to drop ours. */
  showHeader?: boolean;
  /** Parent-driven refresh: refetch when this value *changes* (never on mount). */
  refreshNonce?: number;
} = {}) {
```

Add the nonce effect immediately after the existing initial-load effect (currently :74-76):

```tsx
  // A13: parent-driven refresh. Fires only when the nonce *changes*, so mounting
  // with a nonce already present never double-fetches the initial load.
  const nonceRef = useRef(refreshNonce);
  useEffect(() => {
    if (refreshNonce === undefined || nonceRef.current === refreshNonce) return;
    nonceRef.current = refreshNonce;
    setRefreshing(true);
    load(true);
  }, [refreshNonce, load]);
```

`useRef` is already imported on line 3 — no import change needed.

Wrap the header render (:89-97) in the flag:

```tsx
      {showHeader && (
        <HeaderStrip
          state={headerState}
          source={issuesLive}
          onRefresh={() => {
            setRefreshing(true);
            load(true);
          }}
          refreshing={refreshing}
        />
      )}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run components/danantara/ceo/CeoCommand.test.tsx`
Expected: PASS — 13 tests (10 existing + 3 new).

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: tsc silent. Lint may warn that `refreshing` is now only consumed inside the guarded header — that is fine and expected; it must not **error**.

- [ ] **Step 6: Commit**

```bash
git add components/danantara/ceo/CeoCommand.tsx components/danantara/ceo/CeoCommand.test.tsx
git commit -m "feat(a7): opt-in showHeader/refreshNonce props on CeoCommand (v46.1)"
```

---

### Task 4: The `DanantaraCommandCenter` container

**Files:**
- Create: `components/danantara/ceo/DanantaraCommandCenter.tsx`
- Test: `components/danantara/ceo/DanantaraCommandCenter.test.tsx`

**Interfaces:**
- Consumes: `CrisisGate({ embedded, refreshNonce, onRefresh })` from Task 2; `CeoCommand({ showHeader, refreshNonce })` from Task 3.
- Produces: `DanantaraCommandCenter()` — no props. Renders `data-testid="danantara-command-center"`. Task 5 mounts it.

- [ ] **Step 1: Write the failing test**

Create `components/danantara/ceo/DanantaraCommandCenter.test.tsx`. It stubs all four endpoints; fixtures are local to the file, matching this repo's per-file fixture style.

```tsx
// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BumnSentiment, CeoIssue } from "@/lib/danantara/ceo/types";
import type { ThreatDriver } from "@/lib/danantara/ceo/threats-source";
import { DanantaraCommandCenter } from "./DanantaraCommandCenter";

function mkIssue(over: Partial<CeoIssue> & Pick<CeoIssue, "id" | "title">): CeoIssue {
  return {
    category: "kebijakan",
    relatedBumn: [],
    mentions: 1000,
    reach: 9_000_000,
    sentiment: -40,
    history: Array.from({ length: 8 }, () => 1000),
    headlines: [],
    aiLine: "Konteks singkat.",
    velocity: 0,
    status: "normal",
    rankHistory: [1, 1, 1, 1, 1, 1, 1, 1],
    rankDelta: 0,
    posMentions: 200,
    negMentions: 600,
    ...over,
  };
}

function mkBumn(slug: string, sentiment: number): BumnSentiment {
  return {
    id: slug,
    name: slug,
    short: slug.toUpperCase(),
    sector: "energi",
    sentiment,
    mentions: 1000,
    trend: Array.from({ length: 8 }, () => sentiment),
    topIssueId: `${slug}-neg`,
    rankHistory: Array.from({ length: 8 }, () => 1),
    rankDelta: 0,
    posMentions: 200,
    negMentions: 700,
    reach: 1_000_000,
    posReach: 200_000,
    negReach: 700_000,
  };
}

const SLUGS = ["mandiri", "pln", "telkom", "pertamina", "bni", "bri", "jasamarga"];

const TOPICS = {
  issues: [
    mkIssue({ id: "t0", title: "Investasi Hilirisasi Nikel", reach: 50_000_000, negMentions: 850, sentiment: -64 }),
    mkIssue({ id: "t1", title: "Topik Positif", reach: 5_000_000, negMentions: 80, posMentions: 700, sentiment: 50 }),
  ],
  summary: { total_impressions: 0, total_reach: 0, percentage: { positive: 22, negative: 70, neutral: 8 } },
};

const BOARD = {
  bumn: SLUGS.map((s, i) => mkBumn(s, -60 + i * 10)),
  issues: SLUGS.flatMap((s) => [
    mkIssue({ id: `${s}-neg`, title: `${s} negative`, relatedBumn: [s], reach: 9_000_000, posMentions: 100, negMentions: 800 }),
  ]),
};

// Calm window: no detected threat, so panel 2 uses the /topics fallback (A10 v5.2).
const THREATS_EMPTY = { threat: null, stats: { total_threats: 0, high_severity: 0, medium_severity: 0, low_severity: 0 } };

const ROSTER: ThreatDriver[] = [
  {
    handle: "neg_influencer",
    platform: "twitter",
    followers: 1_200_000,
    credibility: 7,
    riskLevel: "high",
    accountType: "Negative Critic",
    bot: false,
    engagement: 0,
    note: "kritik tata kelola",
    avatarUrl: "data:image/jpg;base64,AAAA",
  },
];

/** Route the fetch mock across all four Danantara endpoints. */
function stubFetch({ boardStatus = 200 } = {}) {
  const fetchMock = vi.fn(async (url: string) => {
    const u = String(url);
    if (u.includes("/actor-intelligence")) return new Response(JSON.stringify({ actors: ROSTER }), { status: 200 });
    if (u.includes("/threats")) return new Response(JSON.stringify(THREATS_EMPTY), { status: 200 });
    if (u.includes("bumn-board")) return new Response(JSON.stringify(BOARD), { status: boardStatus });
    return new Response(JSON.stringify(TOPICS), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("DanantaraCommandCenter (A13 — one-page)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("stacks the Crisis Gate and the CEO wall on one page (T2)", async () => {
    stubFetch();
    render(<DanantaraCommandCenter />);
    await waitFor(() => expect(screen.getByTestId("crisis-gate")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByTestId("ceo-wall")).toBeInTheDocument());
  });

  it("shows a single header — the wall's HeaderStrip is suppressed (T3)", async () => {
    stubFetch();
    render(<DanantaraCommandCenter />);
    await waitFor(() => expect(screen.getByTestId("ceo-wall")).toBeInTheDocument());
    expect(screen.queryByTestId("ceo-header")).not.toBeInTheDocument();
    // Exactly one Refresh control on the page.
    expect(screen.getAllByLabelText("Refresh")).toHaveLength(1);
  });

  it("one Refresh click refetches both blocks with fresh=1, with no double-fetch (T4)", async () => {
    const fetchMock = stubFetch();
    render(<DanantaraCommandCenter />);
    await waitFor(() => expect(screen.getByTestId("ceo-wall")).toBeInTheDocument());

    fetchMock.mockClear();
    fireEvent.click(screen.getByLabelText("Refresh"));

    await waitFor(() => {
      const urls = fetchMock.mock.calls.map((c) => String(c[0]));
      expect(urls.filter((u) => u.includes("/topics") && u.includes("fresh=1"))).toHaveLength(2);
      expect(urls.filter((u) => u.includes("/threats") && u.includes("fresh=1"))).toHaveLength(1);
      expect(urls.filter((u) => u.includes("/actor-intelligence") && u.includes("fresh=1"))).toHaveLength(1);
      expect(urls.filter((u) => u.includes("bumn-board") && u.includes("fresh=1"))).toHaveLength(1);
      // Exact total: 5 requests. More would mean onRefresh AND the nonce both fetched.
      expect(urls).toHaveLength(5);
    });
  });

  it("keeps the crisis index live when the BUMN board feed fails (T5)", async () => {
    stubFetch({ boardStatus: 502 });
    render(<DanantaraCommandCenter />);
    await waitFor(() => expect(screen.getByTestId("crisis-score").textContent).toMatch(/\d/));
    expect(screen.getByTestId("ceo-wall")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run components/danantara/ceo/DanantaraCommandCenter.test.tsx`
Expected: FAIL — `Failed to resolve import "./DanantaraCommandCenter"`.

- [ ] **Step 3: Write the container**

Create `components/danantara/ceo/DanantaraCommandCenter.tsx`:

```tsx
"use client";

import { useState } from "react";
import { CeoCommand } from "./CeoCommand";
import { CrisisGate } from "./CrisisGate";

/**
 * Danantara Command Center (A13) — the whole Danantara story on one continuously
 * scrolling page. The A10 **Crisis Gate** fills the first screen ("how bad is it,
 * what is it, who's driving it"); the A7 **CEO Command wall** scrolls in below it
 * (running narration, the topic board, the BUMN heatboard). One header, one refresh,
 * no route hop — so a boardroom display never blanks mid-read.
 *
 * Deliberately thin: it owns the refresh nonce and the scroll layout, nothing else.
 * Both blocks keep their own fetches and their own live/offline state, so one feed
 * failing degrades only its own block.
 */
export function DanantaraCommandCenter() {
  // Bumped by the gate's header Refresh; both blocks refetch on the change. The gate
  // delegates rather than fetching directly, so each feed is pulled exactly once.
  const [refreshNonce, setRefreshNonce] = useState(0);

  return (
    <div data-testid="danantara-command-center" className="flex flex-col gap-6">
      <CrisisGate
        embedded
        refreshNonce={refreshNonce}
        onRefresh={() => setRefreshNonce((n) => n + 1)}
      />
      <CeoCommand showHeader={false} refreshNonce={refreshNonce} />
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run components/danantara/ceo/DanantaraCommandCenter.test.tsx`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add components/danantara/ceo/DanantaraCommandCenter.tsx components/danantara/ceo/DanantaraCommandCenter.test.tsx
git commit -m "feat(a13): add DanantaraCommandCenter one-page container"
```

---

### Task 5: The `/danantara/command` route

**Files:**
- Create: `app/danantara/command/page.tsx`
- Test: `app/danantara/command/page.test.tsx`

**Interfaces:**
- Consumes: `DanantaraCommandCenter()` from Task 4.
- Produces: the route `/danantara/command`. Task 6 links the nav entry to it.

- [ ] **Step 1: Write the failing test**

Create `app/danantara/command/page.test.tsx`, mirroring the mock pattern in `app/danantara/page.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/layout/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));
vi.mock("@/components/danantara/ceo/DanantaraCommandCenter", () => ({
  DanantaraCommandCenter: () => <div data-testid="danantara-command-center" />,
}));

import Page from "./page";

describe("/danantara/command (A13 — T1)", () => {
  it("renders the Command Center inside AppShell", () => {
    render(<Page />);
    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
    expect(screen.getByTestId("danantara-command-center")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run app/danantara/command/page.test.tsx`
Expected: FAIL — `Failed to resolve import "./page"`.

- [ ] **Step 3: Write the route**

Create `app/danantara/command/page.tsx` (matches `app/danantara/page.tsx` exactly in shape — `AppShell.minimalChrome` already covers `/danantara/*`, so nothing else is needed):

```tsx
import { AppShell } from "@/components/layout/AppShell";
import { DanantaraCommandCenter } from "@/components/danantara/ceo/DanantaraCommandCenter";

export default function Page() {
  return (
    <AppShell>
      <DanantaraCommandCenter />
    </AppShell>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run app/danantara/command/page.test.tsx`
Expected: PASS — 1 test.

- [ ] **Step 5: Commit**

```bash
git add app/danantara/command/page.tsx app/danantara/command/page.test.tsx
git commit -m "feat(a13): add /danantara/command route"
```

---

### Task 6: Gear-menu nav entry

**Files:**
- Modify: `components/layout/AppShell.tsx:47` (insert one `NAV` entry after the Crisis Gate line)
- Test: `components/layout/AppShell.test.tsx` (append a new `describe`; **do not touch existing tests**)

**Interfaces:**
- Consumes: the route `/danantara/command` from Task 5.
- Produces: nothing consumed downstream.

- [ ] **Step 1: Write the failing test**

Append a new `describe` at the end of `components/layout/AppShell.test.tsx`. **Note the regex:** there is already an Operations-group nav item labelled plain "Command Center", so the query must include "Danantara" or it will match two links and throw.

```tsx
describe("AppShell gear menu — Danantara Command Center link (A13)", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ anomalies: [] }), { status: 200 })),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    document.cookie = "atlas_scope=; path=/; max-age=0";
  });

  it("links to /danantara/command from the gear menu (T8)", () => {
    pathname = "/";
    render(<AppShell>content</AppShell>);
    openGearMenu();

    // "Danantara" disambiguates from the Operations-group "Command Center" item.
    const link = screen.getByRole("link", { name: /danantara command center/i });
    expect(link).toHaveAttribute("href", "/danantara/command");
  });

  it("keeps the link on the minimal-chrome danantara pages for danantara-scoped users (T8)", () => {
    // The page runs minimal chrome (Dashboards group only) and a danantara-scoped
    // user is limited to /danantara* — the link must survive both filters.
    pathname = "/danantara/command";
    document.cookie = "atlas_scope=danantara; path=/";
    render(<AppShell>content</AppShell>);
    openGearMenu();

    const link = screen.getByRole("link", { name: /danantara command center/i });
    expect(link).toHaveAttribute("href", "/danantara/command");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run components/layout/AppShell.test.tsx`
Expected: FAIL — both new tests fail with "Unable to find an accessible element with the role link and name /danantara command center/i". Existing tests PASS.

- [ ] **Step 3: Add the nav entry**

Insert after `components/layout/AppShell.tsx:47` (the Crisis Gate line). `LayoutDashboard` is already imported on line 9 — no import change needed:

```tsx
  { to: "/danantara/command", label: "Danantara Command Center", icon: LayoutDashboard, group: "Dashboards" },
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run components/layout/AppShell.test.tsx`
Expected: PASS — existing tests + 2 new.

- [ ] **Step 5: Commit**

```bash
git add components/layout/AppShell.tsx components/layout/AppShell.test.tsx
git commit -m "feat(a13): add Danantara Command Center to the gear menu"
```

---

### Task 7: Full verification, live check, status → Built

**Files:**
- Modify: `docs/study-plans/atlas/3-act.md` (A13 status + revision row), `docs/study-plans/atlas/_index.md` (A13 status)

**Interfaces:**
- Consumes: everything from Tasks 1-6.
- Produces: nothing.

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: **434 passed** (420 baseline + 14 new: 4 CrisisGate, 3 CeoCommand, 4 container, 1 page, 2 AppShell). Per-file after the change: `CrisisGate.test.tsx` 11, `CeoCommand.test.tsx` 13, `DanantaraCommandCenter.test.tsx` 4, `app/danantara/command/page.test.tsx` 1, `AppShell.test.tsx` 6.

**If `CrisisGate.test.tsx` → "keeps panel 3 (roster) alive when the /threats feed itself fails" is the only failure, it is the known load-flake, not your regression.** Confirm with:

Run: `npx vitest run components/danantara/ceo/CrisisGate.test.tsx`
Expected: all PASS in isolation. If it also fails in isolation, you *have* broken it — stop and investigate.

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no output.

Run: `npm run lint`
Expected: no new errors versus the baseline.

- [ ] **Step 3: Live-verify the page in the dev server**

Run: `npm run dev`, then open `http://localhost:3000/danantara/command` (log in first — `middleware.ts` redirects `/` → `/login`).

Confirm by eye, against the spec's ACs:
- The Crisis Gate fills the first screen: gauge + band + score, the biggest-threat panel, the actors panel with real avatars **(AC1)**.
- There is exactly **one** header and **one** refresh button; no clock/totals strip above the ticker **(AC2)**.
- Scrolling down reveals the AI brief ticker, the issue board and the BUMN heatboard, with **no page navigation** **(AC3)**.
- Clicking Refresh spins the icon and both blocks update **(AC4)**.
- The gear menu lists "Danantara Command Center" **(AC6)**.

Then confirm the **regression** ACs — the whole point of the approach:
- `http://localhost:3000/danantara` looks exactly as before (header strip with clock + totals present).
- `http://localhost:3000/danantara/krisis` looks exactly as before (locked to one screen, its own refresh works).

- [ ] **Step 4: Flip the study-plan status to Built**

In `docs/study-plans/atlas/3-act.md`, change the A13 header `**Status:** In progress` → `**Status:** Built`, and append a revision row recording the real numbers:

```markdown
| 1.0 | 2026-07-30 | Built (TDD) — `DanantaraCommandCenter` + `/danantara/command`; opt-in props on `CrisisGate` (A10 v5.5) and `CeoCommand` (A7 v46.1). **+14 tests, 434 total green**, tsc + lint clean; live-verified (one header, one refresh → 5 `fresh=1` requests, continuous scroll, `/danantara` + `/danantara/krisis` unchanged). Status → Built |
```

In `docs/study-plans/atlas/_index.md`, change the A13 row's `In progress` → `Built`.

- [ ] **Step 5: Commit**

```bash
git add docs/study-plans/atlas/3-act.md docs/study-plans/atlas/_index.md
git commit -m "docs(a13): Danantara Command Center v1.0 Built"
```

- [ ] **Step 6 (OPTIONAL — only if the requester approves): de-flake the known CrisisGate test**

Out of scope for A13 and **not** required. It is a pure test-stability fix (no behaviour change, so no study plan needed per `CLAUDE.md`), worth doing because the flake makes the "existing tests stay green" gate hard to read.

The failure is a `waitFor` default 1000ms timeout under full-suite parallel load at `CrisisGate.test.tsx:159`. Fix by giving that file's roster-fallback assertions a longer window — do **not** change what they assert:

```tsx
    await waitFor(() => expect(screen.getByTestId("crisis-score").textContent).toMatch(/\d/), { timeout: 5000 });
    await waitFor(() => expect(screen.getByTestId("crisis-threat").textContent).toBeTruthy(), { timeout: 5000 });
```

Then run `npm test` three times; expect 434 green on all three.

```bash
git add components/danantara/ceo/CrisisGate.test.tsx
git commit -m "test(a10): de-flake the roster-fallback waitFor under full-suite load"
```

---

## Self-Review

**1. Spec coverage** — every spec section maps to a task:

| Spec section | Task |
|---|---|
| Route & shell (`app/danantara/command/page.tsx`, `minimalChrome`) | 5 |
| The container (`DanantaraCommandCenter`) | 4 |
| `embedded` prop | 2 |
| `showHeader` prop | 3 |
| `refreshNonce` prop (both components) | 2, 3 |
| `onRefresh` + the no-double-fetch rule | 2 (unit), 4 (integration, exact count) |
| Navigation (`NAV` entry) | 6 |
| Data flow / independent degradation | 4 (T5) |
| Tests T1-T6 | 5, 4, 4, 4, 4, 2 |
| Regression gate (existing tests unedited) | 2, 3 (T7) + 7 (full suite) |
| Versioning (A13 v1.0, A7 v46.1, A10 v5.5) | 1, 7 |

**2. Placeholder scan** — no TBD/TODO; every code step carries the actual code; no "similar to Task N".

**3. Type consistency** — `embedded: boolean`, `showHeader: boolean`, `refreshNonce: number`, `onRefresh: () => void` are used identically in Tasks 2, 3 and 4. `data-testid` values are consistent throughout: `crisis-gate`, `crisis-score`, `ceo-wall`, `ceo-header`, `danantara-command-center`, `app-shell`. The container's export name `DanantaraCommandCenter` matches the Task 5 import and the Task 5 `vi.mock` path.

**Two ambiguities caught and fixed during this review:**
- The AppShell nav test originally queried `/command center/i`, which would have **matched two links** — there is already an Operations-group item labelled plain "Command Center". Task 6 now queries `/danantara command center/i` and flags why.
- Task 7's expected test count is stated as an absolute (434) with the per-file breakdown, so a partial run cannot be mistaken for success. **The first draft of this plan said 433** — it assumed `CeoCommand.test.tsx` had 11 existing tests when it has 10. Counts are now measured (`grep -c "  it("`), not estimated: CrisisGate 7, CeoCommand 10, AppShell 4.
