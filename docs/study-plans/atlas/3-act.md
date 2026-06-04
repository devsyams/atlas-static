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

- **Version:** 22.0 · **Stage:** 3-act · **Sprint:** demo · **Status:** Built · **Spec ref:** `docs/superpowers/specs/2026-06-02-danantara-ceo-command-design.md` · **Owner:** Dev A

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

*(v6.0)* The CEO is **60 years old**. The wall's type scale (9–13px, designed for analyst-grade
density) is illegible to him at desk/TV distance — the entire artifact fails if the one person it's
built for can't read it. Readability becomes a hard requirement: **nothing below 16px**, names at
20px, key numbers larger still. All 20 items per board are kept; panels scroll vertically.

*(v22.0)* Correcting the v21.0 hierarchy: a BUMN row should not be headlined by the company name. The
row now **leads with the BUMN's dominant topic as the 24px headline** (parallel to the Issues board —
every row of both boards now leads with a topic), and the **BUMN ticker drops to a small eyebrow
label** above it (the logo already carries identity). So the BUMN board reads "this BUMN → here's the
story about it", with the pie + tint + column giving sentiment.

*(v21.0)* Two type tweaks: topic titles step up to **24px** (`text-2xl`, bolder) so the headline the
CEO actually reads leads each row; and a BUMN row is titled by its **nickname/ticker** (`short`, e.g.
*GIAA*, *BBRI*) rather than the full legal name — the logo already carries the full identity, and the
short label fits the half-width column cleanly.

*(v20.0)* Correction to v19.0: "like the Danantara Issues board" means its **two-column
positive/negative split**, not a flat list. The BUMN board now renders two side-by-side sub-columns —
**SENTIMEN POSITIF** (net sentiment ≥ 0) and **SENTIMEN NEGATIF** (< 0), via `groupBumnBySentiment` —
each holding issues-style BUMN rows. Real **logos** were sourced into `/public/bumn/` for 12 BUMN
(favicon-service marks); the remaining 8 (incl. Pertamina/PLN/Telkom/KAI, not indexed) use the
monogram fallback until higher-res files are dropped in.

*(v19.0)* The BUMN board is **rebuilt to mirror the Danantara Issues rows**: one row per BUMN =
**logo + `rank.` + BUMN name** with a muted **context line** (its top issue) on the left, and the
**BUMN's own sentiment pie stacked over its mention count** on the right. This retires the v7–v18
two-cell *positive-topic / negative-topic* layout. Each BUMN gets a **logo**: a real asset at
`/public/bumn/{id}.png`, monogram fallback (ticker on a sector-tinted tile) when absent. The topic-cell
selectors (`topicsForBumn`) remain for reuse / the detail modal.

*(v18.0)* Each topic row gains a **context line** — a one-line AI read of the topic (the existing
`aiLine`) shown beneath the title as a **sneak peek**: muted, smaller than the title (16px floor, AC15),
clamped to two lines so the row stays clean. It gives the CEO the *why* behind a headline without a
click; the full picture still lives in the detail modal. Content stays Indonesian (it is data).

*(v17.0)* Rank-cell tidy. The neutral "stay" dash (`–`) sat under nearly every rank number (the board
is steady most of the time) and read as clutter — so an unchanged rank now renders **nothing**; only
real movement shows a green ▲ / red ▼. Rank numbers also gain a trailing period (`1.`, `2.`, …). (Also
englished the rank-movement tooltips, an AC17 miss.)

*(v16.0)* Bug the client spotted: the mini donut drew `pos → neutral → neg` clockwise, so the green
arc sat on the **right** while its green % label sat on the **left** — chart reversed against labels.
Fixed by drawing the mini donut in reverse (`neg → neutral → pos`) so green lands on the left and red
on the right, in step with the flanking labels.

*(v15.0)* Micro-tweak the client liked: the mini pie's percentages **flank the donut** —
`value% · donut · value%` (green positive on the left, red negative on the right) — instead of being
grouped on one side (v13.0). Applies on both boards.

*(v14.0)* Topic-row layout to the client's sketch: **rank + full title on the left** (title wraps
across lines, never truncated), with the **sentiment pie stacked over the reach value on the right**
— e.g. `1. Hilirisasi nikel & investasi smelter … [pie] / 34.0M reach`. Replaces the v13.0 stacked-card
(title over a reach-left/pie-right meta line); the pie+reach are now a single right-hand column.

