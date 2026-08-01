# BGN Command Center — rename `/danantara/command` → `/bgn/command`, rebrand to Badan Gizi Nasional, scoped demo mock

- **Date:** 2026-08-01
- **Status:** Design — approved for `/change-feature`, pre-implementation
- **Features touched:** A13 (MAJOR), A7 (MINOR), A10 (MINOR), A14 (MINOR), P9 (behaviour)
- **Related memory:** the garudaperkasa.io upstream key is expired & unrenewable — all three Danantara feeds (`/topics`, `/threats`, `/actor-intelligence`) 502; a new data-source direction is expected.

## 1. Background (why)

Two forces meet in this change:

1. **A product rename.** The one-page Command Center currently lives at `/danantara/command` and is the landing the OpenGate SSO handoff drops a `danantara`-scoped user on. The client wants it moved to **`/bgn/command`** and rebranded to **Badan Gizi Nasional (BGN)** — the National Nutrition Agency behind the *Makan Bergizi Gratis* (MBG) programme. The app's root `/` is already "MBG Crisis Command", so the BGN/MBG orientation already exists in the product; this brings the command center into line with it.

2. **A dead upstream.** The garudaperkasa.io key is gone and cannot be renewed, so every pane on the command center that reads `/topics`, `/threats`, or `/actor-intelligence` is offline (502). Until the new data source lands, the page must be demoable, so its data is **mocked** — and, because we are rebranding to BGN, the mock is themed to BGN's real domain (MBG food-safety incidents, budget/logistics, SPPG kitchen hygiene, distribution) and made **cross-consistent** across the panes so the page reads as one coherent situation.

The page must look right for demos now, and the mock must be trivially reversible when the real feed returns.

## 2. Decisions (locked with the client)

| # | Decision | Choice |
|---|----------|--------|
| D1 | Old `/danantara/command` path | **Removed** (404). Only `/bgn/command` exists. |
| D2 | Visible branding on the page | **Rebrand to BGN** (copy + logo). |
| D3 | BGN meaning / mock theme | **Badan Gizi Nasional** — mock themed to the MBG programme. |
| D4 | Cross-pane data | **One cross-consistent story** — the panes reference the same core issues/actors. |
| D5 | Counter-Narrative pane | **AI over the mock** — the LLM drafts over the mocked topics (no separate mock). |
| D6 | Mock scope | **Scoped to `/bgn/command` only** — every other page is left exactly as-is. |
| D7 | `/api/v1/danantara/*` namespace | **Unchanged.** Internal identifier; shared by the surviving Danantara/BUMN pages; tied to the OpenGate autologin + deeplink contracts. Renaming it is pure churn. |
| D8 | Internal `danantara` scope key | **Unchanged.** Part of the signed OpenGate token contract. |

**The separation principle:** *URL + visible branding become BGN; internal identifiers (scope key, API namespace, shared component/file names) stay `danantara`.* The one genuinely-BGN new artifact — the mock fixtures — is the sole exception and gets a BGN home (`lib/bgn/`).

## 3. Scope

### 3.1 Route move (A13)
- **Add** `app/bgn/command/page.tsx` (moved from `app/danantara/command/page.tsx`); **delete** `app/danantara/command/`. The old path 404s.
- `components/layout/AppShell.tsx`:
  - `minimalChrome` gains `|| pathname.startsWith("/bgn")` so the new route keeps the stripped executive chrome.
  - the `danantara`-scope nav filter keeps `/bgn` items: `n.to.startsWith("/danantara") || n.to.startsWith("/bgn")` — otherwise a `danantara`-scoped user lands on `/bgn/command` but cannot see it in the menu.
  - the NAV entry becomes `{ to: "/bgn/command", label: "BGN Command Center", icon: LayoutDashboard, group: "Dashboards" }`.

