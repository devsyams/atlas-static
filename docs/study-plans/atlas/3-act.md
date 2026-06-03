# Stage 3 — Act (surfaces & actions)

> What the operator sees and does: the dashboard read API, live widget integration, persisted
> layouts, the Nexorus AI assistant (chat / briefing / forecast / per-widget ask), and real-time
> ticker/alerts/War Room. See `../README.md` (SOP) and `_index.md` (register). API-first: the UI
> calls `/api/v1/*`, never the DB or LLM directly (spec §6).

---

### A1. Dashboard read API & caching

- **Version:** 1.0 · **Stage:** 3-act · **Sprint:** S2 (initial) → S5 · **Status:** Planned · **Spec ref:** §6.1, E6 · **Owner:** Dev A

#### PM
**Background (why):** Today `GET /api/v1/mbg-crisis` reads a bundled JSON via `buildDashboard()`. In
production it must read live Postgres, fast, without hammering the DB on every poll. A cached,
validated read API is the seam between the pipeline's output and everything the operator sees.

**Acceptance criteria:**
- **AC1** — *Given* enriched data in Postgres, *When* `GET /api/v1/mbg-crisis` is called, *Then* it returns the full `DashboardData` shape assembled from the DB (not the static JSON).
- **AC2** — *Given* repeated requests within the cache window, *When* called, *Then* responses are served from Redis cache (30–60 s TTL) and the DB isn't re-queried each time.
- **AC3** — *Given* `GET /api/v1/article-detail`, *When* called with params, *Then* it returns `ArticleDetail` from stored enrichment (replacing derived JSON logic).
- **AC4** — *Given* an unauthenticated request, *When* it hits a read API, *Then* it is rejected (401) per RBAC (P6).

#### Architecture
**Impact — files add/change:**
- `change` `app/api/v1/mbg-crisis/route.ts` → Kysely reads + Redis cache (keep live USD/IDR override)
- `change` `app/api/v1/article-detail/route.ts` → read from `article_enrichment`
- `add` `apps/web/lib/dashboard.repo.ts` (Kysely queries), `apps/web/lib/cache.ts` (Redis)
- `change` retire `lib/mbg/data.ts` static path (keep types)

**Data-model / API changes:** reads all dashboard tables; response contract unchanged (`DashboardData`).
**Reuse:** `lib/mbg/types.ts`, `lib/market/usdidr.ts` (live ticker override stays).
**Risks:** cache staleness vs freshness → short TTL + SSE invalidation (A6).

#### QA
| # | Maps to | Test case | Type |
|---|---|---|---|
| T1 | AC1 | endpoint returns DB-sourced `DashboardData` | integration |
| T2 | AC2 | 2nd request within TTL served from cache (DB not hit) | integration |
| T3 | AC3 | article-detail returns stored enrichment shape | integration |
| T4 | AC4 | unauth read → 401 | integration |

**Governance edge cases:** payload validated against contract; cache keyed safely; no restricted data leaked to viewers.

#### Revision history
| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-05-25 | Initial plan from architecture spec |

---

### A2. Widget integration & live data

- **Version:** 1.0 · **Stage:** 3-act · **Sprint:** S5 · **Status:** Planned · **Spec ref:** §6.1, E6 · **Owner:** Dev A

#### PM
**Background (why):** The widgets are built but fed by a single fetch + `setInterval` and frozen data.
Production needs robust client data flow (caching, refetch, loading/empty/error states) and the new
trend charts that the snapshots (U4) unlock. This is where the live backend finally shows up on screen.

**Acceptance criteria:**
- **AC1** — *Given* the dashboard, *When* it loads, *Then* all widgets fetch via TanStack Query with proper loading, empty, and error states (no silent blank tiles).
- **AC2** — *Given* a transient API failure, *When* it occurs, *Then* the UI shows the offline/cached state (existing `LiveBadge`) and retries, without crashing.
- **AC3** — *Given* `crisis_snapshots`, *When* a trend view renders, *Then* a Recharts time-series shows score history.
- **AC4** — *Given* the existing widgets (gauge, map, top cities, articles, actors, leadership, ticker), *When* wired to the live API, *Then* behaviour matches current UX with real data.

