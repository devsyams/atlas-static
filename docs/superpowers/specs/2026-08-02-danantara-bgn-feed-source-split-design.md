# Danantara ↔ BGN feed source split — per-product intelligence base URLs

- **Date:** 2026-08-02
- **Status:** Design — pending user sign-off, then `/change-feature`, then TDD
- **Features touched:** A7 (MAJOR), A10 (MAJOR), A13 (MINOR)
- **Related memory:** yesterday's TrawlDeck cutover (`0c04679`) set the shared
  `DANANTARA_TOPIC_CODE` to the numeric TrawlDeck keyword-group `1` (= BGN) so
  `/bgn/command` could go live. `/danantara`'s Issues pane shares that default, so it
  now shows BGN topics too. The BUMN board's per-BUMN codes 502 on the old
  opengate/garudaperkasa key that is being renewed (expected, out of scope here).

## 1. Background (why)

`/danantara` and `/bgn/command` are two different products that happen to share the
same three feed BFFs (`/api/v1/danantara/{topics,threats,actor-intelligence}`) and the
same server-side upstream config. When the feeds were cut over to the TrawlDeck facade
and the single `DANANTARA_TOPIC_CODE` was pointed at the BGN keyword-group so
`/bgn/command` could go live, `/danantara` — which falls through to that same default —
collaterally started showing BGN topics.

The client needs the two products decoupled: `/danantara` shows real Danantara topics
(a natural mix of positive & negative coverage) again, `/bgn/command` keeps showing BGN,
and each product can point at its **own** upstream (old opengate/garudaperkasa vs the
TrawlDeck facade) — which the current single-base-per-endpoint config cannot express.

The two upstreams are **wire-compatible**: both answer `GET {base}/<endpoint>?topic=<code>&api_key=<key>`
with the same response shape (`topik`, `stats_sentiment`, `penjelasan`, `summary`,
`intent` for topics; the sibling shapes for threats/actors). Only the origin + path
prefix differ (`…/api-nexorus` vs `…/atlas/v1`), and both share the `/topics`,
`/threats`, `/actor-intelligence` suffixes.

## 2. Root cause

All three feed routes resolve their topic code identically, falling through to one shared
env default:

```ts
const code = requested?/*allowlisted*/ ?? (process.env.DANANTARA_TOPIC_CODE || DANANTARA_MAIN_CODE);
```

`/danantara`'s Issues pane (`<CeoCommand/>`, no `?code`) and every `/bgn/command` pane
both hit that default. The cutover set it to the BGN group, so both show BGN. Fixing
`/danantara` by resetting the default re-breaks `/bgn/command` — they must be split.

## 3. Decisions (locked with the client)

| # | Decision | Choice |
|---|----------|--------|
| D1 | Issues-board presentation | **Same board, correct feed.** No UI redesign — each topic already carries its net sentiment + positive/negative/neutral breakdown from the opengate spec. |
| D2 | Data-source separation | **Per-product base URLs.** `DANANTARA_INTELLIGENCE_BASE_URL` and `BGN_INTELLIGENCE_BASE_URL`; the `/topics` `/threats` `/actor-intelligence` suffix is hardcoded in code (both upstreams share it). |
| D3 | Key naming | **Keep `DANANTARA_TOPICS_API_KEY`** for the Danantara product (untouched — also read by the OpenGate autologin + Nexorus deeplink routes). BGN gets a new `BGN_INTELLIGENCE_API_KEY`. |
| D4 | Danantara topic code | `DANANTARA_TOPIC_CODE = danantara_main`. |
| D5 | Product selector | A `?bgn=1` scope flag (mirrors the existing `?mock=1`), threaded from `/bgn/command` only. No topic code ever reaches the client. |
| D6 | BUMN board / brief / threat-summary / sentiment-trend | **Danantara product** (no `bgn` flag) — unchanged. |

## 4. Config shape (env)

**New per-product triplets** (server-side only):

```bash
# Danantara product
DANANTARA_INTELLIGENCE_BASE_URL=<origin + prefix, no endpoint, no trailing slash>
DANANTARA_TOPICS_API_KEY=<kept — unchanged name>
DANANTARA_TOPIC_CODE=danantara_main

# BGN product
BGN_INTELLIGENCE_BASE_URL=<origin + prefix>
BGN_INTELLIGENCE_API_KEY=<BGN upstream key>
BGN_TOPIC_CODE=<BGN keyword-group>
```

**Retired:** `DANANTARA_TOPICS_API_BASE`, `DANANTARA_THREATS_API_BASE`,
`DANANTARA_ACTORS_API_BASE` (replaced by the one `DANANTARA_INTELLIGENCE_BASE_URL` +
hardcoded suffixes).