### 3.2 SSO landing (P9)
- `lib/auth.ts` → `homeForScope("danantara")` returns **`/bgn/command`** (was `/danantara/command`). This is the single point that lands the OpenGate `/api/v1/sso` handoff and the middleware scope-bounce. The `danantara` scope key is untouched (D8); only the destination URL changes. Direct demo-login users keep their separate `/danantara/krisis` home (`DEMO_USERS.home`, a different flow) unless separately requested.

### 3.3 Rebrand to BGN (A7 / A10 / A14)
Threaded via an **opt-in `brand` prop** (default `"Danantara"`), so `/danantara` and `/danantara/krisis` stay byte-identical:
- `CrisisGate` (A10): `CLIENT_BRAND` becomes a prop; the `/danantara.png` logo → **`/bgn.png`** (asset present); the "briefing → `/danantara/brief`" link is hidden when a non-default brand is set (it points at a Danantara page).
- `IssueBoard` (A7, via `CeoCommand`): "Danantara Issues" → `{brand} Issues` → "BGN Issues".
- `CounterNarrativeWarRoom` (A14): the cosmetic `--topic danantara` terminal line uses the brand.
- The suppressed `HeaderStrip` (CEO) is **not rendered** on this page (`showHeader={false}`), so its Danantara copy needs no change.

### 3.4 Mock, scoped to `/bgn/command` (A13 + the three routes)
- **New `lib/bgn/mock/`** — typed fixtures `MOCK_TOPICS`, `MOCK_THREATS`, `MOCK_ACTORS`, each typed **against the corresponding route's response type** imported from `lib/danantara/*` (`fetchTopicsForCode`'s `TopicsResult`, `fetchThreatsForCode`'s `ThreatsResult`, and the `{ actors }` roster shape) so they cannot drift from what the client parses.
- The `/bgn/command` page passes a **`mock` prop** into `DanantaraCommandCenter`, which threads it to the panes. The panes append **`&mock=1`** to their feed fetches — the three `/topics` call sites (`CrisisGate`, `CeoCommand`, `useCounterNarrative`), plus `/threats` and `/actor-intelligence` in `CrisisGate`.
- The three routes — `app/api/v1/danantara/{topics,threats,actor-intelligence}/route.ts` — gain an explicit branch at the top:
  ```ts
  if (new URL(req.url).searchParams.get("mock") === "1") {
    return NextResponse.json(<fixture>);
  }
  ```
  This is **production-safe** (unlike the existing `NODE_ENV !== "production"` dev-mock seam, which is untouched): it returns canned demo data — no secrets, no upstream call — so it is safe to honour in prod, and it returns **before** the dead garudaperkasa fetch.
- **Only `/bgn/command` sends `mock=1`.** Every other caller (the Danantara + BUMN pages) omits it and falls through to the current feed path — so they are left exactly as-is (D6).
- **Counter-Narrative stays AI over the mock (D5):** `useCounterNarrative` fetches the mocked topics (`&mock=1`) and POSTs them to `/counter-narrative`; the LLM drafts over the mocked issues. No change to the counter-narrative route. If the LLM is down/off it degrades to the existing deterministic scripted fallback (built from the mocked issues), unchanged.

### 3.5 Cross-consistent BGN story (D4)
The fixtures share a single set of ~6 core BGN/MBG issues so the panes agree:
- e.g. *keracunan massal MBG di sekolah* (mass food-poisoning), *anggaran & realisasi program*, *higienitas dapur SPPG*, *keterlambatan distribusi*, plus positive coverage (local-farmer sourcing, coverage milestones).
- `MOCK_THREATS`' detected threat and `MOCK_ACTORS`' drivers reference the **same** issues/actors that appear as negative topics in `MOCK_TOPICS`, so the Crisis index + biggest threat, the Issues board, and the War Room's top-3 negatives all line up. `dadan-hindayana.png` (the real BGN head, already in the repo) can back a real actor/leadership face.

## 4. Non-goals