*(v13.0)* Topic-row tidy. The per-row **velocity %** is dropped from the list — the RISING /
ESCALATING badge already signals momentum, and the CEO reads the list for *what* is hot, not the exact
growth number (velocity stays in the drill-down detail modal). The per-row **pie moves to the right
side** of the meta line (reach on the left), and the pie's **positive (green) and negative (red)
percentages are grouped together to the left of the donut** rather than flanking it, so the two
colored values read as a matched pair instead of looking detached from the chart.

*(v12.0)* The demo audience for this build is English-speaking, so the wall's **UI chrome is
localized to English** — panel headings, section/column labels, badges (RISING / ESCALATING), metric
labels, the AI ticker narration templates, detail-modal labels, and units (reach in `M`, counts in
`K`/`M`, "reach"/"mentions"). The **content stays Indonesian** as instructed: topic titles, BUMN
names, headlines + their timestamps, the AI lines, and the category/sector taxonomy tags (the latter
also shared read-only with the Sovereign Command build). So a row reads as an English frame around an
Indonesian story — e.g. *POSITIVE TOPICS · "Hilirisasi nikel & investasi smelter" · 34.0M reach*.

*(v11.0)* BUMN-board metric rework. The abstract **−100…+100 net-sentiment score is removed** (even
with the tooltip it read as jargon to the CEO; the green↔red row tint already carries the sign). In
its place the board gains the metrics the CEO actually scans: a **sequential rank number** per row
(1…20, beside the existing movement arrow — matching the topic board), and, inside **each topic
cell**, that topic's **reach value (jt jangkauan) and sentiment %** (the pie's label) — so every named
good/bad story shows how far it travelled and how lopsided it is. (BUMN carry no reach of their own;
the figure is the linked topic's reach.)

*(v10.0)* Polish pass. (1) The BUMN rows name a positive and a negative topic but show no *strength*
of each — so each topic cell now carries its **own mini sentiment pie** (same per-item pie used on the
topic board), making "how positive / how negative is this story" legible per cell. (2) The net-score
number beside each BUMN name was unlabeled and drew a "what is this?" — it gets a **tooltip** ("Skor
sentimen bersih −100…+100"). (3) The Isu Danantara per-row **pie + meta line is tidied** (consistent
alignment: pie left, reach · velocity right) and the pie-totals construction is factored into one
shared helper so both boards build pies identically.

*(v9.0)* On review, the v8.0 single list lost something the CEO relied on: the **explicit TOPIK
POSITIF / TOPIK NEGATIF split**. For topics the labeled good-vs-bad columns matter more than visual
parity with the BUMN list, so the **two side-by-side sub-columns return**. The v7.0 messy-title
problem is solved a different way this time: instead of widening the column (which forced the flat
list), each row now **stacks the title on its own line above a compact meta line** (pie + velocity),
so the title owns the full column width and wraps cleanly (balanced) rather than colliding with the
pie. Pie stays on every row.

*(v8.0)* Client liked the v7.0 BUMN single-row list and wants the **topic board to match it**: one
full-width list, one topic per row, **but the per-topic pie chart stays** (it is the topic board's
sentiment read). This also fixes a v7.0 side-effect — in the cramped side-by-side sub-columns the now
un-truncated titles wrapped across 2–3 lines and looked messy. A single full-width list gives each
title the whole panel width, so it reads on one line (long ones wrap cleanly, balanced). The
side-by-side **TOPIK POSITIF / TOPIK NEGATIF** sub-columns are retired; the list instead **leads with
the most-negative topics** (problems first, mirroring the BUMN list) and carries the same green↔red
per-row sentiment tint.

*(v7.0)* Two refinements from the latest viewing. **Topic board:** the per-row sparkline is
**noise** to the CEO — he reads the headline and the sentiment, not a 6-point trend squiggle — so it
is dropped, and the per-row sentiment **pie takes the sparkline's trailing slot** (the eye already
goes there for the "how bad is this" read). Topic **titles must show in full** — truncating the one
piece of text the CEO actually reads is self-defeating; titles wrap. **BUMN board:** the side-by-side
positive/negative sub-columns are replaced by a **single full-width list, one BUMN per row**, and
each row answers the CEO's real question directly — *for this company, what's the good story and
what's the bad story* — by naming its **leading positive topic and leading negative topic** instead
of an abstract pie. One BUMN, one positive topic, one negative topic, per line.