#### Architecture
**Impact — files add/change:**
- `add` `apps/web/lib/queries.ts` (TanStack Query hooks), QueryClient provider in `app/layout.tsx`
- `change` `components/crisis/CrisisDashboard.tsx` → use query hooks (replace manual fetch/interval)
- `add` `components/crisis/TrendChart.tsx` (Recharts) + a trends widget
- `change` widgets to consume query states

**Data-model / API changes:** consumes A1 + `/api/v1/trends` (U4).
**Reuse:** all existing widget components; `LiveBadge`, loading patterns.
**Risks:** hydration mismatches (map already SSR-false) → keep client-only dynamics.

#### QA
| # | Maps to | Test case | Type |
|---|---|---|---|
| T1 | AC1 | each widget shows loading→data; empty + error rendered | component |
| T2 | AC2 | API failure → offline badge + retry, no crash | component + e2e |
| T3 | AC3 | trend chart renders series from snapshots | component |
| T4 | AC4 | widget behaviours match baseline against seeded data | e2e |

**Governance edge cases:** viewer role sees read-only (no edit-layout); error states never expose internals.

#### Revision history
| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-05-25 | Initial plan from architecture spec |

---

### A3. Persisted dashboard layout

- **Version:** 1.0 · **Stage:** 3-act · **Sprint:** S5 · **Status:** Planned · **Spec ref:** §6.1, §9, E6 · **Owner:** Dev A

#### PM
**Background (why):** Operators arrange the war-room grid to their workflow, but today the layout
lives in `localStorage` — lost on a new device or cleared cache, and invisible to the org. Persisting
it per user server-side makes the workspace portable and durable.

**Acceptance criteria:**
- **AC1** — *Given* a signed-in user who rearranges widgets, *When* they save, *Then* the layout is persisted to `dashboard_layouts` for that user.
- **AC2** — *Given* a returning user on any device, *When* they open the dashboard, *Then* their saved layout loads server-side.
- **AC3** — *Given* the reset action, *When* used, *Then* the layout reverts to default and the stored layout is cleared.
- **AC4** — *Given* a layout schema change, *When* an old layout loads, *Then* `reconcileLayout` still enforces minimums (no broken tiles).

#### Architecture
**Impact — files add/change:**
- `add` `apps/web/app/api/v1/layout/route.ts` (GET/PUT, auth-scoped)
- `change` `CrisisDashboard.tsx` → persist via API instead of `localStorage` (keep reconcile)

**Data-model / API changes:** `dashboard_layouts(user_id PK, layout_jsonb, updated_at)`.
**Reuse:** existing `DEFAULT_LAYOUT`, `reconcileLayout`, edit-mode UX.
**Risks:** layout version skew → keep `reconcileLayout` + a layout version key.

#### QA
| # | Maps to | Test case | Type |
|---|---|---|---|
| T1 | AC1 | save → row persisted for the user | integration |
| T2 | AC2 | load on new session returns saved layout | e2e |
| T3 | AC3 | reset clears stored layout; default returns | integration |
| T4 | AC4 | stale layout reconciled to valid minimums | unit |

**Governance edge cases:** a user can only read/write their own layout (authz); invalid layout JSON rejected.

#### Revision history
| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-05-25 | Initial plan from architecture spec |

---

### A4. AI assistant — copilot chat

- **Version:** 1.0 · **Stage:** 3-act · **Sprint:** S5 · **Status:** Planned · **Spec ref:** §6.2, §8, E7 · **Owner:** Dev B + Dev A

#### PM
**Background (why):** The ⌘K copilot is a headline feature, but its logic lives in the TS BFF and is
Anthropic-only against static grounding. Topology C moves all LLM work to Python: the assistant must
answer grounded on the **real** DB, be model-agnostic, stream smoothly, and degrade to the scripted
fallback when the model is unavailable.