**Endpoint URL built in code:** `${<product>_INTELLIGENCE_BASE_URL}/<endpoint>?topic=<code>&api_key=<key>`
where `<endpoint>` ∈ `topics` | `threats` | `actor-intelligence`.

**Confirmed mapping (client sign-off 2026-08-02):**

| Product | Base (`*_INTELLIGENCE_BASE_URL`) | Key | Code |
|---|---|---|---|
| **Danantara** | `https://api.garudaperkasa.io/api-nexorus` (old opengate) | `DANANTARA_TOPICS_API_KEY` (`sbz_…`, being renewed) | `danantara_main` |
| **BGN** | `https://trawldeck.atlas.nexorus-alpha.io/atlas/v1` (TrawlDeck facade) | `BGN_INTELLIGENCE_API_KEY` (`tdk_…`) | `1` |

So `/danantara` + the BUMN board read the old opengate host (live once its key is
renewed — the `danantara_main` topic + per-BUMN codes), and `/bgn/command` reads the
TrawlDeck facade (keyword-group `1` = BGN, live now). The code reads whatever values are
set — these are the values to deploy.

## 5. Scope — code changes

### 5.1 New: `lib/danantara/feed-config.ts`
Single source of truth for product resolution (all three routes + feeds import it):

- `type FeedProduct = "danantara" | "bgn"`
- `feedProductFromParams(params: URLSearchParams): FeedProduct` — `?bgn=1` → `"bgn"`, else `"danantara"`.
- `resolveFeedEndpoint(product, endpoint): { base, apiKey } | null` — reads the product's
  `*_INTELLIGENCE_BASE_URL` + key, returns `${base.replace(/\/$/,"")}/${endpoint}` + the
  key; `null` when base or key is missing (callers map to their existing `*NotConfiguredError` → 503).
- `resolveTopicCode(params, product): string` — the existing allowlisted-`?code=` override
  (BUMN codes), else `process.env[<product> code var] || DANANTARA_MAIN_CODE`.

### 5.2 Feeds — read the per-product base
- `lib/danantara/topics-feed.ts` — `fetchTopicsForCode(code, opts)` gains `product?: FeedProduct`
  (default `"danantara"`); resolves base+key via `resolveFeedEndpoint(product, "topics")`
  instead of `DANANTARA_TOPICS_API_BASE`. Window/cache/self-heal logic unchanged.
- `lib/danantara/threats-feed.ts` — same, `resolveFeedEndpoint(product, "threats")`.
- `lib/danantara/actor-roster-feed.ts` — same, `resolveFeedEndpoint(product, "actor-intelligence")`.

### 5.3 Routes — resolve product + code, honor `?bgn=1`
- `app/api/v1/danantara/topics/route.ts`
- `app/api/v1/danantara/threats/route.ts`
- `app/api/v1/danantara/actor-intelligence/route.ts`

Each: `const product = feedProductFromParams(params); const code = resolveTopicCode(params, product);`
then call its feed with `{ product, ... }`. The `?mock=1` + dev-mock branches are unchanged
(they return before any upstream call).

### 5.4 Client — thread the `bgn` flag (mirrors `mock`)
- `lib/danantara/feed-query.ts` — `feedQuery` gains `bgn?: boolean` → `&bgn=1`.
- `components/danantara/ceo/DanantaraCommandCenter.tsx` — new `bgn` prop threaded to the
  three children (sibling of `mock`).
- `components/danantara/ceo/CrisisGate.tsx`, `CeoCommand.tsx`,
  `CounterNarrativeWarRoom.tsx` + `useCounterNarrative.ts` — accept `bgn`, pass to `feedQuery`.
- `app/bgn/command/page.tsx` — pass `bgn` into `DanantaraCommandCenter`.

`bgn` **defaults `false`**, so `/danantara`, `/danantara/krisis`, `/danantara/brief`,
`/bumn/*`, and every standalone `<CeoCommand/>`/`<CrisisGate/>` render byte-identical and
send no `bgn=1`.

### 5.5 Docs
- `.env.example` — the per-product triplets (§4); retire the three `*_API_BASE` vars.

## 6. Non-goals

- No UI/layout change to the Issues board (D1). No change to sentiment (already rendered).
- **`/sentiment-trend`** (A11, own `DANANTARA_TREND_API_BASE`) and **`/threat-summary`**
  stay on the Danantara product, untouched. `/sentiment-trend`'s separate base var is left
  as-is (a future consistency cleanup, not this change).
- No change to `/bumn-board` / `/bumn/*` (Danantara product, explicit per-BUMN `?code=`).
- No rename of `DANANTARA_TOPICS_API_KEY` (D3), the `/api/v1/danantara/*` namespace, or the
  `danantara` scope key. No DB, no new LLM, no new client secret.