**Acceptance criteria:**
- **AC1** *(amended v4.0)* — *Given* `/danantara` loads, *When* no user interaction occurs, *Then* the issue board, BUMN sentiment board, and AI brief ticker all render and animate on their own. *(Spotlight removed in v4.0.)*
- **AC2** *(amended v4.0, v7.0, v13.0)* — *Given* the issue board, *When* the simulation ticks, *Then* issues stay live-ranked **within their sentiment group** with re-rank animation and status badge. *(v7.0: per-row sparkline removed. v13.0: per-row **velocity % removed** from the list — the RISING/ESCALATING badge carries momentum; velocity remains in the detail modal.)*
- **AC3** *(amended v4.0, v7.0, v11.0)* — *Given* the BUMN board, *When* rendered, *Then* all 20 BUMN render as a **single full-width list, one BUMN per row** (most-negative first), each row prefixed with a **sequential rank number** (1…20) plus its rank-movement badge, with net sentiment encoded as a **green↔red row tint** (the explicit −100..100 score number is removed in v11.0). *(v7.0: replaces the grouped heatmap tiles; see AC16.)*
- **AC4** — *(removed in v4.0 — breaking-news takeover and spotlight pin dropped; escalating issues keep their ESKALASI badge and row pulse on the board.)*
- **AC5** — *(removed in v4.0 — scripted arcs still drive board badges, but no takeover to trigger; presenter hotkey `E` dropped.)*
- **AC6** — *Given* the old dashboard, *When* `/danantara-v2` is opened, *Then* the full Sovereign Command experience works exactly as it does today.
- **AC7** *(amended v4.0)* — *Given* a phone-width viewport, *When* `/danantara` loads, *Then* the layout stacks (header → ticker → issues → BUMN) and stays zero-click.
- **AC8** *(amended v17.0)* — *Given* the issue board or the BUMN board, *When* an item's rank differs from its rank one rolling window ago (6 ticks ≙ "2 jam"), *Then* the row/tile shows a green ▲ with positions gained or a red ▼ with positions lost (league-table style). *(v17.0: an **unchanged** rank renders **no** badge — the neutral stay dash is dropped as clutter. Rank numbers display with a trailing period, e.g. `1.`)*
- **AC9** *(amended v5.0)* — *Given* any issue or BUMN, *When* it renders on a board, *Then* its sentiment is shown as a **mini pie chart** with explicit positive and negative **% labels** (green/red), not just a net score; positive + negative + neutral shares sum to 100%. The detail modal keeps the labeled split bar with counts.
- **AC10** *(amended v4.0)* — *Given* any issue row or BUMN tile, *When* it is clicked/tapped, *Then* a detail panel opens with the full picture (live trend chart, sentiment % + counts, rank movement, velocity/reach/mention stats, headlines for issues / related issues for BUMN, related-BUMN chips for issues / top issue for BUMN), closable via Esc, the ✕ button, or clicking the overlay; the simulation keeps ticking underneath. Clicking remains optional — the zero-click experience (AC1) is unchanged.
- **AC11** *(v4.0)* — *Given* `/danantara` on a desktop/TV viewport, *When* it renders, *Then* the wall is **two columns**: Danantara topics on the left, BUMN sentiment on the right — no third (Spotlight) column and no takeover overlay.
- **AC12** *(v4.0, amended v5.0, v7.0, v8.0, v9.0)* — *Given* the topic board, *When* it renders, *Then* topics are split into a **TOPIK POSITIF** sub-column (positive mentions > negative) and a **TOPIK NEGATIF** sub-column (otherwise), rendered **side by side**, each ranked by reach (largest first) with counts shown; a topic moves between sub-columns live when its sentiment flips. Each row shows the **full topic title** (wraps cleanly/balanced, never truncates) with a **muted AI context line beneath it** (the topic's `aiLine`, a 2-line-clamped sneak peek smaller than the title; v18.0), and the per-topic pie stacked over reach on the right. *(v9.0 restores the v5–v7 side-by-side columns retired in v8.0; v14.0 rank+title left / pie over reach right; v18.0 adds the context line.)*
- **AC13** *(v4.0, amended v5.0, retired v7.0)* — *(retired in v7.0 — the BUMN board no longer groups into side-by-side positive/negative sub-columns; it is a single per-row list, see AC16. Net-sentiment grouping is still available via `groupBumnBySentiment`, used by the detail modal / kept for reuse.)*
- **AC14** *(v4.0, amended v5.0, v7.0, v10.0, v13.0)* — *Given* any **topic row** or any **present BUMN topic cell** (positive/negative), *When* it renders, *Then* it carries its **own pie/donut chart** of that topic's positive / negative / neutral **mention share** with % labels, updating live with the tick. The mini pie renders its percentages **flanking the donut** — green (positive) % left, donut, red (negative) % right (`value% · donut · value%`, v15.0) — and the **donut arcs align with the labels** (green on the left, red on the right; v16.0); on topic rows the pie sits in a **right-hand column stacked over the reach value** (v14.0). There is **no** panel-level aggregate pie. *(v10.0: pies return to the BUMN board — one per topic cell.)*
- **AC15** *(v6.0, amended v21.0, v22.0)* — *Given* the CEO wall (boards, header, ticker, and the detail modal), *When* any text renders, *Then* **no text is smaller than 16px**; the row headline on **both** boards — the topic title (Issues) and the BUMN's top-issue headline (BUMN) — renders at **24px**; the BUMN ticker label is a secondary **≥ 16px** eyebrow (v22.0); key numbers (sentiment scores, header metrics) are **at least 24px**. Lists keep all 20 items and scroll vertically.
- **AC17** *(v12.0)* — *Given* the CEO wall (boards, header, ticker, detail modal), *When* any **UI chrome** renders, *Then* it is in **English** (panel/section/column headings, status badges RISING/ESCALATING, metric labels, AI-ticker narration templates, modal labels, and units — reach in `M`, counts in `K`/`M`). *Given* any **content** (topic title, BUMN name, headline + timestamp, AI line, category/sector tag), *Then* it remains **Indonesian**. This supersedes the Indonesian label strings quoted in earlier ACs/QA (e.g. "TOPIK POSITIF" → "POSITIVE TOPICS", "Tidak ada…" → "No …", "jt"/"jangkauan" → "M"/"reach").
- **AC16** *(v7.0, amended v10.0, v11.0, superseded v19.0 → AC18)* — *(v7–v18: each BUMN row named a leading positive topic and a leading negative topic, each with its own pie + reach. Retired in v19.0 — the BUMN board now mirrors the Danantara Issues rows; see AC18. `topicsForBumn` is kept for reuse.)*
- **AC18** *(v19.0, amended v20.0)* — *Given* the BUMN board, *When* it renders, *Then* it mirrors the Danantara Issues board: **two side-by-side sub-columns**, **SENTIMEN POSITIF** (net sentiment ≥ 0) and **SENTIMEN NEGATIF** (< 0) with counts (`groupBumnBySentiment`; a BUMN moves columns when its net sentiment flips sign). Each BUMN renders as an issues-style row: **logo + sequential `rank.` (per column) + rank-movement badge**, then a small **BUMN ticker eyebrow** (the `short` label) over the **BUMN's dominant topic as the 24px headline** (v22.0; was the company name), and the **BUMN's own sentiment pie** (its pos/neg/neutral mention share) stacked over its **mention count** on the right; the row keeps the green↔red net-sentiment tint and opens the BUMN detail on click (AC10). The **logo** loads from `/public/bumn/{id}.png` and falls back to a monogram (ticker on a sector-tinted tile) when the file is absent.

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
- *(v6.0)* `change` all CEO wall components — readability type scale: `{IssueBoard,BumnHeatboard,SentimentPie,HeaderStrip,AiBriefTicker,RankBadge,Sparkline,DetailModal,SentimentSplit}.tsx` (16px floor / 20px names / 24px key numbers; pies & sparklines scaled up to match)
- *(v7.0)* `add` `lib/danantara/ceo/engine.ts` → `topicsForBumn(bumnId, issues)` pure selector (leading positive / negative linked topic by reach)
- *(v7.0)* `change` `components/danantara/ceo/IssueBoard.tsx` — drop per-row `Sparkline`; move the mini `SentimentPie` into the vacated trailing slot; topic title wraps (remove `truncate`)
- *(v7.0)* `change` `components/danantara/ceo/BumnHeatboard.tsx` — replace grouped tiles with a single per-row list; each row shows BUMN identity + leading positive topic + leading negative topic (no per-tile pie/sparkline)
- *(v7.0)* `change` `components/danantara/ceo/CeoCommand.tsx` — pass `issues={state.issues}` to `BumnHeatboard` so rows can resolve their linked topics
- *(v7.0)* `keep` `lib/danantara/ceo/engine.ts` `groupBumnBySentiment` + `components/.../Sparkline.tsx` (still used elsewhere / by the topic detail)
- *(v8.0)* `add` `lib/danantara/ceo/format.ts` → `sentimentTint(sentiment, alpha)` shared green↔red row tint
- *(v8.0)* `change` `components/danantara/ceo/IssueBoard.tsx` — single full-width list (drop side-by-side `IssueGroup` sub-columns); order most-negative first via `groupIssuesBySentiment`; per-row tint; keep pie/velocity/badge; balanced title wrap
- *(v8.0)* `change` `components/danantara/ceo/BumnHeatboard.tsx` — use shared `sentimentTint` (was a local `heatColor`)
- *(v9.0)* `change` `components/danantara/ceo/IssueBoard.tsx` — restore side-by-side `IssueGroup` TOPIK POSITIF / TOPIK NEGATIF sub-columns (`issue-groups` grid-cols-2); redesign `IssueRow` to a stacked card (title line over a pie+velocity meta line) so narrow-column titles stay legible; keep per-row tint + pie
- *(v10.0)* `add` `lib/danantara/ceo/format.ts` → `pieTotals(item)` shared SentimentPie-totals builder
- *(v10.0)* `change` `components/danantara/ceo/BumnHeatboard.tsx` — `TopicCell` stacks a mini `SentimentPie` under the topic title; net-score span gets a `title` tooltip; grid rows top-align
- *(v10.0)* `change` `components/danantara/ceo/IssueBoard.tsx` — tidy meta line (pie left, reach · velocity right) via shared `pieTotals`
- *(v11.0)* `change` `components/danantara/ceo/BumnHeatboard.tsx` — drop net-score span; add sequential rank number (`bumn-rank`) to each row; `TopicCell` adds the linked topic's reach + sentiment % under the pie; widen identity grid column for the rank number
- *(v12.0)* `change` UI chrome → English across `{IssueBoard,BumnHeatboard,HeaderStrip,AiBriefTicker,SentimentPie,SentimentSplit,DetailModal}.tsx` + `lib/danantara/ceo/engine.ts` (`briefLines` templates) + `lib/danantara/ceo/format.ts` (`fmtCount` → `K`/`M`, en-US). `keep` Indonesian: `data.ts` content, `CATEGORY_LABEL`, shared `SECTOR_LABEL`
- *(v13.0)* `change` `components/danantara/ceo/IssueBoard.tsx` — remove per-row velocity (+ unused threshold imports); meta line = reach left, pie right. `change` `components/danantara/ceo/SentimentPie.tsx` — mini variant groups pos%/neg% then donut (donut on the right)
- *(v14.0)* `change` `components/danantara/ceo/IssueBoard.tsx` — row → rank + full title (left) | pie stacked over reach (right column)
- *(v15.0)* `change` `components/danantara/ceo/SentimentPie.tsx` — mini variant: pos% · donut · neg% (percentages flank the donut)
- *(v16.0)* `change` `components/danantara/ceo/SentimentPie.tsx` — mini donut draws reversed (neg→neutral→pos) so green arc is left / red right, matching the labels
- *(v17.0)* `change` `components/danantara/ceo/RankBadge.tsx` — unchanged rank renders null (no stay dash); English movement tooltips. `change` `{IssueBoard,BumnHeatboard}.tsx` — rank number shows trailing period (`{rank}.`)
- *(v18.0)* `change` `components/danantara/ceo/IssueBoard.tsx` — render the topic's `aiLine` as a muted, 2-line-clamped context line (`issue-ailine`) beneath the title
- *(v19.0)* `rewrite` `components/danantara/ceo/BumnHeatboard.tsx` — issues-style rows (logo + rank + name + context | pie over mentions); `add` `BumnLogo` (next/image `/bumn/{id}.png` + monogram fallback); drop the positive/negative `TopicCell`. `add` `public/bumn/` (logo drop-in dir + README). `keep` `topicsForBumn` (now unused by the board; detail modal / reuse)
- *(v20.0)* `change` `components/danantara/ceo/BumnHeatboard.tsx` — wrap rows in two `BumnGroup` sub-columns (`bumn-groups` grid-cols-2) via `groupBumnBySentiment`. `add` 12 real logo PNGs under `public/bumn/` (favicon-service marks; 8 remain monogram)
- *(v21.0)* `change` `IssueBoard.tsx` topic title → `text-2xl`; `BumnHeatboard.tsx` name → `row.short` nickname at `text-2xl`
- *(v22.0)* `change` `BumnHeatboard.tsx` — row leads with the BUMN's top issue as `text-2xl` headline (`bumn-headline`); `bumn-name` (ticker) demoted to a `text-base` eyebrow

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
| T8 | AC8 | `rankDelta` = rank window-ago − current rank; ▲ (up) / ▼ (down) rendered per delta sign on both boards; an unchanged rank (delta 0) renders **nothing** (no stay badge) | unit + component |
| T9 | AC9 | breakdown: pos+neg+neutral = mentions, net sign matches sentiment sign; mini pie + % labels rendered on rows & tiles; detail modal keeps labeled split bar | unit + component |
| T10 | AC10 | click issue row → issue detail opens; click BUMN tile → BUMN detail opens; Esc / ✕ / overlay closes; detail shows live data | component |
| T11 | AC11 | wall grid has exactly two columns; `Spotlight` and `BreakingTakeover` are not rendered and files removed from the bundle | component |
| T12 | AC12 | `groupIssuesBySentiment`: pos>neg → positive, tie/neg → negative (within-group reach desc); topic board renders **side-by-side** TOPIK POSITIF / TOPIK NEGATIF sub-columns (`issue-groups` grid-cols-2) with counts; each row stacks full title over a pie+velocity meta line; flipping sentiment moves the row | unit + component |
| T13 | AC13 | `groupBumnBySentiment` selector still classifies sentiment ≥ 0 → positive, < 0 → negative (kept for reuse; board no longer renders side-by-side sub-columns) | unit |
| T14 | AC14 | mini pie renders **on every topic row** and **on each present BUMN topic cell** with one segment per non-zero share + % labels; no panel-level pie; **no sparkline on topic rows** (no `polyline`); updates after tick | unit + component |
| T15 | AC15 | governance scan: rendered wall (and open detail modal) contains **no element with a text class under 16px** (`text-xs`, `text-sm`, `text-[<16px]`); titles/names use ≥ 20px classes; key numbers ≥ 24px | component |
| T17 | AC17 | rendered wall uses English chrome (POSITIVE/NEGATIVE TOPICS, RISING/ESCALATING, metric labels, `M`/reach units, `K`/`M` counts) while content stays Indonesian (topic titles, BUMN names, headlines, category tags); `fmtCount` returns `K`/`M` | unit + component |
| T16 | AC16/AC18 | `topicsForBumn` unit behaviour kept (reuse). BUMN board (v19.0): one issues-style row per BUMN — logo (`bumn-logo`, monogram fallback), `rank.`, name title, top-issue context line, one sentiment pie + mention count; no positive/negative topic cells; clicking a row fires `onSelect(bumnId)` | unit + component |

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
| 5.0 | 2026-06-03 | Client refinement on v4.0: pie chart moves **onto every topic/BUMN** (panel aggregate pie removed) and positive/negative groups render **side by side** as sub-columns (AC9/AC12/AC13/AC14 amended). Status → Built (124 tests green, build verified) |
| 6.0 | 2026-06-03 | Client constraint: CEO is 60 — current type illegible. + AC15 readability scale: 16px floor, 20px names, 24px key numbers, across boards/header/ticker/modal; pies & sparklines scaled up. Status → Built (129 tests green, build verified) |
| 7.0 | 2026-06-03 | Client refinement on v6.0: topic rows drop the sparkline (the pie takes its trailing slot) and show titles in full (AC2/AC12/AC14 amended); BUMN board becomes a single per-row list naming each BUMN's leading positive & negative topic instead of grouped pie tiles (+ AC16; AC3 amended, AC13 retired). Status → Built (129 tests green, build verified) |
| 8.0 | 2026-06-03 | Client: make the topic board match the BUMN single-row list (full-width list, most-negative first, per-row sentiment tint) **but keep the per-topic pie**; fixes the v7.0 messy multi-line title wrap in the narrow sub-columns. Side-by-side TOPIK POSITIF/NEGATIF sub-columns retired (AC12 amended). Status → Built |
| 9.0 | 2026-06-03 | Client: restore the explicit side-by-side TOPIK POSITIF / TOPIK NEGATIF columns (the labeled split matters more than parity with the BUMN list). Title legibility solved instead by a stacked row card — title line above a pie+velocity meta line — so titles own the full column width. Pie + tint kept (AC12 amended). Status → Built |
| 10.0 | 2026-06-03 | Client polish: each BUMN topic cell gets its own mini sentiment pie (AC14/AC16 amended); net-score number gets a −100…+100 tooltip; Isu Danantara meta line/pie layout tidied; shared `pieTotals` helper. Status → Built |
| 11.0 | 2026-06-03 | Client: BUMN board metric rework — remove the −100…+100 net-score number (tint keeps the sign), add a sequential rank number per row, and show each topic cell's reach value + sentiment % (AC3/AC16 amended). Status → Built |
| 12.0 | 2026-06-03 | Client: localize UI chrome to English (headings, labels, badges, AI-ticker, modal, units M/K) while keeping content Indonesian (topic titles, BUMN names, headlines, category/sector tags). + AC17. Status → Built |
| 13.0 | 2026-06-04 | Client: topic rows drop per-row velocity % (badge carries momentum; velocity kept in detail modal); mini pie groups green/red % then donut, and the pie moves to the right side of the topic row (AC2/AC14 amended). Status → Built |
| 14.0 | 2026-06-04 | Client sketch: topic row = rank + full title on the left, sentiment pie stacked over the reach value on the right (AC12/AC14 amended). Status → Built |
| 15.0 | 2026-06-04 | Client micro-tweak: mini pie percentages flank the donut — value% · donut · value% (AC14 amended). Status → Built |
| 16.0 | 2026-06-04 | Client bug: mini donut arcs were reversed vs labels (green drew on the right). Donut now draws neg→neutral→pos so green is left / red right, matching labels (AC14 amended). Status → Built |
| 17.0 | 2026-06-04 | Client: drop the neutral "stay" rank dash (unchanged rank renders nothing; only ▲/▼ show) and add a trailing period to rank numbers (1., 2., …); english rank tooltips (AC8 amended). Status → Built |
| 18.0 | 2026-06-04 | Client: add a per-topic context line (the AI `aiLine`) beneath each title — muted, smaller, 2-line-clamped sneak peek (AC12 amended). Status → Built |
| 19.0 | 2026-06-04 | Client: rebuild the BUMN board to mirror the Danantara Issues rows (logo + rank + name + top-issue context | BUMN's own pie over mention count); retire the positive/negative topic cells; add per-BUMN logo (real asset + monogram fallback). AC16 superseded by + AC18. Status → Built |
| 20.0 | 2026-06-04 | Client correction: "like Issues" = the two-column positive/negative split. BUMN board now renders SENTIMEN POSITIF / SENTIMEN NEGATIF sub-columns side by side (groupBumnBySentiment) with issues-style rows; sourced 12 real BUMN logos into public/bumn (AC18 amended). Status → Built |
| 21.0 | 2026-06-04 | Client: bigger topic titles (text-2xl); BUMN rows titled by nickname/ticker (short) instead of full name (AC15/AC18 amended). Status → Built |
| 22.0 | 2026-06-04 | Client: BUMN name shouldn't headline the row. Row now leads with the BUMN's top issue as the 24px headline; ticker demoted to a small eyebrow label (AC15/AC18 amended). Status → Built |