**Acceptance criteria:**
- **AC1** — *Given* a question, *When* sent to `POST /api/v1/ai/chat`, *Then* the BFF authenticates, rate-limits, and stream-proxies to the Python ai-api, which streams a grounded answer.
- **AC2** — *Given* grounding, *When* the assistant answers, *Then* context is built from Postgres (current crisis data), not the static JSON.
- **AC3** — *Given* the model is unavailable, *When* a request fails, *Then* a deterministic scripted fallback answers (no hard error).
- **AC4** — *Given* a conversation, *When* messages exchange, *Then* they persist to `ai_conversations`/`ai_messages` with cost logged.

#### Architecture
**Impact — files add/change:**
- `add` `services/pipeline/ai_api/chat.py` (FastAPI streaming; LiteLLM via U1; grounding from DB)
- `change` `app/api/v1/ai/chat/route.ts` → auth + rate-limit + stream proxy (+ tiny TS fallback)
- `move` `lib/ai/{context,scripted}.ts` logic → Python (`ai_api/grounding.py`, `ai_api/scripted.py`)
- `change` `components/ai/NexorusCopilot.tsx` if response contract changes (keep streaming UX)

**Data-model / API changes:** `ai_conversations`, `ai_messages`; grounding reads dashboard tables.
**Reuse:** existing copilot UI + streaming reader; prompt-cache pattern.
**Risks:** proxy/streaming buffering → verify chunked passthrough end-to-end.

#### QA
| # | Maps to | Test case | Type |
|---|---|---|---|
| T1 | AC1 | authed chat streams tokens through proxy | integration + e2e |
| T2 | AC2 | grounding reflects DB state (changes when data changes) | integration |
| T3 | AC3 | model down → scripted fallback answers | integration |
| T4 | AC4 | conversation persisted; cost logged | integration |

**Governance edge cases:** unauth/over-limit rejected; provider not hardcoded (U1); restricted data not surfaced to viewers; keys server-side.

#### Revision history
| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-05-25 | Initial plan from architecture spec |

---

### A5. AI assistant — briefing, forecast & per-widget ask

- **Version:** 1.0 · **Stage:** 3-act · **Sprint:** S5 · **Status:** Planned · **Spec ref:** §6.2, §8, E7 · **Owner:** Dev B + Dev A

#### PM
**Background (why):** Beyond chat, the assistant's executive **briefing** (SITREP), **forecast/early-
warning**, and **per-widget Ask** are what turn the dashboard from a display into a decision aid.
These endpoints must move to Python alongside chat, share the same model-agnostic, grounded, cost-
tracked path, and keep their current UI entry points (Briefing button, bell menu, per-tile spark).

**Acceptance criteria:**
- **AC1** — *Given* the Briefing action, *When* invoked, *Then* `POST /api/v1/ai/briefing` returns a grounded SITREP synthesized from current dashboard data.
- **AC2** — *Given* the forecast/early-warning view, *When* requested, *Then* `POST /api/v1/ai/forecast` returns escalation trajectories + anomaly signals from real snapshots/articles.
- **AC3** — *Given* a widget's Ask (explain/drivers/talking-points), *When* invoked, *Then* `POST /api/v1/ai/widget` returns a grounded answer scoped to that widget.
- **AC4** — *Given* all three, *When* the model is unavailable, *Then* scripted fallbacks respond and cost is logged when live.

#### Architecture
**Impact — files add/change:**
- `add` `services/pipeline/ai_api/{briefing,forecast,widget}.py`
- `change` `app/api/v1/ai/{briefing,forecast,widget}/route.ts` → proxy + auth + rate-limit
- `change` `components/ai/BriefingPanel.tsx` + bell/forecast + per-widget spark if contracts shift

**Data-model / API changes:** reads snapshots/articles/predictions; logs to `ai_messages`.
**Reuse:** existing BriefingPanel, forecast UI, per-widget Ask affordances; grounding module (A4).
**Risks (R2):** briefing/forecast are token-heavy → stronger model only here; cache per snapshot.

