# ATLAS — Study-plan index

> Portfolio of all feature study plans for **Nexorus ATLAS** (MBG Crisis Dashboard), derived from
> `docs/superpowers/specs/2026-05-25-atlas-production-architecture-design.md`. One row per feature.
> Maintained per the SOP (`../README.md`). All plans start at **v1.0 / Planned**.

## Stages

`0-platform` · `1-watch` (ingestion) · `2-understand` (enrichment/analytics) · `3-act` (surfaces/assistant)

## Feature register

| ID | Feature | Stage | Sprint | Spec epic | Ver | Status |
|----|---------|-------|:------:|-----------|:---:|--------|
| **P1** | Monorepo foundation & tooling | 0-platform | S1 | E1 | 1.0 | Planned |
| **P2** | DigitalOcean infrastructure & CI/CD | 0-platform | S1 | E1 | 1.0 | Planned |
| **P3** | Database schema, migrations & type generation | 0-platform | S1–S2 | E2 | 1.0 | Planned |
| **P4** | Object storage (Spaces) integration | 0-platform | S2 | E2 | 1.0 | Planned |
| **P5** | Authentication — email/password + sessions | 0-platform | S2 | E3 | 1.0 | Planned |
| **P6** | RBAC, route guards & audit log | 0-platform | S2 | E3 | 1.0 | Planned |
| **P7** | Observability, hardening, backups & launch | 0-platform | S1,S6 | E8,E9 | 1.0 | Planned |
| **P8** | Nexorus cross-app link (autologin: home + per-topic deep link) | 0-platform | demo | — | 3.2 | Built |
| **P9** | OpenGate → Danantara SSO handoff (inbound autologin) | 0-platform | demo | — | 1.1 | Built |
| **W1** | Source registry & scheduler | 1-watch | S3 | E4 | 1.0 | Planned |
| **W2** | RSS & news-API connectors | 1-watch | S3 | E4 | 1.0 | Planned |
| **W3** | Social connectors (X/IG/FB/TikTok) | 1-watch | S3–S4 | E4 | 1.0 | Planned |
| **W4** | Normalization, dedup & raw storage | 1-watch | S3 | E4 | 1.0 | Planned |
| **W5** | Initial recent-window backfill | 1-watch | S3 | E4 | 1.0 | Planned |
| **U1** | LLM provider abstraction & cost ledger | 2-understand | S4 | E5 | 1.0 | Planned |
| **U2** | Article enrichment (score/issues/sentiment/summary/keywords) | 2-understand | S4 | E5 | 1.0 | Planned |
| **U3** | Geocoding & incident mapping | 2-understand | S4 | E5 | 1.0 | Planned |
| **U4** | Crisis snapshots & trends | 2-understand | S4 | E5 | 1.0 | Planned |
| **U5** | Predictions, insights, actor & leadership analytics | 2-understand | S4–S5 | E5 | 1.0 | Planned |
| **A1** | Dashboard read API & caching | 3-act | S2,S5 | E6 | 1.0 | Planned |
| **A2** | Widget integration & live data | 3-act | S5 | E6 | 1.0 | Planned |
| **A3** | Persisted dashboard layout | 3-act | S5 | E6 | 1.0 | Planned |
| **A4** | AI assistant — copilot chat | 3-act | S5 | E7 | 1.0 | Planned |
| **A5** | AI assistant — briefing, forecast & per-widget ask | 3-act | S5 | E7 | 1.0 | Planned |
| **A6** | Real-time ticker, alerts & War Room | 3-act | S5–S6 | E8 | 1.0 | Planned |
| **A7** | Danantara CEO Command Wall (zero-click demo) | 3-act | demo | — | 46.0 | Built |
| **A8** | Per-BUMN CEO sentiment dashboards | 3-act | demo | — | 8.0 | Built |
| **A9** | Communication Response Calculator | 3-act | demo | — | 3.1 | Built |
| **A10** | Danantara Crisis Gate (fear-first executive landing) | 3-act | demo | — | 5.4 | Built |
| **A11** | Danantara Executive Briefing | 3-act | demo | — | 2.2 | Built |
| **A12** | JasaMarga AI Ops Insight & Predictions (LLM-backed) | 3-act | demo | — | 7.0 | Built |
| **A13** | Danantara Command Center (one-page) | 3-act | demo | — | 1.0 | Built |

**Totals:** 32 features · 9 platform · 5 watch · 5 understand · 13 act.

## Sprint → feature map (delivery view)

