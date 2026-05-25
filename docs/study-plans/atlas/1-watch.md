# Stage 1 — Watch (ingestion)

> Watching the information environment: source registry, scheduler, connectors (RSS/news/social),
> and turning raw feeds into normalized, deduplicated, stored content. See `../README.md` (SOP) and
> `_index.md` (register). Connector abstraction is mandatory (spec §7, Risk R1).

---

### W1. Source registry & scheduler

- **Version:** 1.0 · **Stage:** 1-watch · **Sprint:** S3 · **Status:** Planned · **Spec ref:** §6.3, §7.1, E4 · **Owner:** Dev B

#### PM
**Background (why):** The dashboard is only as good as its inputs. Operators need to add/enable feeds
and have them crawled on a schedule without code changes. Without a registry + scheduler, ingestion
is hardcoded and unmanageable, and there's no per-source cadence or failure visibility.

**Acceptance criteria:**
- **AC1** — *Given* a `sources` row (type, endpoint, cadence, enabled), *When* Beat ticks, *Then* due enabled sources are enqueued for crawl at their cadence.
- **AC2** — *Given* a disabled source, *When* Beat ticks, *Then* it is not crawled.
- **AC3** — *Given* a completed crawl, *When* it finishes, *Then* `sources.last_run_at` and a per-run status are recorded (feeds P7 freshness alert).
- **AC4** — *Given* a crawl failure, *When* it errors, *Then* it retries with backoff and the failure is logged, without blocking other sources.

#### Architecture
**Impact — files add/change:**
- `add` `services/pipeline/worker.py`, `beat.py` (Celery app + Beat schedule)
- `add` `services/pipeline/ingest/scheduler.py` (enqueue due sources)
- `add` `services/pipeline/db/models/source.py` (if not in P3 base)

**Data-model / API changes:** `sources(id, name, type, platform, endpoint, cadence_sec, enabled, last_run_at, config_jsonb)`; per-run status (table or log).
**Reuse:** Redis broker (P2), Celery (chosen stack).
**Risks:** thundering herd if many sources share cadence → jitter the schedule.

#### QA
| # | Maps to | Test case | Type |
|---|---|---|---|
| T1 | AC1 | due source enqueued at cadence; not before | unit + integration |
| T2 | AC2 | disabled source never enqueued | unit |
| T3 | AC3 | `last_run_at`/status updated post-run | integration |
| T4 | AC4 | failing crawl retries w/ backoff; siblings unaffected | integration |

**Governance edge cases:** per-source rate limiting; only admins edit sources (P6); config secrets (API keys) referenced from env, not stored plaintext in `config_jsonb`.

#### Revision history
| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-05-25 | Initial plan from architecture spec |

---

### W2. RSS & news-API connectors

- **Version:** 1.0 · **Stage:** 1-watch · **Sprint:** S3 · **Status:** Planned · **Spec ref:** §7.1–7.2, E4 · **Owner:** Dev B

#### PM
**Background (why):** Indonesian RSS + news APIs are the highest-volume, lowest-risk, lowest-cost
source of crisis-relevant articles (Detik, Kompas, CNN Indonesia, Antara, Tempo, etc.). They are the
MVP spine of the pipeline — full product value before touching the risky social platforms.

**Acceptance criteria:**
- **AC1** — *Given* an RSS source, *When* crawled, *Then* entries are fetched, full article text extracted, and emitted as normalized `RawItem`s.
- **AC2** — *Given* a news-API source (language=id, country=id), *When* crawled, *Then* results are mapped to `RawItem`s via the same interface.
- **AC3** — *Given* a feed item already ingested, *When* re-crawled, *Then* it is not duplicated (hands off to W4).
- **AC4** — *Given* an unreachable feed/extraction failure, *When* it occurs, *Then* the item is skipped with a logged reason, not a crashed task.

#### Architecture
**Impact — files add/change:**
- `add` `services/pipeline/ingest/base.py` (`SourceConnector` interface, `RawItem`)
- `add` `services/pipeline/ingest/rss.py` (feedparser + trafilatura), `news_api.py` (httpx; provider-pluggable)
- `add` connector registry mapping `sources.type` → connector

**Data-model / API changes:** writes via W4 into `articles`.
**Reuse:** `feedparser`, `trafilatura`, `httpx` (chosen stack).
**Risks:** extraction quality varies by publisher (mitigate with fallbacks); news-API choice pending (spec §18) — interface keeps it swappable.