#### QA
| # | Maps to | Test case | Type |
|---|---|---|---|
| T1 | AC1 | briefing returns grounded SITREP from current data | integration |
| T2 | AC2 | forecast returns trajectories/anomalies from snapshots | integration |
| T3 | AC3 | widget ask scoped + grounded per widget | integration |
| T4 | AC4 | fallbacks answer when model down; cost logged live | integration |

**Governance edge cases:** rate-limited; provider-agnostic; no fabricated citations; viewer restrictions respected.

#### Revision history
| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-05-25 | Initial plan from architecture spec |

---

### A6. Real-time ticker, alerts & War Room

- **Version:** 1.0 · **Stage:** 3-act · **Sprint:** S5–S6 · **Status:** Planned · **Spec ref:** §6.1, §11, E8 · **Owner:** Dev A + Dev C

#### PM
**Background (why):** In a crisis, latency matters. Operators shouldn't wait for a 30-minute poll to
learn a high-severity incident just landed. Push-based updates for the ticker and new-incident alerts
(and the War Room display) make ATLAS feel live and act as an early-warning surface.

**Acceptance criteria:**
- **AC1** — *Given* new data committed by the pipeline, *When* a snapshot/high-crisis incident is written, *Then* Postgres `NOTIFY` fires and the BFF `GET /api/v1/sse` pushes an event to connected clients.
- **AC2** — *Given* an SSE event, *When* received, *Then* the ticker/score update and a new-incident alert surfaces without a full reload.
- **AC3** — *Given* the War Room mode, *When* open, *Then* it consumes the same live stream for an always-on display.
- **AC4** — *Given* SSE is unavailable, *When* it drops, *Then* the client falls back to TanStack Query polling (no stale lock).

#### Architecture
**Impact — files add/change:**
- `add` `apps/web/app/api/v1/sse/route.ts` (SSE; subscribes to Postgres LISTEN/Redis pub-sub)
- `add` pipeline `NOTIFY` on snapshot/high-crisis insert (or Redis publish)
- `change` `Ticker.tsx`, alert affordance, `WarRoomMode.tsx` to consume SSE
- `add` `apps/web/lib/sse.ts` (client w/ reconnect + polling fallback)

**Data-model / API changes:** none new; uses snapshot/incident writes as triggers.
**Reuse:** existing `Ticker`, `WarRoomMode`, `LiveBadge`; Redis (P2).
**Risks:** connection scaling/instances → Redis pub-sub fan-out; heartbeat + reconnect.

#### QA
| # | Maps to | Test case | Type |
|---|---|---|---|
| T1 | AC1 | new incident → NOTIFY → SSE event emitted | integration |
| T2 | AC2 | client updates ticker + raises alert on event | e2e |
| T3 | AC3 | War Room reflects live stream | e2e |
| T4 | AC4 | SSE drop → polling fallback resumes updates | integration |

**Governance edge cases:** SSE endpoint authenticated; per-connection limits (P7 rate-limit); no sensitive payloads to viewers; heartbeat prevents zombie connections.

#### Revision history
| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-05-25 | Initial plan from architecture spec |

---

### A7. Danantara CEO Command Wall (zero-click demo)

- **Version:** 5.0 · **Stage:** 3-act · **Sprint:** demo · **Status:** In progress · **Spec ref:** `docs/superpowers/specs/2026-06-02-danantara-ceo-command-design.md` · **Owner:** Dev A

#### PM
**Background (why):** Client feedback on the Danantara demo: the real audience is the **CEO**, who
"doesn't have time for clicking". The current `/danantara` (Sovereign Command) is operator-grade —
tabs, draggable grid, modals — and dies in a CEO demo. The CEO wants three things surfaced
automatically: the **top 20 issues** around Danantara, the **top 20 BUMN by public sentiment**, and
an **unmissable warning when an issue escalates** (mentions/reach spiking abnormally fast). A
zero-click command wall is also the strongest possible demo artifact (screenshot-shareable, runs
itself on a TV).