- Not fixing the BUMN 502 — that resolves when the old opengate key is renewed.

## 7. Reversibility & rollback

Pure config + additive prop. To collapse the split later, point both
`*_INTELLIGENCE_BASE_URL` at one base and set both codes; the `bgn` flag becomes a no-op.
No env flag couples deploys.

## 8. Risks

| # | Risk | Mitigation |
|---|------|------------|
| R1 | `?bgn=1` leaks onto a Danantara page → Danantara panes show BGN | `bgn` is opt-in, default `false`; regression tests assert `/danantara*` fetches carry no `bgn=1`. |
| R2 | Env base/code mapping set backwards → a page shows the wrong product | §4 deployment callout; code is value-agnostic, honest 503/empty on a missing/wrong base rather than a silent wrong answer. |
| R3 | Retiring the three `*_API_BASE` vars breaks a missed reader | Grep-verified: only topics/threats/actor feeds read them; all migrated. `/sentiment-trend` uses a different var (untouched). |
| R4 | OpenGate autologin key read breaks | `DANANTARA_TOPICS_API_KEY` name is kept (D3); those routes are untouched; existing key-drift regression tests stay green. |
| R5 | `danantara_main` 404s on the chosen Danantara base | Deployment concern (R2); the feed degrades to its existing empty/offline state, same as any sparse code. |

## 9. Test plan (TDD)

- **feed-config (new unit):** `feedProductFromParams` (`?bgn=1` → bgn, else danantara);
  `resolveFeedEndpoint` builds `${base}/${endpoint}`, trims a trailing slash, returns null
  when base/key unset; `resolveTopicCode` honors an allowlisted `?code=`, else the product's
  env code, else `danantara_main`.
- **Feeds:** each of topics/threats/actor fetches the **BGN** base+key when `product:"bgn"`
  and the **Danantara** base+key by default; `*NotConfiguredError` when the resolved
  product's base/key is unset.
- **Routes:** each of `/topics`, `/threats`, `/actor-intelligence` with `?bgn=1` hits the
  BGN upstream, without it hits the Danantara upstream; `?mock=1` still short-circuits to
  the fixture; `?code=` allowlist still applies.
- **feedQuery:** `bgn:true` → `&bgn=1`; composes with `fresh`/`mock`/`days` without malformed `?`.
- **Threading:** `/bgn/command` (`DanantaraCommandCenter`) makes every topics/threats/actor
  fetch carry `bgn=1`; `/danantara`, `/danantara/krisis`, `/danantara/brief` carry none.
- **Migration:** existing feed/route tests updated from the retired `*_API_BASE` vars to
  `DANANTARA_INTELLIGENCE_BASE_URL` (+ BGN cases).

## 10. Feature / version impact (for `/change-feature`)

| Feature | From | To | Kind | Why |
|---|---|---|---|---|
| **A7** CEO Command | 49.0 | **50.0** | MAJOR | Per-product feed config: `topics-feed` reads `DANANTARA_INTELLIGENCE_BASE_URL` (retires `DANANTARA_TOPICS_API_BASE`); `?bgn=1` selects the product on `/topics`; opt-in `bgn` prop on `CeoCommand`. **`/danantara` restored** to the `danantara_main` topic (observable behaviour change). AC19/AC20 amended. Same class as the v48.0 cutover. |
| **A10** Crisis Gate | 9.3 | **11.0** | MAJOR | `threats-feed` + `actor-roster-feed` read the per-product base (retire `DANANTARA_THREATS_API_BASE` / `DANANTARA_ACTORS_API_BASE`); `?bgn=1` on `/threats` + `/actor-intelligence`; opt-in `bgn` prop on `CrisisGate`. `/danantara/krisis` unchanged (Danantara product). AC8/AC9 amended. |
| **A13** Command Center | 6.2 | **6.4** | MINOR | `DanantaraCommandCenter` threads an opt-in `bgn` prop; `/bgn/command` opts into the BGN product (`BGN_INTELLIGENCE_*` + `BGN_TOPIC_CODE`). Observable output unchanged (still BGN). AC14 amended. |

Build proceeds with TDD (QA cases as failing tests first) only after the study-plan
sections + `_index.md` are updated and signed off.

## 11. Deployment steps (operator)

1. Set the six env vars (§4) in the prod pod / Vercel — **confirm the base↔product mapping**
   (§4 callout) so `danantara_main` resolves for `/danantara` and the BGN group for `/bgn/command`.
2. Remove the three retired `*_API_BASE` vars.
3. `DANANTARA_TOPICS_API_KEY` stays (OpenGate autologin depends on it).
4. BGN's Issues/Threats/Actors panes stay 502/empty until the BGN upstream key is live —
   expected, same as the BUMN board.
