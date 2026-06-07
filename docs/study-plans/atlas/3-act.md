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

- **Version:** 36.0 · **Stage:** 3-act · **Sprint:** demo · **Status:** Built · **Spec ref:** `docs/superpowers/specs/2026-06-02-danantara-ceo-command-design.md` · **Owner:** Dev A

#### PM
*(v31.0)* The wall graduates from a self-running **simulation** to a **live feed** for the Danantara
topics. A real media-intelligence endpoint now exists
(`api.garudaperkasa.io/api-nexorus/topics`) returning the actual Danantara topics with impressions,
reach, categorical sentiment + a positive/negative/neutral breakdown, an AI `penjelasan`, plus
aggregate `summary` and `intent` (share-of-voice). The **Issues (topics) board** is wired to it
through a server-side BFF route (the `api_key` stays on the server, never in the browser), requesting
a **rolling 28-day window** and **cached** (~6 h; the upstream refreshes ~daily) for Vercel. The
**BUMN board has no live feed yet**, so it stays on the seeded simulation (hybrid). If the upstream is
unavailable the board **degrades gracefully** to the existing seeded topics. This is the first time
the CEO sees *real* numbers, not a plausible mock — the credibility step before a production wiring.

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

*(v27.0)* Follow-up: the BUMN rank number was visual clutter — a mono `1.` stacked above the logo
above the name made three competing identity lines in one narrow column. The rank is now a small
**badge pinned to the top-left corner of the logo**, so logo + name read as the single clean identity
and the movement arrow sits beside the name.

*(v26.0)* Follow-up: the pie+reach block is **pinned to the top-right** of each BUMN topic cell with
the title flowing to its left (title-left / pie-right), exactly like an Issues row — rather than
stacked beneath the title.

*(v25.0)* Consistency tweak: inside each BUMN topic cell the pie is now **stacked over the reach**
(right-aligned), exactly like the Danantara Issues rows, rather than inline beside it.

*(v24.0)* Settling the BUMN row shape per the client's original intent ("BUMN | positive topic |
negative topic"): each row is **one BUMN**, and the row's three cells are **BUMN identity | its leading
negative topic | its leading positive topic** (negative first), each topic cell a styled chip with the
topic's **own sentiment pie + reach**. This reverts the v19–v23 single-headline/two-column detours:
the board is a single list again (one row per BUMN, most-negative first), the BUMN is identified by
rank · logo · ticker, and the topic cells come back via `topicsForBumn` with a placeholder when a tone
is absent.