#### QA
| # | Maps to | Test case | Type |
|---|---|---|---|
| T1 | AC1 | fixture RSS → expected RawItems w/ extracted body | unit |
| T2 | AC2 | fixture news-API JSON → RawItems via same interface | unit |
| T3 | AC3 | re-crawl of known item yields no new row (W4 dedup) | integration |
| T4 | AC4 | bad feed / extraction error → skip + log, task succeeds | unit |

**Governance edge cases:** respect robots/ToS; per-source rate limit (W1); news-API keys server-side only.

#### Revision history
| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-05-25 | Initial plan from architecture spec |

---

### W3. Social connectors (X / IG / Facebook / TikTok)

- **Version:** 1.0 · **Stage:** 1-watch · **Sprint:** S3 (spike) → S4 · **Status:** Planned · **Spec ref:** §7.3, Risk R1, E4 · **Owner:** Dev B

#### PM
**Background (why):** Social drives the "Homeless Media" actor analysis and amplifies crises faster
than news. But monitoring arbitrary third-party accounts is the project's **#1 risk**: X API is
paid/limited, Meta Graph only exposes owned/business accounts, TikTok is gated — so production
monitoring realistically needs paid aggregators with ToS/cost implications. This feature delivers
social *incrementally* behind the connector interface, never blocking the RSS/news spine.

**Acceptance criteria:**
- **AC1** — *Given* the connector interface, *When* a social platform is implemented (official API or aggregator), *Then* it emits the same `RawItem`/actor-post shape as W2.
- **AC2** — *Given* per-platform cost/ToS constraints, *When* a connector runs, *Then* it respects a configurable rate/budget cap and degrades gracefully when the provider is unavailable.
- **AC3** — *Given* a platform that cannot be served officially, *When* an aggregator is configured, *Then* it is pluggable without changing the pipeline; if none is configured, that platform is simply skipped.
- **AC4** — *Given* a spike decision record, *When* a platform is enabled, *Then* the chosen provider + legal/cost note is documented.

#### Architecture
**Impact — files add/change:**
- `add` `services/pipeline/ingest/social/{x,instagram,facebook,tiktok}.py` (per-platform, behind `SourceConnector`)
- `add` `services/pipeline/ingest/social/aggregator.py` (Apify/Bright Data/Ensembledata adapter)
- `add` decision record `docs/runbooks/social-sources.md`

**Data-model / API changes:** `social_actors`, `actor_posts` (raw → Spaces, pointer `raw_uri`).
**Reuse:** connector interface (W2), normalize/dedup (W4), storage (P4).
**Risks (R1/R4):** cost, ToS/legal, provider reliability → caps, legal review gate, official-first, skip-if-unconfigured.

#### QA
| # | Maps to | Test case | Type |
|---|---|---|---|
| T1 | AC1 | mocked platform/aggregator response → normalized actor posts | unit |
| T2 | AC2 | budget/rate cap enforced; provider-down → graceful skip + log | integration |
| T3 | AC3 | platform with no aggregator configured → cleanly skipped (no error) | unit |
| T4 | AC4 | enabling a platform requires its decision record present | integration (CI check) |

**Governance edge cases:** legal/ToS sign-off before enabling; spend cap per platform; provider keys server-side; PII minimization in stored posts.

#### Revision history
| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-05-25 | Initial plan from architecture spec |

---

### W4. Normalization, dedup & raw storage

- **Version:** 1.0 · **Stage:** 1-watch · **Sprint:** S3 · **Status:** Planned · **Spec ref:** §7.4, §9, E4 · **Owner:** Dev B

#### PM
**Background (why):** Multiple sources report the same event; duplicates would inflate crisis scores
and waste LLM spend. Every item also needs an auditable raw snapshot. Clean, deduped, provenance-
backed storage is what makes the downstream enrichment and scoring trustworthy.

**Acceptance criteria:**
- **AC1** — *Given* a `RawItem` from any connector, *When* persisted, *Then* it is normalized into `articles`/`actor_posts` with a canonical URL and content hash.
- **AC2** — *Given* an exact or near-duplicate item, *When* persisted, *Then* it upserts/links rather than creating a duplicate row.
- **AC3** — *Given* any ingested item, *When* persisted, *Then* its raw payload is stored in Spaces and `raw_uri` points to it.
- **AC4** — *Given* a newly persisted (non-dup) article, *When* committed, *Then* an enrichment task is enqueued (hands off to U2).

