# Danantara CEO Command Wall Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/danantara` as a zero-click CEO command wall (top-20 issues, top-20 BUMN sentiment, breaking-news escalation takeover); move the existing dashboard to `/danantara-v2`.

**Architecture:** Pure client-side demo (no DB/API). A deterministic simulation engine (`lib/danantara/ceo/engine.ts`, pure functions) drives a single React orchestrator (`CeoCommand`) on one shared 4 s tick. All display components are presentational. The old `SovereignCommand` is untouched and re-exposed at `/danantara-v2`.

**Tech Stack:** Next.js 16 (app router, existing patterns), React 19, Tailwind v4 tokens, lucide-react, vitest + @testing-library/react (new — repo has no test runner yet).

**Spec:** `docs/superpowers/specs/2026-06-02-danantara-ceo-command-design.md` · **Study plan:** A7 in `docs/study-plans/atlas/3-act.md`

---

## File structure

| File | Responsibility |
|---|---|
| `vitest.config.ts`, `vitest.setup.ts` | Test runner config (new — none exists) |
| `app/danantara-v2/page.tsx` | OLD dashboard, pure move (AC6) |
| `app/danantara/page.tsx` | Rewritten → renders `CeoCommand` (AC1) |
| `app/danantara-v2/page.test.tsx`, `app/danantara/page.test.tsx` | Page composition tests (T6, T1-part) |
| `components/layout/AppShell.tsx` | Nav: add v2 entry, rename CEO entry, scope filter |
| `lib/danantara/ceo/types.ts` | `CeoIssue`, `BumnSentiment`, `EscalationArc`, `CeoState` |
| `lib/danantara/ceo/engine.ts` | PRNG, velocity, status ladder, ranking, tick, spotlight queue, brief lines |
| `lib/danantara/ceo/engine.test.ts` | Unit tests T2–T5 |
| `lib/danantara/ceo/data.ts` | 20 curated issues + 20 BUMN + demo arcs + initial state |
| `lib/danantara/ceo/data.test.ts` | Data validation (counts, required fields) |
| `components/danantara/ceo/CeoCommand.tsx` | Orchestrator: tick clock, escalation events, layout (AC1, AC7) |
| `components/danantara/ceo/CeoCommand.test.tsx` | T1, T4-component, T7 |
| `components/danantara/ceo/HeaderStrip.tsx` | Headline numbers + LIVE badge + clock |
| `components/danantara/ceo/IssueBoard.tsx` | Top-20 issues ranked board (AC2) |
| `components/danantara/ceo/BumnHeatboard.tsx` | Top-20 BUMN heatmap (AC3) |
| `components/danantara/ceo/Spotlight.tsx` | Auto-rotating deep-dive |
| `components/danantara/ceo/BreakingTakeover.tsx` | Full-screen escalation interrupt (AC4) |
| `components/danantara/ceo/AiBriefTicker.tsx` | Bottom narration strip |
| `components/danantara/ceo/Sparkline.tsx` | Shared inline-SVG sparkline |
| `app/globals.css` | Add siren/takeover keyframes |

Conventions to follow (from existing code):

- Components: `"use client"`, named exports, `cn()` from `@/lib/utils`, lucide icons, Tailwind tokens (`bg-card/60`, `border-border`, `text-success/warning/destructive`, `.panel`).
- Data/UI helpers: Indonesian labels, oklch colors from `lib/danantara/ui.ts` (`SOV_COLORS`, `withAlpha`, `fmtPct`).
- Commit style: `feat(danantara): …`, `test(danantara): …`, `chore: …`.

---

### Task 1: Vitest test infrastructure

The repo has **no test runner**. Install vitest + React Testing Library, configure for the `@/*` path alias and jsdom.

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `lib/danantara/ceo/smoke.test.ts` (deleted again in Task 3)

- [ ] **Step 1: Install dev dependencies**

Run:
```bash
npm i -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
```
(The repo uses npm — `package-lock.json` is the lock file.)

- [ ] **Step 2: Add test scripts to package.json**

In `package.json` `"scripts"`:
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 3: Create vitest.config.ts**

```ts
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["app/**/*.test.{ts,tsx}", "components/**/*.test.{ts,tsx}", "lib/**/*.test.{ts,tsx}"],
  },
});
```

- [ ] **Step 4: Create vitest.setup.ts**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 5: Create a temporary smoke test**

`lib/danantara/ceo/smoke.test.ts`:
```ts
import { describe, expect, it } from "vitest";

describe("test infrastructure", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Run tests, verify pass**

Run: `npm test`
Expected: `1 passed` (smoke.test.ts)

- [ ] **Step 7: Verify lint and build still pass**

Run: `npm run lint` then `npm run build`
Expected: both succeed (vitest config must not break the Next build).

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vitest.config.ts vitest.setup.ts lib/danantara/ceo/smoke.test.ts
git commit -m "chore: add vitest + testing-library infrastructure"
```

---

### Task 2: Move old dashboard to /danantara-v2 (AC6)

**Files:**
- Create: `app/danantara-v2/page.tsx`
- Create: `app/danantara-v2/page.test.tsx`
- Modify: `components/layout/AppShell.tsx:39-57` (NAV) and `:71` (scope filter)

- [ ] **Step 1: Write the failing composition test**

`app/danantara-v2/page.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/layout/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));
vi.mock("@/components/danantara/SovereignCommand", () => ({
  SovereignCommand: () => <div data-testid="sovereign-command" />,
}));

import Page from "./page";

describe("/danantara-v2 (T6 / AC6)", () => {
  it("renders the old SovereignCommand inside AppShell", () => {
    render(<Page />);
    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
    expect(screen.getByTestId("sovereign-command")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/danantara-v2`
Expected: FAIL — `Cannot find module './page'`