| Sprint | Window (2026) | Features (primary) |
|---|---|---|
| **S1** | Jun 1–12 | P1, P2, P3 (start), P7 (skeleton) |
| **S2** | Jun 15–26 | P3 (finish), P4, P5, P6, A1 (initial) · **M1: DB-backed dashboard** |
| **S3** | Jun 29–Jul 10 | W1, W2, W4, W5, W3 (spike) |
| **S4** | Jul 13–24 | U1, U2, U3, U4, W3 (cont.) · **M2: live enrichment** |
| **S5** | Jul 27–Aug 7 | U5, A1 (finish), A2, A3, A4, A5, A6 (start) · **M3: feature-complete** |
| **S6** | Aug 10–21 | A6 (finish), P7 (hardening/launch) · **M4: production launch** |

## Index revision history
| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-05-25 | Initial register: 22 features derived from the architecture spec |
| 1.1 | 2026-05-25 | Added W5 (initial recent-window backfill) after the light-backfill decision; 22→23 features |
| 1.2 | 2026-06-02 | Added A7 (Danantara CEO Command Wall) from client CEO feedback; 23→24 features |
| 1.3 | 2026-06-03 | A7 → v2.0 In progress (rank-movement arrows + explicit pos/neg sentiment counts) |
| 1.4 | 2026-06-03 | A7 → v4.0 In progress (two-column sentiment-grouped wall + per-panel pie; spotlight/takeover removed) |
| 1.5 | 2026-06-03 | A7 → v5.0 In progress (per-item pie charts; positive/negative groups side by side) |
| 1.6 | 2026-06-03 | A7 → v6.0 In progress (AC15 readability type scale for 60-year-old CEO: 16px floor) |
| 1.7 | 2026-06-03 | A7 → v7.0 Built (topic rows drop sparkline + pie to trailing + full titles; BUMN single-list with leading positive/negative topic per row — AC16) |
| 1.8 | 2026-06-03 | A7 → v8.0 Built (topic board → single full-width list like BUMN, most-negative first + sentiment tint, pie kept; fixes messy multi-line titles; side-by-side topic sub-columns retired) |
| 1.9 | 2026-06-03 | A7 → v9.0 Built (restore side-by-side TOPIK POSITIF/NEGATIF columns; stacked row card keeps titles legible; pie + tint kept) |
| 1.10 | 2026-06-03 | A7 → v10.0 Built (mini pie per BUMN topic cell; net-score tooltip; tidied Isu Danantara pie/meta layout; shared pieTotals) |
| 1.11 | 2026-06-03 | A7 → v11.0 Built (BUMN board: remove net-score number, add sequential rank number, add per-topic reach + sentiment %) |
| 1.12 | 2026-06-03 | A7 → v12.0 Built (localize UI chrome to English; content/taxonomy stays Indonesian — AC17) |
| 1.13 | 2026-06-04 | A7 → v13.0 Built (topic rows drop velocity %; mini pie groups green/red % + donut; pie to right side) |
| 1.14 | 2026-06-04 | A7 → v14.0 Built (topic row: rank + title left, pie over reach right — client sketch) |
| 1.15 | 2026-06-04 | A7 → v15.0 Built (mini pie percentages flank the donut — value% · donut · value%) |
| 1.16 | 2026-06-04 | A7 → v16.0 Built (mini donut arcs reversed to match labels — green left, red right) |
| 1.17 | 2026-06-04 | A7 → v17.0 Built (drop neutral stay rank dash; rank numbers get trailing period; english rank tooltips) |
| 1.18 | 2026-06-04 | A7 → v18.0 Built (per-topic AI context line beneath each title — muted, clamped sneak peek) |
| 1.19 | 2026-06-04 | A7 → v19.0 Built (BUMN board mirrors Issues rows: logo + name + context + own pie/mentions; retire topic cells; + AC18) |
| 1.20 | 2026-06-04 | A7 → v20.0 Built (BUMN board → two-column SENTIMEN POSITIF/NEGATIF like Issues; sourced 12 real BUMN logos) |
| 1.21 | 2026-06-04 | A7 → v21.0 Built (bigger topic titles text-2xl; BUMN titled by nickname/ticker) |
| 1.22 | 2026-06-04 | A7 → v22.0 Built (BUMN row leads with its top issue as the 24px headline; ticker demoted to a small eyebrow) |
| 1.23 | 2026-06-04 | A7 → v23.0 Built (BUMN ticker moved under the logo as one identity block; headline-only text column) |
| 1.24 | 2026-06-04 | A7 → v24.0 Built (BUMN row = identity | negative topic | positive topic, each topic cell with its own pie; single list restored) |
| 1.25 | 2026-06-04 | A7 → v25.0 Built (BUMN topic-cell pie stacked over reach, matching the Issues rows) |
| 1.26 | 2026-06-04 | A7 → v26.0 Built (BUMN topic-cell pie+reach pinned top-right, title-left, like an Issues row) |
| 1.27 | 2026-06-04 | A7 → v27.0 Built (BUMN rank moved from stacked mono line into a corner badge on the logo; logo+name = one identity block) |
| 1.28 | 2026-06-04 | A7 → v28.0 Built (sourced 7 more real BUMN logos → 19/20 covered; only jasamarga stays on a monogram) |
| 1.29 | 2026-06-04 | A7 → v29.0 Built (BUMN topic columns → positive-left/negative-right + English POSITIVE/NEGATIVE TOPICS labels, consistent with the Issues board) |
| 1.30 | 2026-06-04 | A7 → v30.0 Built (empty placeholder topic cell replaces the "No positive/negative topic" text; every BUMN row shows both columns) |
| 1.31 | 2026-06-07 | A7 → v31.0 Built (Issues board wired to the live garudaperkasa.io topics feed via a server-side BFF route + Vercel cache; BUMN stays simulated) |
| 1.32 | 2026-06-07 | A7 → v32.0 Built (issue detail modal: replace the empty "Top Coverage" headlines list with a "Description" section showing the topic penjelasan) |
| 1.33 | 2026-06-07 | A7 → v33.0 Built (issue detail: trend line → sentiment pie with neutral share; remove velocity stat + category tag) |
| 1.34 | 2026-06-07 | A7 → v34.0 Built (issue detail: full topic title; Impressions/Reach metric cards + English hints; remove the horizontal split bar) |
| 1.35 | 2026-06-07 | A7 → v35.0 Built (negative topics on the left on both the Issues board and the BUMN rows/legend; reverses v29.0 positive-left) |
| 1.36 | 2026-06-07 | A7 → v36.0 Built (topics cache 6h → 1h; header Refresh button forces a fresh upstream pull via ?fresh=1 / no-store) |
| 1.37 | 2026-06-07 | Added A8 (Per-BUMN CEO sentiment dashboards) at v1.0 Planned — 7 launch BUMN on A7's live feed; 24→25 features |
| 1.38 | 2026-06-07 | A8 → v1.0 Built (registry-driven `/bumn/‹slug›`, allowlisted `?code=` BFF + 7d→28d window, 7 scoped logins, sentiment + intent pies, topics list, empty-topics state) |
| 1.39 | 2026-06-07 | A8 → v2.0 Built (sentiment summary donut → dominant-verdict + bar + totals; explicit per-topic sentiment badge) |
| 1.40 | 2026-06-07 | A8 → v3.0 Built (topics list redesigned as sentiment-driven dossier cards — rank numerals, tone spine/wash, icon badges, stat-chips, hover + staggered reveal) |
| 1.41 | 2026-06-07 | A8 → v3.1 Built (per-topic pie enlarged: 70% text / 30% big centered donut showing pos/neutral/negative %) |
| 1.42 | 2026-06-07 | A8 → v3.2 Built (Sentiment Summary impressions/reach totals get bar-chart + eye icons, matching the topic cards) |
| 1.43 | 2026-06-07 | A7 → v37.0 Built (BUMN board wired to real data for the 7 launch BUMN via a server-side aggregation BFF; all mock data + the tick simulation removed — /danantara is 100% real) |
| 1.44 | 2026-06-08 | A7 → v38.0 Built (BUMN topic cells: white title + per-topic sentiment-tinted background) |
| 1.45 | 2026-06-08 | A7 → v38.1 Built (BUMN topic cells in a row are equal height — stretch + h-full) |
| 1.46 | 2026-06-08 | A7 → v38.2 Built (board subtitles → "negative vs positive" to match the negative-first layout) |
| 1.47 | 2026-06-08 | A7 → v38.3 Built (real Jasa Marga + BNI logos; all 7 launch BUMN have logos) |
| 1.48 | 2026-06-08 | A7 → v38.4 Built (reach uses fmtCount — small reach shows 15K not 0.0M) |
| 1.49 | 2026-06-08 | A7 → v38.5 Built (header: remove Net BUMN Sentiment + Active Alerts metrics) |
| 1.50 | 2026-06-08 | A7 → v38.6 Built (BUMN detail follows the topic detail: no net sentiment/trend/split; impressions card + sentiment pie + topics) |
| 1.51 | 2026-06-08 | A7 → v39.0 Built (topic detail redesigned as a sentiment-driven brief — hero verdict, stat tiles, AI-analysis card) |
| 1.52 | 2026-06-08 | A7 → v40.0 Built (BUMN board: topic cell → single topic detail; logo → /bumn/<slug> dashboard; topic detail gains an Open-dashboard button) |
| 1.53 | 2026-06-08 | Fix: client-side nav to /bumn/<slug> (and /danantara) loaded no data until a hard refresh — the mountedRef guard was never reset on remount, so the fetch result was discarded. A8 → v3.3, A7 → v40.1 |
| 1.54 | 2026-06-08 | A8 → v3.4 Built (BUMN dashboard: impressions/reach promoted from grey footnote to bold KPI tiles in a hero band right of the sentiment verdict) |
| 1.55 | 2026-06-08 | A8 → v3.5 Built (Intent Share donut → ranked share-of-voice bar leaderboard: `IntentPie` renamed `IntentShare`, bars sorted by share + scaled to the leader, impressions + % per row) |
| 1.56 | 2026-06-08 | A8 → v3.6 Built (Sentiment Summary gains a Key Drivers block — loudest negative + positive topic by reach — filling the panel's blank area below the legend) |
| 1.57 | 2026-06-08 | A8 → v3.7 Built (BUMN logo added to the dashboard header, left of the BUMN name; shared `BumnLogo` extracted with monogram fallback) |
| 1.58 | 2026-06-08 | A7 → v40.2, A8 → v3.8 Built (shrink Danantara issue title 24→20px; add shimmering skeleton loaders to the Danantara Issues, BUMN Sentiment, and BUMN topic lists while the feed is loading) |
| 1.59 | 2026-06-08 | A7 → v40.3 Built (swap trend-arrow icons for thumbs-up/down on the Danantara Issues group headers, BUMN topic cells, and the BUMN Sentiment column legend) |
| 1.60 | 2026-06-08 | A7 → v40.4, A8 → v3.9 Built (stripped app-shell chrome on /danantara + /bumn/*: hide the AI search bar + notifications bell, gear menu shows the Dashboards group only) |
| 1.61 | 2026-06-08 | A7 → v41.0 Built (rework Danantara Issues list: side-by-side columns kept, each row redesigned as a compact issue-briefing card — verdict chip + segmented sentiment bar instead of the pie, A8 dossier styling) |
| 1.62 | 2026-06-08 | A7 → v41.1 Built (Danantara logo on the left of the CEO header; real mark sourced to public/danantara.png) |
| 1.63 | 2026-06-08 | A7 → v41.2 Built (Danantara issue cards mirror the BUMN Sentiment Summary: title → penjelasan → Sentiment·Impressions·Reach row → breakdown bar → value of each sentiment) |
| 1.64 | 2026-06-08 | A7 → v41.3 Built (de-dup: shared `SentimentBreakdown` bar+legend used by the Danantara issue cards and A8's SentimentSummary; issue card trimmed so the sentiment % shows once) |
| 1.65 | 2026-06-08 | Added A9 (Counter-Noise — Response Calculator) at v1.0 Planned — negative-topic detail recommends a count of KOL/clipper/homeless counter-actions sized to contain escalation; 25→26 features |
| 1.66 | 2026-06-08 | A9 → v1.0 Built (TDD) — pure `counterNoisePlan` + `CounterNoisePanel` in the negative-topic detail (KOL / clipper / homeless counts + containment gauge); 9 tests green |
| 1.67 | 2026-06-08 | A9 → v2.0 Built — adopt the boss's model (`negative_baseline × tier multiplier`, clipper 50/homeless 20/kol 30; Basic ×1 / Pro ×3 / Enterprise ×5 selector); baseline estimated from negative impressions; panel moved below the penjelasan + scroll-triggered "calculating" animation |
| 1.68 | 2026-06-08 | A9 → v2.1 Built — rework the gimmick into a **Nexorus AI analysis pipeline** (Fetching → Analyzing → Modeling → Synthesizing, progress bar + scan + shimmer, then count-up reveal); fixed the scroll trigger (IO threshold 0 + fallback) |
| 1.69 | 2026-06-08 | A9 → v2.2 Built — gimmick is now a **faux Nexorus-AI terminal** (8 boot lines + blinking cursor, ~3.7s) that plays **once** on first scroll-in; tier switches are **instant** (no re-animation) |
| 1.70 | 2026-06-08 | A9 → v3.0 Built — **WhatsApp Response dispatch**: a button in the Counter-Noise panel opens `wa.me/‹env number›` with a pre-filled brief (topic · sentiment · reach · **penjelasan** · selected-tier plan); new pure `response-dispatch.ts` |
| 1.71 | 2026-06-08 | A9 → v3.1 Built — rename the panel/feature to **"Communication Response Calculator"** (UI label + WhatsApp brief; internal `counter-noise` names kept) |
| 1.72 | 2026-06-08 | A7 → v41.4 Built — **/danantara responsive for mobile**: page scrolls on phones (wall only at `xl`), Issues columns stack, BUMN rows reflow to one column (legend hidden), count tiles shrink; fixed a Tailwind-JIT template-literal class bug |
| 1.73 | 2026-06-08 | A8 → v3.10 Built — show the dominant sentiment % in the **centre of each BUMN topic pie** (tone-coloured centre label on the shared `SentimentPie` full variant) |
| 1.74 | 2026-06-10 | A8 → v4.0 Built — **`/bumn-v2` alternate option page** (original `/bumn` untouched): split Negative/Positive sentiment-summary boxes (kanan-kiri), topics clustered negative-first then positive (neutral trails), summary boxes click-jump to their cluster |
| 1.75 | 2026-06-10 | A8 → v4.1 Built — **stale-empty cache bugfix** in shared `topics-feed.ts`: a transient hollow upstream window (0 topics) no longer sticks for ~1 h; the BFF confirms an empty cacheable result against the live `no-store` upstream and prefers live data (fixes "Pertamina shows 0 while Postman has data"). Also hardens A7 |
| 1.76 | 2026-06-11 | Added P8 (Nexorus OpenGate cross-app link) at v1.0 Planned — gear-menu item mints an OpenGate autologin link via a session-gated BFF redirect; 26→27 features |
| 1.77 | 2026-06-11 | P8 → v1.0 Built (TDD) — session-gated `/api/v1/opengate/autologin` 307 BFF + fixed gear-menu footer item; 13 tests green |
| 1.78 | 2026-06-11 | A7 → v42.0, A8 → v5.0 Built — topics requests drop `startdate`/`enddate` (upstream defaults to 7d); rolling window + 7d→28d widening removed from the shared feed; stale-empty confirm kept |
| 1.79 | 2026-06-11 | A7 → v43.0, A8 → v6.0 Built — 28-day widening restored as a fallback on the date-less default (v42.0 emptied BMRI/TLKM/PLN whose coverage is older than 7d); applies to every topic code |
| 1.80 | 2026-06-14 | P8 → v2.0 Built (MAJOR, TDD) — "View in Nexorus" deep link in the topic detail modal. After live verification: `idquery` sourced from `meta.idquery` (board-level, not per-topic); **new** garudaperkasa deep-link BFF `app/api/v1/nexorus/topic` (separate service from OpenGate) mints a magic link + 307s with a same-origin `redirect` to `dashboard_demo?id=monitoring&idquery=…`; OpenGate gear link unchanged. AC6–AC9, T6–T10; **243 tests green**, tsc + lint clean. Live finding: magic link ignores `redirect` today → interim signs into dashboard; backend ask filed (`docs/integrations/nexorus-dashboard-deeplink.md`). Spec `2026-06-14-nexorus-topic-deeplink-design.md` |
| 1.81 | 2026-06-14 | A8 → v7.0 Built (MAJOR, TDD) — list the **33-BUMN portfolio** (was 7); client supplied the topic codes, all verified live (3 later dropped — whoosh, hotelnatatour, wisataborobudur). 26 new registry rows (name/short/sector derived); registry-driven so dashboards/logins/index/allowlist/board follow automatically. CEO-wall board fan-out gains a concurrency cap (A7 board perf, no AC change). Logos sourced/wired per slug, monogram fallback for any gap. Tests green, tsc + lint clean |
| 1.82 | 2026-06-14 | A7 → v44.0 Built (MAJOR, TDD) — re-rank the BUMN Sentiment board by **highest negative reach first** (`negMentions` desc), tie-broken by **positive reach** (`posMentions` desc); was most-negative net sentiment. `rankBumn` rewritten; AC3/AC18/T3 amended |
| 1.83 | 2026-06-15 | P8 → v3.0 Built (MAJOR, TDD) — topic deep link resolves: mint through **OpenGate** `autologin_generate` with `redirect=<query string `id=monitoring&idquery=…`>` baked into the generate call (OpenGate hosts the dashboard + appends after `dashboard_demo?` — query only, not a full URL), 307 straight to `login_url`; lands topic-precise on `opengate.nexorus.io/dashboard_demo?id=monitoring&idquery=…`. Route repointed to `OPENGATE_*`, fallback = OpenGate origin; `NEXORUS_DASHBOARD_AUTOLOGIN_BASE`/`_API_KEY`/`_BASE` retired. AC7/AC9 amended, T7/T8 reworked; backend ask resolved |
| 1.84 | 2026-06-15 | P8 → v3.1 Built (MINOR) — rename the topic deep-link button "View in Nexorus" → **"View Nexorus Opengate"** (matches gear-menu wording) after live confirmation; label only, no behaviour change |
| 1.85 | 2026-06-15 | A7 → v45.0 Built (MAJOR, TDD) — **fix** v44.0: it ranked by `negMentions` (impression-based), not reach. Add `reach`/`posReach`/`negReach` to `BumnSentiment` (from `summary.total_reach`); `rankBumn` now sorts by `negReach` → `posReach`. AC3/AC18/T3 amended; reach-derivation + regression-guard tests |
| 1.86 | 2026-06-19 | A7 → v46.0, A8 → v8.0 Built (MAJOR, TDD) — widen the topics cache **1 h → 6 h** (`revalidate: 21600`) so page loads hit the Garuda upstream at most once per code per 6 h (lazy stale-while-revalidate; header Refresh still forces fresh). A scheduled cron pre-warm (sequential 2.5 s pace per the OpenGate/upstream team, 05:00/13:00/21:00 WIB) was built then **dropped** — needs Vercel **Pro**; recoverable from git history. Shared `topics-feed.ts`. AC19/AC20 amended, T22 reworked |
| 1.87 | 2026-06-19 | P8 → v3.2 Built (Bugfix, TDD) — topic deep link mislanded on **Vercel** (generic dashboard, not the topic): both OpenGate routes minted with `OPENGATE_API_KEY \|\| DANANTARA_TOPICS_API_KEY`, and a stale/missing `OPENGATE_API_KEY` on the deploy overrode the shared key. Both routes now read `DANANTARA_TOPICS_API_KEY` directly; `OPENGATE_API_KEY` retired. Per-route key-drift regression tests |
| 1.88 | 2026-06-22 | Added A10 (Danantara Crisis Gate) at v1.0 Planned — fear-first `/danantara/krisis` landing: one 0–100 Crisis Index (high = danger) + threat band + biggest threat, click-through to the A7 wall; reuses A7's live topics feed, `/danantara` untouched. From CEO feedback ("make it fearful, super simple, details on click; one product"); 27→28 features |
| 1.89 | 2026-06-22 | A10 → v1.0 Built (TDD) — pure `crisis.ts` (Crisis Index + band + biggest-threat) + `CrisisGate` + `/danantara/krisis` route; `AppShell.minimalChrome` extended to `/danantara/*`. 11 new tests, 261 total green, tsc + lint clean; live-verified (today 24/Aman) |
| 1.90 | 2026-06-22 | A10 → v1.1 Built — fit the gate to one screen so the "Lihat detail" drill-down needs no scroll (viewport-height section + vh-scaled index + tighter gaps). Presentation only |
| 1.91 | 2026-06-22 | A10 → v2.0 Built (MAJOR) — the named "Ancaman Terbesar" now restricts to **net-negative** topics (wall's `negMentions ≥ posMentions` test) so it's always findable in /danantara's NEGATIVE column (was picking a net-positive high-negative-reach story). AC3/T5 amended; +1 test, 262 green |
| 1.92 | 2026-06-22 | A10 → v3.0 Built — redesign the hero from a bare number into a **threat dial** (green→red gauge + needle, 0·AMAN/KRISIS·100 ends, status pill, `score/100`, plain readout) so a CEO instantly reads what the number means; recompacted to stay one-screen no-scroll to 1366×720. AC1/AC2/AC6 amended; presentation only |
| 1.93 | 2026-06-22 | A10 → v3.1 Built — bigger walk-by hook: vh-scaled type + dial (grows on the CEO's monitor), huge glowing status word, and an **ambient threat glow** that breathes the band colour (calm → pulsing red at Krisis). Presentation only |
| 1.94 | 2026-06-22 | A10 → v3.2 Built — strip the gate to glance-readable essentials (cut subtitle, readout sentence, % line, threat meta; merge eyebrow into title; threat → one line). ~5 elements total. AC2/AC3 amended; presentation only |
| 1.95 | 2026-06-22 | A10 → explored v4.0 "Threat Command" product (full action/containment/record loop, English, `/krisis` home) then **rolled back to v3.2** at the client's request — they preferred the stripped fear gate. v4.0 files/spec removed; A10 stays the v3.2 Crisis Gate. 262 tests green |
| 1.96 | 2026-06-23 | Added A11 (Danantara Executive Briefing) at v1.0 In progress — new `/danantara/brief` drill-down (danantara_main only): verdict hero + win/concern + Share of Voice + topics, reusing A8 components; English chrome, Indonesian topics. A10 → v3.3 (gate chrome English + "View briefing" links to A11). Spec `2026-06-23-danantara-executive-briefing-design.md`; 28→29 features |
| 1.97 | 2026-06-23 | A11 → v1.0 Built (TDD) — `briefing.ts` + `DanantaraBrief` + `/danantara/brief`; 7 new tests, 269 total green, tsc + lint clean; live-verified (verdict + win/concern + share-of-voice + topics, threat chip ties to /krisis). A10 v3.3 (English gate) Built |
| 1.98 | 2026-06-23 | A11 → v2.0 Built (TDD) — **7-day sentiment momentum**: new `sentiment-trend` BFF (key server-side) + pure `trend.ts` (excludes partial trailing day) + `SentimentMomentum` (↑/↓/→ verdict + sparkline) in the briefing verdict hero |
| 1.99 | 2026-06-23 | A11 → v2.1 Built — client preferred a chart: replaced the chip+sparkline with a **Positive-vs-Negative 7-day line chart** (shaded gap, axes, legend) under the same verdict headline. 276 tests green, live-verified |
| 1.100 | 2026-06-23 | A11 → v2.2 Built — client ("too big; cooler"): smooth glowing gradient-filled curves + compact wide strip (no heavy axes). 276 tests green, live-verified |
| 1.102 | 2026-07-15 | A12 → v6.1 Built (Bugfix, TDD) — client live-testing v6.0 caught "Sekarang" pointing at 01:00 instead of real ~08:00 WIB. `currentHourLabel()` trusted `Date.parse()` on `updated_at`, a locale display string ("15 Jul, 08.06"), which V8 silently mis-parses to a bogus 2008 date instead of NaN. Now only parses when the string is ISO 8601; else uses the real clock. 1 new test (383 green), tsc clean, live-verified |
| 1.103 | 2026-07-27 | A12 → v7.0 Built (MAJOR, TDD on Sonnet 5) — prod **CCTV Live** pane blank (*"Aliran CCTV/Model tidak tersedia"*): root-caused on Opus to the prod cluster being unable to **egress** to the ATCS hosts (server proxy `502 upstream unreachable`; model = 200, feeds = 200, BMKG egress fine — a selective block). Both hosts serve playlists + segments with `ACAO:*`. **AC22** — load the CORS-enabled ATCS HLS **directly in the browser** (`crossOrigin="anonymous"`) with the same-origin proxy as automatic fallback (direct-first). New pure `cctvSources` helper + `LiveDetectCamera` fallback state machine; AI detection unchanged. **+2 tests (385 green), tsc clean, 0 new lint.** Live-verify on prod pending redeploy (fix is client-side) |
| 1.104 | 2026-07-28 | A10 → v3.4 Built (MINOR) — the Crisis Gate had no menu entry, so `/danantara/krisis` was only reachable by URL. Added **Danantara Crisis Gate** (`Siren` icon) to the `AppShell` gear-menu **Dashboards** group (after "Danantara CEO Command (v2)"); Dashboards-group placement survives the `minimalChrome` + danantara-scope filters, so it shows even on the gate page. +2 AppShell tests (387 green), tsc clean, no new lint; live-verified as atlasadmin |
| 1.101 | 2026-07-15 | A12 → v6.0 Built (MAJOR, TDD on Sonnet 5) — client asked whether **Proyeksi Beban 6 Jam** was real. It wasn't (a fixed `offsets` curve + `Math.random()` in `buildSnapshot`, then fed back to the model). AC19/20/21: the 6-hour forecast is now **LLM-generated** in the existing structured call (`OPS_AI_SCHEMA` gains `forecast[6]`), grounded on current load + the current hour + **BMKG forward slots** (new `pickForward` + `WeatherZone.outlook[]`), validated independently (out-of-range rejected, not clamped) with the deterministic curve as the graceful fallback + honest LLM/Simulasi badge. **+26 tests (382 green), tsc clean, 0 new lint.** Last fabricated surface on the dashboard; live verification on `/jasamarga` pending |
| 1.105 | 2026-07-28 | A10 → **v4.0 backfilled** (recorded retroactively) — the built Crisis Gate is a **three-column command read** (dial · biggest threat + topics · driving actors), shipped in `feb230b`/`b873619`/`d357eea` without a plan row; captured so docs match code. Middle from `/topics` `biggestThreat`; right from a **hardcoded DUMMY roster** (`lib/danantara/actors.ts`). AC7 added |
| 1.106 | 2026-07-29 | A10 → **v5.0 Built (MAJOR, TDD)** — wire the middle + right columns to the live OpenGate **`/threats`** feed (`danantara_main`): new pure `threats-source.ts` (`mapThreatsResponse` → detected threat + engagement-ranked, deduped `drivers` from `top_impact_posts[].actor_intelligence`) + `threats-feed.ts` (reuses `DANANTARA_TOPICS_API_KEY`, 6 h cache) + public `/api/v1/danantara/threats` BFF; `CrisisGate` feeds the #1 detected threat → `ThreatTopics` and its real drivers → `ThreatActors` (human vs provocateur/bot). Left dial stays on `/topics`. Removes the orphaned `/api/v1/danantara/actors` route; keeps `actors.ts` (still feeds the A7/A8 `ActorMap`). AC8 + T10–T14; **+15 tests, 403/404 green** (1 pre-existing clock-flaky jasamarga test), tsc + lint clean, live-verified (18/AMAN + real threat & drivers). Replaces the last dummy panels on the gate |
| 1.107 | 2026-07-29 | A10 → **v5.1 Built (MINOR, regression fix)** — v5.0 had swapped the middle column's **"Topik pendorong"** top-3 topic list (topic · reach · neg share) for flat `/threats` keyword chips, losing the per-topic metrics. Restored the top-3 from the `/topics` feed (already fetched for the gauge), rendered under the `/threats` detected-threat headline. AC8 amended; +1 test (T15); green, tsc + lint clean, live-verified |
| 1.108 | 2026-07-29 | A10 → **v5.2 In progress (MINOR, TDD)** — **resilient fallback + self-heal**: `/threats` is event-driven/often-empty (calm) or transiently hollow, blanking panels 2 & 3. Now they fall back to the always-on `/topics` + roster — middle headline → `/topics` `biggestThreat` with the top-3 always shown (deduped); right column → **`/actor-intelligence` roster** (new `actor-roster-source`/`-feed`, deduped, negative-first, real avatars) via a server-side fallback in the `/threats` route (`driversSource`). Added `threats-feed` stale-empty self-heal (mirrors `topics-feed`). AC9/AC10 + T16–T20; **+12 tests, 417/417 green**, tsc + lint clean, live-verified (roster fallback with real avatars during a double-hollow window) |
| 1.109 | 2026-07-29 | A10 → **v5.3 In progress (client request, TDD)** — **panel 3 always the roster**: `/threats` carries no avatars, so v5.2's threat-driver path drifted the actors column to bare initials whenever a real incident appeared. Decouple panel 3 → new **`/api/v1/danantara/actor-intelligence`** BFF (real profile pictures every time); `/threats` reverts to `{ threat, stats }` (panel-2 headline only). `CrisisGate` third fetch; `driversSource` dropped. AC9 amended + AC11 + T21/T22; **420/420 green**, tsc + lint clean, live-verified (panel 3 always the roster with real avatars; panel-2 `/topics` fallback also seen live once topics recovered) |
| 1.110 | 2026-07-29 | A10 → **v5.4 Built (presentation only)** — long actor `@handle`s in panel 3 (e.g. `@konveksi_karawang_cikampek`) now **wrap to a new line** instead of truncating: `ThreatActors` handle uses `break-words`/`leading-tight` + `items-start`. No behaviour change |
| 1.111 | 2026-07-30 | Added **A13 (Danantara Command Center, one-page)** at v1.0 In progress — new `/danantara/command` stacks the A10 Crisis Gate over the A7 CEO wall in one continuously scrolling page (one header, one refresh, no route hop), composed via four opt-in props that default to current behaviour so `/danantara` + `/danantara/krisis` stay byte-identical. A7 → v46.1, A10 → v5.5 (MINOR, props only). From client request ("make it a Single Page Application"); 30→31 features |
| 1.112 | 2026-07-31 | Added **P9** (OpenGate → Danantara SSO handoff) at v1.0 Built (TDD) — inbound mirror of P8: `GET /api/v1/sso?token=<HS256 jwt>` verified with the dedicated shared secret `ATLAS_SSO_SECRET` (zero-dep WebCrypto HMAC), `aud==='danantara'` + 120 s `exp` checked, establishes Danantara's own session (`httpOnly` `atlas_auth`/`atlas_scope`, `Path=/`, `SameSite=Lax`) then 302s to the scope home; every failure fails closed to `/login`. Flagged R1: `httpOnly` interacts with the existing client-side `atlas_scope` read + JS logout (`AppShell`), server-side gate unaffected — logout-route follow-up noted. 31→32 features |
| 1.113 | 2026-07-31 | P9 → **v1.1 Bugfix (TDD)** — `/api/v1/sso` redirect `Location` leaked the in-container bind host (`https://0.0.0.0:3000/login`) because it was built from `req.url` behind the ingress; a successful handoff would likewise have stranded the browser at `https://0.0.0.0:3000/danantara/krisis`. Both redirects now emit a **relative** `Location` (host-safe, unspoofable). Reported by the OpenGate agent pre-demo. AC7 + T11; +1 test, live-verified via curl |
