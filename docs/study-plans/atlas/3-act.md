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

- **Version:** 46.0 · **Stage:** 3-act · **Sprint:** demo · **Status:** Built · **Spec ref:** `docs/superpowers/specs/2026-06-02-danantara-ceo-command-design.md` · **Owner:** Dev A

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
- **AC1** *(amended v4.0, v37.0)* — *Given* `/danantara` loads, *When* no user interaction occurs, *Then* the issue board, BUMN sentiment board, and AI brief ticker all render from **live data**. *(Spotlight removed in v4.0.)* *(**v37.0:** the wall is now **100% real** — the mock seeds and the tick/escalation **simulation are removed**; the BUMN board is wired to the live feed (AC20). On upstream failure the boards show a **graceful offline state** — no mock fallback — the ~1 h data cache still covers brief outages.)*
- **AC2** *(amended v4.0, v7.0, v13.0, v31.0)* — *Given* the issue board, *Then* issues stay ranked **within their sentiment group** by reach with status badge. *(v7.0: per-row sparkline removed. v13.0: per-row **velocity % removed** from the list — the RISING/ESCALATING badge carries momentum; velocity remains in the detail modal. **v31.0:** topics are sourced from the live feed (AC19) as a static snapshot — they no longer fake-drift each tick; the **BUMN board keeps the simulation tick** for its animated movement.)*
- **AC3** *(amended v4.0, v7.0, v11.0, v37.0, v44.0, v45.0)* — *Given* the BUMN board, *When* rendered, *Then* the **registry BUMN** *(v37.0: was 20 mock; now the live registry set)* render as a **single full-width list, one BUMN per row**, **ranked by highest negative reach first, tie-broken by positive reach** *(v44.0: was most-negative net sentiment; **v45.0 fix:** "reach" now means actual audience reach — `rankBumn` orders by `negReach` desc, then `posReach` desc, where `negReach = total_reach × negative%`. v44.0 mistakenly used `negMentions` (impression-based), which gave the wrong order since `total_reach` and `total_impressions` differ by orders of magnitude)*, each row prefixed with a **sequential rank number** plus its rank badge, with net sentiment encoded as a **green↔red row tint**. *(v7.0: replaces the grouped heatmap tiles; see AC16/AC18.)*
- **AC4** — *(removed in v4.0 — breaking-news takeover and spotlight pin dropped; escalating issues keep their ESKALASI badge and row pulse on the board.)*
- **AC5** — *(removed in v4.0 — scripted arcs still drive board badges, but no takeover to trigger; presenter hotkey `E` dropped.)*
- **AC6** — *Given* the old dashboard, *When* `/danantara-v2` is opened, *Then* the full Sovereign Command experience works exactly as it does today.
- **AC7** *(amended v4.0)* — *Given* a phone-width viewport, *When* `/danantara` loads, *Then* the layout stacks (header → ticker → issues → BUMN) and stays zero-click.
- **AC8** *(amended v17.0)* — *Given* the issue board or the BUMN board, *When* an item's rank differs from its rank one rolling window ago (6 ticks ≙ "2 jam"), *Then* the row/tile shows a green ▲ with positions gained or a red ▼ with positions lost (league-table style). *(v17.0: an **unchanged** rank renders **no** badge — the neutral stay dash is dropped as clutter. Rank numbers display with a trailing period, e.g. `1.`)*
- **AC9** *(amended v5.0, v34.0)* — *Given* any issue or BUMN, *When* it renders on a board, *Then* its sentiment is shown as a **mini pie chart** with explicit positive and negative **% labels** (green/red), not just a net score; positive + negative + neutral shares sum to 100%. *(**v34.0:** the **issue** detail drops the horizontal split bar — the **full `SentimentPie`** (positive/negative/**neutral** % + counts) now carries the breakdown there; the **BUMN** detail keeps the labeled split bar.)*
- **AC10** *(amended v4.0, v32.0)* — *Given* any issue row or BUMN tile, *When* it is clicked/tapped, *Then* a detail panel opens with the full picture (live trend chart, sentiment % + counts, rank movement, velocity/reach/mention stats, a **Description** for issues / related issues for BUMN, related-BUMN chips for issues / top issue for BUMN), closable via Esc, the ✕ button, or clicking the overlay; the simulation keeps ticking underneath. Clicking remains optional — the zero-click experience (AC1) is unchanged. *(**v32.0:** the issue detail's **"Top Coverage" headlines list is replaced by a "Description"** section showing the topic's `aiLine`/`penjelasan` — the v31.0 live feed carries no headlines, so the empty list is dropped in favour of the AI read.)* *(**v33.0:** the issue detail's **trend line chart is replaced by the full `SentimentPie`** (positive/negative/**neutral** share), and the **velocity stat + category tag are removed** — the static 28-day snapshot from the live feed carries no time-series, so velocity is always 0 and the keyword-inferred category was noise. The mini per-row pies in the topic list stay pos%/neg% only — neutral is shown in the detail pie, not the list.)* *(**v34.0:** the issue detail's **title is shown in full** (wraps, never truncated); **Impressions** and **Reach** become labeled metric cards each with a one-line English hint ("Total views across all posts in this topic" / "Number of users exposed to this topic") and the Sentiment pie gets a hint ("Breakdown of emotional tone (Positive/Negative/Neutral %)"); the horizontal **split bar is removed** (see AC9).)*
- **AC11** *(v4.0)* — *Given* `/danantara` on a desktop/TV viewport, *When* it renders, *Then* the wall is **two columns**: Danantara topics on the left, BUMN sentiment on the right — no third (Spotlight) column and no takeover overlay.
- **AC12** *(v4.0, amended v5.0, v7.0, v8.0, v9.0, v35.0, v41.0)* — *Given* the topic board, *When* it renders, *Then* topics are split into a **NEGATIVE TOPICS** sub-column (positive mentions ≤ negative) and a **POSITIVE TOPICS** sub-column, rendered **side by side** with **NEGATIVE on the left** *(v35.0, client/boss direction — problems lead; was positive-left)*, each ranked by reach (largest first) with counts shown; a topic moves between sub-columns live when its sentiment flips. *(**v41.0** redesigns each row as a **compact issue-briefing card** — a glowing tone spine + editorial rank numeral, the full title (wraps/balanced, never truncates) with a **sentiment verdict chip** (dominant tone icon + %), the muted 2-line `aiLine`, a clear **segmented sentiment bar replacing the mini-pie** (the boss found the pie unclear), and a `reach · impressions` footer with a RISING/ESCALATING status badge; reuses the A8 dossier card styling (`topic-card`/`topic-spine`/`topic-rank`) with hover-lift + staggered reveal. Title is `text-lg` (≥16px) so it stays readable for a 40–60 y/o exec. **v41.2** restructures the card to mirror the BUMN **Sentiment Summary** end-to-end: **Title → penjelasan → a Sentiment·Impressions·Reach metrics row → the breakdown bar → the value of each sentiment** (full Positive/Neutral/Negative legend); the top-right verdict chip is dropped in favour of the in-row Sentiment verdict.)*
- **AC13** *(v4.0, amended v5.0, retired v7.0)* — *(retired in v7.0 — the BUMN board no longer groups into side-by-side positive/negative sub-columns; it is a single per-row list, see AC16. Net-sentiment grouping is still available via `groupBumnBySentiment`, used by the detail modal / kept for reuse.)*
- **AC14** *(v4.0, amended v5.0, v7.0, v10.0, v13.0)* — *Given* any **topic row** or any **present BUMN topic cell** (positive/negative), *When* it renders, *Then* it carries its **own pie/donut chart** of that topic's positive / negative / neutral **mention share** with % labels, updating live with the tick. The mini pie renders its percentages **flanking the donut** — green (positive) % left, donut, red (negative) % right (`value% · donut · value%`, v15.0) — and the **donut arcs align with the labels** (green on the left, red on the right; v16.0); on topic rows the pie sits in a **right-hand column stacked over the reach value** (v14.0). There is **no** panel-level aggregate pie. *(v10.0: pies return to the BUMN board — one per topic cell.)*
- **AC15** *(v6.0, amended v21.0)* — *Given* the CEO wall (boards, header, ticker, and the detail modal), *When* any text renders, *Then* **no text is smaller than 16px**; topic titles (Issues board) render at **24px** (v21.0) and BUMN names (ticker) at **≥ 20px**; topic-cell text and the BUMN context are ≥ 16px; key numbers (sentiment scores, header metrics) are **at least 24px**. Lists keep all 20 items and scroll vertically.
- **AC17** *(v12.0)* — *Given* the CEO wall (boards, header, ticker, detail modal), *When* any **UI chrome** renders, *Then* it is in **English** (panel/section/column headings, status badges RISING/ESCALATING, metric labels, AI-ticker narration templates, modal labels, and units — reach in `M`, counts in `K`/`M`). *Given* any **content** (topic title, BUMN name, headline + timestamp, AI line, category/sector tag), *Then* it remains **Indonesian**. This supersedes the Indonesian label strings quoted in earlier ACs/QA (e.g. "TOPIK POSITIF" → "POSITIVE TOPICS", "Tidak ada…" → "No …", "jt"/"jangkauan" → "M"/"reach").
- **AC16** *(v7.0, amended v10.0, v11.0, superseded v19.0 → AC18)* — *(v7–v18: each BUMN row named a leading positive topic and a leading negative topic, each with its own pie + reach. Retired in v19.0 — the BUMN board now mirrors the Danantara Issues rows; see AC18. `topicsForBumn` is kept for reuse.)*
- **AC18** *(v19.0, amended v20.0, settled v24.0, v27.0, v29.0, v44.0, v45.0)* — *Given* the BUMN board, *When* it renders, *Then* it is a **single list, one row per BUMN** (*v44.0/v45.0:* ranked by highest negative **reach** first (`negReach`), tie-broken by positive reach — see AC3; was most-negative net sentiment), each row laid out in three cells: **(1) BUMN identity** — the **logo** (`/public/bumn/{id}.png`, monogram fallback when absent) carrying the **sequential rank as a small corner badge** *(v27.0; was a stacked mono `rank.` line)*, with the BUMN **ticker** (`short`, ≥ 20px) and the rank-movement badge beside it on the line below; **(2) its leading positive topic**; **(3) its leading positive topic** *(v35.0: **negative before positive**, so the **negative column sits on the left** — matching the Danantara Issues board's v35.0 negative-left order; this reverses the v29.0 positive-left arrangement, again on client/boss direction so problems lead)*. The column headers use the **same English wording as the Issues board** — `POSITIVE TOPICS` (green) / `NEGATIVE TOPICS` (red), per AC17 — not the earlier Indonesian "TOPIK POSITIF/NEGATIF". Each present topic cell is the highest-reach `CeoIssue` linked to that BUMN whose tone is positive / negative, shown as a green/red chip with the topic title, the topic's **own mini sentiment pie**, and its **reach**; an absent tone shows an **empty topic-cell placeholder** *(v30.0: a muted, dashed, tone-tinted cell with the trend icon + an em-dash — **not** a "No … topic" text line)*, so every BUMN row always shows both columns uniformly. The row keeps the green↔red net-sentiment tint and opens the BUMN detail on click (AC10). *(Supersedes the v20 two-column grouping and the v22–v23 single-headline layout.)*
- **AC19** *(v31.0)* — *Given* `/danantara` loads, *When* the Issues (topics) board renders, *Then* its topics come from the **live `garudaperkasa.io` feed** via the **`/api/v1/danantara/topics` BFF route** — the route fetches upstream **server-side** with the `api_key` from env (the key is **never** present in any browser payload), for a **rolling 28-day window** (`enddate` = today, `startdate` = today − 28d), and the response is **cached** (~1 h revalidate, Vercel data cache; *v36.0, was 6 h*), with a **manual Refresh** in the header that re-requests with `?fresh=1` so the BFF **bypasses the cache** (`no-store`) and re-hits the upstream for the newest data on demand *(v36.0)*. Each upstream topic maps to a `CeoIssue`: `topik`→title, `impressions`→mentions, `reach`→reach, `stats_sentiment.{positive,negative,neutral}`→the mini pie shares and the net sentiment (`positive − negative`), `penjelasan`→`aiLine`, with `headlines: []` and `relatedBumn: []`; the header totals come from `summary`. *And When* the upstream is unavailable or returns an error, *Then* the board **degrades gracefully** to the existing seeded mock topics and surfaces a cached/offline state (the wall never blanks). *(**v37.0:** the topics fallback is **no longer the seeded mock** — on failure the Issues board shows an offline/empty state; see AC1.)* *(**v42.0:** the BFF **no longer sends `startdate`/`enddate`** — the upstream applies its own default window (7 days). The explicit rolling-window computation and the 7d→28d auto-widening are removed; `rollingWindow` is deleted and `buildTopicsUrl` sends only `topic` + `api_key`. The 1 h cache, `?fresh=1` bypass, and the v4.1 stale-empty live confirm are unchanged.)* *(**v43.0:** the **28-day widening is restored as a fallback** — the default request stays date-less, but when it returns 0 topics the feed retries **once** with an explicit 28-day window (v42.0 alone emptied BMRI/TLKM/PLN, whose coverage is older than 7 days — upstream-verified). Applies to every topic code via the shared feed.)* *(**v46.0:** the cache window is widened to **6 h** (was 1 h since v36.0), cutting the upstream fan-out on page loads to at most once per code per 6 h. A scheduled cron pre-warm was designed and then dropped — it needs a Vercel Pro plan — so the cache is refreshed lazily (stale-while-revalidate); the header **Refresh** can force a fresh pull.)*
- **AC20** *(v37.0)* — *Given* the BUMN board, *When* `/danantara` loads, *Then* the **7 launch BUMN are populated from real per-BUMN feeds** via a single **aggregation BFF** `/api/v1/danantara/bumn-board`, which **fans out server-side** to the 7 `danantara_‹bumn›` codes (in parallel, each cached ~1 h — the same Data Cache the `/bumn/‹slug›` dashboards use, so the upstream is hit ≤ 7×/h and the browser makes **one** request). Per BUMN it derives **net sentiment** (`positive − negative` from `summary`), mention counts, and the **highest-reach positive & negative topic**. *And When* a single BUMN's feed fails, *Then* that row degrades on its own (the others still render); *And When* the whole aggregation fails, *Then* the board shows a graceful offline state (no mock). The feed `api_key` stays **server-side only**. *(**v46.0:** each BUMN code is now cached **6 h** (was 1 h); the board inherits the longer cache.)*

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
- *(v46.0)* `change` `lib/danantara/topics-feed.ts` — `REVALIDATE_S` 3600 → **21600** (6 h); comment fix in `app/api/v1/danantara/bumn-board/route.ts` (≤ once per BUMN per 6 h)
- *(v46.0)* `change` `lib/danantara/topics-feed.test.ts` + `app/api/v1/danantara/topics/route.test.ts` — assert `{ next: { revalidate: 21600 } }` (vitest)
- *(v46.0 — designed, not shipped)* A scheduled cron pre-warm (cron-only `warmAllTopics`/`/api/internal/warm-topics`, sequential 2.5 s pace per the OpenGate/upstream team, `vercel.json` crons at 05:00/13:00/21:00 WIB) was built then **removed** — it needs a Vercel **Pro** plan (cron frequency + the ~2-min walk's `maxDuration`). Recoverable from git history if the plan is upgraded.

**Data-model / API changes:** *(v31.0)* new **read-only BFF route** `/api/v1/danantara/topics` proxying + transforming the external feed (no DB). New **server-only** secret `DANANTARA_TOPICS_API_KEY`. Full production wiring (DB-backed) remains A1/A2 scope.
**Reuse:** `AppShell`, existing `lib/danantara/types.ts` (`Holding` universe, `CrisisSignal` velocity concept), `lib/ai/scripted.ts` narration pattern, command-center design tokens; *(v31.0)* the `process.env` server-side-key pattern from `lib/ai/engine.ts` / `lib/jasamarga/connector.ts`, and the `LiveBadge` live/offline pattern from `SovereignCommand`.
**Risks:** demo must never miss the escalation moment → deterministic scripted arcs + hotkey; 40 live-animating items on TV → throttle to one shared 4 s tick, CSS-transform-only animations. *(v31.0:* upstream latency/outage → data cache + mock fallback (AC19); rolling window rotates the cache key daily (one fresh fetch/day, acceptable); upstream sentiment is **categorical** (string + %), mapped into the numeric −100..100 model.*)*

#### QA
| # | Maps to | Test case | Type |
|---|---|---|---|
| T1 | AC1 | snapshot render: all four zones present, no interaction handlers required | component |
| T2 | AC2 | `rankIssues` orders by reach; `tick` preserves order invariant; sparkline/velocity data present | unit |
| T3 | AC3 | `rankBumn` sorts by negative **reach** (`negReach`) desc, then positive reach (`posReach`) desc — *not* impression-based `negMentions` (v45.0 regression guard); pure (no input mutation). `buildBumnRow` derives `negReach/posReach/reach` from `total_reach` | unit |
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
| T22 | AC19 | cacheable fetch carries `{ next: { revalidate: 21600 } }` (6 h, v46.0); `?fresh=1` still sends `{ cache: "no-store" }` | unit |

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
| 37.0 | 2026-06-07 | Client: wire the **BUMN board to real data** for the **7 launch BUMN** via a single server-side **aggregation BFF** (`/api/v1/danantara/bumn-board`, fan-out + shared cache), and **remove all mock data + the tick/escalation simulation** — `/danantara` is now 100% real, with a graceful offline state on failure (no mock fallback). + AC20; AC1/AC3/AC19 amended. Status → Built |
| 38.0 | 2026-06-08 | Client: in the BUMN topic cells, make the **topic title white** (was tone-colored) and tint each cell's **background per-topic by its own net sentiment** (`sentimentTint`) instead of a flat green/red block; border + trend icon keep the column tone. Status → Built |
| 38.1 | 2026-06-08 | Client: make the two BUMN topic cells in a row **equal height** (row stretches both; cells `h-full`) so positive/negative boxes line up regardless of title length. Status → Built |
| 38.2 | 2026-06-08 | Client: flip the board subtitles to **"negative vs positive"** / **"negative & positive topic"** to match the negative-first (negative-left) layout. Status → Built |
| 38.3 | 2026-06-08 | Client: source real **Jasa Marga** + **BNI** logos into `public/bumn/` (faviconV2 / Google favicon) — all 7 launch BUMN now show a real logo, no monograms. Assets only. Status → Built |
| 38.4 | 2026-06-08 | Client: fix reach formatting — use `fmtCount` so a small reach shows e.g. `15K` instead of `0.0M` (BUMN topic cells, Issues rows, BUMN detail). Status → Built |
| 38.5 | 2026-06-08 | Client: remove the **Net BUMN Sentiment** and **Active Alerts** metrics from the CEO header (keep Total Mentions + the clock). Status → Built |
| 38.6 | 2026-06-08 | Client: align the BUMN detail modal with the Danantara topic detail — drop the **Net sentiment** stat, trend chart & split bar; show an Impressions card + the sentiment pie (with neutral) + a Topics list. Status → Built |
| 39.0 | 2026-06-08 | Client ("topic details seems boring"): redesign the topic detail modal as a sentiment-driven brief — tone-keyed hero + verdict pill, icon stat tiles, sentiment pie panel, "Nexorus · Analysis" card, tone spine + pop-in. AC10 amended. Status → Built |
| 40.0 | 2026-06-08 | Client: in the BUMN board, **clicking a topic cell opens that single topic's detail** (the Danantara brief — no list of all topics); **the logo links to that BUMN's `/bumn/<slug>` dashboard**; and the topic detail gains an **"Open <BUMN> dashboard"** button (the related-BUMN chip became a dashboard link). AC10/AC18 amended. Status → Built |
| 40.1 | 2026-06-08 | Bugfix: client-side nav to `/danantara` (and `/bumn/<slug>`) showed no data until a manual refresh — the `mountedRef` guard latched `false` on React's dev double-mount. Reset it in the mount effect (`CeoCommand`, shared with A8's dashboard). Status → Built |
| 40.2 | 2026-06-08 | Client: **shrink the Danantara issue topic title** from `text-2xl`→`text-xl` (24→20px, still ≥16px for 40–60 y/o readability); and add a **shimmering skeleton loader** to both boards (Danantara Issues + BUMN Sentiment) while the feed has not responded yet (`loading` prop driven by `issuesLive`/`bumnLive`; shared `.skeleton` sweep). Presentation only (no AC change). Status → Built (51 tests green, lint clean, screenshot-confirmed on live data) |
| 40.3 | 2026-06-08 | Client: swap the **trend-arrow icons for thumbs-up/down** on the Danantara Issues group headers (POSITIVE/NEGATIVE TOPICS), the BUMN topic cells, **and the BUMN Sentiment column legend** (`TrendingUp`/`TrendingDown` → `ThumbsUp`/`ThumbsDown`). Presentation only (no AC change). Status → Built (34 tests green, lint clean, screenshot-confirmed on live data) |
| 41.4 | 2026-06-08 | Client: make **`/danantara` responsive for mobile**. On phones the fixed two-pane "wall" gives way to a naturally-scrolling page (`xl:h-full`/`xl:flex-1` only at `xl`); the Issues list stacks its Negative/Positive columns (`grid-cols-1 sm:grid-cols-2`); the BUMN board reflows each row from `[5rem 1fr 1fr]` to a single column (identity header → negative cell → positive cell), with the column legend hidden < `sm`; the Communication-Response count tiles shrink to `text-2xl` on phones. *(Fixed a Tailwind-JIT gotcha: the BUMN grid was assembled via a `sm:${GRID}` template literal so the arbitrary-value class was never generated — moved the full responsive class into the `GRID` literal.)* Presentation only. Status → Built (192 tests green, lint clean, screenshot-verified at 390px + 1440px) |
| 41.3 | 2026-06-08 | Refactor (de-dup, client-asked "make it less complicated"): extract a shared **`SentimentBreakdown`** (tone map + `readSentiment` + breakdown bar + per-sentiment legend, `size="sm"`/`"md"`) used by both the Danantara issue cards **and** A8's `SentimentSummary` — one source of truth (the tone map + bar + legend now live once, not in 2 files). Also **trim the issue card** so the sentiment % shows **once** (legend); the metrics-row verdict is now the qualitative tone only. No behaviour change beyond the trim. Status → Built (177 tests green, lint + tsc clean, screenshot-confirmed on /danantara + /bumn) |
| 41.2 | 2026-06-08 | Client (boss): make each Danantara issue card mirror the **BUMN Sentiment Summary** — **Title → penjelasan → Sentiment·Impressions·Reach metrics row → breakdown bar → value of each sentiment** (full Positive/Neutral/Negative legend); drop the top-right verdict chip for the in-row Sentiment verdict. AC12 amended. Status → Built (14 IssueBoard tests green, lint clean, screenshot-confirmed on live data) |
| 41.1 | 2026-06-08 | Client: put the **Danantara logo on the left of the CEO header** (replaces the generic Landmark icon) — sourced the real mark to `public/danantara.png`, rendered on a white rounded tile beside the title/subtitle. Presentation only (no AC change). Status → Built (10 HeaderStrip tests green, lint clean, screenshot-confirmed) |
| 41.0 | 2026-06-08 | Client (boss review of the Danantara Issues list): **rework the topic rows** — keep the side-by-side Negative \| Positive columns but redesign each row as a **compact issue-briefing card** (tone spine + editorial rank, verdict chip, full title, AI line, **segmented sentiment bar instead of the pie**, reach · impressions footer; A8 dossier styling, hover-lift + stagger). Clearer + more readable for the 40–60 y/o audience. AC12 amended. Status → Built (23 IssueBoard/CeoCommand tests green, lint clean, screenshot-confirmed on live data) |
| 40.4 | 2026-06-08 | Client: run a **stripped app-shell chrome on the executive dashboards** (`/danantara` + every `/bumn/*`) — hide the "Tanya Nexorus AI" search bar and the notifications bell, and reduce the gear menu to the **Dashboards** group only (drop Operations + System) via a `minimalChrome` route flag in `AppShell`. Other dashboards keep full chrome. Presentation only (no AC change). Status → Built (lint clean, screenshot-confirmed on /danantara + /bumn + home) |
| 42.0 | 2026-06-11 | Client: **stop sending `startdate`/`enddate` to the topics upstream** — it defaults to a 7-day window on its own, so the explicit rolling-window params are redundant. `rollingWindow` deleted, `buildTopicsUrl` sends only `topic` + `api_key`, and the **7d→28d auto-widening is removed with it** (client call: sparse BUMN simply show their empty state). Cache, `?fresh=1`, and the stale-empty live confirm unchanged. AC19 amended; shared `topics-feed.ts`, so A8 moves with it (A8 v5.0) |
| 43.0 | 2026-06-11 | Client ("BMRI, TLKM and PLN are empty — why?"): v42.0's date-less request emptied any BUMN whose coverage is older than 7 days (upstream probe: 0 topics in the default window vs 10 in 28 days for all three). **Restore the 28-day widening as a fallback**: default request stays date-less; a 0-topic result retries once with an explicit 28-day window — for **every** topic code via the shared feed. AC19 amended; A8 → v6.0 |
| 44.0 | 2026-06-14 | Client: **re-rank the BUMN Sentiment board by audience, not net %** — `rankBumn` now sorts by **highest negative reach first** (`negMentions` desc), tie-broken by **positive reach** (`posMentions` desc), replacing the most-negative net-sentiment sort. The BUMN with the loudest negative audience now tops the wall (a small-but-very-negative BUMN no longer outranks a huge moderately-negative one). AC3/AC18 amended; T3 reworked |
| 45.0 | 2026-06-15 | Client ("BUMN order still wrong — should be highest **neg reach** first"): v44.0 ranked by `negMentions`, which is **impression**-weighted (`total_impressions × neg%`), not reach. Since `total_reach` and `total_impressions` differ by orders of magnitude, the order was wrong. **Fix:** add `reach`/`posReach`/`negReach` to `BumnSentiment` (derived from `summary.total_reach`), and `rankBumn` now sorts by `negReach` desc → `posReach` desc. `negMentions`/`posMentions` stay (impression-based) for the BUMN pie/Impressions display. AC3/AC18 amended, T3 reworked; new buildBumnRow reach test + a regression guard (reach beats negMentions) |
| 46.0 | 2026-06-19 | Client ("the page fans out a bunch of Garuda calls on load and sometimes times out"): widen the topics cache **1 h → 6 h** (`revalidate: 21600`) so a page load hits the upstream at most once per code per 6 h (lazy stale-while-revalidate; header Refresh still forces a fresh pull). *A scheduled cron pre-warm (sequential 2.5 s pace per the OpenGate/upstream team, 05:00/13:00/21:00 WIB) was built then **dropped** — it needs a Vercel **Pro** plan for the 3×/day cron + the ~2-min walk's `maxDuration`; recoverable from git history.* AC19/AC20 amended, T22 reworked. Shared `topics-feed.ts`, so A8 moves with it (A8 → v8.0). Status → Built (TDD) |

---

### A8. Per-BUMN CEO sentiment dashboards

- **Version:** 8.0 · **Stage:** 3-act · **Sprint:** demo · **Status:** Built · **Spec ref:** built on A7's live topics feed (`docs/superpowers/specs/2026-06-02-danantara-ceo-command-design.md`) · **Owner:** Dev A

#### PM
**Background (why):** Danantara is the **holding company over all BUMN**, but the Danantara CEO Command wall (A7) is one aggregate view. The boss wants a **dedicated dashboard per BUMN**, each aimed at **that BUMN's own CEO** — a focused, low-density read of *"how is the public talking about my company right now"*. These users are **40–60 years old**, non-analyst executives, so the dashboard must be **simple and readable** (large type, no operator chrome) and **zero-config** (open the URL, see your company). It also has to be **access-scoped**: each BUMN CEO signs in as their own user and only ever sees their own company's dashboard — they must not wander into Danantara-wide or other BUMN data during a demo. The live feed already exposes a **topic code per BUMN** (`danantara_‹bumn›`), so each dashboard is the same A7 topics endpoint pointed at a different code — real data, not a mock. Launch set: **7 BUMN** (Mandiri, PLN, Telkom, Pertamina, BNI, BRI, Jasa Marga).

**v7.0 — roster expansion (2026-06-14, client):** the portfolio to be listed grew from 7 to **33 BUMN** — the client supplied the topic-code list, all verified live (HTTP 200; most with data, a couple temporarily empty — e.g. `jamkrindosyariah`, `asdpindonesia` — which the AC6 empty state + AC2 widening already cover). *(The client then dropped 3 of the proposed codes — `whoosh`, `hotelnatatour`, `wisataborobudur` — so 26 net-new codes.)* The new codes span financial (BSI, ASABRI, Askrindo(+Syariah), Jamkrindo(+Syariah), Pegadaian, Manajemen Aset), construction/transport (Adhi/Hutama/PP/Waskita/Wijaya Karya, Pelindo, ASDP, PELNI), industri & logistik (Pos, Garuda, Citilink, Pelita Air, Galangan Kapal, Kimia Farma, RSPP, InJourney), and pangan/konsumer (AgriNas Palma, Sarinah). Sectors are best-effort mapped to the existing 7-key taxonomy (no new keys); new BUMN with no logo asset use the monogram fallback.

**Acceptance criteria:**
- **AC1** *(amended v3.7, v7.0)* — *Given* a registered BUMN slug, *When* `/bumn/‹slug›` loads, *Then* it renders that BUMN's dashboard driven by a **registry** (`slug → name → short → sector → topicCode`, with `topicCode === danantara_‹slug›`), with a **header** showing the **BUMN logo on the left** of the eyebrow / **BUMN name** / subtitle stack *(v3.7 — real `/bumn/‹slug›.png` via the shared `BumnLogo`, monogram fallback)*; *And When* the slug is not in the registry, *Then* it 404s. A super-admin-only **`/bumn` index** lists all registered BUMN with links. *(**v7.0** — the registry holds the full **33-BUMN** portfolio; each new BUMN automatically gets its `/bumn/‹slug›` + `/bumn-v2/‹slug›` dashboards, a `‹slug›@nexorus.io`/`‹slug›2026` scoped login, an allowlist entry, and a CEO-wall board row — adding a BUMN remains one registry row.)*
- **AC2** *(amended v4.1)* — *Given* a BUMN dashboard, *When* it loads data, *Then* it calls the BFF `/api/v1/danantara/topics?code=‹code›` where **`code` is validated against the registry allowlist** (an unknown/absent code rejects or falls back to `danantara_main`, never proxied blindly). The request uses a **rolling 7-day window that auto-widens to 28 days when the 7-day window returns 0 topics**, is **cached ~1 h** (Vercel data cache) with the header **Refresh** forcing a fresh upstream pull (`?fresh=1` → `no-store`); on upstream error the page **degrades gracefully** (last-known/empty state, never a blank screen). **Stale-empty guard (v4.1):** the upstream intermittently serves a *hollow* window (no `topics`, null `summary`) for a code that has data — typically when it is slow/recomputing — and a cacheable hollow response would otherwise mask real data for up to an hour. So when the **cacheable path returns 0 topics**, the feed **confirms once against the live (`no-store`) upstream** and prefers any live data; a transient/stale empty self-heals on the next load instead of sticking, while a genuinely sparse BUMN (Mandiri/BRI) stays empty. *(Shared `topics-feed.ts` — also hardens A7's CEO command.)* *(**v5.0:** the request **sends no `startdate`/`enddate`** — the upstream applies its own default 7-day window, so the explicit rolling window **and the 7d→28d auto-widening are removed**; a sparse BUMN with an empty default window shows the AC6 empty state. Allowlist, 1 h cache, `?fresh=1`, graceful degradation, and the stale-empty live confirm all stay.)* *(**v6.0:** the **28-day widening is restored as a fallback** for every code — the default request stays date-less, but a 0-topic result retries once with an explicit 28-day window (v5.0 alone emptied BMRI/TLKM/PLN, whose coverage is older than 7 days).)*
- **AC3** *(amended v2.0, v3.4, v3.6)* — *Given* the dashboard, *When* it renders, *Then* it shows a **Sentiment Summary** built from `summary`: a **hero band** pairing the **dominant-sentiment verdict** (the largest of positive/neutral/negative as a large colored headline + %) with the feed's **total impressions & reach** as **bold KPI tiles** *(v3.4 — promoted from a grey footnote so scale reads next to feeling)*, then a **segmented bar** (green/neutral/red) sized by share, a legend of all three %s, and a **Key Drivers** block *(v3.6)* naming the **loudest negative and positive topic** (title + reach, by reach within dominant tone) — the "why" behind the verdict, which also fills the panel against the taller Intent leaderboard. *(v2.0 replaced the original 3-slice donut — a donut reads poorly for a 3-way split at exec glance.)*
- **AC4** *(amended v3.5)* — *Given* the dashboard, *When* it renders, *Then* it shows an **Intent Share leaderboard** — a **ranked horizontal share-of-voice bar list** of the feed's `intent[]` categories: rows sorted by `share_of_voice` descending (dominant intent on top), each with the intent name, a colored bar **scaled to the leader** (so small categories stay legible, floored to a visible sliver), the category's **impressions**, and its **%**; bars grow out on load. *(v3.5 replaces the original donut — slices are hard to compare at exec glance; a ranked bar reads as a leaderboard and surfaces the dominant public intent instantly.)*
- **AC5** *(amended v2.0, v3.0)* — *Given* the dashboard, *When* topics exist, *Then* it shows a **topics list**, each item with: **title**, an **explicit sentiment badge** (dominant tone — Positive/Neutral/Negative — *v2.0*), **Impressions**, **Reach** (both with a plain-English hint), the **description** (`penjelasan`), and a **sentiment-breakdown** donut. *(**v3.0** presents each topic as a **sentiment-driven dossier card**: an editorial rank numeral, a glowing tone **spine** + soft tone wash keyed to the dominant sentiment, the badge with an icon, refined icon stat-chips for Impressions/Reach, hover lift/glow, and a **staggered reveal** on load — distinctive, screenshot-shareable, still ≥16px per AC8.)*
- **AC6** *(amended v5.0)* — *Given* a BUMN with **no topics** in the window (e.g. Mandiri, BRI), *When* the dashboard renders, *Then* it still shows the Intent Share leaderboard (and the Sentiment Summary when `summary` is present) plus a clear **"No topics in this window"** state — the page never blanks. *(v5.0: "the window" is the upstream's **default 7-day window** — the 28-day widening retry no longer exists.)* *(v6.0: the widening retry is **back** — this state now means empty even after the 28-day fallback, as originally.)*
- **AC7** — *Given* a BUMN-scoped user (`scope = bumn:‹slug›`), *When* they are authenticated, *Then* they may reach **only** `/bumn/‹slug›` (middleware redirects any other path back to their dashboard) and they land there on sign-in; *And* the `all` super-admin may reach every dashboard plus the `/bumn` index. Existing `danantara` / `all` scopes are unchanged.
- **AC8** — *Given* any text on a BUMN dashboard, *When* it renders, *Then* it uses a **readable executive type scale** (body ≥16px, larger titles/key numbers) and the **shared `/danantara-v2`-style header** (eyebrow → h1 → subtitle, Live/Sample badge + Refresh), for visual consistency across dashboards.
- **AC9** — *Given* the BFF, *When* it serves a BUMN dashboard, *Then* the feed `api_key` stays **server-side only** and never appears in any client payload (API-first + secrets-server-side).
- **AC10** *(v4.0 — alternate option page)* — *Given* a registered BUMN slug, *When* `/bumn-v2/‹slug›` loads, *Then* it renders an **alternate layout option** of the same dashboard (same registry, BFF call, header, and data; `/bumn/‹slug›` is **unchanged**): **(a)** the Sentiment Summary is **split into two side-by-side boxes — Negative left, Positive right** (kanan-kiri; negative-first matches the A7 v35.0 convention and the cluster order below), each showing its tone icon, share %, topic count, and loudest driver, with the segmented bar + Impressions/Reach KPI tiles kept beneath; **(b)** the topics list is **clustered by dominant tone — the Negative cluster first, the Positive cluster after it** (each with a tone-tinted header + per-cluster rank numerals; an empty cluster shows a clear "none in this window" placeholder so it still anchors), with a **Neutral cluster last only when neutral topics exist**; **(c)** **clicking the Positive summary box smooth-scrolls ("jumps") to the Positive cluster** — and the Negative box likewise to the Negative cluster. *And* a `bumn:‹slug›` scope may reach `/bumn-v2/‹slug›` (only their own), `all` also reaches the `/bumn-v2` index; both options appear in the Dashboards menu as **(v1)/(v2)**, mirroring the `/danantara-v2`–`/danantara` pattern.

#### Architecture
**Impact — files add/change:**
- `add` `lib/bumn/registry.ts` — `BUMN_REGISTRY: { slug, name, topicCode }[]` (7 rows) + helpers `getBumn(slug)`, `listBumn()`, `isAllowedTopicCode(code)` (registry codes + `danantara_main`)
- `change` `app/api/v1/danantara/topics/route.ts` — accept `?code=` (validated via `isAllowedTopicCode`, default `danantara_main`); window strategy = **7-day, widen to 28-day when the mapped topics are empty** (at most two upstream fetches, both cache-keyed); keep 1 h revalidate + `?fresh=1` `no-store` + graceful non-OK. *(Side-effect: the shared default window also moves A7's CEO command to the 7d→28d strategy — to be recorded as a small A7 revision when built.)*
- `change` `lib/auth.ts` — generalize `Scope` to `"all" | "danantara" | bumn:‹slug›`; add 7 BUMN `DEMO_USERS` (`‹slug›@nexorus.io` / `‹slug›2026`, `home = /bumn/‹slug›`); update `parseScope` (parse `bumn:‹slug›`), `homeForScope`, `scopeAllowsPath` (a `bumn:‹slug›` scope allows only `/bumn/‹slug›`; `all` also allows `/bumn`)
- `add` `app/bumn/[slug]/page.tsx` — resolve slug via registry (404 on miss), render `<BumnDashboard>` in `AppShell`
- `add` `app/bumn/page.tsx` — super-admin index linking to all registered BUMN
- `add` `components/bumn/BumnDashboard.tsx` — client component: fetch BFF (`code`, refresh, fallback), v2-style header, the two pies, the topics list, empty + offline states
- `add` `components/bumn/IntentShare.tsx` *(v3.5; was `IntentPie.tsx` donut)* — a **ranked share-of-voice bar leaderboard**: rows sorted by `share_of_voice` desc, bars scaled to the leader (floored to a visible sliver), each labeled with the category, its impressions, and its %; a fixed palette cycles for ≤ ~6 intents; bars grow in on load
- `add` tests (vitest): `lib/bumn/registry.test.ts`, extend `app/api/v1/danantara/topics/route.test.ts` (code allowlist + 7d→28d widening), extend `lib/auth.test.ts` (bumn scope gating), `components/bumn/BumnDashboard.test.tsx`, `components/bumn/IntentShare.test.tsx`
- `reuse` `components/danantara/ceo/SentimentPie.tsx` (sentiment summary + per-topic pies), `lib/danantara/ceo/topics-source.ts` (mapper unchanged), `lib/danantara/ceo/format.ts` (`fmtCount`/`pieTotals`), `AppShell`, the v37-style header pattern
- *(v4.0 — `/bumn-v2` option)* `add` `app/bumn-v2/page.tsx` + `app/bumn-v2/[slug]/page.tsx` (duplicate routes; v2 dashboard), `components/bumn/BumnDashboardV2.tsx` (split summary + clustered topics), `components/bumn/SentimentSummarySplit.tsx` (the two clickable neg/pos boxes + bar + KPIs); `change` (pure refactor, no behavior change) `BumnDashboard.tsx` → extract shared `components/bumn/TopicCard.tsx` (`TopicCard`, `TopicCardSkeleton`, `topicTone`, `topDriver`); `change` `BumnIndex.tsx` (+`basePath` prop, default `/bumn`), `lib/auth.ts` (`scopeAllowsPath`: `bumn:‹slug›` also allows `/bumn-v2/‹slug›`), `AppShell.tsx` (NAV: BUMN Dashboards (v1)/(v2) items)

**v7.0 — files add/change (roster 7 → 33):**
- `change` `lib/bumn/registry.ts` — **26 new `BUMN_REGISTRY` rows** (slug = `danantara_‹slug›` minus prefix; `name`/`short`/`sector` per the v7.0 roster). No helper/interface change — `getBumn`/`listBumn`/`isAllowedTopicCode` already iterate the array; the auth logins, `/bumn` index, allowlist, and CEO-wall board all derive automatically.
- `change` `lib/bumn/registry.test.ts` — roster assertion updated to the 33 slugs (the `topicCode === danantara_‹slug›` invariant validates each slug).
- `change` `app/api/v1/danantara/bumn-board/route.ts` *(A7 v37 board)* — **cap the parallel upstream fan-out** (small concurrency pool, e.g. 8) so 33 codes on a cold cache don't hammer/rate-limit the upstream; total upstream calls and output rows unchanged. *(Recorded as an A7 revision — internal perf, no AC change.)*
- `change` `app/api/v1/danantara/bumn-board/route.test.ts` — assert in-flight fan-out never exceeds the cap.
- *(no change needed: `lib/auth.ts`, `BumnIndex.tsx`, `components/bumn/BumnDashboard*.tsx`, `app/bumn/**` — all registry-driven; new BUMN flow through unchanged.)*

**Data-model / API changes:** BFF gains an **allowlisted `code` query param** + the 7d→28d window strategy; no DB. Secret `DANANTARA_TOPICS_API_KEY` unchanged (server-only).
**Reuse:** A7's live topics BFF + mapper + `SentimentPie`; the demo-auth scope/cookie mechanism + middleware; `AppShell`.
**Risks:** per-BUMN topic volume is **sparse** (Mandiri/BRI return 0 topics in any recent window; PLN empty at 7d) → mitigated by the 28-day widen + the empty state (AC6). The shared-BFF window change touches A7 (flagged above). Allowlisting `code` prevents the route becoming an open proxy (SSRF-style abuse). *(v7.0)* the CEO-wall board fans out to **all 33** codes on a cold cache → mitigated by the concurrency cap; new BUMN ship **without logos** → monogram fallback (cosmetic, no breakage); sector mapping onto the 7-key taxonomy is approximate for transport/insurance/tourism/health (label + color only, trivially re-assignable).

#### QA
| # | Maps to | Test case | Type |
|---|---|---|---|
| T1 | AC1 | `getBumn` resolves each registered slug to its name + `danantara_‹slug›` code (every row satisfies `topicCode === danantara_‹slug›`); unknown slug → undefined (page 404s); roster is the full **33-BUMN** set *(v7.0)* | unit |
| T2 | AC1 | `/bumn` index lists **all** registry entries with links (registry-driven, not a fixed count) | component |
| T19 | AC1 *(v7.0)* | bumn-board fan-out: with 33 codes the **in-flight** upstream fetches never exceed the concurrency cap; total calls still one per BUMN | unit |
| T3 | AC2 | route: `?code=danantara_pln` (allowed) → mapped payload; unknown code → rejected/`danantara_main` fallback, never proxied | unit |
| T4 | AC2 | route window: 7-day request with 0 topics auto-widens to 28-day; a non-empty 7-day result is used as-is | unit |
| T5 | AC2 | route: `?fresh=1` → upstream `no-store`; default → `{ next: { revalidate: 3600 } }` | unit |
| T6 | AC3 | sentiment summary pie renders pos/neg/neutral % from `summary.percentage` | component |
| T7 | AC4 | intent leaderboard renders one ranked bar per `intent[]` entry, sorted by `share_of_voice` desc, leader fills the track + a tiny share floors to a visible sliver; labels show impressions + % | unit + component |
| T8 | AC5 | a topic item shows title, Impressions, Reach (+ hints), description, and its sentiment-breakdown pie | component |
| T9 | AC6 | empty-topics payload → intent leaderboard still renders + "No topics in this window" message; no blank page | component |
| T10 | AC7 | `scopeAllowsPath("bumn:pln", "/bumn/pln")` true; `/bumn/bri` and `/danantara` false; `all` allows `/bumn` | unit |
| T11 | AC7 | each BUMN `DEMO_USER` has `home = /bumn/‹slug›` and a `bumn:‹slug›` scope | unit |
| T12 | AC8 | rendered dashboard has no text class below 16px; header uses the eyebrow→h1→subtitle structure | component |
| T13 | AC9 | route response JSON never contains the api key; the key is sent only on the upstream URL | unit |
| T14 | AC10a | split summary renders the **Negative box before the Positive box** (left/right), each with its tone %, topic count, and loudest driver | component |
| T15 | AC10b | v2 dashboard clusters topics by dominant tone: Negative section **before** Positive; a neutral topic lands in a trailing Neutral cluster; an empty cluster shows its placeholder | component |
| T16 | AC10c | clicking the Positive summary box scrolls the Positive cluster into view (and Negative → Negative) | component |
| T17 | AC10 | `scopeAllowsPath("bumn:pln", "/bumn-v2/pln")` true; `"/bumn-v2/bri"` + bare `/bumn-v2` false for a bumn scope; `/bumn-v2` index links carry the basePath | unit + component |
| T18 | AC2 | feed: a cacheable **hollow** window (0 topics) triggers a **live `no-store` confirm** and uses live data when present; a window with topics does **not** re-fetch; a genuinely empty code stays empty; `?fresh=1` adds no redundant confirm | unit |

**Governance edge cases:** `api_key` server-side only (T13); `code` allowlisted (no open proxy / SSRF); BUMN-scoped users cannot cross to other BUMN or Danantara-wide views (T10, middleware); all data is public open-source media intelligence; graceful degradation on upstream failure (AC2/AC6); no auth change to existing `all` / `danantara` users.

#### Revision history
| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-06-07 | Initial plan — per-BUMN CEO dashboards (7 launch BUMN) on A7's live feed: registry-driven `/bumn/‹slug›`, allowlisted `?code=` BFF with 7d→28d window, `bumn:‹slug›` scoped logins, sentiment + intent pies, topics list with per-topic breakdown, empty-topics state. Status → Planned |
| 1.0 | 2026-06-07 | Built — all 9 ACs implemented TDD (178 tests green, typecheck + lint clean, build verified). Shared-BFF window change also moved A7's CEO command to the 7d→28d strategy (no A7 version bump on this branch to avoid colliding with the parked header v37 — to reconcile at merge). Status → Built |
| 2.0 | 2026-06-07 | Client: the sentiment-summary donut reads poorly — replace it with a **dominant-verdict + segmented bar + legend + totals** (`SentimentSummary`, using `total_impressions`/`total_reach`); add an **explicit per-topic sentiment badge** (+ card tint), not only the background. AC3/AC5 amended. Status → Built (182 tests green, build verified) |
| 3.0 | 2026-06-07 | Client ("make it beautiful, amaze me"): redesign the topics list as **sentiment-driven dossier cards** — editorial rank numerals, glowing tone spine + wash, icon badge, refined stat-chips, hover lift/glow, staggered reveal. AC5 amended. Status → Built (182 tests green, build verified, screenshot-confirmed on live PLN data) |
| 3.1 | 2026-06-07 | Client: the per-topic pie was too small — give each topic card a **~70% text / ~30% pie** split with a **large centered donut** (`SentimentPie` `size`/`layout="stack"`), and show the **neutral %** in it (full legend pos/neutral/negative + counts). Status → Built (screenshot-confirmed) |
| 3.2 | 2026-06-07 | Client: add icons to the Sentiment Summary impressions/reach totals (bar-chart + eye), matching the topic-card stat-chips. Status → Built (screenshot-confirmed) |
| 3.3 | 2026-06-07 | Bugfix: client-side nav to `/bumn/‹slug›` showed no data until a manual F5 — the `mountedRef` guard latched `false` on React's dev double-mount and discarded the fetch. Reset it to `true` in the mount effect (also applied to A7's `CeoCommand`). Status → Built (puppeteer-verified soft-nav loads) |
| 3.4 | 2026-06-08 | Client: the page-level **impressions & reach were a grey footnote** under the Sentiment Summary — promote them to **bold bordered KPI tiles in a hero band to the right of the dominant-sentiment verdict** (`SentimentSummary` v2.1), so scale reads next to feeling at a glance. Cosmetic only (same data, AC3 layout). Status → Built (8 tests green, screenshot-confirmed on live Pertamina data) |
| 3.5 | 2026-06-08 | Client ("the intent share isn't good enough — rework it, not a pie"): replace the Intent Share **donut** with a **ranked share-of-voice bar leaderboard** (`IntentPie` → `IntentShare`) — rows sorted by share desc, bars scaled to the leader + floored to a visible sliver, each showing impressions + %, growing in on load. AC4 amended. Status → Built (14 bumn tests green, lint clean, screenshot-confirmed on live Pertamina data) |
| 3.6 | 2026-06-08 | Client ("blank area in the sentiment summary — any other idea?"): fill it with a **Key Drivers** block (`SentimentSummary` v2.2) — the loudest **negative** and **positive** topic (title + reach, picked by reach within dominant tone), shown under the legend with tone icons. Adds the "why" behind the verdict and balances the panel height against the Intent leaderboard. AC3 amended. Status → Built (16 bumn tests green, lint clean, screenshot-confirmed on live Pertamina data) |
| 3.7 | 2026-06-08 | Client: add the **BUMN logo to the dashboard header**, on the **left of the name** (eyebrow / name / subtitle stack) — extract a shared `BumnLogo` (real `/bumn/‹slug›.png`, monogram fallback); thread `slug`/`short`/`sector` from the page. *(Corrected from a first pass that wrongly placed it inside the sentiment verdict box.)* AC1 amended. Status → Built (16 bumn tests green, lint clean, screenshot-confirmed on live Pertamina data) |
| 3.8 | 2026-06-08 | Client: add a **shimmering skeleton loader** to the BUMN dashboard's **topic list** while the feed has not responded (replaces the plain "Loading topics…" text with shaped `TopicCardSkeleton`s; shared `.skeleton` sweep). Presentation only (no AC change). Status → Built (51 tests green, lint clean) |
| 3.9 | 2026-06-08 | Client: each `/bumn/*` board runs the **stripped app-shell chrome** (no AI search bar, no notifications bell, gear menu = Dashboards only) — shared with A7 v40.4 via the `minimalChrome` route flag in `AppShell`. Presentation only (no AC change). Status → Built (lint clean, screenshot-confirmed) |
| 3.10 | 2026-06-08 | Client: show the **dominant ("final") sentiment % in the centre of each topic pie** on the BUMN page — added a tone-coloured centre label to the shared `SentimentPie` **full** variant (also enriches the A7 topic/BUMN detail donuts). Presentation only. Status → Built (28 tests green, lint clean, screenshot-confirmed: e.g. Neutral-dominant topic shows "50%" in the donut hole) |
| 4.0 | 2026-06-10 | Client ("don't change what we have — give the other option; duplicate the page"): add **`/bumn-v2/‹slug›`** as an alternate layout option, `/bumn/‹slug›` untouched — **(1)** Sentiment Summary split into **Negative (left) / Positive (right)** side-by-side clickable boxes, **(2)** topics **clustered: Negative first**, **(3)** **Positive cluster after**, the Positive box **click-jumps** to it (Negative box likewise). Neutral cluster trails when present. Shared `TopicCard` extracted (pure refactor); `bumn:‹slug›` scope also allows `/bumn-v2/‹slug›`; (v1)/(v2) nav items mirror the danantara pattern. AC10 added. Status → Built |
| 4.1 | 2026-06-10 | Bugfix (client: "why is Pertamina showing 0 — Postman shows data"): the upstream intermittently serves a **hollow window** (no `topics`, null `summary`, ~63 s slow) for a code that has data, and the BFF's **1 h cache** made that blip **stick for up to an hour** (the 7→28 d widen can't help — both windows are empty in the same instant). Fix in shared `topics-feed.ts`: when the **cacheable path returns 0 topics, confirm once against the live `no-store` upstream** and prefer live data; genuinely sparse BUMN stay empty. AC2 amended; T18 added. Status → Built (208 tests green, typecheck + lint clean, build verified; upstream re-probe confirmed Pertamina = 10 topics) |
| 5.0 | 2026-06-11 | Client: **drop `startdate`/`enddate` from every topics request** — the upstream defaults to 7 days by itself. The explicit rolling window and the **7d→28d auto-widening are removed** (sparse BUMN show the AC6 empty state); allowlist, 1 h cache, `?fresh=1`, and the v4.1 stale-empty live confirm are unchanged. AC2 + AC6 amended; shared `topics-feed.ts`, so A7 moves with it (A7 v42.0) |
| 6.0 | 2026-06-11 | Client ("BMRI, TLKM and PLN are empty"): **restore the 28-day widening as a fallback** on the date-less default request, for every topic code — a 0-topic default window retries once with an explicit 28-day window (upstream-verified: those three have 0 topics in 7d, 10 each in 28d). AC2 + AC6 amended; A7 → v43.0 |
| 7.0 | 2026-06-14 | **MAJOR** — client expanded the listed portfolio from **7 → 33 BUMN** (codes supplied + verified live; 3 later dropped — whoosh, hotelnatatour, wisataborobudur). 26 new `BUMN_REGISTRY` rows (name/short/sector derived; sectors mapped onto the existing 7-key taxonomy; new BUMN use the monogram logo fallback). Registry-driven, so dashboards/logins/index/allowlist/board all follow automatically. CEO-wall board fan-out gains a **concurrency cap** (A7 board, internal perf, no AC change). AC1 amended; T1/T2 generalised + T19 added. Status → Built (TDD): registry roster + uniqueness + cap tests; full suite green, tsc + lint clean (`BumnIndex` test made registry-count-agnostic + O(1)-query to stay fast at 33 rows) |
| 8.0 | 2026-06-19 | Moves with A7 v46.0 (shared `topics-feed.ts`): topics cache **1 h → 6 h**, so each `/bumn/<slug>` dashboard hits the Garuda upstream at most once per code per 6 h. No per-dashboard UI change. *(The scheduled cron pre-warm explored alongside this was dropped — needs Vercel Pro; see A7 v46.0.)* Status → Built (TDD) |

---

### A9. Communication Response Calculator

- **Version:** 3.1 · **Stage:** 3-act · **Sprint:** demo · **Status:** Built · **Spec ref:** built on A7's Danantara topic detail · **Owner:** Dev A
- *Formerly "Counter-Noise — Response Calculator" (renamed v3.1); internal module/testids keep the `counter-noise` name.*

#### PM
**Background (why):** Media monitoring tells the CEO *what* is being said; the boss's next question is always **"so what do we do about it?"**. For a **negative** topic, the comms team needs a quick, concrete **response plan** — **how many counter-narrative actions** to push so the issue **doesn't escalate** — across the team's real channels: **clipper content**, **homeless posts** (grassroots / anonymous-account flooding — the client's term), and **KOL posts**. *(v2.0 adopts the boss's own crisis-dashboard model — see AC2 — replacing v1's reach-based heuristic.)* This makes the dashboard *actionable* in a demo — one glance from "here's the problem" to "here's the response" — and plays to the team's media-intelligence strength.

**Acceptance criteria:**
- **AC1** — *Given* a topic whose dominant sentiment is **Negative**, *When* its detail opens (`/danantara` topic detail, **below the penjelasan / AI-analysis card**), *Then* a **"Communication Response Calculator"** panel shows the recommended **number of clipper clips, KOL posts, and homeless posts** to deploy, as the hero output. **No cost and no reach-per-unit are shown** — just the counts.
- **AC2** *(v2.0 — boss's model)* — *Given* a **negative-post baseline** and a service **tier**, *When* the plan is computed, *Then* `counter_actions = negative_baseline × noise_multiplier` with `noise_multiplier ∈ {Basic 1, Professional 3 (default), Enterprise 5}`, split **clipper 50% · homeless 20% · kol 30%** (`round`). Worked example: baseline **1,498** @ Professional → **4,494** total → clipper **2,247** / homeless **899** / kol **1,348**.
- **AC3** *(v2.0)* — *Given* our live feed reports negative **impressions**, not a post count, *When* the panel needs a baseline, *Then* it **estimates the negative-post count** = `round(negativeImpressions ÷ IMPRESSIONS_PER_POST)` (default 7,500, a single tunable constant) and shows the derivation in one line (*"from N negative posts × M (Tier)"*).
- **AC4** — *Given* a topic whose dominant sentiment is **Positive or Neutral**, *When* its detail opens, *Then* the counter-noise panel is **omitted** — the calculator is a negative-topic tool.
- **AC5** — *Given* the calculator, *When* the plan is computed repeatedly, *Then* it is **deterministic & pure** — same input → same plan, computed **client-side** (no API, no LLM).
- **AC6** *(v2.2)* — *Given* the panel **first scrolls into view**, *Then* **Nexorus AI runs a terminal analysis** — a faux console boots through `nexorus-ai analyze …` → establishing feed → fetching → parsing N flagged posts → analyzing vectors → cross-referencing reach → modeling → synthesizing (line-by-line with a blinking cursor + `[ok]` tags, ~3.7s), then the counts **reveal with a count-up**. The animation runs **once**; *When* the **tier** is changed afterwards, *Then* the plan **recomputes instantly with no re-animation**. Counts are the largest type; honours `prefers-reduced-motion`; a fallback guarantees the result always reveals even if the observer misfires.
- **AC7** *(v3.0 — WhatsApp dispatch)* — *Given* the Counter-Noise panel, *When* the user clicks **"Dispatch Response via WhatsApp"**, *Then* a **WhatsApp click-to-chat** link opens (`https://wa.me/‹number›?text=…`, new tab) to a **configured war-room number** (`NEXT_PUBLIC_RESPONSE_WHATSAPP`, demo fallback) with a **pre-filled brief** containing the **topic title, sentiment, reach/impressions, the Nexorus AI penjelasan, and the selected-tier Communication Response plan** (per-channel counts + total). The message is pre-filled only — **the user still taps send** in WhatsApp; the brief reflects the **currently-selected tier**.

#### Architecture (impact analysis)
- `add` `lib/danantara/ceo/counter-noise.ts` — **pure**: `responseCalculator(negativeBaseline, tier="professional")` → `{ tier, noiseMultiplier, negativeBaseline, counterActions, clipper, homeless, kol }` (boss's model: `× TIER_MULTIPLIER`, split `CHANNEL_SHARE` clipper .50 / homeless .20 / kol .30); plus `negativeBaselineFromIssue({negMentions})` = `round(negMentions / IMPRESSIONS_PER_POST)` and exported `TIER_MULTIPLIER` / `TIER_LABEL`.
- `add` `components/danantara/ceo/CounterNoisePanel.tsx` — the three counts as hero numerals + channel icons, a **Basic/Professional/Enterprise tier selector** (live recompute), and the derivation caption. **Scroll-in `useInView` + `useCountUp`** drive the calculating animation (falls back instantly under `prefers-reduced-motion` / jsdom). A `.cn-calc` scan sweep in `globals.css`.
- `change` `components/danantara/ceo/DetailModal.tsx` — render `<CounterNoisePanel issue={...} />` **below the AI-analysis card**, **only when** the dominant tone is Negative.
- `add` `lib/danantara/ceo/response-dispatch.ts` *(v3.0)* — **pure** `whatsappResponseLink(number, message)` + `waNumber` (digits-only) + `buildResponseBrief(topic, plan)` (topic + sentiment + reach/impressions + **penjelasan** + plan). `change` `CounterNoisePanel` to widen its topic prop (title/reach/mentions/posMentions/aiLine) and render the **WhatsApp dispatch `<a>`** in the result; number from `NEXT_PUBLIC_RESPONSE_WHATSAPP`.
- `add`/`change` tests (vitest): `lib/danantara/ceo/counter-noise.test.ts` (boss's worked example, tier multipliers, 50/20/30 split, baseline estimate, determinism) + `components/danantara/ceo/DetailModal.test.tsx` (panel + counts + tier selector shown for negative; live recompute on tier change; omitted for positive/neutral; ≥16px).
- **Reuse:** the `detail-*` styling, the `.intent-bar`/skeleton CSS patterns. **Risks:** the baseline is an **estimate** (the feed has no post count) — the divisor is one tunable constant; keep the calculator pure so it can later read a real negative-post count without a UI change.

#### QA (test cases mapped to ACs)
| # | AC | Case | Type |
|---|----|------|------|
| T1 | AC2 | `responseCalculator(1498,"professional")` → counterActions 4494, clipper 2247, homeless 899, kol 1348 (boss's worked example) | unit |
| T2 | AC2 | tier multiplier: basic ×1, professional ×3, enterprise ×5; default = professional | unit |
| T3 | AC2 | split is clipper 50% / homeless 20% / kol 30% and sums to counter_actions | unit |
| T4 | AC3 | `negativeBaselineFromIssue` estimates a realistic post count from negative impressions; 0 → 0 | unit |
| T5 | AC5 | same input → identical plan across calls (pure/deterministic) | unit |
| T6 | AC1/AC6 | DetailModal of a negative topic shows the panel with the 3 counts + tier selector; no `text-xs/sm` | component |
| T7 | AC6 | changing the tier recomputes the plan (caption multiplier/label changes) | component |
| T8 | AC4 | DetailModal of a positive/neutral topic omits the panel | component |
| T9 | AC7 | `waNumber` strips to digits; `whatsappResponseLink` builds `wa.me/‹digits›?text=` with the URL-encoded message | unit |
| T10 | AC7 | `buildResponseBrief` includes title, sentiment %, reach/impressions, the **penjelasan**, and the plan (counts + tier + total); omits the AI line cleanly when absent | unit |
| T11 | AC7 | DetailModal's negative-topic panel renders the WhatsApp dispatch link (`target=_blank`, `wa.me`) whose decoded text carries the topic title, penjelasan, and plan | component |

#### Revision history
| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-06-08 | Initial plan — **Counter-Noise Response Calculator**: in the Danantara negative-topic detail, turn reach + pressure into a recommended count of KOL / clipper / homeless counter-actions sized to contain escalation (counts only, no cost/reach shown). Pure client-side heuristic. Status → Planned (awaiting sign-off) |
| 1.0 | 2026-06-08 | Built (TDD) — `lib/danantara/ceo/counter-noise.ts` (pure plan: responseRatio by status + neg-share, target = reach × ratio, split KOL/clipper/homeless by per-unit reach) + `CounterNoisePanel` shown in the negative-topic detail; channel named **"Homeless posts"** per client. Worked example confirmed live (9.8M / neg 75% / normal → 8 / 35 / 245, ~51% re-reach). 7 formula + 2 component tests green, lint clean. Status → Built |
| 2.1 | 2026-06-08 | Client ("rework the gimmick — something AI: fetch / analyze etc."): replace the count-up+scan with a **Nexorus AI analysis pipeline** on scroll-in / tier-change — stepped status (Fetching → Analyzing → Modeling → Synthesizing), filling progress bar, scan sweep + glow, shimmering tiles, then a count-up reveal. Fixed the trigger (IntersectionObserver threshold 0 + rootMargin + a 2.5s fallback so it can't stick) — the modal's inner scroll wasn't tripping the 0.4 threshold. AC6 amended. Status → Built (187 tests green, lint clean, live-verified: 4 steps then count-up) |
| 3.1 | 2026-06-08 | Client: **rename the panel/feature** "Counter-Noise · Response Calculator" → **"Communication Response Calculator"** (and the WhatsApp brief line "Counter-Noise plan" → "Communication Response plan"; terminal labels updated). Internal module (`counter-noise.ts`), component, and `counter-noise` testids unchanged. Status → Built (192 tests green, lint clean) |
| 3.0 | 2026-06-08 | Client ("a Response button in the topic detail that WhatsApps the topic content to a set number — include the penjelasan / Nexorus analysis"): add a **"Dispatch Response via WhatsApp"** button to the Counter-Noise panel → opens `wa.me/‹NEXT_PUBLIC_RESPONSE_WHATSAPP›` with a pre-filled brief (topic · sentiment · reach/impressions · **Nexorus AI penjelasan** · selected-tier plan). New pure `response-dispatch.ts` (`whatsappResponseLink` / `buildResponseBrief` / `waNumber`). AC7 added. Status → Built (TDD: 4 unit + 1 component test; 192 total green, lint clean, live-verified link + message) |
| 2.2 | 2026-06-08 | Client ("run the animation once; tier change shouldn't re-animate; make it a terminal + longer"): rebuild the gimmick as a **faux Nexorus-AI terminal** (window chrome + traffic-lights, 8 boot lines line-by-line with a blinking cursor + `[ok]`, ~3.7s) that plays **once** on first scroll-in (`started` ref guard; effect no longer keyed on tier); a **`tierTouched`** flag makes tier switches **instant** (no count-up). AC6 amended. Status → Built (187 tests green, lint clean; live-verified L1→L8 boot then instant tier switches 733 / 3,665 / 2,199) |
| 2.0 | 2026-06-08 | Client (boss's crisis-dashboard model) — **replace the reach heuristic** with `counter_actions = negative_baseline × noise_multiplier`, split **clipper 50% / homeless 20% / kol 30%**, tier **Basic ×1 / Professional ×3 / Enterprise ×5** (live selector). Baseline = **estimated negative-post count** from negative impressions ÷ 7,500 (feed has no post count). Panel **moved below the penjelasan** + a **scroll-triggered "calculating" gimmick** (count-up + scan sweep). Worked example confirmed live (1,498 @ Pro → 4,494 = 2,247 / 899 / 1,348). AC1–AC6 amended; `responseCalculator` rewrites the pure module. 7 formula + 4 component tests green (187 total), lint clean, screenshot-confirmed. Status → Built |

---

### A10. Danantara Crisis Gate (fear-first executive landing)

- **Version:** 5.4 · **Stage:** 3-act · **Sprint:** demo · **Status:** Built · **Spec ref:** built on A7's Danantara topics feed + the OpenGate `/threats` + `/actor-intelligence` feeds; CEO feedback 2026-06-22 · **Owner:** Dev A

> **Note (2026-06-22):** an early v4.0 "Threat Command" product (full action/containment loop) was built on top of this gate, then **rolled back at the client's request** — they preferred the stripped fear gate. That "4.0 → reverted" row in the history records the explored-and-reverted work; it is **distinct** from the three-column v4.0 below.

> **Note (2026-07-28):** the built gate is now a **three-column command read** — (left) the Crisis Index dial · (middle) the biggest threat + its topics · (right) the accounts driving it — shipped in commits `feb230b` → `b873619` → `d357eea` but **never recorded** in this plan. It is captured retroactively as **v4.0** (AC7). **v5.0** then rewires the middle + right columns to the live OpenGate **`/threats`** feed (real detected threat + its real driving accounts); the left dial stays on `/topics`.

#### PM
**Background (why):** The Danantara CEO reviewed the `/danantara` Command Wall (A7) and gave direct feedback: he sees the split Danantara/BUMN views as *separate products* and wants **one product**, and — most importantly — the landing must be **fearful enough to stop him in his tracks** if he merely walks past the screen. His words: make it **super simple at first**, then reveal detail **only when he clicks**. A7's dense two-column sentiment wall is the *detail*, not the *alarm*: it answers "what's happening" but doesn't deliver a single visceral "how bad is it **right now**" at a glance. A10 adds a deliberately stark **Crisis Gate** in front of that wall — one giant glowing **Crisis Index (0–100)**, a one-word threat band, and the single biggest threat named beneath — and nothing else. It reuses A7's live feed and components; the existing `/danantara` is untouched and becomes the click-through detail layer. (Danantara-wide only for now; the same pattern can later drive a BUMN gate.)

**Background — v5.0 real-data wiring (2026-07-28, why):** two of the gate's three columns were on placeholder/derived data — the right **"Aktor Penggerak"** column was a **hardcoded demo roster** (`lib/danantara/actors.ts`, flagged "DUMMY"), and the middle threat was *inferred* from the topics feed rather than the platform's own threat detection. For a board whose whole job is "how bad, what is it, **who's causing it**", fabricated accounts undercut the "who". v5.0 wires the middle + right columns to the real OpenGate **`/threats`** endpoint (`topic=danantara_main`): the actual #1 detected threat and the real accounts driving it. The left Crisis Index dial keeps reading the aggregate **`/topics`** feed — it measures whole-conversation negativity, which `/threats` (a sparse, can-be-empty incident list) cannot.

**Background — v5.2 resilience (2026-07-29, why):** in use, the client hit **blank** middle + right panels. `/threats` is **event-driven** — it returns empty in calm periods — and the OpenGate upstream also serves intermittent **hollow** windows (empty `threats` list with non-zero `stats.*_severity`). Because v5.0 wired both panels solely to `/threats`, they went dark exactly when the gate should still say *something*. v5.2 makes them **degrade to the always-on `/topics` + `/actor-intelligence` roster** — restoring the pre-v5.0 resilience while keeping `/threats`' precision when a real incident is live — and adds a stale-empty self-heal so a transient hollow isn't cached for 6 h.

**Acceptance criteria (Given / When / Then):**
- **AC1** *(v3.0)* — *Given* the live Danantara topics feed (`/api/v1/danantara/topics` → `{ issues, summary }`), *When* `/danantara/krisis` loads, *Then* it renders **one** dominant signal — a **threat dial** ("Indeks Ancaman Danantara", 0–100, **high = danger**) whose needle points at the live score over a green→red arc, with the ends labelled **0 · AMAN** and **KRISIS · 100** so the scale and its direction are self-evident — computed from **real** fields only (overall negative share + reach-weighted negativity + worst-topic severity). A title + one-line subtitle ("Skala 0–100 — makin tinggi, makin berisiko") state plainly what is measured.
- **AC2** *(v3.3 — English ladder)* — *Given* the score, *When* rendered, *Then* beneath the dial a **huge status word** names the band in its colour — **LOW** `<25` (green) · **GUARDED** `25–44` (amber) · **ELEVATED** `45–64` (orange) · **SEVERE** `≥65` (red) from `SOV_COLORS` — with the precise **`‹score› / 100`** under it; at **SEVERE** the word siren-pulses (`.ceo-siren`). *(The prose readout sentence + `% negatif` line were cut in v3.2 to keep the gate glance-readable.)*
- **AC3** *(v3.2)* — *Given* the feed's issues, *When* rendered, *Then* the **single biggest threat** — *among genuinely-negative topics* (the wall's NEGATIVE test, `negMentions ≥ posMentions`) the one maximizing `reach × negative share` — is named in **one line** ("Ancaman Terbesar · ‹title›"); *When* no topic is negative, no threat is named. (This keeps the named threat **findable in the /danantara wall's NEGATIVE column** — a net-positive story with a wide negative minority is never labelled the threat.) The per-threat sentiment/reach meta was cut in v3.2 (detail on click). **No fabricated spike/velocity** (the feed is a flat snapshot: `velocity`/`status` are always `0`/`normal`).
- **AC4** *(v3.3)* — *Given* the gate, *When* the CEO clicks **"View briefing →"**, *Then* it navigates to **`/danantara/brief`** (the A11 Executive Briefing) for the full story. All gate **chrome is English** (title "Danantara Threat Index", "Top Threat", "Refresh", "Data unavailable"); the **topic title stays Indonesian**. The old `/danantara` wall is unchanged and still reachable via the menu.
- **AC5** — *Given* the upstream is unavailable or returns no issues, *When* the page loads, *Then* it **degrades gracefully** to a neutral "Data tidak tersedia" state (never a crash), per the degradation guardrail.
- **AC6** *(amaze, v3.0)* — *Given* the page mounts, *Then* the dial's **needle sweeps** and the score **counts up** to its value (driven off the same animated value), the layout is **full-viewport, dark, screenshot-shareable** and **fits one screen with no scroll** (verified to 1366×720), and motion honours `prefers-reduced-motion`.
- **AC7** *(v4.0 — three-column, recorded retroactively)* — *Given* the gate, *When* it loads, *Then* it renders a **three-column command read**: (left) the Crisis Index dial (AC1–AC2); (middle) **"Ancaman Utama"** naming the biggest threat + a **"Topik pendorong"** list; (right) **"Aktor Penggerak"** listing the accounts driving it, split **human vs bot** (up to 2 each). A Danantara brand header + a date-range preset control (**"Hari ini / 7 hari / 30 hari"**, UI-only) sit at the top.
- **AC8** *(v5.0 — real `/threats` wiring)* — *Given* the live OpenGate `/threats` feed (`/api/v1/danantara/threats` → the #1 detected threat + its drivers), *When* the gate loads, *Then* the **middle** column names that **detected threat** (title + severity `n/10` + growth-rate) and, beneath it, **"Topik pendorong"** — the **top-3 negative topics** feeding the conversation, each with its **reach + negative share**, from the `/topics` feed *(v5.1 — restored: v5.0 had briefly replaced this long-standing topic list with `/threats` trending-keyword chips, dropping the per-topic reach/neg metrics)* — and the **right** column lists its **real driving accounts** — mapped from `top_impact_posts[].actor_intelligence` (`@handle`, platform, followers, credibility, risk), split **human (`real_person`) vs provocateur/bot** — deduped by handle, ranked by engagement. The **left** dial is unchanged (`/topics`). *When* the feed has no detected threat (calm period) or is unavailable, both columns degrade to their neutral empty states (no crash), per AC5 — *superseded by the resilient fallback in **AC9***.
- **AC9** *(v5.2 — resilient fallback)* — *Given* the `/threats` feed has **no detected threat** (calm period or a transient hollow response), *When* the gate loads, *Then* the two threat panels **fall back to the always-populated `/topics` + roster data** instead of going blank: the **middle** headline falls back to the `/topics` **`biggestThreat`** (the net-negative topic maximizing `reach × neg-share`, with a category chip), and the **"Topik pendorong"** top-3 is **always shown** whenever there are negative topics (decoupled from the headline; the fallback headline topic is **excluded** from the list to avoid duplication); the **right** column falls back to the **`/actor-intelligence` roster** (`@handle`, platform, followers, credibility, risk, real avatar) — deduped by handle, ranked negative-leaning + influential first, split human vs provokator/bot — with an honest caption ("Aktor kunci dalam percakapan"). *When* a detected threat exists, the `/threats`-driven behaviour (AC8) applies. *When* there are genuinely no negative topics **and** no threat, the panels show their neutral empty states. *(**v5.3:** the **right** column now reads the `/actor-intelligence` roster **always**, not only as a fallback — see AC11; the middle-column `/topics` fallback below is unchanged.)*
- **AC10** *(v5.2 — feed self-heal)* — *Given* the OpenGate `/threats` upstream intermittently serves a **hollow** response (empty `threats` list, sometimes with non-zero `stats.*_severity`), *When* the cacheable (6 h) fetch returns zero threats, *Then* `threats-feed` **re-confirms once against the live (no-store) upstream** and prefers any live data (mirroring `topics-feed`), so a transient empty is **not cached for 6 h** and the panels recover on the next load; a genuinely empty feed stays empty (no fabricated data), and `?fresh=1` skips the redundant confirm.
- **AC11** *(v5.3 — panel 3 always the roster)* — *Given* the gate, *When* it loads, *Then* the **right "Aktor Penggerak"** column **always** reads the **`/actor-intelligence` roster** (its own BFF), independent of whether `/threats` has a detected incident — so it consistently renders **real profile pictures**, deduped + negative-first, split human vs provokator/bot, captioned "Aktor kunci dalam percakapan". *(Rationale: `/threats` carries **no avatars**, so tying panel 3 to it drifted the UI to bare initials whenever a real incident appeared; decoupling keeps the experience consistent.)* Panel 2's `/topics` fallback (AC9) and the `/threats` self-heal (AC10) are unchanged; `/threats` now serves **only** the detected-threat headline for panel 2 (`{ threat, stats }`).

#### Architecture
**Impact — files add/change:**
- `add` `lib/danantara/ceo/crisis.ts` — **pure, side-effect-free**: `crisisIndex(issues, summary)` → `{ score, level, color, siren }`; `crisisBand(score)`; `biggestThreat(issues)` (max `reach × negShare`). Named weight constants (`0.55·negShare + 0.30·weightedNeg + 0.15·worstNeg`, clamped 0–100) + band thresholds 25/45/65.
- `add` `lib/danantara/ceo/crisis.test.ts` — vitest (TDD target).
- `add` `components/danantara/ceo/CrisisGate.tsx` — client: fetch the topics feed (reuse the `CeoCommand` fetch/offline pattern), compute index + biggest threat, render the giant index + band word + threat line + `Lihat detail →` link, with offline state.
- `add` `app/danantara/krisis/page.tsx` — `<AppShell><CrisisGate /></AppShell>` (mirrors `app/danantara/page.tsx`).
- `change` `app/globals.css` *(maybe)* — count-up / scanline polish if `.ceo-siren` alone isn't enough.
- `unchanged` `/danantara`, `CeoCommand`, `/api/v1/danantara/topics` (reused as-is).

**Data-model / API changes:** **none** — reuses the existing topics BFF; no DB, no LLM, no new endpoint.

**Reuse:** `AppShell`; `SOV_COLORS` + helpers in `lib/danantara/ui.ts`; `.ceo-siren` + fonts in `app/globals.css`; the `CeoCommand` fetch/`mountedRef`/offline pattern; optionally `SentimentPie` as a ring.

**Risks:** the feed is a **flat snapshot** (no real velocity/spike) → the index is built only from real fields; weights are **named constants tunable in the QA pass**, and the "fear" framing stays credible (no invented numbers). Route is **public** (no auth), consistent with the other standalone demo routes.

**Impact — v4.0 / v5.0 files (add/change/remove):**
- *(v4.0, already built — backfilled)* `components/danantara/ceo/ThreatTopics.tsx` (middle column), `components/danantara/ceo/ThreatActors.tsx` (right column), `lib/danantara/ceo/threat-actors.ts` (`actorsDrivingThreat` + `CATEGORY_LABEL`); `CrisisGate.tsx` → three-column layout + brand header + date-range presets.
- *(v5.0)* `add` `lib/danantara/ceo/threats-source.ts` — **pure** DTO + `mapThreatsResponse` → `{ stats, threats: DetectedThreat[] }`; each `DetectedThreat` carries its `drivers: ThreatDriver[]` (mapped from `top_impact_posts[].actor_intelligence`, deduped by handle, ranked by engagement, `bot` from `account_type`).
- *(v5.0)* `add` `lib/danantara/threats-feed.ts` — server fetch (mirrors `sentiment-trend-feed.ts`): reuses `DANANTARA_TOPICS_API_KEY`, base `…/threats`, 6 h cache, `ThreatsNotConfiguredError`.
- *(v5.0)* `add` `app/api/v1/danantara/threats/route.ts` — public BFF → `{ threat, stats }` (503 unconfigured, 502 upstream fail).
- *(v5.0)* `change` `CrisisGate.tsx` — fetch `/api/v1/danantara/threats`; feed the detected threat → `ThreatTopics`, its drivers → `ThreatActors`; drop the static `/actors` fetch. `change` `ThreatTopics.tsx` (render the detected threat + trending-keyword chips), `ThreatActors.tsx` (render `ThreatDriver[]`, human vs provocateur/bot).
- *(v5.0)* `remove` `app/api/v1/danantara/actors/route.ts` — orphaned once `CrisisGate` stops fetching it. **Keep** `lib/danantara/actors.ts` (`DANANTARA_ACTORS` is still consumed by `lib/danantara/data.ts` → the A7/A8 media-intelligence `ActorMap`). `actorsDrivingThreat` + `CATEGORY_LABEL` in `threat-actors.ts` are **retained** (gate-unused after this change, but self-contained and still unit-tested).
- `unchanged` the left dial + `crisis.ts` + `/api/v1/danantara/topics` + `/topics` mapping.

**Data-model / API changes (v5.0):** adds **one** BFF — `/api/v1/danantara/threats` — proxying the OpenGate `/threats` endpoint for `danantara_main`; **no DB, no LLM**; reuses the existing server-side `DANANTARA_TOPICS_API_KEY` (never client-side). Local dev: `.env.local` supplies the key so all three panels read live.

**Risks (v5.0):** `/threats` is **sparse** (can be empty in calm periods) → the middle/right columns must render clean empty states (the left dial, on `/topics`, keeps a value). Upstream `follower_count` is a **formatted string** (`"13,793"`) → parsed defensively. The `account_type` enum is open-ended → the human/bot split treats a known amplifier set (`propaganda_provocator` / buzzer / bot) as bot, else human. Route is **public** (consistent with the other demo BFFs); `api_key` stays server-side.

**Impact — v5.2 files (add/change):**
- *(v5.2)* `add` `lib/danantara/ceo/actor-roster-source.ts` — **pure** `mapActorRoster` → `ThreatDriver[]` from the `/actor-intelligence` payload: deduped by handle, ranked negative-leaning + influential first, `bot` from `account_classification`, real base64 `avatarUrl`, float `sentiment_score` tolerated.
- *(v5.2)* `add` `lib/danantara/actor-roster-feed.ts` — server fetch (mirrors `threats-feed.ts`): reuses `DANANTARA_TOPICS_API_KEY`, base `…/actor-intelligence`, 6 h cache, `ActorRosterNotConfiguredError`.
- *(v5.2)* `change` `lib/danantara/threats-feed.ts` — add the **stale-empty self-heal** (re-confirm live when the cacheable window has zero threats).
- *(v5.2)* `change` `app/api/v1/danantara/threats/route.ts` — when there is **no detected threat**, fetch the roster server-side and return `{ threat, stats, drivers, driversSource }` (`driversSource` = `"threat"` | `"roster"`), so the client always reads a populated `drivers`.
- *(v5.2)* `change` `ThreatTopics.tsx` — render the `/threats` `DetectedThreat` **or** the `/topics` `biggestThreat` fallback headline, and always show the top-3 "Topik pendorong". `change` `ThreatActors.tsx` — accept a `caption` + optional `avatarUrl`. `change` `CrisisGate.tsx` — compute the `biggestThreat(issues)` fallback + dedup the top-3; pass `drivers`/`caption` through. `ThreatDriver` gains an optional `avatarUrl`.

**Data-model / API changes (v5.2):** the existing `/api/v1/danantara/threats` BFF now **also** proxies `/actor-intelligence` (server-side, only when there is no detected threat) and returns `drivers` + `driversSource`; still no DB/LLM; same server-side `DANANTARA_TOPICS_API_KEY`.

**Risks (v5.2):** the roster (`/actor-intelligence`) is **dense** (always ~13–19 actors, with **duplicate handles** → dedup) and stays populated even when `/topics`/`/threats` are hollow, so it is a reliable fallback; the extra upstream call runs **only** when there is no detected threat. The roster fallback is framed honestly ("Aktor kunci", not "Penggerak" of a specific incident). `sentiment_score` may be a **float**; `profile_picture` is a **base64 data-URI** (rendered directly, initials fallback).

**Impact — v5.3 files (add/change):**
- *(v5.3)* `add` `app/api/v1/danantara/actor-intelligence/route.ts` — public BFF → `{ actors }` from `fetchActorRosterForCode` (503 unconfigured, 502 fail); panel 3's own endpoint.
- *(v5.3)* `change` `app/api/v1/danantara/threats/route.ts` — **revert** to `{ threat, stats }` (the roster + `drivers`/`driversSource` move to the new route; the `/threats` self-heal stays).
- *(v5.3)* `change` `CrisisGate.tsx` — add a third fetch to `/api/v1/danantara/actor-intelligence`; panel 3 **always** renders the roster (caption always "Aktor kunci dalam percakapan"); `loadThreats` reverts to reading `{ threat }`; `driversSource` dropped.
- `unchanged` `actor-roster-source.ts` / `actor-roster-feed.ts` (now consumed by the new route) · `ThreatActors.tsx` (already renders avatars) · `ThreatTopics.tsx`.

**Data-model / API changes (v5.3):** adds `/api/v1/danantara/actor-intelligence` (proxies the OpenGate `/actor-intelligence` endpoint) for panel 3; `/api/v1/danantara/threats` returns to `{ threat, stats }`. No DB/LLM; same server-side `DANANTARA_TOPICS_API_KEY`.

**Risks (v5.3):** panel 3 no longer reflects a specific incident's *drivers* — it shows the topic-wide negative-leaning key actors (framed honestly by the caption; the client accepted this to keep avatars consistent). Three parallel client fetches on mount (topics · threats · actor-intelligence); each degrades independently.

#### QA
| # | Maps to | Test case | Type |
|---|---|---|---|
| T1 | AC1 | `crisisIndex` is monotonic in `summary.percentage.negative` (more negative → higher score), clamped 0–100 | unit |
| T2 | AC1/AC3 | reach-weighted negativity: a loud (high-reach) negative topic raises the score more than a quiet one | unit |
| T3 | AC2 | `crisisBand` thresholds: 24→Aman, 25→Terkendali, 45→Waspada, 65→Krisis; colour per band | unit |
| T4 | AC2 | `siren` is `true` only at level Krisis (`score ≥ 65`) | unit |
| T5 | AC3 | `biggestThreat` returns the issue maximizing `reach × negShare` **among net-negative topics**; ignores net-positive topics (wall consistency); ties resolved deterministically; `null` when none negative | unit |
| T6 | AC5 | empty issues / null summary → score `0`, level Aman, `biggestThreat` = `null` (no throw) | unit |
| T7 | AC1/AC2/AC3 | `CrisisGate` renders the index number, band word, and the named biggest threat from seeded feed data | component |
| T8 | AC5 | fetch failure → "Data tidak tersedia" offline state, no crash | component |
| T9 | AC4 | the gate exposes a link/route to `/danantara` for drill-down | component |
| T10 | AC8 | `mapThreatsResponse` maps a real `/threats` payload → `DetectedThreat[]`; drivers deduped by handle (highest-engagement kept), sorted by engagement desc; `follower_count` `"13,793"`→`13793` | unit |
| T11 | AC8 | driver `bot` flag from `account_type`: `propaganda_provocator`/buzzer/bot → bot; `real_person` → human | unit |
| T12 | AC5/AC8 | `mapThreatsResponse` on `{ threats: [] }` → no threat, empty drivers (no throw); malformed payload rejected by the feed | unit |
| T13 | AC8 | `/api/v1/danantara/threats` → 503 when unconfigured, `{ threat, stats }` on success (mirrors the topics route) | route |
| T14 | AC8 | `CrisisGate` (stubbing **both** `/topics` and `/threats`) renders the detected-threat title in the middle column and its driver handles in the right column | component |
| T15 | AC8 *(v5.1)* | `CrisisGate` renders the top negative `/topics` topics as "Topik pendorong" rows — each showing the topic title, reach, and negative share — beneath the detected threat | component |
| T16 | AC9 | `CrisisGate` (stub `/threats` → `{ threat: null }`, `/topics` with negatives): the middle headline falls back to the `/topics` `biggestThreat` and the top-3 "Topik pendorong" still render | component |
| T17 | AC9 | the fallback headline topic is **excluded** from the top-3 list beneath it (no duplication) | component |
| T18 | AC9 | `mapActorRoster` → `ThreatDriver[]`: deduped by handle, ranked negative-leaning first, `bot` from `account_classification`, float `sentiment_score` + base64 avatar tolerated | unit |
| T19 | AC9 | `/api/v1/danantara/threats` with no detected threat returns `driversSource: "roster"` + roster drivers; with a threat returns `driversSource: "threat"` + threat drivers | route |
| T20 | AC10 | `fetchThreatsForCode`: a cacheable empty re-confirms live and prefers live threats; a genuinely empty stays empty; `?fresh=1` adds no redundant confirm | unit |
| T21 | AC11 | `/api/v1/danantara/actor-intelligence` → 503 when unconfigured, `{ actors }` (mapped roster) on success; `api_key` never appears in the response | route |
| T22 | AC11 | `CrisisGate` renders the `/actor-intelligence` roster in the right column **even when `/threats` has a detected threat** (panel 3 decoupled from `/threats`) | component |

**Governance edge cases:** public demo route (no RBAC, like A7/A8) — no restricted data, the feed `api_key` stays server-side in the existing BFF; graceful degradation on upstream failure (AC5); index is **deterministic & pure** (same input → same score), computed client-side, no LLM/cost.

#### Revision history
| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-06-22 | Initial plan — **Crisis Gate**: a fear-first `/danantara/krisis` landing showing one 0–100 Crisis Index (high = danger) + threat band + biggest threat, click-through to the A7 wall; reuses A7's live topics feed, `/danantara` untouched. From CEO feedback ("make it fearful, super simple, details on click; one product"). Status → Planned (awaiting sign-off) |
| 1.0 | 2026-06-22 | Built (TDD) — pure `lib/danantara/ceo/crisis.ts` (`crisisIndex` `0.55·negShare + 0.30·reach-weighted negativity + 0.15·worst-topic`, bands 25/45/65, `crisisBand`, `biggestThreat`) + `CrisisGate.tsx` (giant count-up index, threat band + green→red meter, named biggest threat, `Lihat detail →` /danantara, graceful "Data tidak tersedia" offline) + `/danantara/krisis` route; `AppShell.minimalChrome` extended to `/danantara/*`. 11 new tests (8 unit + 3 component), **261 total green**, tsc + lint clean (new files). Live-verified on the real feed: today reads **24 / Aman** (22.8% negative) with the loudest negative-reach topic as the named threat; red/`.ceo-siren` state triggers when the index reaches Krisis (≥65). |
| 1.1 | 2026-06-22 | Client: the gate **shouldn't scroll** — reaching "Lihat detail" took a small scroll. Pin the section to the available viewport height (`h-[calc(100dvh-7.75rem)]`, `overflow-hidden`), scale the index with viewport height (`text-[clamp(5rem,22vh,12rem)]`), and tighten the inter-block gaps so the whole gate fits one screen. Presentation only (no AC change). Verified no-scroll with the drill-down button in view at 1440×820 and 1366×720. Status → Built |
| 2.0 | 2026-06-22 | Client ("can't find the named topic in the topic list"): the "Ancaman Terbesar" was picked by raw negative-reach, so it could be a **net-positive** story (e.g. the Himbara topic, sentiment +10) that the wall files under **POSITIVE** — invisible when looking for a threat. `biggestThreat` now restricts to **net-negative** topics using the wall's exact test (`negMentions ≥ posMentions`), so the named threat always sits in the wall's NEGATIVE column. Confirmed real-data consistency (same `/api/v1/danantara/topics` feed): named threat moved to "Kritikan… Transparansi… Korupsi" (sentiment −80), index 24→32 (Terkendali). AC3 + T5 amended; +1 regression test (net-positive ignored). 262 tests green, tsc + lint clean. Status → Built |
| 3.0 | 2026-06-22 | Client ("imagine you're the CEO — a bare '47' doesn't say what it represents"): redesign the hero from a bare number into a **threat dial** (`CrisisGauge.tsx`) — a 180° green→red gauge with a needle at the live score, ends labelled **0 · AMAN / KRISIS · 100**, plus a clearer title ("Indeks Ancaman Danantara") + subtitle, a coloured **status pill**, the precise **`score / 100`**, and a one-line plain-language readout per band. The needle sweeps with the count-up. Recompacted (smaller dial, vh gaps, merged readout line) so it still **fits one screen with no scroll** down to 1366×720. AC1/AC2/AC6 amended; presentation only (scoring unchanged). 262 tests green, tsc + lint clean, screenshot-verified at 1280×800 and 1366×720. Status → Built |
| 3.1 | 2026-06-22 | Client ("font's too little; add more fear — a walk-by hook that makes the CEO stop"): scale the whole hero with **viewport height** (vh-clamped type + dial) so it grows large on the CEO's monitor/TV while staying one-screen on a laptop; turn the band word into a **huge glowing status word** (the hook), and add an **ambient threat glow** (`.crisis-breathe`) that washes the screen in the band colour and breathes harder as the level worsens (calm at Aman → pulsing red at Krisis; honours `prefers-reduced-motion`). Presentation only. 262 tests green, tsc + lint clean, screenshot-verified at 1920×1080 and 1366×720. Status → Built |
| 3.2 | 2026-06-22 | Client ("still too much text"): strip the gate to glance-readable essentials — **cut** the subtitle, the prose readout sentence, and the `% negatif` line; **merge** the live-eyebrow into the title (one line); **collapse** the threat card to a single line ("Ancaman Terbesar · ‹title›", no sentiment/reach meta). The gate is now ~5 elements: title · dial · status word · `score/100` · one threat line. AC2/AC3 amended; presentation only. 262 tests green, tsc + lint clean, screenshot-verified at 1920×1080 and 1366×720. Status → Built |
| 4.0 → reverted | 2026-06-22 | Explored **MAJOR tool → product** ("make it addictive"): built the full **Threat Command** Hooked loop on topics-as-board — `FIGHT NOW` → sized A9 response → projected suppression + CONTAINMENT → Neutralized → Command Record + streak, English copy, LOW/GUARDED/ELEVATED/SEVERE ladder, `/krisis` as home (new `command-model.ts`/`command-store.ts`/`CommandDeck`/`ThreatBoard`; 270 tests green; live-verified 47→26 loop). **Client did not like the product direction → rolled back to v3.2** (the stripped fear gate). All v4.0 files removed; `crisis.ts`/`CrisisGate`/`CrisisGauge`/`auth` restored; spec + AC7–11 + T10–15 dropped. Current behaviour = v3.2. 262 tests green, tsc + lint clean |
| 3.3 | 2026-06-23 | Client: **gate chrome → English** (except topic titles) and **"Lihat detail" → "View briefing"** now opens the new A11 Executive Briefing at `/danantara/brief` (was the `/danantara` wall). `crisis.ts` band ladder → **LOW/GUARDED/ELEVATED/SEVERE** (thresholds/colours unchanged); `CrisisGauge` labels → `0 · LOW` / `SEVERE · 100`; title → "Danantara Threat Index". AC2/AC4 amended. Status → Built |
| 3.4 | 2026-07-28 | Discoverability (MINOR) — the gate had **no menu entry**, so `/danantara/krisis` was only reachable by typing the URL. Add **Danantara Crisis Gate** (`Siren` icon) to the `AppShell` gear-menu **Dashboards** group, after "Danantara CEO Command (v2)". Placed in the Dashboards group so it survives both the `minimalChrome` filter (Dashboards-only on `/danantara/*`) and the danantara-scope filter (`/danantara*`) — i.e. it's present even on the gate page itself. No change to the gate's behaviour/scoring. +2 `AppShell.test.tsx` cases (link present on `/` and on the minimal-chrome `/danantara/krisis`); **387 total green**, tsc clean, no new lint; live-verified logged in as atlasadmin. Status → Built |
| 4.0 (backfilled) | 2026-07-28 | **Recorded retroactively** — the built gate became a **three-column command read** in commits `feb230b` → `b873619` → `d357eea`: (left) the Crisis Index dial; (middle) `ThreatTopics` — biggest threat (`biggestThreat`) + related negative topics ("Topik pendorong"); (right) `ThreatActors` — accounts driving it, ranked by `actorsDrivingThreat`, split **human vs bot** (2×2); plus a Danantara brand header + UI-only date-range presets. Data: middle from the `/topics` feed's `biggestThreat`; **right from a hardcoded demo roster** (`lib/danantara/actors.ts`, flagged "DUMMY"). Shipped without a study-plan row; captured here so the plan matches the code. AC7 added. |
| 5.0 | 2026-07-28 | **Real-data wiring (MAJOR)** — the middle + right columns were on placeholder/derived data (right = the DUMMY roster; middle = topics-inferred). Rewire both to the live OpenGate **`/threats`** feed (`topic=danantara_main`): new pure `threats-source.ts` (`mapThreatsResponse` → `DetectedThreat[]`, each with deduped, engagement-ranked `drivers` from `top_impact_posts[].actor_intelligence`) + `threats-feed.ts` (reuses `DANANTARA_TOPICS_API_KEY`, 6 h cache) + public `/api/v1/danantara/threats` BFF; `CrisisGate` feeds the #1 detected threat → `ThreatTopics` (title + severity + growth + impact + trending-keyword chips) and its drivers → `ThreatActors` (human vs provocateur/bot). Left dial stays on `/topics`. The orphaned `/api/v1/danantara/actors` route is removed; the static `actors.ts` roster **stays** (still feeds the A7/A8 `ActorMap` via `data.ts`), and `actorsDrivingThreat` is retained (gate-unused, still unit-tested). `.env.local` wires the key for local live. AC8 + T10–T14 added. **+15 new unit/route tests + the updated `CrisisGate` suite; 403/404 green** (the lone red is a pre-existing clock-dependent `jasamarga/ai-insight` test, untouched here), tsc + lint clean. **Live-verified** on the real `danantara_main` feed: gauge **18 / AMAN** (12.18% neg), threat *"Tuduhan Manipulasi Keuangan…"* (severitas 8/10, +15%), 4 real drivers split 2 human / 2 provokator-bot (`follower_count` parsed, deduped, engagement-ranked); `api_key` never leaves the server. Status → Built. |
| 5.1 | 2026-07-29 | **Regression fix (MINOR)** — v5.0 replaced the middle column's long-standing **"Topik pendorong"** list (top-3 negative topics, each with reach + negative share) with flat `/threats` trending-keyword chips, dropping the per-topic metrics the client relies on. Restored the top-3 list from the `/topics` feed already fetched for the gauge (`groupIssuesBySentiment(issues).negative.slice(0,3)`), rendered under the `/threats` detected-threat headline (severity + growth kept). AC8 amended; +1 component test (T15). Tests green, tsc + lint clean, live-verified. Status → Built. |
| 5.2 | 2026-07-29 | **Resilient fallback + feed self-heal (MINOR)** — `/threats` is event-driven and often empty (calm periods) or transiently **hollow** (empty list with non-zero severity stats), which blanked panels 2 & 3. Now they degrade to the always-populated `/topics` + roster: the middle headline falls back to the `/topics` `biggestThreat` and the top-3 "Topik pendorong" always render (decoupled from the headline, deduped); the right column falls back to the **`/actor-intelligence` roster** (new `mapActorRoster` — deduped, negative-first, real avatars) via a server-side fallback in the `/threats` route (`driversSource` `threat`\|`roster`). Added the **stale-empty self-heal** to `threats-feed` (mirrors `topics-feed`) so a transient hollow doesn't stick in the 6 h cache. AC9/AC10 + T16–T20. **+12 tests, 417/417 green**, tsc + lint clean. **Live-verified** during a real double-hollow window: panel 3 fell back to the `/actor-intelligence` roster (4 real accounts, real avatars, human/bot split, honest "Aktor kunci" caption, no console errors); panel 2's `/topics` fallback is test-proven (T16/T17). Status → Built. |
| 5.3 | 2026-07-29 | **Panel 3 always the roster (client request)** — `/threats` carries **no avatars**, so v5.2's threat-driver path drifted panel 3 to bare initials whenever a real incident appeared. Decouple panel 3 from `/threats`: it now **always** reads a new **`/api/v1/danantara/actor-intelligence`** BFF (real profile pictures every time), and `/threats` reverts to `{ threat, stats }` (panel-2 headline only; self-heal kept). `CrisisGate` gains a third fetch; caption is always "Aktor kunci dalam percakapan"; `driversSource` dropped. AC9 amended, +AC11 + T21/T22. **420/420 green, tsc + lint clean.** **Live-verified**: `/threats` → `{ threat, stats }`, `/actor-intelligence` → `{ actors }` (7 real accounts w/ avatars); panel 3 always the roster; the topics feed also recovered mid-verify, so panel 2's `/topics` fallback showed live too (SIAGA 49 · KEBIJAKAN · TOPIK TERATAS + top-3). No console errors. Status → Built. |
| 5.4 | 2026-07-29 | **Presentation only (client)** — a long actor `@handle` in panel 3 (e.g. `@konveksi_karawang_cikampek`) was truncated with an ellipsis. Let it **wrap to a new line** instead: the `ThreatActors` driver card's handle uses `break-words` (was `truncate`) + `leading-tight`, and the card header aligns `items-start` so the avatar top-aligns when the name spans two lines. No behaviour/data change; tests unaffected. Status → Built. |

---

### A11. Danantara Executive Briefing

- **Version:** 2.2 · **Stage:** 3-act · **Sprint:** demo · **Status:** Built · **Spec ref:** `docs/superpowers/specs/2026-06-23-danantara-executive-briefing-design.md` · **Owner:** Dev A

#### PM
**Background (why):** `/danantara/krisis` (A10) is the CEO's one-glance alarm. When he wants more — *"okay it's ELEVATED, now tell me the whole story"* — he needs a clean drill-down, not the dense analyst wall at `/danantara` (A7). A11 is a new **Executive Briefing** at `/danantara/brief`, driven **only** by `danantara_main` (the Danantara-wide topics feed), in a top-down narrative layout for a time-poor CEO: a written verdict, the win + the concern, share-of-voice, then the topics. `/krisis`'s "View briefing" links here; the old `/danantara` wall is untouched. **English chrome; topic titles/content stay Indonesian.**

**Acceptance criteria (Given / When / Then):**
- **AC1** — *Given* the live `danantara_main` feed (`/api/v1/danantara/topics`, no code param), *When* `/danantara/brief` loads, *Then* it renders an Executive Briefing: a **verdict hero** (a plain-English one-line read composed from the data + the sentiment split bar + KPI tiles **Total Reach · Impressions · Topics**).
- **AC2** — *Given* the topics, *When* rendered, *Then* a **"What's driving it"** section shows two cards — **Biggest win** (`topWin`: loudest net-positive topic) and **Biggest concern** (`biggestThreat`: loudest net-negative) — each with the topic title + AI read; clicking either opens the topic `DetailModal`.
- **AC3** — *Given* the feed's intent data, *When* rendered, *Then* the **Share of Voice** leaderboard (`IntentShare`) shows the dominant conversation themes.
- **AC4** — *Given* the topics, *When* rendered, *Then* the **ranked topic list** (`TopicCard`) shows every topic; clicking one opens the `DetailModal` (sentiment, AI analysis, A9 response calculator for negatives, P8 Nexorus deep-link).
- **AC5** — *Given* the upstream is unavailable or empty, *When* the page loads, *Then* it **degrades gracefully** ("Data unavailable", loading skeletons), never a crash.
- **AC6** — *Given* the product, *Then* all **chrome is English**; **topic titles/content stay Indonesian**; the page is scrollable + responsive; a small **threat-level chip** (same `crisisIndex` band as `/krisis`) ties the two screens together.
- **AC7** *(v2.1 — 7-day momentum chart)* — *Given* the `sentiment-trend` feed for `danantara_main` (a 7-day daily `{ date, positive, negative, neutral }` series), *When* the verdict hero renders, *Then* a **momentum** element shows a **direction verdict** headline (↑ Improving / ↓ Deteriorating / → Stable + delta in points) over a clean **Positive-vs-Negative two-line chart** (green positive share vs red negative share per day, the gap between them shaded, day labels + y-axis + legend). The **partial trailing day** (today, still accumulating) is excluded from both the chart and the direction read so it never shows a false crash. *Given* the trend feed fails, *Then* the briefing still renders (momentum simply omitted — graceful).

#### Architecture
**Impact — files add/change:**
- `add` `lib/danantara/ceo/briefing.ts` — **pure**: `dominantTone(summary)` → `{ tone, pct }`; `topWin(issues)` → loudest net-positive topic (`reach × positive fraction`), `null` when none. + `briefing.test.ts`.
- `add` `components/danantara/brief/DanantaraBrief.tsx` — page component (fetch + states + layout).
- `add` `app/danantara/brief/page.tsx` — `<AppShell><DanantaraBrief/></AppShell>`. + `DanantaraBrief.test.tsx`.
- `change` `components/danantara/ceo/CrisisGate.tsx` — "View briefing" link → `/danantara/brief` (also part of A10 v3.3 English pass).
- *(v2.0)* `add` `lib/danantara/sentiment-trend-feed.ts` — server-side fetch for the upstream `sentiment-trend` endpoint (key stays server-side, 6 h cache, `TrendNotConfiguredError`), mirroring `topics-feed.ts`. + `app/api/v1/danantara/sentiment-trend/route.ts` (allowlisted `?code=`, defaults to `danantara_main`).
- *(v2.0)* `add` `lib/danantara/ceo/trend.ts` — **pure**: `trendPoints(data)` (net per day + partial-tail flag) + `trendDirection(points)` (`up`/`down`/`flat` + delta, robust half-vs-half, ignores the partial day). + `trend.test.ts`.
- *(v2.0–2.1)* `add` `components/danantara/brief/SentimentMomentum.tsx` (verdict headline + **Positive-vs-Negative 7-day line chart**, hand-rolled SVG; `trendPoints` carries daily `pos`/`neg` %); `change` `DanantaraBrief.tsx` to fetch the trend feed + render it in the verdict hero.

**Data-model / API changes:** *(v2.0)* one new read-only BFF route `GET /api/v1/danantara/sentiment-trend` (proxies the upstream daily series; `api_key` server-side). No DB/LLM.

**Reuse:** the topics fetch pattern; `SentimentBreakdown`, `SentimentPie`, `TopicCard` (+`TopicCardSkeleton`), `IntentShare`, `DetailModal` (state `{ tickCount:0, issues, bumn:[] }`, selection `{ type:"issue", id }`); `crisisIndex` / `biggestThreat`; the Danantara logo (`/public/danantara.png`).

**Risks:** the verdict line must be **composed only from real data** (no invented claims); `topWin`/`biggestThreat` use the same negative/positive test as the wall so win vs concern are classified consistently.

#### QA
| # | Maps to | Test case | Type |
|---|---|---|---|
| T1 | AC2 | `topWin` returns the loudest **net-positive** topic by `reach × positive fraction`; ignores net-negative; `null` when none positive | unit |
| T2 | AC1 | `dominantTone` returns the tone with the max share (positive/negative/neutral) + its % | unit |
| T3 | AC1/AC2/AC3/AC4 | `DanantaraBrief` renders the verdict hero, both driver cards, `IntentShare`, and a topic row from seeded feed data | component |
| T4 | AC4 | clicking a topic opens the `DetailModal` | component |
| T5 | AC5 | feed failure → "Data unavailable" offline state, no crash | component |
| T6 | AC7 | `trendPoints` computes net `(pos−neg)/total` per day and flags a low-volume **trailing partial day** | unit |
| T7 | AC7 | `trendDirection`: rising series → `up` (+delta), falling → `down`, flat → `flat`; the partial day is excluded; `<2` complete days → `flat` | unit |

**Governance edge cases:** public demo route (like A7/A8) — feed `api_key` stays server-side (topics **and** sentiment-trend); graceful degradation (AC5/AC7); pure helpers are deterministic; no LLM/cost.

#### Revision history
| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-06-23 | Initial plan — **Executive Briefing** at `/danantara/brief` (danantara_main only): verdict hero + win/concern cards + Share of Voice + topic list, reusing A8 components + `DetailModal`; English chrome, Indonesian topics; `/krisis` "View briefing" links here. From client direction (revamp the Danantara detail, keep `/danantara`). Status → In progress |
| 1.0 | 2026-06-23 | Built (TDD) — pure `briefing.ts` (`dominantTone` + `topWin`) + `DanantaraBrief.tsx` (verdict hero with `SentimentBreakdown` + KPI tiles, win/concern `DriverCard`s, `IntentShare`, `TopicCard` list → `DetailModal`) + `/danantara/brief` route; reuses the topics feed + A8 components. 7 new tests (4 unit + 3 component), **269 total green**, tsc + lint clean. Live-verified on the real feed: verdict "broadly positive (68%)", win = Obligasi Global, concern = Transparansi/Fiskal, Share-of-Voice + 10 topic cards; threat chip GUARDED·25 ties to /krisis. Status → Built |
| 2.0 | 2026-06-23 | Client offered a `sentiment-trend` endpoint → add **7-day momentum** to the verdict hero (the CEO's "is it getting better or worse?"). New server-side `sentiment-trend-feed.ts` + `GET /api/v1/danantara/sentiment-trend` BFF (key server-side, 6 h cache); pure `trend.ts` (`trendPoints`/`trendDirection`, **excludes the partial trailing day** so today's incomplete data can't fake a crash); `SentimentMomentum` (↑/↓/→ verdict chip + net-sentiment sparkline). Graceful: briefing still renders if the trend feed fails. AC7 + T6/T7 added. Status → Built |
| 2.1 | 2026-06-23 | Client ("don't like the chip+sparkline; a chart isn't too much"): replace it with a proper **Positive-vs-Negative 7-day line chart** (hand-rolled SVG — green positive vs red negative share per day, shaded gap, y-axis + date labels + legend) under the same ↑/↓/→ verdict headline. `trendPoints` now carries daily `pos`/`neg` %. Partial day still excluded. AC7 amended; 276 tests green, tsc + lint clean, live-verified on the real feed (Stable, green leads red). Status → Built |
| 2.2 | 2026-06-23 | Client ("too big; make it cooler"): redesign the chart — **smooth glowing curves** (Catmull-Rom bezier) with **gradient area fills** + glowing end markers, dropped the heavy y-axis/gridlines, and made it a **compact wide strip** (viewBox 660×132 vs 600×188 → far shorter at full width). Same verdict headline + legend; partial day still excluded. 276 tests green, tsc + lint clean, live-verified. Status → Built |

---

### A12. JasaMarga AI Ops Insight & Predictions (LLM-backed)

- **Version:** 7.0 · **Stage:** 3-act · **Sprint:** demo · **Status:** Built · **Spec ref:** — · **Owner:** Dev A

#### PM
**Background (why):** The JasaMarga Ops Command dashboard ships two widgets badged as AI — **"AI Ops Insight"** (`ANALISIS NEXORUS AI`) and **"Prediksi Kemacetan"** (`PREDIKSI NEXORUS AI`) — and the page header claims *"analitik Nexorus AI"*. Neither calls a model. `deriveInsight()` in `lib/jasamarga/data.ts` assembles the insight from string templates, and `predictions:` is a hardcoded three-item array whose confidence figures come from `jit()`, a random-jitter helper — so the percentages shown to a client (68% / 63% / 49%) change on every refresh and mean nothing.

That is a demo-integrity problem, not a cosmetic one. The lead audience for these demos is technical enough to ask *"what model produces that number?"*, and today the honest answer is "none". It also wastes the differentiator: we already have a real LLM engine (`lib/ai/engine.ts`, live since the `NEXORUS_AI_KEY` wiring) and a rich, genuinely-live grounding surface (TomTom flow + incidents, weather, sentiment, forecast). A12 makes the two AI-badged widgets actually AI-backed: the LLM reads the same snapshot the operator is looking at and writes the analysis and the scenarios, grounded in real numbers.

**Acceptance criteria (Given / When / Then):**
- **AC1** — *Given* a rendered Ops snapshot and a configured `NEXORUS_AI_KEY`, *When* the dashboard loads, *Then* the **AI Ops Insight** panel (title / text / recommended action) is **generated by the LLM** from that snapshot, not from `deriveInsight()`.
- **AC2** — *Given* the same snapshot, *Then* the **Prediksi Kemacetan** board shows **exactly 3** LLM-authored scenarios, each with a question, an integer `probability` 0–100, an `answer_label`, a `timeframe`, and a `reasoning` line that cites figures from the snapshot.
- **AC3** — *Given* the LLM reasons over the snapshot, *Then* it sees **exactly what the operator sees** — the analysis must never cite a speed, delay, incident or sentiment figure that differs from the rendered dashboard. (The client POSTs its own snapshot; the server does not rebuild one, because `buildSnapshot` jitters.)
- **AC4** — *Given* **no** `NEXORUS_AI_KEY`, or an LLM error/timeout, or a response that fails schema validation, *Then* the widgets **degrade gracefully** to today's deterministic `deriveInsight()` + `predictions` and the dashboard never blanks or blocks. (Spec guardrail: scripted fallback.)
- **AC5** — *Given* either outcome, *Then* the UI is **honest about provenance**: the widgets badge `NEXORUS AI · LLM` when model-generated and `Simulasi` when scripted — the same live/demo convention the TomTom badge already uses.
- **AC6** — *Given* the demo polls the snapshot every 60 s, *Then* the LLM is **not** called on every poll: results are cached per corridor (~5 min TTL) so cost stays bounded and the numbers stay stable while an operator reads them.
- **AC7** — *Given* an LLM call, *Then* it routes through the **`lib/ai/engine.ts` abstraction** (never a hardcoded provider at the call site), the key stays **server-side**, and token usage is logged. *(Full cost ledger is U1 — out of scope here; log-only until then.)*
- **AC8** *(v2.0 — cost control)* — *Given* the demo runs unattended for long stretches, *Then* the per-corridor AI cache TTL is **1 hour** (was 5 min), overridable via `JASAMARGA_AI_TTL_MIN`, so a corridor costs at most one LLM call per hour no matter how long the dashboard is left open.
- **AC9** *(v2.0 — kill switch)* — *Given* a **Settings** page at `/settings` (the previously dead "System Settings" nav item now points here), *When* the operator flips **Nexorus AI (LLM)** off, *Then* the browser stops calling `/api/v1/jasamarga-ai` **and** the AI briefing requests the scripted path (`?ai=0`) — so **no tokens are spent at all** while it is off — and the widgets fall back to the deterministic read with the `Simulasi` badge. The choice persists across reloads (localStorage) and defaults to **on**.
- **AC10** *(v2.0 — real public sentiment)* — *Given* the client's own media-intelligence feed already carries a JasaMarga topic set (`danantara_jasamarga`, the same feed behind `/bumn-v2/jasamarga`), *When* the Ops snapshot is built, *Then* the **Sentimen Publik** widget is driven by that **live** feed — real impressions, real reach, the real positive/negative/neutral split, and the **real topics** (title + AI read + reach) — replacing the **fabricated `@handle` tweets** that were there before. *And When* the feed is unavailable, *Then* it degrades to the existing synthetic pulse (badged `demo`, never a blank).
- **AC16** *(v5.0 — real weather)* — *Given* the **Cuaca Koridor (BMKG)** panel, *Then* its conditions and temperatures come from **BMKG's public forecast API** (`api.bmkg.go.id/publik/prakiraan-cuaca?adm4=<village>`, free, no key), one verified `adm4` code per corridor weather zone, picking the forecast slot nearest to now. It was a **hardcoded literal** in `corridors.ts` — Japek claimed "Cerah berawan, 31°" at midnight, in the dark, forever.
- **AC17** *(v5.0)* — *Given* that fixed `impact` also drove the **Safe Meter's `Cuaca` penalty**, the **header KPI**, the **condition chip** *and* **the LLM grounding** (the model had been recommending rain warnings off a string literal), *Then* all of them read the real BMKG figures, and `impact` is derived from BMKG's own weather code (rain/thunder → `tinggi`, light rain/fog/haze → `sedang`, else `rendah`).
- **AC18** *(v5.0)* — *Given* BMKG is unavailable or a zone fails, *Then* the corridor **degrades to the existing static values** (never a blank panel), the snapshot carries `weather_source: "bmkg" | "demo"`, the panel badges itself accordingly, and `BMKG Cuaca` reappears in the **Sumber Data** list — **live** — having been removed in v3.0 precisely because it was fake. Cached ~3 h (BMKG publishes 3-hourly), so it costs nothing per page load.
- **AC14** *(v4.0 — real AI vision)* — *Given* the **AI Vision** panel, *Then* it is a **real CCTV feed with real on-device detection** — a public ATCS HLS stream (same-origin proxied) run through the existing YOLO11n → COCO-SSD detector, drawing genuine boxes with genuine confidences and a live vehicle/person tally — replacing the hand-drawn `CameraScene` tiles whose boxes and confidence scores were invented. `Nexorus Vision (CCTV AI · ATCS)` is badged **live** in the source list. *Provenance:* these are **public city ATCS cameras**, not JasaMarga's own toll cameras (Travoy requires a login) — the UI says so; what is proven is that the pipeline is real, and repointing it is a credentials change, not an engineering one.
- **AC15** *(v4.0 — one detector at a time)* — *Given* browser cost, *Then* **exactly one** stream + detector runs at a time: the panel shows a single live camera plus a **picker** for the other six, and switching swaps the running stream. *(A 2×2 of concurrent live tiles was built first and **hung the browser** — four HLS players and four inference loops contend for one GPU. Never grid live detectors.)*
- **AC22** *(v7.0 — client-direct HLS, so a locked-down server can't blank the feed)* — *Given* the **AI Vision** panel rendered only *"Aliran CCTV/Model tidak tersedia"* in production because the server-side HLS proxy (`/api/v1/cctv/playlist`, `/seg`) returned **`502 "upstream unreachable"`** — the production cluster **cannot open outbound connections** to the ATCS hosts (`cctvjss.jogjakota.go.id`, `atcs.tasikmalayakota.go.id`); it is a **selective** egress restriction (the same server reaches `api.bmkg.go.id` fine, and the feeds are alive on the open internet) — *Then* `LiveDetectCamera` loads the upstream HLS **directly in the browser** with `video.crossOrigin = "anonymous"`, because both hosts serve their playlists **and** their live `.ts` segments with `Access-Control-Allow-Origin: *`, so the client (which *can* reach the public feeds) both plays the stream and reads its frames for detection **without tainting the canvas**. The same-origin proxy is kept as an automatic **fallback**: the player tries the **direct** source first and only advances to `/api/v1/cctv/playlist?cam=…` when the direct source raises a fatal HLS.js / `<video>` error; the unavailable panel appears **only when both** sources fail. Detection is unchanged (CORS-clean frames keep YOLO11n/COCO-SSD working); the one-stream/one-detector rule (AC15) and the 7-camera picker are unchanged. *Guardrail note:* this is a **deliberate, documented exception** to API-first, scoped to **public, CORS-enabled, keyless media** — no secret, DB, or LLM is touched client-side, and the BFF path survives as the fallback.
- **AC12** *(v3.0 — drop the fabricated surfaces)* — *Given* the dashboard should only show what it can actually source, *Then* the three widgets fed entirely by invented data are **removed**: **Kanal Resmi** (fake @PTJASAMARGA posts), **Liputan Media** (fake detik/Kompas/Antara/Tribun articles) and **Papan Waktu Tempuh** (fake routing figures) — from `OpsCommand`, from `OpsGlance` (whose "Waktu Tempuh" drill tab goes with them), and the "Sentimen & Kanal" tab becomes "Sentimen Publik".
- **AC13** *(v3.0 — honest source list)* — *Given* the **Sumber Data** panel, *Then* it lists **only** feeds we consume: `Traffic Flow (TomTom)` · `Insiden Lalu Lintas (TomTom)` · **`Media Intelligence (Nexorus)`** — the client's own `danantara_jasamarga` / OpenGate topic feed, badged **live** when attached — plus `Nexorus Vision (CCTV AI)` (still demo). `Berita Online (RSS)`, `BMKG Cuaca` and `Kanal Resmi (@PTJASAMARGA)` are dropped, and `Media Sosial (X API)` is **renamed** to Media Intelligence. The header ticker's live/demo tally and the page's "sumber publik/daring" strapline are kept in step (they still advertised the removed feeds).
- **AC11** *(v2.0)* — *Given* the sentiment feed is live, *Then* those **real** figures are also placed in the LLM grounding (AC3), so the analysis and the scenarios can reason about actual public reaction (e.g. the Rest Area KM 19 truck-queue complaints) instead of a synthetic mention count.
- **AC19** *(v6.0 — real forecast, not a hardcoded curve)* — *Given* the **Proyeksi Beban 6 Jam** timeline (and the map **time-machine scrubber** that reads `data.forecast` to recolour the corridor), *Then* the 6 hourly load points are **LLM-generated** from the live snapshot, replacing the fabricated curve in `buildSnapshot` — a fixed `offsets = [0, -0.9, -1.6, -0.6, 0.5, 1.0, -1.3]` shape plus `Math.random()` jitter, applied identically to every corridor at every time of day and re-randomised on every 60 s poll. The model returns **exactly 6** points, each an `hour` label + a `load` in 0.5–10 (a point outside that range **rejects the whole forecast** → deterministic fallback, per AC21 — not clamped, since a single clamped spike would fake a `Puncak`); the parse layer marks the first `Sekarang` and the max `Puncak` (same convention as today).
- **AC20** *(v6.0 — grounded on real forward signals, no extra cost)* — *Given* cost is already capped by the per-corridor cache (AC8), *Then* the forecast rides in the **same structured LLM call** that already authors `insight` + `predictions` (`OPS_AI_SCHEMA` gains a `forecast[6]`) — no new round-trip, no new token line, covered by the existing 1 h TTL. *And* the grounding **stops echoing a precomputed forecast** to the model (today `buildOpsGrounding` feeds it `PROYEKSI BEBAN 6 JAM: …`, i.e. the model was handed the very curve it is meant to predict) and instead feeds the **real basis to project from**: current `load_index` + per-segment speeds, the current hour, active incidents, and — the genuinely forward-looking signal — **BMKG's next 3-hourly weather slots** (exposed via a new `pickForward` in `lib/jasamarga/bmkg.ts`, carried on the snapshot's weather zones as an `outlook[]` when `weather_source === "bmkg"`, so the client still POSTs exactly what it renders per AC3). AC3 still holds: `outlook` is **additive real data**, never a figure that contradicts what is on screen.
- **AC21** *(v6.0 — graceful + honest provenance)* — *Given* no `NEXORUS_AI_KEY`, an LLM error, or a forecast that fails validation (≠6 points, a `load` outside 0.5–10, a missing/empty `hour`), *Then* the forecast **degrades to the deterministic curve** and the timeline never blanks. Validation is **independent of `insight`/`predictions`**: a bad forecast drops to `undefined` (the panel falls back) *without* discarding a good insight — but a valid one is all-or-nothing (never a mix of model and template hours). The **Proyeksi Beban 6 Jam** panel badges provenance the same way the AI widgets do — `NEXORUS AI · LLM` when the points are model-generated, `Simulasi` when scripted. *Honesty note:* this is a **qualitative AI trend projection** off current state + forward weather, **not a calibrated statistical forecast** — no historical typical-traffic baseline (Google/TomTom history) is ingested yet; that stays flagged as a follow-up, and the UI copy must not imply validated numeric accuracy.

#### Architecture
**Impact — files add/change:**
- `add` `lib/jasamarga/ai-insight.ts` — **pure, no I/O**: `buildOpsGrounding(snapshot)` → a compact Indonesian brief of the corridor state (segments, slowest ruas, delays, incidents w/ severity + source, weather, sentiment, 6 h forecast, safety score); `JASAMARGA_AI_SYSTEM` (persona + hard rule: cite only figures present in the grounding); `OPS_AI_SCHEMA` (JSON Schema for `{insight, predictions[3]}`); `parseOpsAi(json)` → `{insight, predictions} | null` (validates shape, clamps `probability` to 0–100, requires exactly 3 predictions, rejects empty strings). + `ai-insight.test.ts`.
- `change` `lib/ai/engine.ts` — add `liveJson<T>(system, user, schema, maxTokens)`: a structured-output call (`output_config.format` = `json_schema`) so we get a typed object instead of parsing prose out of Markdown. Model stays env-driven (`NEXORUS_AI_MODEL`, default current Opus) — no provider named at any call site.
- `add` `app/api/v1/jasamarga-ai/route.ts` — **BFF, `POST`**: body = the snapshot the client is rendering. `hasLiveAI()` false → `{ source: "scripted" }` immediately. Else `liveJson(...)` → `parseOpsAi` → `{ insight, predictions, source: "llm" }`. Any throw / invalid → `{ source: "scripted" }` (never a 5xx — the UI must not have to handle an error path). In-process cache keyed by corridor, 5 min TTL (AC6).
- `change` `components/jasamarga/OpsCommand.tsx`, `components/jasamarga/OpsGlance.tsx` — after the snapshot lands, POST it to `/api/v1/jasamarga-ai`; on `source: "llm"` swap in the returned `insight` + `predictions` and flip the badge. Snapshot renders immediately; the AI layer upgrades it a beat later (never blocks first paint).
- `change` `components/jasamarga/OpsInsight.tsx` — provenance badge (AC5).
- *(v2.0)* `add` `lib/jasamarga/social-feed.ts` — **pure**: `mapTopicsToSocial(feed)` → a live `SocialPulse` (impressions, reach, sentiment split, negativity 0–10, real topics sorted by reach); `null` when the feed has no topics. + `social-feed.test.ts`.
- *(v2.0)* `change` `lib/jasamarga/types.ts` — `SocialPulse` gains optional live fields (`source`, `impressions`, `reach`, `sentiment_pct`, `topics: SocialTopic[]`). Additive: the synthetic path is untouched.
- *(v2.0)* `change` `lib/jasamarga/data.ts` — `buildSnapshot(id, segments, incidents, social?)` accepts a live social override.
- *(v2.0)* `change` `app/api/v1/jasamarga-ops/route.ts` — fetch `danantara_jasamarga` via the existing `fetchTopicsForCode` (server-side key, 6 h cache) and pass the mapped pulse into `buildSnapshot`; any failure → synthetic (AC10).
- *(v2.0)* `change` `components/jasamarga/SocialPulse.tsx` — live mode renders real KPIs + real topic cards + a `live` provenance footer; demo mode keeps the old post cards.
- *(v2.0)* `add` `lib/ai-settings.ts` + `app/settings/page.tsx` + `components/settings/SettingsPanel.tsx` — the AI kill switch (AC9); `change` `components/layout/AppShell.tsx` so "System Settings" points at `/settings` instead of `/`.
- *(v2.0)* `change` `lib/jasamarga/ai-insight.ts` — grounding carries the real sentiment block when live (AC11).
- *(v6.0)* `change` `lib/jasamarga/ai-insight.ts` — **the core of this change.** `OPS_AI_SCHEMA` gains `forecast` (array, exactly 6 items of `{ hour, load }`). `parseOpsAi` validates it **independently** (exactly 6, each `load` clamped 0.5–10, each `hour` non-empty; invalid → `forecast: undefined`, insight/predictions untouched) and derives the `Sekarang`/`Puncak` labels. `buildOpsGrounding` **drops** the `PROYEKSI BEBAN 6 JAM` echo line and instead emits the current hour, the per-zone weather **`outlook`** (next slots) when live, and a projection instruction; `JASAMARGA_AI_SYSTEM` gains a forecasting rule (project from state + forward weather, don't invent a curve). `OpsAi` gains `forecast?: ForecastHour[]`.
- *(v6.0)* `change` `lib/jasamarga/bmkg.ts` — add `pickForward(series, nowMs, n)`: the next `n` 3-hourly slots strictly after `now`, sorted, capped at series length (pure, mirrors `pickCurrent`). `mapBmkgZone`/`fetchZone` populate the zone's `outlook` from it.
- *(v6.0)* `change` `lib/jasamarga/types.ts` — `WeatherZone` gains optional `outlook?: { hour: string; condition: string; impact: WeatherZone["impact"] }[]` (additive; the static/synthetic path leaves it undefined). No change to `ForecastHour`.
- *(v6.0)* `change` `app/api/v1/jasamarga-ai/route.ts` — bump `liveJson` `max_tokens` to cover the 6 extra points; on success return `forecast` alongside `insight`/`predictions`. Cache entry now also holds `forecast`. (No new route; still one call, still 1 h cache.)
- *(v6.0)* `change` `components/jasamarga/useOpsAi.ts` — `OpsAiState` gains `forecast: ForecastHour[] | null`; the hook surfaces `payload.forecast` (null when scripted/absent) so both the timeline and the scrubber can prefer it.
- *(v6.0)* `change` `components/jasamarga/OpsCommand.tsx`, `components/jasamarga/OpsGlance.tsx` — the time-machine scrubber and the `ForecastTimeline` read `ai.forecast ?? data.forecast`; the **Proyeksi Beban 6 Jam** tile shows the `NEXORUS AI · LLM` / `Simulasi` badge off whether `ai.forecast` is present.
- *(v6.0)* `change` `components/jasamarga/ForecastTimeline.tsx` — accept a provenance flag (or a `source` prop) so the header can carry the badge; keep the empty-state and the deterministic render unchanged.
- *(v7.0)* `add` a pure `cctvSources(cam)` in `lib/jasamarga/atcs.ts` → the ordered candidate list `[cam.url` (direct, the CORS-enabled ATCS host)`, "/api/v1/cctv/playlist?cam=" + cam.id` (same-origin proxy fallback)`]`. `change` `components/jasamarga/LiveDetectCamera.tsx` — the HLS effect walks that list: set `video.crossOrigin = "anonymous"`, load candidate `i`; on a **fatal** HLS.js error or a `<video>` `error`, advance to `i+1` and re-attach; only when the list is **exhausted** → `setError("stream")` (so a single reachable source is enough). The native-HLS (Safari) path mirrors it via `video.src`. The `/api/v1/cctv/playlist` + `/seg` routes are **unchanged** — retained as the fallback and for any future non-CORS source. No server, type, or contract change.

**Data-model / API changes:** one new BFF route (`POST /api/v1/jasamarga-ai`). *(v2.0)* `/api/v1/jasamarga-ops` now also reads the topics feed server-side; `SocialPulse` gains additive optional fields. *(v6.0)* the LLM schema gains a `forecast[6]` block (the model now fills `OpsInsight`, `Prediction` **and** `ForecastHour[]`); `WeatherZone` gains an additive optional `outlook[]`; the `jasamarga-ai` response and cache carry the forecast. No DB.

**Reuse:** `lib/ai/engine.ts` (`hasLiveAI` / live call + prompt caching on the system block), the `scriptedX`-fallback pattern from `/api/v1/ai/briefing`, the live/demo badge convention from the TomTom wiring, existing `OpsInsight` + `Prediction` types.

**Risks:**
- *Hallucinated figures* → the grounding is the **only** source of numbers, the system prompt forbids inventing any, and `reasoning` is expected to quote the snapshot. Mitigated further by AC3 (model sees the rendered snapshot verbatim).
- *Latency* → the LLM call is off the critical path (snapshot renders first, AI upgrades in place), so a slow model degrades to a late upgrade, never a blank dashboard.
- *Cost* → 5 min per-corridor cache (AC6) + capped `max_tokens`; the demo polls every 60 s, so worst case is ~12 calls/hour/corridor, not 60.
- *Client-supplied snapshot* (AC3) → this is a public, read-only demo route with no DB write and no privileged action; the snapshot only shapes a prompt. Flagged for productization (gate + server-side snapshot with a stable seed).
- *(v6.0) Forecast credibility* → an LLM extrapolation from current state + forward weather is **qualitative, not calibrated**. Mitigated by: honest UI copy + badge (AC21 — never claim validated accuracy), and the deterministic curve as the always-available fallback. A validated forecast needs a historical typical-traffic baseline, which is out of scope here and flagged as a follow-up.
- *(v6.0) A bad forecast poisoning the good widgets* → `parseOpsAi` validates the forecast **independently** of `insight`/`predictions`, so a malformed forecast drops to the deterministic curve without discarding a valid analysis (AC21).

#### QA
| # | Maps to | Test case | Type |
|---|---|---|---|
| T1 | AC3 | `buildOpsGrounding` includes the corridor name, avg speed, slowest ruas + its speed, incident count, and the top incident's type/severity from the snapshot it is given | unit |
| T2 | AC1/AC2 | `parseOpsAi` maps a well-formed LLM payload → typed `{insight, predictions}`; insight keeps title/text/action; all 3 predictions survive | unit |
| T3 | AC2 | `parseOpsAi` clamps `probability` (e.g. `140` → `100`, `-5` → `0`) and rounds to an integer | unit |
| T4 | AC4 | `parseOpsAi` returns `null` on a malformed payload: not 3 predictions, missing `question`, empty `title`, non-numeric `probability` | unit |
| T5 | AC4 | route: `hasLiveAI()` false → `{ source: "scripted" }`, HTTP 200, no LLM call | unit |
| T6 | AC4 | route: LLM throws → `{ source: "scripted" }`, HTTP 200 (never 5xx) | unit |
| T7 | AC1/AC2 | route: LLM returns a valid payload → `{ source: "llm" }` with the mapped insight + 3 predictions | unit |
| T8 | AC6 | route: two calls for the same corridor inside the TTL → the LLM is invoked **once** (second is served from cache) | unit |
| T9 | AC5 | `OpsInsight` renders the `NEXORUS AI · LLM` badge when `source: "llm"` and `Simulasi` when scripted | component |
| T10 | AC10 | `mapTopicsToSocial` maps a real feed → live pulse: impressions/reach from `summary`, `negativity` = negative% ÷ 10, topics sorted by reach, `source: "live"` | unit |
| T11 | AC10 | `mapTopicsToSocial` returns `null` for an empty/topic-less feed, so the route keeps the synthetic pulse | unit |
| T12 | AC10 | `buildSnapshot` uses the live social override when given one, and the synthetic pulse when not | unit |
| T13 | AC10 | `SocialPulse` renders real topic cards + the `live` footer in live mode; the legacy post cards in demo mode | component |
| T14 | AC8 | the AI route's TTL is 1 h by default and honours `JASAMARGA_AI_TTL_MIN` | unit |
| T15 | AC9 | `useOpsAi` does **not** call `/api/v1/jasamarga-ai` when the AI switch is off (zero tokens), and does when on | component |
| T16 | AC11 | `buildOpsGrounding` includes the real sentiment block (impressions, negative %, top topic titles) when the pulse is live, and omits it when synthetic | unit |
| T17 | AC19/AC20 | `parseOpsAi` maps a well-formed payload with a 6-point `forecast` → typed `OpsAi.forecast`: hours preserved, loads clamped to 0.5–10, first labelled `Sekarang`, the max labelled `Puncak` | unit |
| T18 | AC21 | `parseOpsAi` drops `forecast` to `undefined` when it isn't exactly 6 points / a `load` is out of 0.5–10 / an `hour` is empty — **while still returning** the valid `insight` + `predictions` | unit |
| T19 | AC20 | `buildOpsGrounding` **omits** the precomputed `PROYEKSI BEBAN 6 JAM` echo line, and includes the current hour + the per-zone weather `outlook` when weather is live (`bmkg`), so the model projects from forward data | unit |
| T20 | AC20 | `pickForward(series, now, n)` returns the next `n` 3-hourly slots strictly after `now`, sorted ascending, capped at series length (and `[]` for an empty/all-past series) | unit |
| T21 | AC21 | the **Proyeksi Beban 6 Jam** panel badges `NEXORUS AI · LLM` when `ai.forecast` is present and `Simulasi` when null; `ForecastTimeline` renders the LLM points when present and the deterministic curve otherwise | component |
| T22 | AC22 | `cctvSources(cam)` returns exactly `[cam.url, "/api/v1/cctv/playlist?cam=" + cam.id]` — the **direct** upstream first, the same-origin **proxy** second | unit |
| T23 | AC22 | every `ATCS_CAMERAS[i].url` is an allowlisted host (`isAllowedAtcsUrl(cam.url)` true), so the direct source is a known CORS feed and not an arbitrary origin | unit |

**Governance edge cases:** key is **server-side only** (`NEXORUS_AI_KEY`, never shipped to the browser — asserted by T5's route test reading `process.env`); model is **not hardcoded** at the call site (env-driven via the engine, AC7); **graceful degradation** is the default, not the exception (AC4 — every failure mode lands on the deterministic path); tokens logged per call pending the U1 ledger; public demo route, consistent with A7/A8/JasaMarga.

#### Revision history
| Version | Date | Change |
|---|---|---|
| 7.0 | 2026-07-27 | **MAJOR** — production bug: the **AI Vision — CCTV Live** pane showed only *"Aliran CCTV/Model tidak tersedia"*. Root-caused on Opus, evidence traced across every boundary: the prod cluster **cannot egress** to the ATCS hosts, so the server-side proxy `/api/v1/cctv/playlist` throws and returns `502 "upstream unreachable"` → HLS.js fatal → `error="stream"`. Ruled out: the model (`/models/yolo11n.onnx` = **200** in prod), the feeds (**200** + valid m3u8 from the open internet), and a blanket egress block (the same server reaches `api.bmkg.go.id` → `weather_source:"bmkg"`). Both ATCS hosts serve playlists **and** live `.ts` segments with `Access-Control-Allow-Origin: *`. **AC22** — `LiveDetectCamera` now loads the upstream HLS **directly** in the browser (`crossOrigin="anonymous"`), with the same-origin proxy kept as an automatic **fallback** (direct-first, proxy on error), so the *client's* reach — not the datacenter's — decides whether the feed shows; new pure `cctvSources(cam)` helper; AI detection unchanged. Built (TDD on Sonnet 5): T22/T23 written failing first, then green — new `lib/jasamarga/atcs.test.ts`, `cctvSources` in `atcs.ts`, and the HLS effect rewired to a direct-first/proxy-fallback state machine (a `settled` guard stops HLS.js's fatal error and the `<video>` `error` event from double-advancing and skipping the proxy). **+2 tests (385 total green), tsc clean, 0 new lint.** Live verification on prod `/jasamarga` pending redeploy (the fix is client-side — once deployed, the datacenter egress block is irrelevant because the browser fetches the CORS feeds directly). Status → Built |
| 1.0 | 2026-07-14 | Initial plan — client asked to "make sure the prediction is based on the AI and the analysis is coming from the LLM as well". Audit found both AI-badged JasaMarga widgets were deterministic templates (`deriveInsight` + a hardcoded `predictions` array with `jit()`-randomised confidence). A12 routes both through the real LLM (`lib/ai/engine.ts`) grounded on the **rendered** snapshot (AC3), with structured outputs, a 5 min per-corridor cache, an honest live/scripted badge, and the deterministic path retained as the graceful fallback. Status → In progress |
| 6.1 | 2026-07-15 | **Bugfix, TDD** — client live-testing v6.0 caught it: "Sekarang" pointed at 01:00 while real Jakarta time was 08:12. Root cause: `currentHourLabel()` (added in v6.0) called `Date.parse(s.updated_at)`, but `s.updated_at` is a **locale-formatted display string** from `data.ts` (`toLocaleString("id-ID", {...})` → e.g. `"15 Jul, 08.06"`, no year, period-separated time), not a real timestamp. `Date.parse` doesn't reject it as invalid — V8's lenient legacy parser silently resolves it to an unrelated bogus date (`2008-07-14T17:00:00Z`), which then got the `+7h` WIB shift applied, landing on hour 0–1. The LLM was handed the wrong "now" and (correctly, given bad input) projected the 6-hour forecast starting from there. Fix: only trust `Date.parse` when `s.updated_at` matches an ISO 8601 prefix (`/^\d{4}-\d{2}-\d{2}T/`, what the test fixtures use); otherwise fall back to the real wall clock (`Date.now()`), the same convention `data.ts`'s own deterministic forecast already uses. 1 new regression test (383 total green), tsc clean. **Live-verified:** the grounding now emits `JAM SEKARANG: 08:00 WIB.` for a real `"15 Jul, 08.16"` snapshot; a fresh AI call then projected `Sekarang` at 09:00 (the model's own choice to start at the next full hour, given a now-correct "now" — not a defect) instead of the previous nonsensical 01:00; confirmed in-browser on `/jasamarga` (Japek, "Diperbarui 15 Jul, 08.17" → forecast `SEKARANG` 09:00, badge `● Nexorus AI · LLM`). Status → Built |
| 6.0 | 2026-07-15 | **MAJOR** — client asked whether **Proyeksi Beban 6 Jam** was real and whether we could "literally do the projection using the LLM since we have the data". It was **not** real: `buildSnapshot` in `lib/jasamarga/data.ts` synthesised the curve from a fixed `offsets = [0, -0.9, -1.6, -0.6, 0.5, 1.0, -1.3]` shape + `Math.random()` jitter — the same hand-drawn "dip then evening peak" applied to every corridor at every hour, re-randomised on each 60 s poll — and the grounding then *fed that curve back to the model* (`PROYEKSI BEBAN 6 JAM: …`). It was the last fabricated surface after v5.0 made all 5 sources live. **AC19** — the 6-hour forecast (and the map time-machine scrubber it drives) is now **LLM-generated** in the same structured call that authors insight + predictions (`OPS_AI_SCHEMA` gains `forecast[6]`; `parseOpsAi` validates + labels it). **AC20** — no extra cost/round-trip (rides the existing call + 1 h cache); the grounding stops echoing a curve and instead feeds the real projection basis — current load + per-segment speeds, the current hour, incidents, and **BMKG's forward 3-hourly slots** via new `pickForward` + a `WeatherZone.outlook[]`. **AC21** — forecast validated **independently** (a bad one drops to the deterministic curve without poisoning a good insight — and out-of-range loads are **rejected, not clamped**, so a rogue point can't fake a `Puncak`), honest `NEXORUS AI · LLM` / `Simulasi` badge on the panel, and copy framed as a **qualitative** AI trend projection (no historical baseline yet → flagged). Built (TDD, on Sonnet 5): T17–T21 written failing first, then green. New `pickForward` + `wibHourLabel` + `WeatherZone.outlook[]`; `parseForecast` (independent, reject-out-of-range); grounding drops the echo and adds `JAM SEKARANG` + `PRAKIRAAN CUACA (BMKG, ke depan)` + a projection instruction; `useOpsAi`/`OpsCommand`/`OpsGlance`/`ForecastTimeline` prefer `ai.forecast ?? data.forecast` with the provenance badge. **+26 tests (382 total green), tsc clean, 0 new lint.** **Live-verified** on `/jasamarga` against the real LLM + BMKG: the snapshot carries real `WeatherZone.outlook[]` (BMKG forward slots, e.g. Bekasi 11:00/14:00/17:00 WIB); a fresh corridor (Jagorawi) returns `source: llm` with a genuine 6-point projection `01:00 1.2 (Sekarang) → 1.0 → 1.1 → 1.8 → 3.2 → 06:00 4.5 (Puncak)` rising into the morning peak (not the old fixed `offsets` curve), the panel badges `● Nexorus AI · LLM`, and the time-machine slider max tracks the 6-point length. AC21 independent provenance confirmed on Japek (a corridor cached under the old code before rebuild): AI Ops Insight stayed `● NEXORUS AI · LLM` while the forecast panel independently fell back to the deterministic curve badged `Simulasi`. En route, the panel subtitle was made source-aware ("Proyeksi AI: beban terkini + prakiraan cuaca BMKG" for LLM; "Estimasi tren beban (non-kalibrasi)" for the fallback) so the copy stops implying a typical-traffic/calendar basis we don't ingest (AC21 honesty). **Two follow-ups noted (not in scope):** the AI **Ops Insight** title occasionally mislabels the corridor ("Japek" on Jagorawi) — insight-grounding quirk, LLM since v1.0; and the fullscreen **Command Wall** forecast slide still renders the deterministic `d.forecast` (not the LLM one). Status → Built |
| 5.0 | 2026-07-15 | **MAJOR** — client asked whether Cuaca Koridor (BMKG) was real. It was not: a **hardcoded literal** in `corridors.ts` (Japek claimed "Cerah berawan, 31°" at midnight, in the dark, forever), and that fixed `impact` also drove the Safe Meter's weather penalty, the header KPI, the condition chip **and the LLM grounding** — the model had been recommending rain warnings off a string constant. **AC16/AC17** — new `lib/jasamarga/bmkg.ts` reads BMKG's public forecast API (`api.bmkg.go.id/publik/prakiraan-cuaca?adm4=`, free, no key): `pickCurrent` selects the 3-hourly slot covering now, `weatherImpact` derives impact from BMKG's own weather code (63/95/97 → tinggi; 5/10/45/60/61/80 → sedang), `mapBmkgZone` validates + maps. Each corridor gains a `bmkg[]` of **verified Kemendagri adm4 village codes** (one per weather zone, resolved from the Permendagri wilayah list and each confirmed against the live API, which echoes back kabupaten/kecamatan). **AC18** — all-or-nothing per corridor (a half-real weather strip is worse than an honestly static one), `weather_source: "bmkg"|"demo"` on the snapshot, panel badges `● live` vs `simulasi`, ~3 h cache (BMKG publishes 3-hourly), and **BMKG Cuaca returns to Sumber Data — live**, having been dropped in v3.0 precisely because it was fake. **The dashboard is now 5/5 live sources; nothing on it is fabricated.** 21 new tests (356 total green), tsc clean, no new lint errors. Live-verified: 26°/25°/24° Cerah Berawan–Berawan at 00:15 (vs the literal's 31°/27°/29° + phantom rain), and the Safe Meter's Cuaca penalty dropped 8 → 2 because the real impact is `rendah`, proving it propagates. Status → Built |
| 4.0 | 2026-07-14 | **MAJOR** — client: "for the AI CCTV koridor please replace it with the cctv live with AI vision". **AC14** — `VisionWall` now renders a real ATCS HLS stream through the existing YOLO11n/COCO-SSD detector (the pipeline already existed but was buried in the "Deteksi Live" modal while the wall showed fakes): real boxes, real confidences, real tally. `LiveDetectCamera` gains `compact` (in-frame tally instead of the counts strip) and `detectIntervalMs`. Simulated `CameraScene`/`CameraModal` tiles dropped, along with the map's "click a segment → pop the nearest CCTV" behaviour (those cameras no longer exist); `cctv` stays on the snapshot, unused. Source list: `Nexorus Vision (CCTV AI · ATCS)` → **live** (4/4 sources now live except none — tally derived, not hardcoded); tile title "CCTV Koridor" → "CCTV Live", `Nexorus Vision · simulasi` → `● live`. **AC15 (client-reported bug)** — the first build was a 2×2 of four concurrent live tiles and **hung the browser**; four HLS players + four inference loops contend for one GPU. Rebuilt as **one live camera + a 7-camera picker**, so exactly one stream and one detector run at a time. 340 tests green, tsc clean, no new lint errors. Live-verified: Malioboro Nol Km streaming, YOLO11n boxing `orang`/`mobil` with real scores, tally 13 objek, camera switching works, page responsive. Status → Built |
| 3.0 | 2026-07-14 | **MAJOR** — client: remove the fabricated surfaces and tell the truth about sources. **AC12** — deleted **Kanal Resmi**, **Liputan Media** and **Papan Waktu Tempuh** from `OpsCommand` + `OpsGlance` (all three were 100% invented: fake @PTJASAMARGA posts, fake detik/Kompas/Antara/Tribun articles, fake routing times); `OpsGlance`'s "Waktu Tempuh" drill tab removed with them and "Sentimen & Kanal" → "Sentimen Publik". **AC13** — the **Sumber Data** panel now lists only what we consume: TomTom flow (live) · TomTom incidents (live) · **Media Intelligence (Nexorus)** (live — the `danantara_jasamarga` / OpenGate feed, renamed from "Media Sosial (X API)") · Nexorus Vision (demo); `Berita Online (RSS)`, `BMKG Cuaca` and `Kanal Resmi` dropped. Also fixed the two places that still advertised the removed feeds — the header ticker's hardcoded `"2 live · 4 demo"` (now derived: **3 live · 1 demo**) and the "sumber publik/daring (traffic API, medsos, berita, BMKG, kanal resmi)" strapline — plus the briefing's "Memindai berita & kanal resmi" stage. Snapshot still carries `official`/`news`/`travel_times` (unused; no type change). 331 tests green, tsc clean, no new lint errors. Live-verified: 3 sections gone, source panel reads 3/4 with Media Intelligence live, LLM widgets unaffected (model citing the real KM 16 severity-9.2 incident). *Note: the **Cuaca Koridor (BMKG)** widget and the Safe Meter's weather penalty are still synthetic — BMKG was removed from the source list only, per the client's instruction; flagged for a follow-up decision.* Status → Built |
| 2.0 | 2026-07-14 | **MAJOR** — client asked for (a) a 1 h cache instead of 5 min, (b) an on/off switch to control cost, and (c) real public sentiment from the JasaMarga topic set already behind `/bumn-v2/jasamarga`. Built (TDD): **AC8** TTL → 1 h (`JASAMARGA_AI_TTL_MIN`); **AC9** `/settings` page + `lib/ai-settings.ts` kill switch (localStorage, gates `useOpsAi` *and* the briefing via `?ai=0`; "System Settings" nav now resolves instead of pointing at `/`); **AC10/AC11** `lib/jasamarga/social-feed.ts` maps the live `danantara_jasamarga` feed into the Sentimen Publik widget — real impressions (8,277,074), reach (5,518,049) and the real 5.79/35.97/58.24 split — replacing the **fabricated `@handle` tweets** with the 10 real topics, and feeding those figures to the LLM. **Coherence fix:** the header KPI, Safe Meter sentiment penalty and condition chip now read the *same* real numbers (they were still on the jittered synthetic negativity, so the header said 74% while the widget said 36%); the volume KPI is relabelled "Impresi (media intel)" since the feed counts impressions, not 24 h mentions. **Bug fixed en route:** `useOpsAi` keyed its effect on the snapshot object, so the 60 s poll tore it down mid-flight and the cleanup discarded a model answer that hadn't landed — it now keys on the corridor and reads the snapshot from a ref. **16 new tests (331 total green)**, tsc clean, no new lint errors. Live-verified: LLM badge + LLM-authored widgets, model citing the real feed ("sentimen negatif 35.97% … keluhan spesifik Rest Area KM 19 (sentimen -80)"); switch off → **zero requests to `/api/v1/jasamarga-ai`** (network-confirmed) and both widgets back on the deterministic path. Status → Built |
| 1.0 | 2026-07-14 | Built (TDD) — pure `lib/jasamarga/ai-insight.ts` (`buildOpsGrounding` + `JASAMARGA_AI_SYSTEM` + `OPS_AI_SCHEMA` + `parseOpsAi` w/ clamping + all-or-nothing validation); `liveJson()` added to `lib/ai/engine.ts` (structured outputs via `output_config.format`, token logging, model still env-driven); `POST /api/v1/jasamarga-ai` (5 min per-corridor cache, always-200, scripted fallback on every failure path); `useOpsAi` hook + `OpsCommand`/`OpsGlance`/`OpsInsight` wiring (snapshot renders first, AI upgrades in place; provenance badge). **21 new tests (11 unit + 7 route + 3 component), 315 total green**, tsc clean, no new lint errors. Live-verified on `/jasamarga` against the real TomTom feed: badge reads `● NEXORUS AI · LLM`, and every figure the model cited cross-checks against the rendered dashboard — indeks beban 0.1/10, 79 km/j, 6 insiden, "severity 10 di KM 36 (tundaan ±13 mnt)", ruas terlambat Kalihurip–Cikampek Utama 49 km/j, Safe Meter 50/100 Rawan, penalti insiden −24.5 / volatilitas −8.8. The 3 scenarios are corridor-specific and data-grounded (e.g. "beban naik menjelang puncak 02:00?" — matches the forecast's PUNCAK 02:00). No hallucinated numbers. Status → Built |