*(v23.0)* The eyebrow-ticker-over-headline stack felt busy. The BUMN **ticker now sits directly under
its logo** as one compact identity block, leaving the text column to carry only the 24px topic
headline — a calmer row.

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
- **AC2** *(amended v4.0, v7.0, v13.0, v31.0)* — *Given* the issue board, *Then* issues stay ranked **within their sentiment group** by reach with status badge. *(v7.0: per-row sparkline removed. v13.0: per-row **velocity % removed** from the list — the RISING/ESCALATING badge carries momentum; velocity remains in the detail modal. **v31.0:** topics are sourced from the live feed (AC19) as a static snapshot — they no longer fake-drift each tick; the **BUMN board keeps the simulation tick** for its animated movement.)*
- **AC3** *(amended v4.0, v7.0, v11.0)* — *Given* the BUMN board, *When* rendered, *Then* all 20 BUMN render as a **single full-width list, one BUMN per row** (most-negative first), each row prefixed with a **sequential rank number** (1…20) plus its rank-movement badge, with net sentiment encoded as a **green↔red row tint** (the explicit −100..100 score number is removed in v11.0). *(v7.0: replaces the grouped heatmap tiles; see AC16.)*
- **AC4** — *(removed in v4.0 — breaking-news takeover and spotlight pin dropped; escalating issues keep their ESKALASI badge and row pulse on the board.)*
- **AC5** — *(removed in v4.0 — scripted arcs still drive board badges, but no takeover to trigger; presenter hotkey `E` dropped.)*
- **AC6** — *Given* the old dashboard, *When* `/danantara-v2` is opened, *Then* the full Sovereign Command experience works exactly as it does today.
- **AC7** *(amended v4.0)* — *Given* a phone-width viewport, *When* `/danantara` loads, *Then* the layout stacks (header → ticker → issues → BUMN) and stays zero-click.
- **AC8** *(amended v17.0)* — *Given* the issue board or the BUMN board, *When* an item's rank differs from its rank one rolling window ago (6 ticks ≙ "2 jam"), *Then* the row/tile shows a green ▲ with positions gained or a red ▼ with positions lost (league-table style). *(v17.0: an **unchanged** rank renders **no** badge — the neutral stay dash is dropped as clutter. Rank numbers display with a trailing period, e.g. `1.`)*
- **AC9** *(amended v5.0, v34.0)* — *Given* any issue or BUMN, *When* it renders on a board, *Then* its sentiment is shown as a **mini pie chart** with explicit positive and negative **% labels** (green/red), not just a net score; positive + negative + neutral shares sum to 100%. *(**v34.0:** the **issue** detail drops the horizontal split bar — the **full `SentimentPie`** (positive/negative/**neutral** % + counts) now carries the breakdown there; the **BUMN** detail keeps the labeled split bar.)*
- **AC10** *(amended v4.0, v32.0)* — *Given* any issue row or BUMN tile, *When* it is clicked/tapped, *Then* a detail panel opens with the full picture (live trend chart, sentiment % + counts, rank movement, velocity/reach/mention stats, a **Description** for issues / related issues for BUMN, related-BUMN chips for issues / top issue for BUMN), closable via Esc, the ✕ button, or clicking the overlay; the simulation keeps ticking underneath. Clicking remains optional — the zero-click experience (AC1) is unchanged. *(**v32.0:** the issue detail's **"Top Coverage" headlines list is replaced by a "Description"** section showing the topic's `aiLine`/`penjelasan` — the v31.0 live feed carries no headlines, so the empty list is dropped in favour of the AI read.)* *(**v33.0:** the issue detail's **trend line chart is replaced by the full `SentimentPie`** (positive/negative/**neutral** share), and the **velocity stat + category tag are removed** — the static 28-day snapshot from the live feed carries no time-series, so velocity is always 0 and the keyword-inferred category was noise. The mini per-row pies in the topic list stay pos%/neg% only — neutral is shown in the detail pie, not the list.)* *(**v34.0:** the issue detail's **title is shown in full** (wraps, never truncated); **Impressions** and **Reach** become labeled metric cards each with a one-line English hint ("Total views across all posts in this topic" / "Number of users exposed to this topic") and the Sentiment pie gets a hint ("Breakdown of emotional tone (Positive/Negative/Neutral %)"); the horizontal **split bar is removed** (see AC9).)*
- **AC11** *(v4.0)* — *Given* `/danantara` on a desktop/TV viewport, *When* it renders, *Then* the wall is **two columns**: Danantara topics on the left, BUMN sentiment on the right — no third (Spotlight) column and no takeover overlay.
- **AC12** *(v4.0, amended v5.0, v7.0, v8.0, v9.0, v35.0)* — *Given* the topic board, *When* it renders, *Then* topics are split into a **NEGATIVE TOPICS** sub-column (positive mentions ≤ negative) and a **POSITIVE TOPICS** sub-column, rendered **side by side** with **NEGATIVE on the left** *(v35.0, client/boss direction — problems lead; was positive-left)*, each ranked by reach (largest first) with counts shown; a topic moves between sub-columns live when its sentiment flips. Each row shows the **full topic title** (wraps cleanly/balanced, never truncates) with a **muted AI context line beneath it** (the topic's `aiLine`, a 2-line-clamped sneak peek smaller than the title; v18.0), and the per-topic pie stacked over reach on the right. *(v9.0 restores the v5–v7 side-by-side columns retired in v8.0; v14.0 rank+title left / pie over reach right; v18.0 adds the context line.)*
- **AC13** *(v4.0, amended v5.0, retired v7.0)* — *(retired in v7.0 — the BUMN board no longer groups into side-by-side positive/negative sub-columns; it is a single per-row list, see AC16. Net-sentiment grouping is still available via `groupBumnBySentiment`, used by the detail modal / kept for reuse.)*
- **AC14** *(v4.0, amended v5.0, v7.0, v10.0, v13.0)* — *Given* any **topic row** or any **present BUMN topic cell** (positive/negative), *When* it renders, *Then* it carries its **own pie/donut chart** of that topic's positive / negative / neutral **mention share** with % labels, updating live with the tick. The mini pie renders its percentages **flanking the donut** — green (positive) % left, donut, red (negative) % right (`value% · donut · value%`, v15.0) — and the **donut arcs align with the labels** (green on the left, red on the right; v16.0); on topic rows the pie sits in a **right-hand column stacked over the reach value** (v14.0). There is **no** panel-level aggregate pie. *(v10.0: pies return to the BUMN board — one per topic cell.)*
- **AC15** *(v6.0, amended v21.0)* — *Given* the CEO wall (boards, header, ticker, and the detail modal), *When* any text renders, *Then* **no text is smaller than 16px**; topic titles (Issues board) render at **24px** (v21.0) and BUMN names (ticker) at **≥ 20px**; topic-cell text and the BUMN context are ≥ 16px; key numbers (sentiment scores, header metrics) are **at least 24px**. Lists keep all 20 items and scroll vertically.
- **AC17** *(v12.0)* — *Given* the CEO wall (boards, header, ticker, detail modal), *When* any **UI chrome** renders, *Then* it is in **English** (panel/section/column headings, status badges RISING/ESCALATING, metric labels, AI-ticker narration templates, modal labels, and units — reach in `M`, counts in `K`/`M`). *Given* any **content** (topic title, BUMN name, headline + timestamp, AI line, category/sector tag), *Then* it remains **Indonesian**. This supersedes the Indonesian label strings quoted in earlier ACs/QA (e.g. "TOPIK POSITIF" → "POSITIVE TOPICS", "Tidak ada…" → "No …", "jt"/"jangkauan" → "M"/"reach").
- **AC16** *(v7.0, amended v10.0, v11.0, superseded v19.0 → AC18)* — *(v7–v18: each BUMN row named a leading positive topic and a leading negative topic, each with its own pie + reach. Retired in v19.0 — the BUMN board now mirrors the Danantara Issues rows; see AC18. `topicsForBumn` is kept for reuse.)*
- **AC18** *(v19.0, amended v20.0, settled v24.0, v27.0, v29.0)* — *Given* the BUMN board, *When* it renders, *Then* it is a **single list, one row per BUMN** (most-negative first), each row laid out in three cells: **(1) BUMN identity** — the **logo** (`/public/bumn/{id}.png`, monogram fallback when absent) carrying the **sequential rank as a small corner badge** *(v27.0; was a stacked mono `rank.` line)*, with the BUMN **ticker** (`short`, ≥ 20px) and the rank-movement badge beside it on the line below; **(2) its leading positive topic**; **(3) its leading positive topic** *(v35.0: **negative before positive**, so the **negative column sits on the left** — matching the Danantara Issues board's v35.0 negative-left order; this reverses the v29.0 positive-left arrangement, again on client/boss direction so problems lead)*. The column headers use the **same English wording as the Issues board** — `POSITIVE TOPICS` (green) / `NEGATIVE TOPICS` (red), per AC17 — not the earlier Indonesian "TOPIK POSITIF/NEGATIF". Each present topic cell is the highest-reach `CeoIssue` linked to that BUMN whose tone is positive / negative, shown as a green/red chip with the topic title, the topic's **own mini sentiment pie**, and its **reach**; an absent tone shows an **empty topic-cell placeholder** *(v30.0: a muted, dashed, tone-tinted cell with the trend icon + an em-dash — **not** a "No … topic" text line)*, so every BUMN row always shows both columns uniformly. The row keeps the green↔red net-sentiment tint and opens the BUMN detail on click (AC10). *(Supersedes the v20 two-column grouping and the v22–v23 single-headline layout.)*
- **AC19** *(v31.0)* — *Given* `/danantara` loads, *When* the Issues (topics) board renders, *Then* its topics come from the **live `garudaperkasa.io` feed** via the **`/api/v1/danantara/topics` BFF route** — the route fetches upstream **server-side** with the `api_key` from env (the key is **never** present in any browser payload), for a **rolling 28-day window** (`enddate` = today, `startdate` = today − 28d), and the response is **cached** (~1 h revalidate, Vercel data cache; *v36.0, was 6 h*), with a **manual Refresh** in the header that re-requests with `?fresh=1` so the BFF **bypasses the cache** (`no-store`) and re-hits the upstream for the newest data on demand *(v36.0)*. Each upstream topic maps to a `CeoIssue`: `topik`→title, `impressions`→mentions, `reach`→reach, `stats_sentiment.{positive,negative,neutral}`→the mini pie shares and the net sentiment (`positive − negative`), `penjelasan`→`aiLine`, with `headlines: []` and `relatedBumn: []`; the header totals come from `summary`. *And When* the upstream is unavailable or returns an error, *Then* the board **degrades gracefully** to the existing seeded mock topics and surfaces a cached/offline state (the wall never blanks). The **BUMN board is unaffected** — it stays on the seeded simulation (no live BUMN feed in this version).

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
- *(v23.0)* `change` `BumnHeatboard.tsx` — move `bumn-name` ticker into the logo column (stacked under the logo); text column holds only the headline
- *(v24.0)* `rewrite` `BumnHeatboard.tsx` — single list, row = `grid-cols-[5rem_1fr_1fr]`: identity (rank · logo · ticker) | negative `TopicCell` | positive `TopicCell` (restored, with pie + reach), via `topicsForBumn`; drop the two-column `BumnGroup`
- *(v25.0)* `change` `BumnHeatboard.tsx` `TopicCell` — pie stacked over reach (`flex-col items-end`), matching the Issues rows
- *(v26.0)* `change` `BumnHeatboard.tsx` `TopicCell` — title-left / pie+reach top-right (cell is `flex items-start`; title `flex-1`), like an Issues row
- *(v27.0)* `change` `BumnHeatboard.tsx` `BumnRow` — rank moved from a stacked mono `rank.` line into a corner badge on the logo (`relative` logo wrapper + absolutely-positioned `bumn-rank`); name + movement arrow share one line
- *(v28.0)* `assets` `public/bumn/{pertamina,pln,kai,bulog,semen,telkom,waskita}.png` — 7 real BUMN logos sourced (Wikidata P154 → Commons PNG; waskita via site favicon), lifting logo coverage 12 → 19/20; only `jasamarga` keeps the monogram (no clean corporate mark available). No component change — `BumnLogo` already prefers the asset over the monogram fallback.
- *(v29.0)* `change` `BumnHeatboard.tsx` — swap the topic cells to **positive then negative** (positive column on the left, matching Issues) and relabel the column legend `POSITIVE TOPICS` / `NEGATIVE TOPICS` (English, matching the Issues board) instead of `TOPIK NEGATIF/POSITIF`; header subtitle → `positive & negative topic`. Fixes the cross-board wording + side inconsistency (and the lingering AC17 violation).
- *(v30.0)* `change` `BumnHeatboard.tsx` `TopicCell` — render an **empty placeholder cell** when a tone is absent (muted/dashed tone-tinted cell, trend icon + em-dash) instead of the plain "No positive/negative topic" text line, so every BUMN row shows both columns. (Tone is computed live from drifting sentiment, so absence must be handled in the view, not the seed data.)
- *(v31.0)* `add` `lib/danantara/ceo/topics-source.ts` — pure helpers: `rollingWindow(today, days)` → `{startdate, enddate}`; `buildTopicsUrl(base, code, key, window)`; `mapTopicsResponse(json)` → `{ issues: CeoIssue[], summary, intent }` (sentiment math, flat history, empty headlines/relatedBumn, keyword-inferred `category`)
- *(v31.0)* `add` `app/api/v1/danantara/topics/route.ts` — BFF GET: reads `DANANTARA_TOPICS_API_{BASE,KEY}` + `DANANTARA_TOPIC_CODE` (server-side), computes the rolling window, `fetch(upstream, { next: { revalidate: 21600 } })`, returns `mapTopicsResponse(...)`; on upstream error returns a non-OK status so the client falls back. (No `force-dynamic` — caching is the point.)
- *(v31.0)* `change` `lib/danantara/ceo/types.ts` — add upstream DTOs (`TopicsApiResponse`, `UpstreamTopic`, `TopicsSummary`, `TopicIntent`)
- *(v31.0)* `change` `components/danantara/ceo/CeoCommand.tsx` — fetch `/api/v1/danantara/topics` on mount; seed `state.issues` from the live payload (fall back to `buildInitialState()` topics on error); keep `buildInitialState().bumn` + the 4 s `tick` for the **BUMN board only**; surface a live/cached/offline state
- *(v31.0)* `add` `.env.example` — `DANANTARA_TOPICS_API_BASE`, `DANANTARA_TOPICS_API_KEY`, `DANANTARA_TOPIC_CODE` (real values set in `.env.local` + Vercel, never committed)
- *(v31.0)* `add` `lib/danantara/ceo/topics-source.test.ts` + `app/api/v1/danantara/topics/route.test.ts` + extend `CeoCommand.test.tsx` (vitest)

**Data-model / API changes:** *(v31.0)* new **read-only BFF route** `/api/v1/danantara/topics` proxying + transforming the external feed (no DB). New **server-only** secret `DANANTARA_TOPICS_API_KEY`. Full production wiring (DB-backed) remains A1/A2 scope.
**Reuse:** `AppShell`, existing `lib/danantara/types.ts` (`Holding` universe, `CrisisSignal` velocity concept), `lib/ai/scripted.ts` narration pattern, command-center design tokens; *(v31.0)* the `process.env` server-side-key pattern from `lib/ai/engine.ts` / `lib/jasamarga/connector.ts`, and the `LiveBadge` live/offline pattern from `SovereignCommand`.
**Risks:** demo must never miss the escalation moment → deterministic scripted arcs + hotkey; 40 live-animating items on TV → throttle to one shared 4 s tick, CSS-transform-only animations. *(v31.0:* upstream latency/outage → data cache + mock fallback (AC19); rolling window rotates the cache key daily (one fresh fetch/day, acceptable); upstream sentiment is **categorical** (string + %), mapped into the numeric −100..100 model.*)*

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
| T18 | AC19 | `mapTopicsResponse`: `topik`→title, `impressions`→mentions, `reach`→reach; pos/neg/neutral counts = `impressions × pct` (sum = impressions); net sentiment sign matches `stats_sentiment`; `penjelasan`→`aiLine`; `headlines`/`relatedBumn` empty; summary/intent passed through | unit |
| T19 | AC19 | `rollingWindow(today, 28)` → `enddate` = today, `startdate` = today − 28d (ISO `YYYY-MM-DD`); `buildTopicsUrl` injects the topic code + `api_key` query params | unit |
| T20 | AC19 | route: upstream OK → mapped `{issues, summary, intent}`; upstream error/timeout → non-OK response; **`api_key` never appears in the route's JSON output** (governance) | unit |
| T21 | AC19 | `CeoCommand` renders live topics when the fetch resolves; on fetch error it renders the seeded mock topics (graceful degradation) and the BUMN board still ticks | component |

**Governance edge cases:** all data from public/open sources (no client-internal figures); AI ticker is deterministic scripted fallback (no live LLM call, no provider key client-side); demo banner identifies synthetic data; no auth change (`AppShell` login gate reused as-is). *(v31.0:* the topics `api_key` lives **only** in server env and is never serialized to the client (API-first + secrets-server-side guardrails); upstream failure falls back to seeded data, never a blank wall (graceful degradation); the live feed is **public media-intelligence data**, consistent with the open-source-data rule.*)*

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
| 23.0 | 2026-06-04 | Client: row felt busy — BUMN ticker moved under the logo as one identity block; text column carries only the topic headline (AC18 amended). Status → Built |
| 24.0 | 2026-06-04 | Client (original intent): each BUMN row = identity | negative topic | positive topic, each topic cell with its own pie + reach. Reverts v20 two-column grouping / v22–23 single headline; single list restored (AC18 settled, AC15 reverted). Status → Built |
| 25.0 | 2026-06-04 | Client: BUMN topic-cell pie stacked over reach (right-aligned), matching the Danantara Issues rows. Status → Built |
| 26.0 | 2026-06-04 | Client: pie+reach pinned top-right of the BUMN topic cell (title-left / pie-right), like an Issues row. Status → Built |
| 27.0 | 2026-06-04 | Client: the stacked BUMN rank number was unclean. Rank moved into a small badge on the logo's top-left corner; logo + name become one identity block (AC18 amended). Status → Built |
| 28.0 | 2026-06-04 | Client: source logos for the BUMN still on monograms. Added 7 real logos (pertamina, pln, kai, bulog, semen, telkom, waskita) → 19/20 covered; jasamarga keeps the monogram (no clean corporate mark). Assets only, no component change. Status → Built |
| 29.0 | 2026-06-04 | Client: BUMN topic columns inconsistent with the Issues board. Swap to positive-left/negative-right and relabel POSITIVE TOPICS / NEGATIVE TOPICS (English, matching Issues; fixes AC17 violation). AC18 amended. Status → Built |
| 30.0 | 2026-06-04 | Client: replace the "No positive/negative topic" text with an empty placeholder topic cell (muted dashed tone-tinted cell + icon + em-dash) so every BUMN row shows both columns. AC18 amended. Status → Built |
| 31.0 | 2026-06-07 | Client: wire the Issues (topics) board to the **live `garudaperkasa.io` media-intelligence feed** via a server-side BFF route (`/api/v1/danantara/topics`, `api_key` server-only, rolling 28-day window, ~6 h Vercel cache); upstream failure degrades to seeded topics. BUMN board stays simulated (no live feed yet). + AC19; AC2 amended. Status → Built (155 tests green, typecheck + lint clean, build verified) |
| 32.0 | 2026-06-07 | Client: in the **issue detail modal**, remove the "Top Coverage" headlines list (empty under the live feed) and show a **Description** section with the topic's `aiLine`/`penjelasan` instead. AC10 amended. Status → Built |
| 33.0 | 2026-06-07 | Client: issue detail — replace the **trend line chart with a sentiment pie** (incl. **neutral** share) and **remove the velocity stat + category tag** (no time-series in the static feed → velocity always 0). Split bar kept. List mini-pies stay pos/neg only. AC10 amended. Status → Built |
| 34.0 | 2026-06-07 | Client: issue detail — show the **full topic title** (no truncation); turn **Impressions/Reach** into labeled metric cards with English hints + a Sentiment hint; **remove the horizontal split bar** (the pie carries the breakdown). AC9/AC10 amended. Status → Built |
| 35.0 | 2026-06-07 | Boss: put the **negative topics on the left** on both boards — the Issues topic board and the BUMN row topic cells (+ legend) now lead with NEGATIVE (reverses v29.0 positive-left). AC12/AC18 amended. Status → Built |
| 36.0 | 2026-06-07 | Client: cache the topics feed **1 h** (was 6 h) and add a header **Refresh** button that forces a fresh upstream pull (`?fresh=1` → `no-store`), so a manually-refreshing dashboard user always re-hits the endpoint. AC19 amended. Status → Built |

---

### A8. Per-BUMN CEO sentiment dashboards

- **Version:** 3.0 · **Stage:** 3-act · **Sprint:** demo · **Status:** Built · **Spec ref:** built on A7's live topics feed (`docs/superpowers/specs/2026-06-02-danantara-ceo-command-design.md`) · **Owner:** Dev A

#### PM
**Background (why):** Danantara is the **holding company over all BUMN**, but the Danantara CEO Command wall (A7) is one aggregate view. The boss wants a **dedicated dashboard per BUMN**, each aimed at **that BUMN's own CEO** — a focused, low-density read of *"how is the public talking about my company right now"*. These users are **40–60 years old**, non-analyst executives, so the dashboard must be **simple and readable** (large type, no operator chrome) and **zero-config** (open the URL, see your company). It also has to be **access-scoped**: each BUMN CEO signs in as their own user and only ever sees their own company's dashboard — they must not wander into Danantara-wide or other BUMN data during a demo. The live feed already exposes a **topic code per BUMN** (`danantara_‹bumn›`), so each dashboard is the same A7 topics endpoint pointed at a different code — real data, not a mock. Launch set: **7 BUMN** (Mandiri, PLN, Telkom, Pertamina, BNI, BRI, Jasa Marga).

**Acceptance criteria:**
- **AC1** — *Given* a registered BUMN slug, *When* `/bumn/‹slug›` loads, *Then* it renders that BUMN's dashboard (header = BUMN name) driven by a **registry** (`slug → name → topicCode`); *And When* the slug is not in the registry, *Then* it 404s. A super-admin-only **`/bumn` index** lists all registered BUMN with links.
- **AC2** — *Given* a BUMN dashboard, *When* it loads data, *Then* it calls the BFF `/api/v1/danantara/topics?code=‹code›` where **`code` is validated against the registry allowlist** (an unknown/absent code rejects or falls back to `danantara_main`, never proxied blindly). The request uses a **rolling 7-day window that auto-widens to 28 days when the 7-day window returns 0 topics**, is **cached ~1 h** (Vercel data cache) with the header **Refresh** forcing a fresh upstream pull (`?fresh=1` → `no-store`); on upstream error the page **degrades gracefully** (last-known/empty state, never a blank screen).
- **AC3** *(amended v2.0)* — *Given* the dashboard, *When* it renders, *Then* it shows a **Sentiment Summary** built from `summary`: a **dominant-sentiment verdict** (the largest of positive/neutral/negative as a large colored headline + %), a **segmented bar** (green/neutral/red) sized by share, a legend of all three %s, and the feed's **total impressions & reach** as context. *(v2.0 replaces the original 3-slice donut — a donut reads poorly for a 3-way split at exec glance; the verdict + bar is clearer and uses `total_impressions`/`total_reach` too.)*
- **AC4** — *Given* the dashboard, *When* it renders, *Then* it shows an **Intent Share pie** — a donut of the feed's `intent[]` categories by `share_of_voice` (%), each slice labeled with the intent name.
- **AC5** *(amended v2.0, v3.0)* — *Given* the dashboard, *When* topics exist, *Then* it shows a **topics list**, each item with: **title**, an **explicit sentiment badge** (dominant tone — Positive/Neutral/Negative — *v2.0*), **Impressions**, **Reach** (both with a plain-English hint), the **description** (`penjelasan`), and a **sentiment-breakdown** donut. *(**v3.0** presents each topic as a **sentiment-driven dossier card**: an editorial rank numeral, a glowing tone **spine** + soft tone wash keyed to the dominant sentiment, the badge with an icon, refined icon stat-chips for Impressions/Reach, hover lift/glow, and a **staggered reveal** on load — distinctive, screenshot-shareable, still ≥16px per AC8.)*
- **AC6** — *Given* a BUMN with **no topics** in the window even after widening to 28 days (e.g. Mandiri, BRI), *When* the dashboard renders, *Then* it still shows the Intent Share pie (and the Sentiment Summary pie when `summary` is present) plus a clear **"No topics in this window"** state — the page never blanks.
- **AC7** — *Given* a BUMN-scoped user (`scope = bumn:‹slug›`), *When* they are authenticated, *Then* they may reach **only** `/bumn/‹slug›` (middleware redirects any other path back to their dashboard) and they land there on sign-in; *And* the `all` super-admin may reach every dashboard plus the `/bumn` index. Existing `danantara` / `all` scopes are unchanged.
- **AC8** — *Given* any text on a BUMN dashboard, *When* it renders, *Then* it uses a **readable executive type scale** (body ≥16px, larger titles/key numbers) and the **shared `/danantara-v2`-style header** (eyebrow → h1 → subtitle, Live/Sample badge + Refresh), for visual consistency across dashboards.
- **AC9** — *Given* the BFF, *When* it serves a BUMN dashboard, *Then* the feed `api_key` stays **server-side only** and never appears in any client payload (API-first + secrets-server-side).

#### Architecture
**Impact — files add/change:**
- `add` `lib/bumn/registry.ts` — `BUMN_REGISTRY: { slug, name, topicCode }[]` (7 rows) + helpers `getBumn(slug)`, `listBumn()`, `isAllowedTopicCode(code)` (registry codes + `danantara_main`)
- `change` `app/api/v1/danantara/topics/route.ts` — accept `?code=` (validated via `isAllowedTopicCode`, default `danantara_main`); window strategy = **7-day, widen to 28-day when the mapped topics are empty** (at most two upstream fetches, both cache-keyed); keep 1 h revalidate + `?fresh=1` `no-store` + graceful non-OK. *(Side-effect: the shared default window also moves A7's CEO command to the 7d→28d strategy — to be recorded as a small A7 revision when built.)*
- `change` `lib/auth.ts` — generalize `Scope` to `"all" | "danantara" | bumn:‹slug›`; add 7 BUMN `DEMO_USERS` (`‹slug›@nexorus.io` / `‹slug›2026`, `home = /bumn/‹slug›`); update `parseScope` (parse `bumn:‹slug›`), `homeForScope`, `scopeAllowsPath` (a `bumn:‹slug›` scope allows only `/bumn/‹slug›`; `all` also allows `/bumn`)
- `add` `app/bumn/[slug]/page.tsx` — resolve slug via registry (404 on miss), render `<BumnDashboard>` in `AppShell`
- `add` `app/bumn/page.tsx` — super-admin index linking to all registered BUMN
- `add` `components/bumn/BumnDashboard.tsx` — client component: fetch BFF (`code`, refresh, fallback), v2-style header, the two pies, the topics list, empty + offline states
- `add` `components/bumn/IntentPie.tsx` — general N-category donut (reuses the SVG-donut approach from `SentimentPie`; a fixed palette cycles for ≤ ~6 intents) with a labeled legend
- `add` tests (vitest): `lib/bumn/registry.test.ts`, extend `app/api/v1/danantara/topics/route.test.ts` (code allowlist + 7d→28d widening), extend `lib/auth.test.ts` (bumn scope gating), `components/bumn/BumnDashboard.test.tsx`, `components/bumn/IntentPie.test.tsx`
- `reuse` `components/danantara/ceo/SentimentPie.tsx` (sentiment summary + per-topic pies), `lib/danantara/ceo/topics-source.ts` (mapper unchanged), `lib/danantara/ceo/format.ts` (`fmtCount`/`pieTotals`), `AppShell`, the v37-style header pattern

**Data-model / API changes:** BFF gains an **allowlisted `code` query param** + the 7d→28d window strategy; no DB. Secret `DANANTARA_TOPICS_API_KEY` unchanged (server-only).
**Reuse:** A7's live topics BFF + mapper + `SentimentPie`; the demo-auth scope/cookie mechanism + middleware; `AppShell`.
**Risks:** per-BUMN topic volume is **sparse** (Mandiri/BRI return 0 topics in any recent window; PLN empty at 7d) → mitigated by the 28-day widen + the empty state (AC6). The shared-BFF window change touches A7 (flagged above). Allowlisting `code` prevents the route becoming an open proxy (SSRF-style abuse).

#### QA
| # | Maps to | Test case | Type |
|---|---|---|---|
| T1 | AC1 | `getBumn` resolves each of the 7 slugs to its name + `danantara_‹bumn›` code; unknown slug → undefined (page 404s) | unit |
| T2 | AC1 | `/bumn` index lists all 7 registry entries with links | component |
| T3 | AC2 | route: `?code=danantara_pln` (allowed) → mapped payload; unknown code → rejected/`danantara_main` fallback, never proxied | unit |
| T4 | AC2 | route window: 7-day request with 0 topics auto-widens to 28-day; a non-empty 7-day result is used as-is | unit |
| T5 | AC2 | route: `?fresh=1` → upstream `no-store`; default → `{ next: { revalidate: 3600 } }` | unit |
| T6 | AC3 | sentiment summary pie renders pos/neg/neutral % from `summary.percentage` | component |
| T7 | AC4 | intent pie renders one labeled slice per `intent[]` entry, sized by `share_of_voice`; shares handle rounding | unit + component |
| T8 | AC5 | a topic item shows title, Impressions, Reach (+ hints), description, and its sentiment-breakdown pie | component |
| T9 | AC6 | empty-topics payload → intent pie still renders + "No topics in this window" message; no blank page | component |
| T10 | AC7 | `scopeAllowsPath("bumn:pln", "/bumn/pln")` true; `/bumn/bri` and `/danantara` false; `all` allows `/bumn` | unit |
| T11 | AC7 | each BUMN `DEMO_USER` has `home = /bumn/‹slug›` and a `bumn:‹slug›` scope | unit |
| T12 | AC8 | rendered dashboard has no text class below 16px; header uses the eyebrow→h1→subtitle structure | component |
| T13 | AC9 | route response JSON never contains the api key; the key is sent only on the upstream URL | unit |

**Governance edge cases:** `api_key` server-side only (T13); `code` allowlisted (no open proxy / SSRF); BUMN-scoped users cannot cross to other BUMN or Danantara-wide views (T10, middleware); all data is public open-source media intelligence; graceful degradation on upstream failure (AC2/AC6); no auth change to existing `all` / `danantara` users.

#### Revision history
| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-06-07 | Initial plan — per-BUMN CEO dashboards (7 launch BUMN) on A7's live feed: registry-driven `/bumn/‹slug›`, allowlisted `?code=` BFF with 7d→28d window, `bumn:‹slug›` scoped logins, sentiment + intent pies, topics list with per-topic breakdown, empty-topics state. Status → Planned |
| 1.0 | 2026-06-07 | Built — all 9 ACs implemented TDD (178 tests green, typecheck + lint clean, build verified). Shared-BFF window change also moved A7's CEO command to the 7d→28d strategy (no A7 version bump on this branch to avoid colliding with the parked header v37 — to reconcile at merge). Status → Built |
| 2.0 | 2026-06-07 | Client: the sentiment-summary donut reads poorly — replace it with a **dominant-verdict + segmented bar + legend + totals** (`SentimentSummary`, using `total_impressions`/`total_reach`); add an **explicit per-topic sentiment badge** (+ card tint), not only the background. AC3/AC5 amended. Status → Built (182 tests green, build verified) |
| 3.0 | 2026-06-07 | Client ("make it beautiful, amaze me"): redesign the topics list as **sentiment-driven dossier cards** — editorial rank numerals, glowing tone spine + wash, icon badge, refined stat-chips, hover lift/glow, staggered reveal. AC5 amended. Status → Built (182 tests green, build verified, screenshot-confirmed on live PLN data) |