- [ ] **Step 3: Create the page (exact copy of today's app/danantara/page.tsx)**

`app/danantara-v2/page.tsx`:
```tsx
import { AppShell } from "@/components/layout/AppShell";
import { SovereignCommand } from "@/components/danantara/SovereignCommand";

export default function Page() {
  return (
    <AppShell>
      <SovereignCommand />
    </AppShell>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/danantara-v2`
Expected: PASS

- [ ] **Step 5: Update AppShell nav**

In `components/layout/AppShell.tsx`, replace the Danantara NAV entry (line 42):
```tsx
  { to: "/danantara", label: "Danantara CEO Command", icon: Landmark, group: "Dashboards" },
  { to: "/danantara-v2", label: "Danantara Sovereign Command (v2)", icon: Landmark, group: "Dashboards" },
```

And replace the scope filter (line 71):
```tsx
  const nav = scope === "danantara" ? NAV.filter((n) => n.to.startsWith("/danantara")) : NAV;
```

- [ ] **Step 6: Verify in dev server**

Run: `npm run dev`, open `http://localhost:3000/danantara-v2`
Expected: the existing Sovereign Command dashboard renders fully (boards, tabs, ticker). `/danantara` still shows the old dashboard too (rewritten in Task 10).

- [ ] **Step 7: Commit**

```bash
git add app/danantara-v2 components/layout/AppShell.tsx
git commit -m "feat(danantara): expose Sovereign Command at /danantara-v2 ahead of CEO rebuild"
```

---

### Task 3: CEO types & engine constants

**Files:**
- Create: `lib/danantara/ceo/types.ts`
- Delete: `lib/danantara/ceo/smoke.test.ts`

- [ ] **Step 1: Create types.ts**

```ts
import type { SectorKey } from "@/lib/danantara/types";

/** Issue taxonomy for the CEO board (Indonesian labels live in data/ui). */
export type IssueCategory = "tata-kelola" | "investasi" | "kebijakan" | "pasar" | "sosial";

/** Escalation ladder. Transitions computed by engine.statusOf(). */
export type IssueStatus = "normal" | "rising" | "escalating";

export interface IssueHeadline {
  source: string; // "Kompas", "CNBC Indonesia", "X"
  title: string;
  time: string; // "2 jam lalu"
}

/** One of the top-20 issues around Danantara. All figures from public signals. */
export interface CeoIssue {
  id: string;
  title: string;
  category: IssueCategory;
  relatedBumn: string[]; // BumnSentiment ids
  mentions: number; // cumulative mentions (running)
  reach: number; // estimated audience reached
  sentiment: number; // -100 (hostile) .. 100 (supportive)
  history: number[]; // mentions per tick, oldest → newest
  headlines: IssueHeadline[];
  aiLine: string; // one-line AI read for the spotlight
  velocity: number; // % mention growth over the rolling window (derived)
  status: IssueStatus; // derived
}

/** One of the top-20 BUMN, scored by net public sentiment. */
export interface BumnSentiment {
  id: string;
  name: string;
  short: string; // tile label
  sector: SectorKey;
  sentiment: number; // -100..100 net sentiment
  mentions: number;
  trend: number[]; // sentiment history for the spark, oldest → newest
  topIssueId?: string; // dominant CeoIssue id
}

/** A scripted mention-spike so a live demo reliably triggers the takeover (AC5). */
export interface EscalationArc {
  issueId: string;
  atTick: number; // arc starts at this tick count
  rampTicks: number; // how many ticks the spike lasts
  growthPerTick: number; // e.g. 0.4 = +40% mentions per tick while ramping
}

/** The whole board state. Engine.tick() maps CeoState → CeoState. */
export interface CeoState {
  tickCount: number;
  issues: CeoIssue[]; // ALWAYS sorted by reach desc (rankIssues)
  bumn: BumnSentiment[]; // ALWAYS sorted most-negative first (rankBumn)
}
```

- [ ] **Step 2: Delete the smoke test**

```bash
rm lib/danantara/ceo/smoke.test.ts
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/danantara/ceo/types.ts
git rm lib/danantara/ceo/smoke.test.ts
git commit -m "feat(danantara): CEO command wall types"
```

---

### Task 4: Engine — PRNG + velocity (T2-part, TDD)

**Files:**
- Create: `lib/danantara/ceo/engine.test.ts`
- Create: `lib/danantara/ceo/engine.ts`

- [ ] **Step 1: Write failing tests**

`lib/danantara/ceo/engine.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { mulberry32, velocity, VELOCITY_WINDOW } from "./engine";

describe("mulberry32 PRNG", () => {
  it("is deterministic for the same seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("returns values in [0, 1)", () => {
    const r = mulberry32(7);
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("velocity (T2)", () => {
  it("computes % growth over the rolling window", () => {
    // window of 6: first = 100, last = 340 → +240%
    const history = [100, 120, 150, 200, 260, 340];
    expect(velocity(history)).toBeCloseTo(240, 0);
  });

  it("only looks at the last VELOCITY_WINDOW entries", () => {
    const history = [9999, 9999, 100, 120, 150, 200, 260, 340];
    expect(velocity(history)).toBeCloseTo(240, 0);
    expect(VELOCITY_WINDOW).toBe(6);
  });

  it("returns 0 for flat history", () => {
    expect(velocity([500, 500, 500, 500, 500, 500])).toBe(0);
  });

  it("returns 0 when history is shorter than 2 entries", () => {
    expect(velocity([100])).toBe(0);
    expect(velocity([])).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run lib/danantara/ceo`
Expected: FAIL — `Cannot find module './engine'`

- [ ] **Step 3: Implement minimal engine.ts**

```ts
/**
 * Pure simulation engine for the CEO command wall. Every function here is
 * deterministic given its inputs (PRNG is injected) so the whole board is
 * unit-testable. UI components never compute — they only display.
 */

/** Velocity rolling window in ticks (UI labels it "2 jam terakhir"). */
export const VELOCITY_WINDOW = 6;
/** Velocity (%) at which an issue becomes "rising". */
export const RISING_THRESHOLD = 80;
/** Velocity (%) at which an issue can become "escalating". */
export const ESCALATING_THRESHOLD = 200;
/** Minimum reach for a full escalation (filter out small-but-fast issues). */
export const REACH_FLOOR = 5_000_000;

/** Small deterministic PRNG (mulberry32) so ticks are reproducible in tests. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** % growth of mentions across the last `window` entries of history. */
export function velocity(history: number[], window = VELOCITY_WINDOW): number {
  const slice = history.slice(-window);
  if (slice.length < 2) return 0;
  const first = slice[0];
  const last = slice[slice.length - 1];
  if (first <= 0) return 0;
  return ((last - first) / first) * 100;
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run lib/danantara/ceo`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/danantara/ceo/engine.ts lib/danantara/ceo/engine.test.ts
git commit -m "feat(danantara): CEO engine — deterministic PRNG + mention velocity"
```

---

### Task 5: Engine — status ladder with cooldown (T4-unit, TDD)

**Files:**
- Modify: `lib/danantara/ceo/engine.test.ts` (append)
- Modify: `lib/danantara/ceo/engine.ts` (append)

- [ ] **Step 1: Append failing tests**

Append to `lib/danantara/ceo/engine.test.ts`:
```ts
import { statusOf } from "./engine";

describe("statusOf ladder (T4 / AC4)", () => {
  it("normal when velocity is low", () => {
    expect(statusOf(10, 10_000_000, "normal")).toBe("normal");
  });

  it("rising above +80%", () => {
    expect(statusOf(81, 1_000_000, "normal")).toBe("rising");
  });

  it("escalating above +200% with reach over the 5M floor", () => {
    expect(statusOf(201, 5_000_001, "rising")).toBe("escalating");
  });

  it("NOT escalating above +200% when reach is under the floor", () => {
    expect(statusOf(300, 4_999_999, "rising")).toBe("rising");
  });

  it("stays escalating while velocity is above the rising threshold (cooldown)", () => {
    expect(statusOf(120, 6_000_000, "escalating")).toBe("escalating");
  });

  it("cools from escalating to rising-equivalent only below +80%", () => {
    expect(statusOf(79, 6_000_000, "escalating")).toBe("normal");
  });
});
```

Also update the existing import line at the top of the test file to pull everything from one import:
```ts
import { mulberry32, statusOf, velocity, VELOCITY_WINDOW } from "./engine";
```
(and remove the duplicate `import { statusOf } from "./engine";` line)

- [ ] **Step 2: Run tests, verify new ones fail**

Run: `npx vitest run lib/danantara/ceo`
Expected: FAIL — `statusOf is not a function` (or export missing)

- [ ] **Step 3: Implement statusOf**

Append to `lib/danantara/ceo/engine.ts`:
```ts
import type { IssueStatus } from "./types";

/**
 * Escalation ladder with hysteresis: once escalating, an issue stays pinned
 * until its velocity cools below the RISING threshold (so the takeover/pin
 * doesn't flicker on noisy data).
 */
export function statusOf(vel: number, reach: number, prev: IssueStatus): IssueStatus {
  if (vel >= ESCALATING_THRESHOLD && reach >= REACH_FLOOR) return "escalating";
  if (prev === "escalating" && vel >= RISING_THRESHOLD) return "escalating";
  if (vel >= RISING_THRESHOLD) return "rising";
  return "normal";
}
```
(Move the `import type { IssueStatus } from "./types";` line to the TOP of engine.ts with the other imports — imports must be first.)

- [ ] **Step 4: Run tests, verify pass**

Run: `npx vitest run lib/danantara/ceo`
Expected: PASS (12 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/danantara/ceo/engine.ts lib/danantara/ceo/engine.test.ts
git commit -m "feat(danantara): CEO engine — escalation status ladder with cooldown"
```

---

### Task 6: Engine — ranking (T2, T3, TDD)

**Files:**
- Modify: `lib/danantara/ceo/engine.test.ts` (append)
- Modify: `lib/danantara/ceo/engine.ts` (append)

- [ ] **Step 1: Append failing tests**

Append to `lib/danantara/ceo/engine.test.ts` (add `rankBumn, rankIssues` to the import from `./engine`; also `import type { BumnSentiment, CeoIssue } from "./types";`):
```ts
/** Minimal valid CeoIssue for tests. */
export function makeIssue(over: Partial<CeoIssue> & { id: string }): CeoIssue {
  return {
    title: over.id,
    category: "tata-kelola",
    relatedBumn: [],
    mentions: 1000,
    reach: 1_000_000,
    sentiment: 0,
    history: [1000, 1000, 1000, 1000, 1000, 1000],
    headlines: [],
    aiLine: "",
    velocity: 0,
    status: "normal",
    ...over,
  };
}

/** Minimal valid BumnSentiment for tests. */
export function makeBumn(over: Partial<BumnSentiment> & { id: string }): BumnSentiment {
  return {
    name: over.id,
    short: over.id,
    sector: "energi",
    sentiment: 0,
    mentions: 100,
    trend: [0, 0, 0],
    ...over,
  };
}

describe("rankIssues (T2 / AC2)", () => {
  it("sorts by reach descending", () => {
    const ranked = rankIssues([
      makeIssue({ id: "low", reach: 100 }),
      makeIssue({ id: "high", reach: 9000 }),
      makeIssue({ id: "mid", reach: 5000 }),
    ]);
    expect(ranked.map((i) => i.id)).toEqual(["high", "mid", "low"]);
  });

  it("does not mutate the input array", () => {
    const input = [makeIssue({ id: "a", reach: 1 }), makeIssue({ id: "b", reach: 2 })];
    rankIssues(input);
    expect(input.map((i) => i.id)).toEqual(["a", "b"]);
  });
});

describe("rankBumn (T3 / AC3)", () => {
  it("sorts most-negative sentiment first", () => {
    const ranked = rankBumn([
      makeBumn({ id: "good", sentiment: 60 }),
      makeBumn({ id: "bad", sentiment: -70 }),
      makeBumn({ id: "neutral", sentiment: 0 }),
    ]);
    expect(ranked.map((b) => b.id)).toEqual(["bad", "neutral", "good"]);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run lib/danantara/ceo`
Expected: FAIL — `rankIssues is not a function`

- [ ] **Step 3: Implement ranking**

Append to `lib/danantara/ceo/engine.ts` (add `BumnSentiment, CeoIssue` to the type import at top):
```ts
/** Issues ranked by estimated audience reach, biggest first. */
export function rankIssues(issues: CeoIssue[]): CeoIssue[] {
  return [...issues].sort((a, b) => b.reach - a.reach);
}

/** BUMN ranked most-negative first — the CEO's job is spotting problems. */
export function rankBumn(rows: BumnSentiment[]): BumnSentiment[] {
  return [...rows].sort((a, b) => a.sentiment - b.sentiment);
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npx vitest run lib/danantara/ceo`
Expected: PASS (15 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/danantara/ceo/engine.ts lib/danantara/ceo/engine.test.ts
git commit -m "feat(danantara): CEO engine — issue & BUMN ranking"
```

---

### Task 7: Engine — tick + scripted arcs (T2, T5, TDD)

**Files:**
- Modify: `lib/danantara/ceo/engine.test.ts` (append)
- Modify: `lib/danantara/ceo/engine.ts` (append)

- [ ] **Step 1: Append failing tests**

Append to `lib/danantara/ceo/engine.test.ts` (add `tick` and `HISTORY_LIMIT` to the engine import; `import type { CeoState, EscalationArc } from "./types";`):
```ts
function makeState(issues: CeoIssue[], bumn: BumnSentiment[] = [], tickCount = 0): CeoState {
  return { tickCount, issues: rankIssues(issues), bumn: rankBumn(bumn) };
}

describe("tick (T2 / AC2)", () => {
  it("increments tickCount and grows mentions monotonically", () => {
    const state = makeState([makeIssue({ id: "a", mentions: 1000, reach: 1_000_000 })]);
    const next = tick(state, mulberry32(1), []);
    expect(next.tickCount).toBe(1);
    expect(next.issues[0].mentions).toBeGreaterThan(1000);
    expect(next.issues[0].reach).toBeGreaterThan(1_000_000);
  });

  it("appends to history and caps it at HISTORY_LIMIT", () => {
    const longHistory = Array.from({ length: 50 }, (_, i) => 100 + i);
    const state = makeState([makeIssue({ id: "a", history: longHistory })]);
    const next = tick(state, mulberry32(1), []);
    expect(next.issues[0].history.length).toBeLessThanOrEqual(HISTORY_LIMIT);
    expect(next.issues[0].history[next.issues[0].history.length - 1]).toBe(next.issues[0].mentions);
  });

  it("keeps issues ranked by reach and bumn by sentiment after ticking", () => {
    const state = makeState(
      [makeIssue({ id: "a", reach: 100 }), makeIssue({ id: "b", reach: 200 })],
      [makeBumn({ id: "x", sentiment: 50 }), makeBumn({ id: "y", sentiment: -50 })],
    );
    const next = tick(state, mulberry32(1), []);
    for (let i = 1; i < next.issues.length; i++) {
      expect(next.issues[i - 1].reach).toBeGreaterThanOrEqual(next.issues[i].reach);
    }
    for (let i = 1; i < next.bumn.length; i++) {
      expect(next.bumn[i - 1].sentiment).toBeLessThanOrEqual(next.bumn[i].sentiment);
    }
  });

  it("recomputes velocity and status each tick", () => {
    const state = makeState([makeIssue({ id: "a" })]);
    const next = tick(state, mulberry32(1), []);
    expect(typeof next.issues[0].velocity).toBe("number");
    expect(["normal", "rising", "escalating"]).toContain(next.issues[0].status);
  });

  it("is deterministic for the same PRNG seed", () => {
    const state = makeState([makeIssue({ id: "a" })]);
    const a = tick(state, mulberry32(99), []);
    const b = tick(state, mulberry32(99), []);
    expect(a.issues[0].mentions).toBe(b.issues[0].mentions);
  });

  it("does not mutate the previous state", () => {
    const state = makeState([makeIssue({ id: "a", mentions: 1000 })]);
    tick(state, mulberry32(1), []);
    expect(state.issues[0].mentions).toBe(1000);
    expect(state.tickCount).toBe(0);
  });
});

describe("scripted escalation arcs (T5 / AC5)", () => {
  const arc: EscalationArc = { issueId: "target", atTick: 3, rampTicks: 5, growthPerTick: 0.45 };

  it("does not spike before atTick", () => {
    const state = makeState([makeIssue({ id: "target", mentions: 1000, reach: 6_000_000 })], [], 0);
    const next = tick(state, mulberry32(1), [arc]);
    // organic growth only: well under +10% in one tick
    expect(next.issues[0].mentions).toBeLessThan(1100);
  });

  it("spikes mentions by growthPerTick while the arc is active", () => {
    const state = makeState([makeIssue({ id: "target", mentions: 1000, reach: 6_000_000 })], [], 3);
    const next = tick(state, mulberry32(1), [arc]);
    // 45% growth ± organic noise
    expect(next.issues[0].mentions).toBeGreaterThanOrEqual(1400);
  });

  it("reliably reaches escalating status by the end of the ramp", () => {
    let state = makeState(
      [makeIssue({ id: "target", mentions: 1000, reach: 6_000_000, history: [1000, 1000, 1000, 1000, 1000, 1000] })],
      [],
      3,
    );
    const rand = mulberry32(1);
    for (let i = 0; i < arc.rampTicks; i++) {
      state = tick(state, rand, [arc]);
    }
    expect(state.issues[0].status).toBe("escalating");
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run lib/danantara/ceo`
Expected: FAIL — `tick is not a function` / `HISTORY_LIMIT` undefined

- [ ] **Step 3: Implement tick**

Append to `lib/danantara/ceo/engine.ts` (add `CeoState, EscalationArc` to the type import):
```ts
/** Max history entries kept per issue (~24 ticks ≈ 96 s of wall time). */
export const HISTORY_LIMIT = 24;

/** Organic per-tick mention growth range (0.5%–3%). */
const ORGANIC_MIN = 0.005;
const ORGANIC_MAX = 0.03;
/** Reach grows faster than mentions (each mention reaches many people). */
const REACH_FACTOR = 3;
/** BUMN sentiment random drift per tick (± points). */
const SENTIMENT_DRIFT = 1.5;

/** Advance the whole board one step. Pure: returns a new state. */
export function tick(state: CeoState, rand: () => number, arcs: EscalationArc[]): CeoState {
  const tickCount = state.tickCount + 1;

  const issues = state.issues.map((issue) => {
    const arc = arcs.find(
      (a) => a.issueId === issue.id && state.tickCount >= a.atTick && state.tickCount < a.atTick + a.rampTicks,
    );
    const organic = ORGANIC_MIN + rand() * (ORGANIC_MAX - ORGANIC_MIN);
    const growth = arc ? arc.growthPerTick + organic : organic;

    const mentions = Math.round(issue.mentions * (1 + growth));
    const reach = Math.round(issue.reach * (1 + growth * REACH_FACTOR));
    const history = [...issue.history, mentions].slice(-HISTORY_LIMIT);
    const vel = velocity(history);
    const status = statusOf(vel, reach, issue.status);

    return { ...issue, mentions, reach, history, velocity: vel, status };
  });

  const bumn = state.bumn.map((row) => {
    const drift = (rand() * 2 - 1) * SENTIMENT_DRIFT;
    const sentiment = Math.max(-100, Math.min(100, row.sentiment + drift));
    const trend = [...row.trend, sentiment].slice(-HISTORY_LIMIT);
    return { ...row, sentiment, trend };
  });

  return { tickCount, issues: rankIssues(issues), bumn: rankBumn(bumn) };
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npx vitest run lib/danantara/ceo`
Expected: PASS (24 tests). If the "reliably reaches escalating" test fails, check the math: 5 ramp ticks at +45% ≈ 6.4× over a 6-tick window = +540% velocity — well past the +200% threshold; the bug is in the implementation, not the test.

- [ ] **Step 5: Commit**

```bash
git add lib/danantara/ceo/engine.ts lib/danantara/ceo/engine.test.ts
git commit -m "feat(danantara): CEO engine — simulation tick with scripted escalation arcs"
```

---

### Task 8: Engine — spotlight queue + AI brief lines (TDD)

**Files:**
- Modify: `lib/danantara/ceo/engine.test.ts` (append)
- Modify: `lib/danantara/ceo/engine.ts` (append)

- [ ] **Step 1: Append failing tests**

Append to `lib/danantara/ceo/engine.test.ts` (add `briefLines, spotlightQueue` to the engine import):
```ts
describe("spotlightQueue", () => {
  it("returns issue ids in reach order when nothing escalates", () => {
    const issues = rankIssues([
      makeIssue({ id: "big", reach: 9000 }),
      makeIssue({ id: "small", reach: 100 }),
    ]);
    expect(spotlightQueue(issues)).toEqual(["big", "small"]);
  });

  it("pins escalating issues to the front, ordered by velocity", () => {
    const issues = rankIssues([
      makeIssue({ id: "big", reach: 9000 }),
      makeIssue({ id: "esc-slow", reach: 100, status: "escalating", velocity: 210 }),
      makeIssue({ id: "esc-fast", reach: 50, status: "escalating", velocity: 400 }),
    ]);
    expect(spotlightQueue(issues)).toEqual(["esc-fast", "esc-slow", "big"]);
  });
});

describe("briefLines", () => {
  it("includes total mentions and the top issue", () => {
    const state = makeState(
      [makeIssue({ id: "a", title: "Isu Utama", mentions: 5000, reach: 9000 })],
      [makeBumn({ id: "prt", name: "Pertamina", sentiment: -40 })],
    );
    const lines = briefLines(state);
    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(lines.join(" ")).toContain("Isu Utama");
    expect(lines.join(" ")).toContain("Pertamina");
  });

  it("leads with an escalation warning when an issue is escalating", () => {
    const state = makeState([
      makeIssue({ id: "a", title: "Isu Meledak", status: "escalating", velocity: 320, reach: 9_000_000 }),
    ]);
    const lines = briefLines(state);
    expect(lines[0]).toContain("Isu Meledak");
    expect(lines[0].toUpperCase()).toContain("ESKALASI");
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run lib/danantara/ceo`
Expected: FAIL — `spotlightQueue is not a function`

- [ ] **Step 3: Implement**

Append to `lib/danantara/ceo/engine.ts`:
```ts
/** Spotlight rotation order: escalating issues pin first (fastest spike first). */
export function spotlightQueue(rankedIssues: CeoIssue[]): string[] {
  const escalating = rankedIssues
    .filter((i) => i.status === "escalating")
    .sort((a, b) => b.velocity - a.velocity);
  const rest = rankedIssues.filter((i) => i.status !== "escalating");
  return [...escalating, ...rest].map((i) => i.id);
}

/** Deterministic Indonesian narration for the AI brief ticker (no LLM — scripted fallback pattern). */
export function briefLines(state: CeoState): string[] {
  const lines: string[] = [];
  const totalMentions = state.issues.reduce((a, i) => a + i.mentions, 0);
  const escalating = state.issues.filter((i) => i.status === "escalating");
  const rising = state.issues.filter((i) => i.status === "rising");
  const topIssue = state.issues[0];
  const worstBumn = state.bumn[0];

  for (const issue of escalating) {
    lines.push(
      `⚠ ESKALASI: "${issue.title}" naik ${Math.round(issue.velocity)}% dalam 2 jam — jangkauan ${(issue.reach / 1_000_000).toFixed(1)} jt akun.`,
    );
  }
  lines.push(
    `Nexorus AI memantau ${state.issues.length} isu utama · total ${totalMentions.toLocaleString("id-ID")} sebutan publik.`,
  );
  if (topIssue) {
    lines.push(`Isu terbesar hari ini: "${topIssue.title}" (jangkauan ${(topIssue.reach / 1_000_000).toFixed(1)} jt).`);
  }
  if (rising.length > 0) {
    lines.push(`${rising.length} isu berstatus NAIK: ${rising.map((i) => `"${i.title}"`).join(", ")}.`);
  }
  if (worstBumn) {
    lines.push(
      `Sentimen BUMN paling tertekan: ${worstBumn.name} (${Math.round(worstBumn.sentiment)}). Perlu perhatian komunikasi publik.`,
    );
  }
  return lines;
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npx vitest run lib/danantara/ceo`
Expected: PASS (28 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/danantara/ceo/engine.ts lib/danantara/ceo/engine.test.ts
git commit -m "feat(danantara): CEO engine — spotlight queue + scripted AI brief lines"
```

---

### Task 9: Data — 20 curated issues + 20 BUMN + demo arcs

**Files:**
- Create: `lib/danantara/ceo/data.test.ts`
- Create: `lib/danantara/ceo/data.ts`

- [ ] **Step 1: Write failing validation tests**

`lib/danantara/ceo/data.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { REACH_FLOOR, VELOCITY_WINDOW } from "./engine";
import { buildInitialState, DEMO_ARCS, TICK_MS } from "./data";

describe("CEO board data", () => {
  const state = buildInitialState();

  it("has exactly 20 issues (AC1)", () => {
    expect(state.issues).toHaveLength(20);
  });

  it("has exactly 20 BUMN (AC3)", () => {
    expect(state.bumn).toHaveLength(20);
  });

  it("issues are pre-ranked by reach desc", () => {
    for (let i = 1; i < state.issues.length; i++) {
      expect(state.issues[i - 1].reach).toBeGreaterThanOrEqual(state.issues[i].reach);
    }
  });

  it("bumn are pre-ranked most-negative first", () => {
    for (let i = 1; i < state.bumn.length; i++) {
      expect(state.bumn[i - 1].sentiment).toBeLessThanOrEqual(state.bumn[i].sentiment);
    }
  });

  it("every issue has full display content", () => {
    for (const issue of state.issues) {
      expect(issue.title.length).toBeGreaterThan(0);
      expect(issue.headlines.length).toBeGreaterThanOrEqual(2);
      expect(issue.aiLine.length).toBeGreaterThan(0);
      expect(issue.history.length).toBeGreaterThanOrEqual(VELOCITY_WINDOW);
      expect(issue.relatedBumn.length).toBeGreaterThan(0);
    }
  });

  it("every issue starts calm (no escalation at load)", () => {
    for (const issue of state.issues) {
      expect(issue.status).toBe("normal");
    }
  });

  it("BUMN sentiment values are within -100..100", () => {
    for (const row of state.bumn) {
      expect(row.sentiment).toBeGreaterThanOrEqual(-100);
      expect(row.sentiment).toBeLessThanOrEqual(100);
    }
  });

  it("issue relatedBumn ids all resolve to real BUMN", () => {
    const ids = new Set(state.bumn.map((b) => b.id));
    for (const issue of state.issues) {
      for (const ref of issue.relatedBumn) {
        expect(ids.has(ref)).toBe(true);
      }
    }
  });

  it("demo arcs reference real issues with enough reach to escalate (AC5)", () => {
    const byId = new Map(state.issues.map((i) => [i.id, i]));
    expect(DEMO_ARCS.length).toBeGreaterThanOrEqual(2);
    for (const arc of DEMO_ARCS) {
      const issue = byId.get(arc.issueId);
      expect(issue).toBeDefined();
      expect(issue!.reach).toBeGreaterThanOrEqual(REACH_FLOOR);
    }
    // first arc fires ~60 s in: tick 15 at 4 s/tick
    expect(DEMO_ARCS[0].atTick * TICK_MS).toBeGreaterThanOrEqual(40_000);
    expect(DEMO_ARCS[0].atTick * TICK_MS).toBeLessThanOrEqual(80_000);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run lib/danantara/ceo/data`
Expected: FAIL — `Cannot find module './data'`

- [ ] **Step 3: Create data.ts with the full curated content**

`lib/danantara/ceo/data.ts` — **complete file** (curated from public coverage; all figures synthetic but plausible):

```ts
import { rankBumn, rankIssues } from "./engine";
import type { BumnSentiment, CeoIssue, CeoState, EscalationArc, IssueCategory, IssueHeadline } from "./types";

/** Wall-clock between simulation ticks (ms). */
export const TICK_MS = 4_000;
/** Spotlight rotation interval (ms). */
export const SPOTLIGHT_MS = 10_000;
/** Breaking takeover display duration (ms). */
export const TAKEOVER_MS = 5_000;

/* ----------------------------- 20 BUMN ----------------------------- */

type BumnSeed = Omit<BumnSentiment, "trend">;

const BUMN_SEEDS: BumnSeed[] = [
  { id: "garuda", name: "Garuda Indonesia", short: "GIAA", sector: "infrastruktur", sentiment: -52, mentions: 8400, topIssueId: "isu-garuda" },
  { id: "waskita", name: "Waskita Karya", short: "WSKT", sector: "infrastruktur", sentiment: -45, mentions: 5200, topIssueId: "isu-karya" },
  { id: "wika", name: "Wijaya Karya", short: "WIKA", sector: "infrastruktur", sentiment: -38, mentions: 4100, topIssueId: "isu-karya" },
  { id: "pln", name: "PLN", short: "PLN", sector: "energi", sentiment: -24, mentions: 11200, topIssueId: "isu-tarif-listrik" },
  { id: "bulog", name: "Perum Bulog", short: "Bulog", sector: "pangan", sentiment: -18, mentions: 6800, topIssueId: "isu-pangan" },
  { id: "krakatau", name: "Krakatau Steel", short: "KRAS", sector: "industri", sentiment: -16, mentions: 2100, topIssueId: "isu-industri-baja" },
  { id: "pertamina", name: "Pertamina", short: "Pertamina", sector: "energi", sentiment: -12, mentions: 14600, topIssueId: "isu-bbm" },
  { id: "kai", name: "Kereta Api Indonesia", short: "KAI", sector: "infrastruktur", sentiment: -4, mentions: 5400, topIssueId: "isu-transportasi" },
  { id: "pelindo", name: "Pelindo", short: "Pelindo", sector: "infrastruktur", sentiment: 2, mentions: 2900, topIssueId: "isu-logistik" },
  { id: "ptba", name: "Bukit Asam", short: "PTBA", sector: "mineral", sentiment: 4, mentions: 1900, topIssueId: "isu-transisi-energi" },
  { id: "pupuk", name: "Pupuk Indonesia", short: "Pupuk", sector: "pangan", sentiment: 8, mentions: 3100, topIssueId: "isu-pangan" },
  { id: "injourney", name: "InJourney", short: "InJourney", sector: "infrastruktur", sentiment: 12, mentions: 2400, topIssueId: "isu-pariwisata" },
  { id: "biofarma", name: "Bio Farma", short: "Bio Farma", sector: "industri", sentiment: 14, mentions: 1600, topIssueId: "isu-kesehatan" },
  { id: "jasamarga", name: "Jasa Marga", short: "JSMR", sector: "infrastruktur", sentiment: 16, mentions: 2800, topIssueId: "isu-transportasi" },
  { id: "semen", name: "Semen Indonesia", short: "SMGR", sector: "industri", sentiment: 18, mentions: 1700, topIssueId: "isu-industri-baja" },
  { id: "antam", name: "Aneka Tambang", short: "ANTM", sector: "mineral", sentiment: 22, mentions: 4800, topIssueId: "isu-hilirisasi" },
  { id: "mindid", name: "MIND ID", short: "MIND ID", sector: "mineral", sentiment: 26, mentions: 5600, topIssueId: "isu-hilirisasi" },
  { id: "telkom", name: "Telkom Indonesia", short: "TLKM", sector: "telko", sentiment: 31, mentions: 7200, topIssueId: "isu-digital" },
  { id: "mandiri", name: "Bank Mandiri", short: "BMRI", sector: "perbankan", sentiment: 38, mentions: 6300, topIssueId: "isu-dividen" },
  { id: "bri", name: "Bank Rakyat Indonesia", short: "BBRI", sector: "perbankan", sentiment: 42, mentions: 9100, topIssueId: "isu-dividen" },
];

/* ----------------------------- 20 issues ----------------------------- */

interface IssueSeed {
  id: string;
  title: string;
  category: IssueCategory;
  relatedBumn: string[];
  mentions: number;
  reach: number;
  sentiment: number;
  headlines: IssueHeadline[];
  aiLine: string;
}

const ISSUE_SEEDS: IssueSeed[] = [
  {
    id: "isu-tata-kelola",
    title: "Transparansi & tata kelola dana kelolaan",
    category: "tata-kelola",
    relatedBumn: ["pertamina", "pln", "bri"],
    mentions: 12400,
    reach: 52_000_000,
    sentiment: -42,
    headlines: [
      { source: "Tempo", title: "DPR minta kerangka audit Danantara diperjelas", time: "1 jam lalu" },
      { source: "Kompas", title: "Ekonom soroti keterbukaan laporan kinerja portofolio", time: "3 jam lalu" },
      { source: "X", title: "Thread viral: kemana laporan keuangan Danantara?", time: "5 jam lalu" },
    ],
    aiLine: "Isu dengan jangkauan terbesar — didorong pernyataan anggota DPR dan thread viral; perlu respons keterbukaan data.",
  },
  {
    id: "isu-independensi",
    title: "Independensi dari intervensi politik",
    category: "tata-kelola",
    relatedBumn: ["pertamina", "mandiri", "bri"],
    mentions: 9800,
    reach: 44_000_000,
    sentiment: -48,
    headlines: [
      { source: "Kompas", title: "Pengamat: keputusan investasi harus bebas kepentingan politik", time: "2 jam lalu" },
      { source: "CNBC Indonesia", title: "Pasar menunggu sinyal independensi pengelolaan dana", time: "4 jam lalu" },
    ],
    aiLine: "Narasi politisasi menyebar di akun-akun ekonomi; sentimen sangat negatif namun velocity masih normal.",
  },
  {
    id: "isu-dividen",
    title: "Konsolidasi dividen BUMN ke Danantara",
    category: "kebijakan",
    relatedBumn: ["bri", "mandiri", "telkom"],
    mentions: 8900,
    reach: 38_000_000,
    sentiment: -8,
    headlines: [
      { source: "Bisnis Indonesia", title: "Skema setoran dividen BUMN ke dana kelolaan dipertanyakan DPR", time: "2 jam lalu" },
      { source: "Kontan", title: "Dividen jumbo bank Himbara jadi tulang punggung Danantara", time: "6 jam lalu" },
    ],
    aiLine: "Perdebatan kebijakan fiskal — media bisnis netral, media politik kritis. Sentimen campuran.",
  },
  {
    id: "isu-hilirisasi",
    title: "Hilirisasi nikel & investasi smelter",
    category: "investasi",
    relatedBumn: ["mindid", "antam"],
    mentions: 7800,
    reach: 34_000_000,
    sentiment: 22,
    headlines: [
      { source: "CNBC Indonesia", title: "Danantara siapkan pendanaan smelter generasi kedua", time: "1 jam lalu" },
      { source: "Reuters", title: "Indonesia courts foreign partners for nickel downstream push", time: "4 jam lalu" },
    ],
    aiLine: "Isu positif terbesar — momentum hilirisasi bisa jadi narasi tandingan untuk isu tata kelola.",
  },
  {
    id: "isu-investasi-asing",
    title: "Kemitraan investor asing & sovereign fund",
    category: "investasi",
    relatedBumn: ["mindid", "pertamina", "pelindo"],
    mentions: 6900,
    reach: 31_000_000,
    sentiment: 18,
    headlines: [
      { source: "Bloomberg", title: "Gulf funds eye co-investment with Danantara", time: "3 jam lalu" },
      { source: "Detik", title: "Danantara jajaki kemitraan dana Timur Tengah", time: "5 jam lalu" },
    ],
    aiLine: "Liputan internasional positif; di dalam negeri muncul kekhawatiran 'penjualan aset' yang perlu diluruskan.",
  },
  {
    id: "isu-garuda",
    title: "Restrukturisasi & layanan Garuda Indonesia",
    category: "pasar",
    relatedBumn: ["garuda", "injourney"],
    mentions: 8200,
    reach: 29_000_000,
    sentiment: -55,
    headlines: [
      { source: "TikTok", title: "Video keluhan delay Garuda tembus 2 juta views", time: "4 jam lalu" },
      { source: "Detik", title: "Garuda kembali rugi; suntikan modal dipertanyakan", time: "7 jam lalu" },
    ],
    aiLine: "Sentimen terburuk di portofolio — keluhan layanan viral menyeret diskusi suntikan modal.",
  },
  {
    id: "isu-bbm",
    title: "Subsidi & ketahanan stok BBM Pertamina",
    category: "kebijakan",
    relatedBumn: ["pertamina"],
    mentions: 10800,
    reach: 27_000_000,
    sentiment: -20,
    headlines: [
      { source: "Kompas", title: "Impor BBM dan beban subsidi kembali jadi sorotan", time: "2 jam lalu" },
      { source: "X", title: "Antrean SPBU di beberapa daerah ramai diperbincangkan", time: "5 jam lalu" },
    ],
    aiLine: "Volume sebutan tertinggi kedua; sensitif terhadap harga minyak dunia dan kurs rupiah.",
  },
  {
    id: "isu-karya",
    title: "Restrukturisasi utang BUMN Karya",
    category: "pasar",
    relatedBumn: ["waskita", "wika"],
    mentions: 5600,
    reach: 24_000_000,
    sentiment: -44,
    headlines: [
      { source: "Kontan", title: "Skema penyehatan Waskita-WIKA menunggu keputusan Danantara", time: "3 jam lalu" },
      { source: "Bisnis Indonesia", title: "Kreditur menanti kejelasan restrukturisasi BUMN karya", time: "8 jam lalu" },
    ],
    aiLine: "Isu warisan dengan risiko kredit; pasar menunggu sinyal keputusan dari Danantara.",
  },
  {
    id: "isu-tarif-listrik",
    title: "Tarif listrik & beban subsidi PLN",
    category: "kebijakan",
    relatedBumn: ["pln"],
    mentions: 7400,
    reach: 23_000_000,
    sentiment: -26,
    headlines: [
      { source: "Detik", title: "Wacana penyesuaian tarif listrik non-subsidi mencuat", time: "4 jam lalu" },
      { source: "Kompas", title: "PLN tanggung beban oversupply listrik Jawa-Bali", time: "9 jam lalu" },
    ],
    aiLine: "Isu yang langsung menyentuh publik luas; berpotensi viral cepat bila ada kenaikan tarif.",
  },
  {
    id: "isu-phk",
    title: "Efisiensi & isu PHK karyawan BUMN",
    category: "sosial",
    relatedBumn: ["garuda", "waskita", "krakatau"],
    mentions: 4800,
    reach: 21_000_000,
    sentiment: -50,
    headlines: [
      { source: "CNN Indonesia", title: "Serikat pekerja tolak rencana efisiensi pasca-konsolidasi", time: "5 jam lalu" },
      { source: "X", title: "Tagar #SaveKaryawanBUMN sempat trending", time: "8 jam lalu" },
    ],
    aiLine: "Isu sosial paling sensitif — keterlibatan serikat pekerja membuat velocity bisa melonjak mendadak.",
  },
  {
    id: "isu-apbn",
    title: "Kontribusi Danantara terhadap APBN",
    category: "kebijakan",
    relatedBumn: ["bri", "mandiri", "pertamina", "telkom"],
    mentions: 5200,
    reach: 19_000_000,
    sentiment: -6,
    headlines: [
      { source: "Kontan", title: "Kemenkeu hitung ulang setoran BUMN pasca-Danantara", time: "6 jam lalu" },
      { source: "Bisnis Indonesia", title: "Target dividen negara vs reinvestasi dana kelolaan", time: "10 jam lalu" },
    ],
    aiLine: "Perdebatan teknis fiskal; audiens terbatas pada media ekonomi namun penting bagi kredibilitas.",
  },
  {
    id: "isu-pangan",
    title: "Ketahanan pangan & peran Bulog-Pupuk",
    category: "kebijakan",
    relatedBumn: ["bulog", "pupuk"],
    mentions: 6100,
    reach: 18_000_000,
    sentiment: -14,
    headlines: [
      { source: "Kompas", title: "Stok beras nasional dan peran Bulog dalam stabilisasi harga", time: "3 jam lalu" },
      { source: "Detik", title: "Distribusi pupuk subsidi masih timpang di beberapa provinsi", time: "7 jam lalu" },
    ],
    aiLine: "Isu musiman yang menguat menjelang masa tanam; sensitif secara politik.",
  },
  {
    id: "isu-digital",
    title: "Transformasi digital & kinerja Telkom",
    category: "pasar",
    relatedBumn: ["telkom"],
    mentions: 4200,
    reach: 16_000_000,
    sentiment: 28,
    headlines: [
      { source: "CNBC Indonesia", title: "Telkom genjot bisnis data center untuk topang valuasi", time: "4 jam lalu" },
      { source: "Kontan", title: "Mitratel jadi penopang pertumbuhan grup Telkom", time: "9 jam lalu" },
    ],
    aiLine: "Narasi pertumbuhan digital yang positif dan stabil; aset komunikasi yang baik untuk Danantara.",
  },
  {
    id: "isu-transisi-energi",
    title: "Transisi energi & pensiun dini PLTU",
    category: "investasi",
    relatedBumn: ["pln", "ptba", "pertamina"],
    mentions: 3900,
    reach: 15_000_000,
    sentiment: 12,
    headlines: [
      { source: "Reuters", title: "Indonesia explores early coal retirement funding via JETP", time: "5 jam lalu" },
      { source: "Kompas", title: "Danantara diminta pimpin pendanaan transisi energi", time: "11 jam lalu" },
    ],
    aiLine: "Isu strategis jangka panjang; LSM lingkungan mulai menyorot kecepatan eksekusi.",
  },
  {
    id: "isu-merger-karya",
    title: "Wacana merger & konsolidasi BUMN konstruksi",
    category: "tata-kelola",
    relatedBumn: ["waskita", "wika", "semen"],
    mentions: 3600,
    reach: 14_000_000,
    sentiment: -10,
    headlines: [
      { source: "Bisnis Indonesia", title: "Peta jalan konsolidasi BUMN karya disiapkan", time: "6 jam lalu" },
      { source: "Kontan", title: "Analis: merger karya butuh keputusan cepat Danantara", time: "12 jam lalu" },
    ],
    aiLine: "Pasar menunggu kepastian; ketidakjelasan berkepanjangan akan menekan sentimen sektor infrastruktur.",
  },
  {
    id: "isu-direksi",
    title: "Penunjukan direksi & komisaris BUMN",
    category: "tata-kelola",
    relatedBumn: ["pertamina", "pln", "bri", "garuda"],
    mentions: 4500,
    reach: 13_000_000,
    sentiment: -32,
    headlines: [
      { source: "Tempo", title: "Sorotan rangkap jabatan komisaris di BUMN besar", time: "4 jam lalu" },
      { source: "X", title: "Daftar komisaris baru jadi perdebatan warganet", time: "7 jam lalu" },
    ],
    aiLine: "Isu klasik yang selalu kambuh tiap pergantian pejabat; mudah dipolitisasi.",
  },
  {
    id: "isu-transportasi",
    title: "Integrasi transportasi publik KAI-Jasa Marga",
    category: "investasi",
    relatedBumn: ["kai", "jasamarga"],
    mentions: 3200,
    reach: 12_000_000,
    sentiment: 24,
    headlines: [
      { source: "Detik", title: "Penumpang KAI tembus rekor; okupansi Whoosh stabil", time: "5 jam lalu" },
      { source: "Kompas", title: "Skema pendanaan perpanjangan tol trans-Jawa disiapkan", time: "10 jam lalu" },
    ],
    aiLine: "Kinerja operasional positif; aset cerita keberhasilan yang layak diangkat lebih sering.",
  },
  {
    id: "isu-logistik",
    title: "Efisiensi logistik & kinerja Pelindo",
    category: "pasar",
    relatedBumn: ["pelindo"],
    mentions: 2400,
    reach: 9_000_000,
    sentiment: 8,
    headlines: [
      { source: "Bisnis Indonesia", title: "Dwelling time pelabuhan utama membaik pasca-merger Pelindo", time: "8 jam lalu" },
      { source: "Kontan", title: "Pelindo siapkan ekspansi pelabuhan hub internasional", time: "13 jam lalu" },
    ],
    aiLine: "Isu teknis dengan audiens terbatas; tren membaik secara konsisten.",
  },
  {
    id: "isu-pariwisata",
    title: "Pemulihan pariwisata & aset InJourney",
    category: "pasar",
    relatedBumn: ["injourney", "garuda"],
    mentions: 2100,
    reach: 8_000_000,
    sentiment: 30,
    headlines: [
      { source: "Detik", title: "Kunjungan wisman naik; okupansi hotel BUMN membaik", time: "6 jam lalu" },
      { source: "Kompas", title: "InJourney benahi tata kelola destinasi prioritas", time: "14 jam lalu" },
    ],
    aiLine: "Sentimen paling positif di portofolio; cerita pemulihan yang kuat.",
  },
  {
    id: "isu-kesehatan",
    title: "Kemandirian farmasi & vaksin Bio Farma",
    category: "investasi",
    relatedBumn: ["biofarma"],
    mentions: 1800,
    reach: 7_000_000,
    sentiment: 20,
    headlines: [
      { source: "Kompas", title: "Bio Farma perluas ekspor vaksin ke pasar OKI", time: "9 jam lalu" },
      { source: "CNBC Indonesia", title: "Kemandirian bahan baku obat masih jadi PR besar", time: "15 jam lalu" },
    ],
    aiLine: "Isu positif bervolume kecil; potensi narasi kemandirian kesehatan nasional.",
  },
  {
    id: "isu-industri-baja",
    title: "Daya saing industri baja & banjir impor",
    category: "pasar",
    relatedBumn: ["krakatau", "semen"],
    mentions: 1600,
    reach: 6_000_000,
    sentiment: -22,
    headlines: [
      { source: "Kontan", title: "Krakatau Steel minta proteksi dari baja impor", time: "11 jam lalu" },
      { source: "Bisnis Indonesia", title: "Utilisasi pabrik baja domestik masih di bawah 60%", time: "16 jam lalu" },
    ],
    aiLine: "Isu struktural lama; velocity rendah namun sentimen industri konsisten negatif.",
  },
];

/* ----------------------------- assembly ----------------------------- */

/** Build an issue's initial flat history so velocity starts ≈ 0 (status normal). */
function flatHistory(mentions: number, n = 8): number[] {
  return Array.from({ length: n }, () => mentions);
}

/** Initial board state: 20 issues + 20 BUMN, ranked, all calm. */
export function buildInitialState(): CeoState {
  const issues = ISSUE_SEEDS.map((seed) => ({
    ...seed,
    history: flatHistory(seed.mentions),
    velocity: 0,
    status: "normal" as const,
  }));

  const bumn = BUMN_SEEDS.map((seed) => ({
    ...seed,
    trend: Array.from({ length: 8 }, () => seed.sentiment),
  }));

  return { tickCount: 0, issues: rankIssues(issues), bumn: rankBumn(bumn) };
}

/**
 * Scripted escalation arcs (AC5): the first fires ~60 s after load (tick 15 ×
 * 4 s) on the workforce/PHK issue (reach 21M > 5M floor); a second fires ~4 min
 * in on the Garuda issue. A demo must never depend on luck.
 */
export const DEMO_ARCS: EscalationArc[] = [
  { issueId: "isu-phk", atTick: 15, rampTicks: 5, growthPerTick: 0.45 },
  { issueId: "isu-garuda", atTick: 60, rampTicks: 5, growthPerTick: 0.5 },
];
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npx vitest run lib/danantara/ceo`
Expected: PASS (all engine + data tests)

- [ ] **Step 5: Commit**

```bash
git add lib/danantara/ceo/data.ts lib/danantara/ceo/data.test.ts
git commit -m "feat(danantara): CEO board data — 20 curated issues, 20 BUMN, demo escalation arcs"
```

---

### Task 10: Presentational components — Sparkline, HeaderStrip, AiBriefTicker + CSS keyframes

These are display-only components; the logic they show is already tested. Component coverage comes from CeoCommand tests (Task 12). Verify visually + via build.

**Files:**
- Create: `components/danantara/ceo/Sparkline.tsx`
- Create: `components/danantara/ceo/HeaderStrip.tsx`
- Create: `components/danantara/ceo/AiBriefTicker.tsx`
- Modify: `app/globals.css` (append keyframes)

- [ ] **Step 1: Append CSS keyframes to app/globals.css**

Append at the end of `app/globals.css`:
```css
/* ===== Danantara CEO command wall ===== */

@keyframes ceo-siren {
  0%, 100% { box-shadow: 0 0 0 0 oklch(0.62 0.22 25 / 0.55); }
  50% { box-shadow: 0 0 0 10px oklch(0.62 0.22 25 / 0); }
}
.ceo-siren { animation: ceo-siren 1.2s ease-in-out infinite; }

@keyframes ceo-takeover-in {
  0% { opacity: 0; transform: scale(1.04); }
  100% { opacity: 1; transform: scale(1); }
}
.ceo-takeover { animation: ceo-takeover-in 0.35s ease-out; }

@keyframes ceo-flash {
  0%, 100% { background-color: transparent; }
  50% { background-color: oklch(0.62 0.22 25 / 0.18); }
}
.ceo-flash { animation: ceo-flash 1.6s ease-in-out infinite; }

@keyframes ceo-ticker-slide {
  0% { opacity: 0; transform: translateY(8px); }
  8%, 92% { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(-8px); }
}
.ceo-ticker-line { animation: ceo-ticker-slide 6s ease-in-out infinite; }

/* Row re-rank: rows animate via CSS transition on transform (FLIP applied inline) */
.ceo-row { transition: transform 0.6s cubic-bezier(0.22, 1, 0.36, 1); }
```

- [ ] **Step 2: Create Sparkline.tsx**

```tsx
"use client";

/** Tiny inline-SVG sparkline; no chart deps. */
export function Sparkline({
  data,
  width = 64,
  height = 20,
  stroke = "oklch(0.78 0.14 230)",
}: {
  data: number[];
  width?: number;
  height?: number;
  stroke?: string;
}) {
  if (data.length < 2) return <svg width={width} height={height} aria-hidden />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * width},${height - 2 - ((v - min) / span) * (height - 4)}`)
    .join(" ");
  return (
    <svg width={width} height={height} aria-hidden className="shrink-0">
      <polyline points={points} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
```

- [ ] **Step 3: Create HeaderStrip.tsx**

```tsx
"use client";

import { Landmark, Radio, Siren } from "lucide-react";
import { useEffect, useState } from "react";
import type { CeoState } from "@/lib/danantara/ceo/types";

/** Headline strip: identity, LIVE badge, totals, alert count, Jakarta clock. Zero-click. */
export function HeaderStrip({ state }: { state: CeoState }) {
  const totalMentions = state.issues.reduce((a, i) => a + i.mentions, 0);
  const netSentiment = Math.round(state.bumn.reduce((a, b) => a + b.sentiment, 0) / Math.max(1, state.bumn.length));
  const alerts = state.issues.filter((i) => i.status !== "normal").length;
  const escalating = state.issues.some((i) => i.status === "escalating");

  const [clock, setClock] = useState("");
  useEffect(() => {
    const update = () =>
      setClock(
        new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Jakarta" }),
      );
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div data-testid="ceo-header" className="panel flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
      <div className="flex items-center gap-2">
        <Landmark className="h-5 w-5 text-primary" />
        <div>
          <div className="text-sm font-semibold leading-tight">Danantara — CEO Command</div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Intelijen Media & Sentimen BUMN</div>
        </div>
      </div>

      <span className="flex items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-success">
        <Radio className="h-3 w-3 animate-pulse" /> Live
      </span>

      <Metric label="Total Sebutan" value={totalMentions.toLocaleString("id-ID")} />
      <Metric
        label="Sentimen Bersih BUMN"
        value={`${netSentiment > 0 ? "+" : ""}${netSentiment}`}
        tone={netSentiment >= 10 ? "text-success" : netSentiment <= -10 ? "text-destructive" : "text-warning"}
      />
      <div className={escalating ? "ceo-siren rounded-md" : undefined}>
        <Metric
          label="Peringatan Aktif"
          value={String(alerts)}
          tone={escalating ? "text-destructive" : alerts > 0 ? "text-warning" : "text-success"}
          icon={escalating ? <Siren className="h-4 w-4 text-destructive" /> : undefined}
        />
      </div>

      <div className="ml-auto text-right">
        <div className="font-mono text-lg tabular-nums leading-tight">{clock || "--:--:--"}</div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">WIB · Jakarta</div>
      </div>
    </div>
  );
}

function Metric({ label, value, tone, icon }: { label: string; value: string; tone?: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-2">
      {icon}
      <div>
        <div className={`font-mono text-lg font-semibold tabular-nums leading-tight ${tone ?? ""}`}>{value}</div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create AiBriefTicker.tsx**

```tsx
"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { briefLines } from "@/lib/danantara/ceo/engine";
import type { CeoState } from "@/lib/danantara/ceo/types";

const LINE_MS = 6_000;

/** Bottom narration strip — deterministic scripted lines from the live state (no LLM). */
export function AiBriefTicker({ state }: { state: CeoState }) {
  const lines = briefLines(state);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIdx((v) => v + 1), LINE_MS);
    return () => clearInterval(id);
  }, []);

  const line = lines[idx % lines.length] ?? "";
  const isWarning = line.startsWith("⚠");

  return (
    <div
      data-testid="ceo-ticker"
      className={`panel flex items-center gap-3 px-4 py-2.5 ${isWarning ? "border-destructive/50 bg-destructive/10" : ""}`}
    >
      <span className="flex shrink-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
        <Sparkles className="h-3.5 w-3.5" /> Nexorus AI
      </span>
      <p key={idx} className={`ceo-ticker-line min-w-0 flex-1 truncate text-sm ${isWarning ? "font-semibold text-destructive" : ""}`}>
        {line}
      </p>
    </div>
  );
}
```

- [ ] **Step 5: Verify compile + lint**

Run: `npx tsc --noEmit` then `npm run lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add components/danantara/ceo app/globals.css
git commit -m "feat(danantara): CEO wall presentational components — sparkline, header, AI ticker"
```

---

### Task 11: Boards — IssueBoard, BumnHeatboard, Spotlight, BreakingTakeover

**Files:**
- Create: `components/danantara/ceo/IssueBoard.tsx`
- Create: `components/danantara/ceo/BumnHeatboard.tsx`
- Create: `components/danantara/ceo/Spotlight.tsx`
- Create: `components/danantara/ceo/BreakingTakeover.tsx`

- [ ] **Step 1: Create IssueBoard.tsx**

```tsx
"use client";

import { Flame, TrendingUp } from "lucide-react";
import { Sparkline } from "./Sparkline";
import type { CeoIssue } from "@/lib/danantara/ceo/types";
import { SOV_COLORS } from "@/lib/danantara/ui";

const STATUS_BADGE: Record<CeoIssue["status"], { label: string; cls: string }> = {
  normal: { label: "", cls: "" },
  rising: { label: "NAIK", cls: "bg-warning/15 text-warning border-warning/40" },
  escalating: { label: "ESKALASI", cls: "bg-destructive/15 text-destructive border-destructive/50 ceo-siren" },
};

/** Top-20 issues ranked by reach. Rows re-rank live; zero interaction needed. */
export function IssueBoard({ issues }: { issues: CeoIssue[] }) {
  return (
    <div data-testid="ceo-issues" className="panel flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Flame className="h-3.5 w-3.5 text-primary" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">20 Isu Utama Danantara</span>
        <span className="ml-auto text-[10px] uppercase tracking-widest text-muted-foreground">Peringkat jangkauan</span>
      </div>
      <ol className="min-h-0 flex-1 overflow-y-auto">
        {issues.map((issue, rank) => {
          const badge = STATUS_BADGE[issue.status];
          return (
            <li
              key={issue.id}
              data-testid={`issue-row-${issue.id}`}
              className={`ceo-row flex items-center gap-2.5 border-b border-border/40 px-3 py-2 last:border-b-0 ${
                issue.status === "escalating" ? "ceo-flash" : ""
              }`}
            >
              <span className="w-6 shrink-0 text-right font-mono text-sm tabular-nums text-muted-foreground">{rank + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[13px] font-medium leading-snug">{issue.title}</span>
                  {badge.label && (
                    <span className={`shrink-0 rounded border px-1 py-px text-[9px] font-bold tracking-wider ${badge.cls}`}>
                      {badge.label}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>{(issue.reach / 1_000_000).toFixed(1)} jt jangkauan</span>
                  <span>·</span>
                  <span>{issue.mentions.toLocaleString("id-ID")} sebutan</span>
                </div>
              </div>
              <Sparkline
                data={issue.history}
                stroke={issue.status === "escalating" ? SOV_COLORS.weak : issue.status === "rising" ? SOV_COLORS.watch : SOV_COLORS.strong}
              />
              <span
                className={`flex w-16 shrink-0 items-center justify-end gap-0.5 font-mono text-xs tabular-nums ${
                  issue.velocity >= 200 ? "text-destructive" : issue.velocity >= 80 ? "text-warning" : "text-muted-foreground"
                }`}
              >
                <TrendingUp className="h-3 w-3" />
                {issue.velocity >= 0 ? "+" : ""}
                {Math.round(issue.velocity)}%
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
```

- [ ] **Step 2: Create BumnHeatboard.tsx**

```tsx
"use client";

import { Building2 } from "lucide-react";
import { Sparkline } from "./Sparkline";
import type { BumnSentiment } from "@/lib/danantara/ceo/types";

/** Sentiment −100..100 → tile background (red ↔ green via oklch). */
function heatColor(sentiment: number): string {
  const t = (sentiment + 100) / 200; // 0 (worst) .. 1 (best)
  const hue = 25 + t * 130; // red 25 → green 155
  const chroma = 0.07 + Math.abs(sentiment) / 100 * 0.1;
  return `oklch(0.45 ${chroma.toFixed(3)} ${hue.toFixed(0)} / 0.35)`;
}

/** Top-20 BUMN by net public sentiment, most-negative first. */
export function BumnHeatboard({ rows }: { rows: BumnSentiment[] }) {
  return (
    <div data-testid="ceo-bumn" className="panel flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Building2 className="h-3.5 w-3.5 text-primary" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">Sentimen 20 BUMN</span>
        <span className="ml-auto text-[10px] uppercase tracking-widest text-muted-foreground">Paling tertekan dulu</span>
      </div>
      <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-2 gap-1.5 overflow-y-auto p-2">
        {rows.map((row) => (
          <div
            key={row.id}
            data-testid={`bumn-tile-${row.id}`}
            className="flex flex-col justify-between rounded-md border border-border/60 p-2"
            style={{ backgroundColor: heatColor(row.sentiment) }}
          >
            <div className="flex items-start justify-between gap-1">
              <span className="truncate text-[12px] font-semibold leading-tight">{row.short}</span>
              <span
                className={`font-mono text-sm font-bold tabular-nums ${
                  row.sentiment <= -20 ? "text-destructive" : row.sentiment >= 20 ? "text-success" : "text-warning"
                }`}
              >
                {row.sentiment > 0 ? "+" : ""}
                {Math.round(row.sentiment)}
              </span>
            </div>
            <div className="mt-1 flex items-end justify-between gap-1">
              <span className="truncate text-[9px] text-muted-foreground">{row.mentions.toLocaleString("id-ID")} sebutan</span>
              <Sparkline data={row.trend} width={40} height={14} stroke="oklch(0.85 0.02 250 / 0.8)" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create Spotlight.tsx**

```tsx
"use client";

import { Newspaper, ScanEye, Sparkles, Siren } from "lucide-react";
import type { BumnSentiment, CeoIssue } from "@/lib/danantara/ceo/types";
import { SOV_COLORS, withAlpha } from "@/lib/danantara/ui";

/** Mention-trend area chart (inline SVG, no deps). */
function TrendChart({ history, escalating }: { history: number[]; escalating: boolean }) {
  const w = 600;
  const h = 120;
  if (history.length < 2) return null;
  const min = Math.min(...history);
  const max = Math.max(...history);
  const span = max - min || 1;
  const pts = history.map((v, i) => [(i / (history.length - 1)) * w, h - 6 - ((v - min) / span) * (h - 12)] as const);
  const line = pts.map((p) => p.join(",")).join(" ");
  const area = `0,${h} ${line} ${w},${h}`;
  const color = escalating ? SOV_COLORS.weak : SOV_COLORS.strong;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-28 w-full" preserveAspectRatio="none" aria-hidden>
      <polygon points={area} fill={withAlpha(color, 0.15)} />
      <polyline points={line} fill="none" stroke={color} strokeWidth="2" />
    </svg>
  );
}

/** Auto-rotating deep-dive. The dashboard does the clicking for the CEO. */
export function Spotlight({ issue, bumn }: { issue: CeoIssue | undefined; bumn: BumnSentiment[] }) {
  if (!issue) return <div data-testid="ceo-spotlight" className="panel h-full" />;
  const escalating = issue.status === "escalating";
  const related = bumn.filter((b) => issue.relatedBumn.includes(b.id));

  return (
    <div
      data-testid="ceo-spotlight"
      className={`panel flex h-full flex-col overflow-hidden ${escalating ? "border-destructive/60" : ""}`}
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <ScanEye className="h-3.5 w-3.5 text-primary" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">Sorotan Otomatis</span>
        {escalating && (
          <span className="ceo-siren ml-auto flex items-center gap-1 rounded border border-destructive/50 bg-destructive/15 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-destructive">
            <Siren className="h-3 w-3" /> ESKALASI — DIPANTAU
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        <div>
          <h2 className="text-lg font-semibold leading-snug">{issue.title}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-3 font-mono text-xs tabular-nums text-muted-foreground">
            <span>{(issue.reach / 1_000_000).toFixed(1)} jt jangkauan</span>
            <span>{issue.mentions.toLocaleString("id-ID")} sebutan</span>
            <span className={issue.velocity >= 200 ? "font-bold text-destructive" : issue.velocity >= 80 ? "text-warning" : ""}>
              {issue.velocity >= 0 ? "+" : ""}
              {Math.round(issue.velocity)}% / 2 jam
            </span>
          </div>
        </div>

        <TrendChart history={issue.history} escalating={escalating} />

        <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 p-2.5">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <p className="text-[13px] leading-relaxed">{issue.aiLine}</p>
        </div>

        <div className="space-y-1.5">
          {issue.headlines.map((headline) => (
            <div key={headline.title} className="flex items-start gap-2 text-[12px]">
              <Newspaper className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 leading-snug">{headline.title}</span>
              <span className="shrink-0 text-[10px] text-muted-foreground">
                {headline.source} · {headline.time}
              </span>
            </div>
          ))}
        </div>

        {related.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {related.map((b) => (
              <span
                key={b.id}
                className="rounded-full border border-border bg-background/40 px-2 py-0.5 text-[10px] font-medium"
              >
                {b.short}{" "}
                <span className={b.sentiment < 0 ? "text-destructive" : "text-success"}>
                  {b.sentiment > 0 ? "+" : ""}
                  {Math.round(b.sentiment)}
                </span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create BreakingTakeover.tsx**

```tsx
"use client";

import { Siren } from "lucide-react";
import type { CeoIssue } from "@/lib/danantara/ceo/types";

/** Full-screen breaking-news interrupt. Fires on a status transition to "escalating". */
export function BreakingTakeover({ issue }: { issue: CeoIssue }) {
  return (
    <div
      data-testid="ceo-takeover"
      className="ceo-takeover fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background/95 backdrop-blur-sm"
    >
      <div className="ceo-siren flex items-center gap-3 rounded-full border-2 border-destructive bg-destructive/15 px-6 py-2">
        <Siren className="h-6 w-6 text-destructive" />
        <span className="text-lg font-black uppercase tracking-[0.3em] text-destructive">Isu Tereskalasi</span>
        <Siren className="h-6 w-6 text-destructive" />
      </div>

      <h1 className="max-w-4xl px-8 text-center text-4xl font-bold leading-tight">{issue.title}</h1>

      <div className="flex items-center gap-10 font-mono tabular-nums">
        <Stat label="Lonjakan 2 jam" value={`+${Math.round(issue.velocity)}%`} accent />
        <Stat label="Jangkauan" value={`${(issue.reach / 1_000_000).toFixed(1)} jt`} />
        <Stat label="Sebutan" value={issue.mentions.toLocaleString("id-ID")} />
      </div>

      <p className="max-w-2xl px-8 text-center text-sm text-muted-foreground">{issue.aiLine}</p>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="text-center">
      <div className={`text-3xl font-bold ${accent ? "text-destructive" : ""}`}>{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{label}</div>
    </div>
  );
}
```

- [ ] **Step 5: Verify compile + lint**

Run: `npx tsc --noEmit` then `npm run lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add components/danantara/ceo
git commit -m "feat(danantara): CEO wall boards — issues, BUMN heatmap, spotlight, breaking takeover"
```

---

### Task 12: CeoCommand orchestrator + tests (T1, T4-component, T7, TDD)

**Files:**
- Create: `components/danantara/ceo/CeoCommand.test.tsx`
- Create: `components/danantara/ceo/CeoCommand.tsx`

- [ ] **Step 1: Write failing component tests**

`components/danantara/ceo/CeoCommand.test.tsx`:
```tsx
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TICK_MS } from "@/lib/danantara/ceo/data";
import { CeoCommand } from "./CeoCommand";

describe("CeoCommand (T1 / AC1)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders all four zones with zero interaction", () => {
    render(<CeoCommand />);
    expect(screen.getByTestId("ceo-header")).toBeInTheDocument();
    expect(screen.getByTestId("ceo-issues")).toBeInTheDocument();
    expect(screen.getByTestId("ceo-bumn")).toBeInTheDocument();
    expect(screen.getByTestId("ceo-spotlight")).toBeInTheDocument();
    expect(screen.getByTestId("ceo-ticker")).toBeInTheDocument();
  });

  it("renders 20 issue rows and 20 BUMN tiles (AC2, AC3)", () => {
    render(<CeoCommand />);
    expect(screen.getAllByTestId(/^issue-row-/)).toHaveLength(20);
    expect(screen.getAllByTestId(/^bumn-tile-/)).toHaveLength(20);
  });

  it("fires the breaking takeover when the scripted arc escalates an issue (T4 / AC4, AC5)", () => {
    render(<CeoCommand />);
    expect(screen.queryByTestId("ceo-takeover")).not.toBeInTheDocument();
    // Advance past the first demo arc (atTick 15 + rampTicks 5) plus margin.
    act(() => {
      vi.advanceTimersByTime(TICK_MS * 25);
    });
    expect(screen.getByTestId("ceo-takeover")).toBeInTheDocument();
  });

  it("force-fires escalation with the presenter hotkey E (AC5)", () => {
    render(<CeoCommand />);
    expect(screen.queryByTestId("ceo-takeover")).not.toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "e" }));
      vi.advanceTimersByTime(TICK_MS * (6 + 2)); // one full velocity window of spiked ticks
    });
    expect(screen.getByTestId("ceo-takeover")).toBeInTheDocument();
  });

  it("uses a stacked-to-3-column responsive wall (T7 / AC7)", () => {
    render(<CeoCommand />);
    const wall = screen.getByTestId("ceo-wall");
    expect(wall.className).toContain("grid-cols-1");
    expect(wall.className).toMatch(/xl:grid-cols-/);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run components/danantara/ceo`
Expected: FAIL — `Cannot find module './CeoCommand'`

- [ ] **Step 3: Implement CeoCommand.tsx**

```tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildInitialState, DEMO_ARCS, SPOTLIGHT_MS, TAKEOVER_MS, TICK_MS } from "@/lib/danantara/ceo/data";
import { mulberry32, spotlightQueue, tick } from "@/lib/danantara/ceo/engine";
import type { CeoState, EscalationArc } from "@/lib/danantara/ceo/types";
import { AiBriefTicker } from "./AiBriefTicker";
import { BreakingTakeover } from "./BreakingTakeover";
import { BumnHeatboard } from "./BumnHeatboard";
import { HeaderStrip } from "./HeaderStrip";
import { IssueBoard } from "./IssueBoard";
import { Spotlight } from "./Spotlight";

/**
 * Zero-click CEO command wall. One shared tick drives the whole board; the
 * spotlight rotates on its own; escalations interrupt with a takeover.
 * The CEO never has to click anything.
 */
export function CeoCommand() {
  const [state, setState] = useState<CeoState>(buildInitialState);
  const [spotIdx, setSpotIdx] = useState(0);
  const [takeoverId, setTakeoverId] = useState<string | null>(null);
  // Presenter-triggered arcs (hotkey E) are appended at runtime.
  const arcsRef = useRef<EscalationArc[]>([...DEMO_ARCS]);
  const randRef = useRef(mulberry32(20260602));
  const seenEscalating = useRef<Set<string>>(new Set());

  // Simulation clock — the single tick that animates everything.
  useEffect(() => {
    const id = setInterval(() => {
      setState((prev) => tick(prev, randRef.current, arcsRef.current));
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  // Spotlight rotation.
  useEffect(() => {
    const id = setInterval(() => setSpotIdx((v) => v + 1), SPOTLIGHT_MS);
    return () => clearInterval(id);
  }, []);

  // Presenter hotkey: E force-fires an escalation arc on the top issue.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "e" || e.metaKey || e.ctrlKey || e.altKey) return;
      setState((prev) => {
        const target = prev.issues.find((i) => i.status === "normal" && i.reach >= 5_000_000) ?? prev.issues[0];
        arcsRef.current = [
          ...arcsRef.current,
          { issueId: target.id, atTick: prev.tickCount, rampTicks: 6, growthPerTick: 0.5 },
        ];
        return prev;
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Takeover: fires once per issue on its transition into "escalating".
  useEffect(() => {
    const nowEscalating = state.issues.filter((i) => i.status === "escalating");
    const fresh = nowEscalating.find((i) => !seenEscalating.current.has(i.id));
    if (fresh) {
      seenEscalating.current.add(fresh.id);
      setTakeoverId(fresh.id);
      const id = setTimeout(() => setTakeoverId(null), TAKEOVER_MS);
      return () => clearTimeout(id);
    }
    // Allow re-triggering after an issue fully cools down.
    for (const id of [...seenEscalating.current]) {
      const issue = state.issues.find((i) => i.id === id);
      if (issue && issue.status === "normal") seenEscalating.current.delete(id);
    }
  }, [state]);

  // Spotlight target: escalating issues pin to the front of the queue.
  const queue = useMemo(() => spotlightQueue(state.issues), [state.issues]);
  const spotlightIssue = useMemo(() => {
    const escalating = state.issues.find((i) => i.status === "escalating");
    if (escalating) return escalating;
    const id = queue[spotIdx % Math.max(1, queue.length)];
    return state.issues.find((i) => i.id === id);
  }, [queue, spotIdx, state.issues]);

  const takeoverIssue = takeoverId ? state.issues.find((i) => i.id === takeoverId) : undefined;

  return (
    <div className="flex h-full flex-col gap-3">
      <HeaderStrip state={state} />

      <div
        data-testid="ceo-wall"
        className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[1.2fr_1.6fr_1fr] xl:[&>*]:min-h-[60vh]"
      >
        {/* Phone order: spotlight hero first, then issues, then BUMN (AC7). */}
        <div className="order-2 xl:order-1"><IssueBoard issues={state.issues} /></div>
        <div className="order-1 xl:order-2"><Spotlight issue={spotlightIssue} bumn={state.bumn} /></div>
        <div className="order-3"><BumnHeatboard rows={state.bumn} /></div>
      </div>

      <AiBriefTicker state={state} />

      {takeoverIssue && <BreakingTakeover issue={takeoverIssue} />}
    </div>
  );
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npx vitest run components/danantara/ceo`
Expected: PASS (5 tests). Notes if failing:
- Hotkey test: the keydown handler appends an arc starting at `prev.tickCount`; the subsequent ticks must include the spiked growth before the velocity window fills.
- Takeover test: ensure the arc issue (`isu-phk`, reach 21M) crosses both thresholds by tick 20–25.

- [ ] **Step 5: Commit**

```bash
git add components/danantara/ceo/CeoCommand.tsx components/danantara/ceo/CeoCommand.test.tsx
git commit -m "feat(danantara): CEO command wall orchestrator — tick clock, spotlight, takeover, hotkey"
```

---

### Task 13: Rewrite /danantara page (AC1) + page composition test

**Files:**
- Create: `app/danantara/page.test.tsx`
- Modify: `app/danantara/page.tsx`

- [ ] **Step 1: Write failing composition test**

`app/danantara/page.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/layout/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));
vi.mock("@/components/danantara/ceo/CeoCommand", () => ({
  CeoCommand: () => <div data-testid="ceo-command" />,
}));

import Page from "./page";

describe("/danantara (AC1)", () => {
  it("renders the new CeoCommand inside AppShell", () => {
    render(<Page />);
    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
    expect(screen.getByTestId("ceo-command")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run app/danantara`
Expected: FAIL — page still renders `SovereignCommand`, no `ceo-command` test id.

- [ ] **Step 3: Rewrite the page**

`app/danantara/page.tsx` (full file):
```tsx
import { AppShell } from "@/components/layout/AppShell";
import { CeoCommand } from "@/components/danantara/ceo/CeoCommand";

export default function Page() {
  return (
    <AppShell>
      <CeoCommand />
    </AppShell>
  );
}
```

- [ ] **Step 4: Run all tests, verify pass**

Run: `npm test`
Expected: ALL PASS (engine, data, both pages, CeoCommand).

- [ ] **Step 5: Visual verification in dev**

Run: `npm run dev`, open `http://localhost:3000/danantara`
Expected:
- Wall renders: header, 20-issue board (left), spotlight (center), 20-BUMN heatmap (right), AI ticker (bottom)
- Numbers tick every ~4 s, rows re-rank, spotlight rotates every ~10 s
- At ~60 s: full-screen red takeover for "Efisiensi & isu PHK karyawan BUMN", then it pins to the spotlight
- Pressing `E` force-fires another escalation
- Narrow window (< 1280px): layout stacks spotlight-first
- `/danantara-v2` still shows the old dashboard

- [ ] **Step 6: Commit**

```bash
git add app/danantara
git commit -m "feat(danantara): /danantara is now the zero-click CEO command wall"
```

---

### Task 14: Final verification + study plan status

**Files:**
- Modify: `docs/study-plans/atlas/3-act.md` (A7 status)
- Modify: `docs/study-plans/atlas/_index.md` (A7 status)

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: all tests pass. Record the count.

- [ ] **Step 2: Lint + production build**

Run: `npm run lint` then `npm run build`
Expected: both pass with no errors (warnings acceptable if pre-existing).

- [ ] **Step 3: Update study plan status to Built**

In `docs/study-plans/atlas/3-act.md` A7 header line, change `**Status:** Planned` → `**Status:** Built`.
In A7's Revision history table, add:
```markdown
| 1.1 | <today's date> | Status → Built (code + tests green) |
```
In `docs/study-plans/atlas/_index.md`, change A7's row `Planned` → `Built`.

- [ ] **Step 4: Commit**

```bash
git add docs/study-plans/atlas/3-act.md docs/study-plans/atlas/_index.md
git commit -m "docs(danantara): A7 status -> Built"
```

- [ ] **Step 5: Verify branch is clean and complete**

Run: `git status` and `git log --oneline main..HEAD`
Expected: working tree clean; commit list covers tasks 1–14. Hand off for review / PR (superpowers:finishing-a-development-branch).

---

## Self-review checklist (done at plan-writing time)

- **Spec coverage:** AC1 (Tasks 12–13), AC2 (Tasks 6–7, 11), AC3 (Tasks 6, 9, 11), AC4 (Tasks 5, 11–12), AC5 (Tasks 7, 9, 12), AC6 (Task 2), AC7 (Tasks 12–13). Test infra prerequisite: Task 1. Nav: Task 2. ✓
- **Placeholders:** none — every code step has complete code. ✓
- **Type consistency:** `CeoState` (not `CeoSnapshot` — renamed during planning; spec's "CeoSnapshot" concept = `CeoState`), `statusOf(vel, reach, prev)`, `tick(state, rand, arcs)`, `EscalationArc.growthPerTick` used consistently across tasks. ✓