*(v4.0)* Client direction after the v3.0 viewing: the CEO reads the wall as **"what is good vs what
is bad"** — they want sentiment to be the organizing principle, not rank. The wall becomes **two
columns**: **left = Danantara topics grouped into positive / negative**, **right = BUMN names grouped
into positive / negative**, each panel headed by a **pie chart** of overall sentiment share. The
rotating Spotlight and the breaking-news takeover are dropped — the grouping itself now carries the
"what's wrong" signal, and the takeover competed with it for attention.

*(v5.0)* Client refinement on the v4.0 build: the pie belongs **on each topic and each BUMN**, not as
one aggregate per panel — the CEO reads item-by-item, and a per-item pie answers "how bad is *this
one*" at a glance. And the positive / negative groups should sit **side by side** (two sub-columns
inside each panel), not stacked, so good vs bad is a single horizontal comparison.

**Acceptance criteria:**
- **AC1** *(amended v4.0)* — *Given* `/danantara` loads, *When* no user interaction occurs, *Then* the issue board, BUMN sentiment board, and AI brief ticker all render and animate on their own. *(Spotlight removed in v4.0.)*
- **AC2** *(amended v4.0)* — *Given* the issue board, *When* the simulation ticks, *Then* issues stay live-ranked **within their sentiment group** with re-rank animation, per-row sparkline, velocity %, and status badge.
- **AC3** *(amended v4.0)* — *Given* the BUMN board, *When* rendered, *Then* exactly 20 BUMN tiles show net sentiment (−100..100) as a green↔red heatmap with trend spark, **grouped by sentiment sign** (see AC13).
- **AC4** — *(removed in v4.0 — breaking-news takeover and spotlight pin dropped; escalating issues keep their ESKALASI badge and row pulse on the board.)*
- **AC5** — *(removed in v4.0 — scripted arcs still drive board badges, but no takeover to trigger; presenter hotkey `E` dropped.)*
- **AC6** — *Given* the old dashboard, *When* `/danantara-v2` is opened, *Then* the full Sovereign Command experience works exactly as it does today.
- **AC7** *(amended v4.0)* — *Given* a phone-width viewport, *When* `/danantara` loads, *Then* the layout stacks (header → ticker → issues → BUMN) and stays zero-click.
- **AC8** — *Given* the issue board or the BUMN board, *When* an item's rank differs from its rank one rolling window ago (6 ticks ≙ "2 jam"), *Then* the row/tile shows a green ▲ with positions gained, a red ▼ with positions lost, or a neutral "=" stay indicator when unchanged (league-table style).
- **AC9** *(amended v5.0)* — *Given* any issue or BUMN, *When* it renders on a board, *Then* its sentiment is shown as a **mini pie chart** with explicit positive and negative **% labels** (green/red), not just a net score; positive + negative + neutral shares sum to 100%. The detail modal keeps the labeled split bar with counts.
- **AC10** *(amended v4.0)* — *Given* any issue row or BUMN tile, *When* it is clicked/tapped, *Then* a detail panel opens with the full picture (live trend chart, sentiment % + counts, rank movement, velocity/reach/mention stats, headlines for issues / related issues for BUMN, related-BUMN chips for issues / top issue for BUMN), closable via Esc, the ✕ button, or clicking the overlay; the simulation keeps ticking underneath. Clicking remains optional — the zero-click experience (AC1) is unchanged.
- **AC11** *(v4.0)* — *Given* `/danantara` on a desktop/TV viewport, *When* it renders, *Then* the wall is **two columns**: Danantara topics on the left, BUMN sentiment on the right — no third (Spotlight) column and no takeover overlay.
- **AC12** *(v4.0, amended v5.0)* — *Given* the topic board, *When* it renders, *Then* topics are split into a **TOPIK POSITIF** sub-column (positive mentions > negative mentions) and a **TOPIK NEGATIF** sub-column (otherwise), rendered **side by side**, each ranked by reach (largest first), with counts shown; a topic moves between sub-columns live when its sentiment flips.
- **AC13** *(v4.0, amended v5.0)* — *Given* the BUMN board, *When* it renders, *Then* BUMN are split into a **SENTIMEN POSITIF** sub-column (net sentiment ≥ 0) and a **SENTIMEN NEGATIF** sub-column (net sentiment < 0), rendered **side by side**, positive ranked most-positive first, negative ranked most-negative first, with counts shown; a BUMN moves between sub-columns live when its net sentiment flips sign.
- **AC14** *(v4.0, amended v5.0)* — *Given* any topic row or BUMN tile, *When* it renders, *Then* it carries its **own pie/donut chart** of that item's positive / negative / neutral **mention share** with % labels, updating live with the tick. There is **no** panel-level aggregate pie.