#### Architecture
**Impact — files add/change:**
- `add` `services/pipeline/ingest/normalize.py` (canonicalize URL, hash, map to model)
- `add` `services/pipeline/ingest/dedup.py` (content_hash exact + SimHash/MinHash near-dup)
- `add` `services/pipeline/ingest/persist.py` (upsert + Spaces put + enqueue enrich)

**Data-model / API changes:** `articles(url UNIQUE, canonical_url, content_hash, raw_uri, fts)`, FTS index; dedup index on `content_hash`.
**Reuse:** Spaces (P4), schema (P3).
**Risks:** false-positive dedup merging distinct stories → tune near-dup threshold; keep exact-hash as primary.

#### QA
| # | Maps to | Test case | Type |
|---|---|---|---|
| T1 | AC1 | RawItem → normalized row w/ canonical URL + hash | unit |
| T2 | AC2 | duplicate + near-dup → no new row; original linked | unit + integration |
| T3 | AC3 | raw stored in Spaces; `raw_uri` resolves | integration |
| T4 | AC4 | new article enqueues exactly one enrich task | integration |

**Governance edge cases:** idempotent persistence (safe re-runs); enrich enqueued once (no double LLM spend); raw retention honored (P4/P7).

#### Revision history
| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-05-25 | Initial plan from architecture spec |

---

### W5. Initial recent-window backfill

- **Version:** 1.0 · **Stage:** 1-watch · **Sprint:** S3 · **Status:** Planned · **Spec ref:** §7.4, E4 · **Owner:** Dev B

#### PM
**Background (why):** On launch the dashboard would otherwise be empty until crawls accumulate, and
trends would start flat. A bounded, one-time backfill of the **recent window each source naturally
exposes** makes the dashboard meaningful on day one and gives trends a short head start — *without*
paying for deep archive access (decision: "light/recent only"). Deep historical import (paid news-API
archives, social history via aggregators) is explicitly **out of scope** for this feature.

**Acceptance criteria:**
- **AC1** — *Given* a newly onboarded source, *When* it is first crawled, *Then* the connector pulls the full recent window it exposes (RSS: all current entries; news API: items within a configurable max-age, e.g. ≤30 days), bounded by a max-items cap.
- **AC2** — *Given* the initial backfill has completed, *When* later crawls run, *Then* the source switches to **incremental** (only items newer than last seen), with no duplicates (reuses W4 dedup).
- **AC3** — *Given* backfilled articles carry their real `published_at`, *When* enrichment + rollup run, *Then* snapshots are **retro-computed** over the backfilled window so trend charts show a short history at launch.
- **AC4** — *Given* cost/ToS limits, *When* backfilling, *Then* it respects the per-source cap and does **not** call paid deep-archive endpoints (light mode only).

#### Architecture
**Impact — files add/change:**
- `add` `services/pipeline/ingest/backfill.py` (first-run detection, bounded lookback, max-age/max-items caps)
- `change` `services/pipeline/ingest/scheduler.py` (W1) — first-run vs incremental branch
- `change` connectors (W2) — accept `since` / `max_age` / `limit` params
- `change` rollup (U4) — invoked over the backfilled window for retro-snapshots (best-effort)

**Data-model / API changes:** `sources` gains `backfilled_at` (or treat `last_run_at IS NULL` as first run); relies on `articles.published_at`.
**Reuse:** W2 connectors, W4 dedup/persist, U4 rollup.
**Risks (R2):** feeds/news-API recent windows vary (some return little) → best-effort; enrichment cost of the initial batch → batch + budget guard; **must not** trigger paid deep-archive (cap enforced).

#### QA
| # | Maps to | Test case | Type |
|---|---|---|---|
| T1 | AC1 | first crawl pulls full recent window within caps | integration |
| T2 | AC2 | second crawl is incremental; no duplicates | integration |
| T3 | AC3 | retro-snapshots created over backfill window; trend non-empty | integration |
| T4 | AC4 | no paid-archive endpoint called; per-source cap enforced | unit |

**Governance edge cases:** backfill enrichment cost logged + capped; idempotent (safe re-run); ToS respected (no deep scrape).

#### Revision history
| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-05-25 | Added after the "light/recent backfill" scope decision |