- No change to `/danantara`, `/danantara/krisis`, `/danantara/brief`, `/danantara-v2`, `/danantara/simulation`, `/bumn/*`, `/bumn-v2/*` — they keep their current behaviour (mostly offline against the dead feed).
- No rename of the `/api/v1/danantara/*` namespace, the `danantara` scope key, or the shared component/lib file names (D7/D8).
- No new BFF route, no DB, no schema, no new secret, no change to the LLM stack.
- `/danantara-v2` (root `/api/v1/danantara` snapshot + `briefing`) and `/danantara/simulation` (`world` / `world-chat`) use **different** endpoints and are explicitly out of the mock scope.

## 5. Reversibility & rollback

When the new data source lands: **remove the `mock` prop from `app/bgn/command/page.tsx`** (one line). The panes stop sending `&mock=1`, the routes fall through to the (by-then live) feed, and `lib/bgn/mock/` + the route `mock` branches can be deleted in a follow-up. No env flag to unset, no deploy coupling.

## 6. Risks

| # | Risk | Mitigation |
|---|------|------------|
| R1 | Rebrand copy leaks onto the shared Danantara pages | `brand` is opt-in, default `"Danantara"`; regression tests assert no-prop renders are unchanged. |
| R2 | `mock=1` accidentally served on a non-BGN page | Only `/bgn/command` sets the `mock` prop; a component test asserts the Danantara pages' fetches carry no `mock=1`, and the routes' non-mock path is unchanged. |
| R3 | Fixtures drift from the real response shape | Fixtures are typed against the feed return types; `tsc` fails on drift. |
| R4 | Mock branch ships to prod permanently | Intended (the page is demo-only now); reversal is the one-line prop removal in §5. |
| R5 | Panes look disconnected | Fixtures share one issue/actor set (§3.5); a fixture test asserts the same issue ids appear across topics/threats/actors. |

## 7. Test plan (TDD)

- **Routes:** each of `/topics`, `/threats`, `/actor-intelligence` returns its fixture on `?mock=1` (asserted in production `NODE_ENV`), and is byte-unchanged without it.
- **Fixtures:** cross-consistency — the negative issue ids in `MOCK_TOPICS` are the ones referenced by `MOCK_THREATS` and `MOCK_ACTORS`.
- **Auth:** `homeForScope("danantara") === "/bgn/command"`; the P9 SSO route + fixtures updated; middleware bounce target follows.
- **AppShell:** `/bgn` gets `minimalChrome`; the `danantara`-scope nav includes the `/bgn/command` entry; the entry label/`to` updated.
- **Page:** new `app/bgn/command/page.test.tsx` (mirrors the old command page test); the old `app/danantara/command/` test is removed with the route.
- **Brand/mock props:** default (`Danantara`, no mock) renders leave `/danantara*` panes byte-identical; `brand="BGN"` + `mock` render "BGN Issues", the `/bgn.png` mark, and `&mock=1` on every feed fetch.

## 8. Feature / version impact (for `/change-feature`)

| Feature | From | To | Kind | Why |
|---|---|---|---|---|
| **A13** Command Center | 3.2 | **4.0** | MAJOR | new `/bgn/command` route, old route removed, BGN rebrand, scoped `?mock=1` demo data — new/changed ACs. |
| **A7** CEO Command | 47.0 | **47.1** | MINOR | opt-in `brand`/`mock` props on `CeoCommand`; `?mock=1` branch on `/topics` route. Defaults unchanged. |
| **A10** Crisis Gate | 5.5 | **5.6** | MINOR | opt-in `brand`/`mock` props on `CrisisGate`; `/bgn.png` mark via brand; `?mock=1` branch on `/threats` + `/actor-intelligence`. Defaults unchanged. |
| **A14** War Room | 4.0 | **4.1** | MINOR | `mock` prop threads to `useCounterNarrative`'s topics fetch (AI over mock). |
| **P9** SSO handoff | 1.2 | **1.3** | behaviour | `homeForScope("danantara")` → `/bgn/command` (SSO + middleware landing). Token contract unchanged. |

Build proceeds with TDD (QA cases as failing tests first) only after the study-plan sections + `_index.md` are updated and signed off.