#### Architecture
**Impact — files add/change:**
- `change` `app/danantara/page.tsx` → render new `CeoCommand` (in `AppShell`)
- `add` `app/danantara-v2/page.tsx` → render existing `SovereignCommand` (pure move)
- `add` `lib/danantara/ceo/types.ts` — `CeoIssue`, `BumnSentiment`, `EscalationEvent`, `CeoSnapshot`
- `add` `lib/danantara/ceo/data.ts` — 20 curated issues + 20 BUMN sentiment rows (public sources only)
- `add` `lib/danantara/ceo/engine.ts` — pure sim/rank/velocity/status/spotlight/scripted-arc functions
- `add` `components/danantara/ceo/{CeoCommand,HeaderStrip,IssueBoard,BumnHeatboard,Spotlight,BreakingTakeover,AiBriefTicker}.tsx`
- `add` `lib/danantara/ceo/engine.test.ts` + component smoke tests (vitest)
- *(v2.0)* `change` `lib/danantara/ceo/{types,engine,data}.ts` — rank history/delta tracking + sentiment breakdown (pos/neg/neutral counts)
- *(v2.0)* `add` `components/danantara/ceo/{RankBadge,SentimentSplit}.tsx`; `change` `IssueBoard`, `BumnHeatboard`, `Spotlight` to show both
- *(v3.0)* `add` `components/danantara/ceo/DetailModal.tsx` (issue + BUMN variants); `change` `IssueBoard`/`BumnHeatboard` rows/tiles become clickable buttons; `CeoCommand` owns selection state
- *(v4.0)* `change` `lib/danantara/ceo/engine.ts` — add pure grouping selectors `groupIssuesBySentiment()` / `groupBumnBySentiment()` + `sentimentTotals()` aggregate for the pies
- *(v4.0)* `add` `components/danantara/ceo/SentimentPie.tsx` — hand-rolled SVG donut (follows `SectorDonut` pattern; no chart dependency)
- *(v4.0)* `change` `components/danantara/ceo/{IssueBoard,BumnHeatboard}.tsx` — render two grouped sections + `SentimentPie` header
- *(v4.0)* `change` `components/danantara/ceo/CeoCommand.tsx` — 2-column grid; remove Spotlight / BreakingTakeover / hotkey wiring (takeover queue state deleted from reducer)
- *(v4.0)* `delete` `components/danantara/ceo/{Spotlight,BreakingTakeover}.tsx`
- *(v5.0)* `change` `components/danantara/ceo/SentimentPie.tsx` — add `mini` variant (per-row donut + inline pos/neg % labels)
- *(v5.0)* `change` `components/danantara/ceo/{IssueBoard,BumnHeatboard}.tsx` — positive/negative groups become side-by-side sub-columns; rows/tiles swap the SentimentSplit bar for the mini pie; panel-level pie removed
- *(v5.0)* `keep` `components/danantara/ceo/SentimentSplit.tsx` — full variant still used by the detail modal

**Data-model / API changes:** none (static demo; no DB/API). Production wiring is A1/A2 scope.
**Reuse:** `AppShell`, existing `lib/danantara/types.ts` (`Holding` universe, `CrisisSignal` velocity concept), `lib/ai/scripted.ts` narration pattern, command-center design tokens.
**Risks:** demo must never miss the escalation moment → deterministic scripted arcs + hotkey; 40 live-animating items on TV → throttle to one shared 4 s tick, CSS-transform-only animations.

#### QA
| # | Maps to | Test case | Type |
|---|---|---|---|
| T1 | AC1 | snapshot render: all four zones present, no interaction handlers required | component |
| T2 | AC2 | `rankIssues` orders by reach; `tick` preserves order invariant; sparkline/velocity data present | unit |
| T3 | AC3 | `rankBumn` returns exactly 20 sorted by net sentiment | unit |
| T4 | AC4 | *(retired in v4.0 — takeover/spotlight removed; `statusOf` ladder unit tests kept for board badges)* | unit |
| T5 | AC5 | *(retired in v4.0 — hotkey removed; scripted-arc tick test kept)* | unit |
| T6 | AC6 | `/danantara-v2` page renders `SovereignCommand` | component |
| T7 | AC7 | stacked layout below `md` breakpoint (header → ticker → issues → BUMN) | component |
| T8 | AC8 | `rankDelta` = rank window-ago − current rank; ▲/▼/= rendered per delta sign on both boards | unit + component |
| T9 | AC9 | breakdown: pos+neg+neutral = mentions, net sign matches sentiment sign; mini pie + % labels rendered on rows & tiles; detail modal keeps labeled split bar | unit + component |
| T10 | AC10 | click issue row → issue detail opens; click BUMN tile → BUMN detail opens; Esc / ✕ / overlay closes; detail shows live data | component |
| T11 | AC11 | wall grid has exactly two columns; `Spotlight` and `BreakingTakeover` are not rendered and files removed from the bundle | component |
| T12 | AC12 | `groupIssuesBySentiment`: pos>neg → positive group, tie/neg → negative group; within-group order by reach desc; both sub-columns render **side by side** with counts; flipping sentiment moves the row | unit + component |
| T13 | AC13 | `groupBumnBySentiment`: sentiment ≥ 0 → positive, < 0 → negative; positive sorted desc, negative sorted asc; sub-columns side by side; flipping sign moves the tile | unit + component |
| T14 | AC14 | mini pie renders **on every row/tile** with one segment per non-zero share + % labels; no panel-level pie; updates after tick | unit + component |

**Governance edge cases:** all data from public/open sources (no client-internal figures); AI ticker is deterministic scripted fallback (no live LLM call, no provider key client-side); demo banner identifies synthetic data; no auth change (`AppShell` login gate reused as-is).

#### Revision history
| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-06-02 | Initial plan from CEO feedback (zero-click rebuild; old dashboard → /danantara-v2) |
| 1.1 | 2026-06-03 | Status → Built (55 tests green, build verified). Review-driven refinements: bounded simulation growth (reach tracks mentions, capped), 21→20 issue trim, live spotlight pin per AC4, queued concurrent takeovers, /danantara-v2 middleware scope fix |
| 2.0 | 2026-06-03 | Client feedback after first viewing: + AC8 (league-table rank movement arrows ▲▼= on both boards) and AC9 (explicit positive/negative sentiment counts, not just net score). Status → In progress |
| 2.1 | 2026-06-03 | AC9 refined during build (client): percentages primary, counts secondary (spotlight only). Split bar kept over pie chart — length comparison beats angle comparison across 40 items. Status → Built (83 tests green, build + live visual verification on TV/phone viewports) |
| 3.0 | 2026-06-03 | Client: + AC10 click-to-detail on every issue & BUMN (optional drill-down; zero-click flow unchanged). Status → Built (93 tests green, cross-navigation verified live). Backlog: modal focus-trap/role="dialog" for keyboard a11y |
| 4.0 | 2026-06-03 | Client: sentiment becomes the organizing principle. Two-column wall (topics left / BUMN right) grouped into positive/negative sections + per-panel sentiment pie (AC11–AC14). Spotlight, breaking takeover & hotkey removed (AC4/AC5 retired; AC1/AC2/AC3/AC7/AC10 amended). Status → Built (118 tests green, build verified) |
| 5.0 | 2026-06-03 | Client refinement on v4.0: pie chart moves **onto every topic/BUMN** (panel aggregate pie removed) and positive/negative groups render **side by side** as sub-columns (AC9/AC12/AC13/AC14 amended). Status → In progress |
