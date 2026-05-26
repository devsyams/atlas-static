# Stage 2 — Understand (enrichment & analytics)

> Turning raw content into meaning: model-agnostic LLM enrichment (scoring, issues, sentiment,
> summaries, keywords), geocoding, time-series snapshots/trends, predictions, and actor/leadership
> analytics. See `../README.md` (SOP) and `_index.md` (register). All LLM calls go through the
> abstraction in U1 — never hardcode a provider (spec §8).

---

### U1. LLM provider abstraction & cost ledger

- **Version:** 1.0 · **Stage:** 2-understand · **Sprint:** S4 · **Status:** Planned · **Spec ref:** §6.2, §8, E5 · **Owner:** Dev B

#### PM
**Background (why):** The current AI engine is Anthropic-only (`lib/ai/engine.ts`). The product must
be model-agnostic (Claude / Gemini / GPT) for resilience, cost control, and provider leverage, and
every call must be accounted for or LLM spend becomes invisible. This abstraction underpins all
enrichment and the assistant.

**Acceptance criteria:**
- **AC1** — *Given* a task with a configured provider/model, *When* it requests a completion, *Then* the call routes through LiteLLM to that provider and returns a typed result.
- **AC2** — *Given* a provider failure, *When* a fallback chain is configured, *Then* the request retries on the next provider before erroring.
- **AC3** — *Given* any completed call, *When* it returns, *Then* model, tokens, and cost are logged to the cost ledger.
- **AC4** — *Given* a daily budget guardrail, *When* spend exceeds it, *Then* non-critical enrichment is throttled/paused and an alert fires.
- **AC5** — *Given* a structured-output schema, *When* enrichment runs, *Then* the response is validated against a Pydantic model (instructor) or rejected/retried.

#### Architecture
**Impact — files add/change:**
- `add` `services/pipeline/llm/provider.py` (LiteLLM wrapper: route, retry, fallback, cache system prompt)
- `add` `services/pipeline/llm/structured.py` (instructor + Pydantic schemas)
- `add` `services/pipeline/llm/ledger.py` → writes `ai_messages`/cost; budget guard
- `change` (later) assistant + enrichment call this module

**Data-model / API changes:** `ai_messages(model, tokens, cost)`; budget config (env/`sources`-like).
**Reuse:** prompt-cache pattern from existing `lib/ai/engine.ts#systemBlocks`.
**Risks (R2):** runaway cost → budget guard + cheap-model defaults for high-volume scoring.

#### QA
| # | Maps to | Test case | Type |
|---|---|---|---|
| T1 | AC1 | mocked LiteLLM → typed result for selected provider | unit |
| T2 | AC2 | first provider errors → fallback succeeds | unit |
| T3 | AC3 | each call writes ledger row w/ model/tokens/cost | integration |
| T4 | AC4 | exceeding budget pauses non-critical work + alerts | integration |
| T5 | AC5 | malformed LLM output rejected/retried; valid output passes | unit |

**Governance edge cases:** provider never hardcoded; keys server-side only; budget enforced; ledger is the cost audit trail.

#### Revision history
| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-05-25 | Initial plan from architecture spec |

---

### U2. Article enrichment (score / issues / sentiment / summary / keywords / embedding)

- **Version:** 2.0 · **Stage:** 2-understand · **Sprint:** S4 · **Status:** Planned · **Spec ref:** §8, §9, E5 · **Owner:** Dev B

#### PM
**Background (why):** Raw articles mean nothing to an operator until they carry a crisis score, the
dominant issue, sentiment, a readable summary, and keywords. This is the core intelligence that
powers the Crisis Index, Insight, Articles feed, and detail modal — replacing today's pre-baked JSON
fields with live AI output.

**Acceptance criteria:**
- **AC1** — *Given* a newly persisted article, *When* the enrichment task runs, *Then* `article_enrichment` is written with score (0–10), level, dominant_issue, secondary_issues, sentiment, `ai_reasoning` summary, and keywords.
- **AC2** — *Given* enrichment output, *When* validated, *Then* it conforms to the typed schema (U1) and out-of-range scores are rejected.
- **AC3** — *Given* an already-enriched article, *When* re-triggered, *Then* it is not re-charged for LLM unless content changed (idempotent).
- **AC4** — *Given* the existing UI fields (e.g., `dominant_issue`, `ai_reasoning`, `secondary_issues`), *When* enrichment runs, *Then* it populates exactly those shapes consumed by the Articles list and DetailModal.
- **AC5** — *Given* a newly enriched article, *When* the enrichment task completes, *Then* a vector embedding (via the U1 abstraction) is generated and stored on `articles.embedding`; cost is logged to the U1 ledger; consumer is U6 (semantic search).

#### Architecture
**Impact — files add/change:**
- `add` `services/pipeline/enrich/article.py` (prompt + structured call → enrichment row)
- `add` keyword extraction → `keywords` rollup contribution
- `change` enqueue hook from W4 triggers this task
- `change` `services/pipeline/enrich/article.py` — after enrichment validates, call
  `services/pipeline/llm/embed.py` (U6) and store on `articles.embedding` in the same write

**Data-model / API changes:** `article_enrichment` (1:1 articles); contributes to `keywords`.
**Reuse:** issue taxonomy + field shapes from `lib/mbg/types.ts` and `buildArticleDetail`.
**Risks (R2):** per-article cost at volume → cheap model for scoring; batch where possible.

#### QA
| # | Maps to | Test case | Type |
|---|---|---|---|
| T1 | AC1 | fixture article → enrichment row with all fields | integration |
| T2 | AC2 | out-of-range/garbage output rejected/retried | unit |
| T3 | AC3 | re-run unchanged article → no new LLM charge | integration |
| T4 | AC4 | enriched shape matches `Article`/`ArticleDetail` types | unit |
| T5 | AC5 | after enrichment, `articles.embedding` is populated and the U1 ledger has a corresponding embedding-call row | integration |

**Governance edge cases:** cost logged per article (U1); idempotency prevents double-spend; PII in summaries minimized; embedding regenerated when article content changes (content_hash diff).

#### Revision history
| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-05-25 | Initial plan from architecture spec |
| 2.0 | 2026-05-26 | Added AC5: generate embedding alongside enrichment (consumer: U6 semantic search). MAJOR bump — scope/behaviour change. |

---

### U3. Geocoding & incident mapping

- **Version:** 1.0 · **Stage:** 2-understand · **Sprint:** S4 · **Status:** Planned · **Spec ref:** §8, §9, Risk R3, E5 · **Owner:** Dev B

#### PM
**Background (why):** The Indonesia incident map and Top Cities widgets need each article resolved to
a real city/province with coordinates and heat. Geocoding Indonesian locales from free text is
error-prone (R3); getting it right (and honestly surfacing what couldn't be mapped) is what makes the
map trustworthy rather than decorative.

**Acceptance criteria:**
- **AC1** — *Given* an enriched article, *When* geocoding runs, *Then* it extracts location via LLM NER and reconciles to an Indonesia gazetteer → city/province/lat/lng.
- **AC2** — *Given* an article with no resolvable location, *When* geocoding runs, *Then* it is counted as unmapped (feeds `unmapped_article_count`), not silently dropped.
- **AC3** — *Given* geocoded articles, *When* the rollup runs, *Then* `city_metrics` (heat, severity_sum, article_count, dominant_issue) and `cities` are updated for the map/Top Cities.
- **AC4** — *Given* the existing map data shape, *When* served, *Then* `city_map_points`/`top_cities` match the current `CityMapPoint`/`TopCity` types.

#### Architecture
**Impact — files add/change:**
- `add` `services/pipeline/enrich/geocode.py` (NER + gazetteer reconcile)
- `add` Indonesia city/province gazetteer dataset (Spaces or repo data)
- `add` `services/pipeline/enrich/rollup_cities.py`

**Data-model / API changes:** `cities`, `city_metrics`; `article_enrichment.{city,province,lat,lng}`.
**Reuse:** existing `cityKeyFromLocation`, `CRISIS_COLORS`, GeoJSON (P4); map shapes in `lib/mbg/types.ts`.
**Risks (R3):** mis-geocoding → gazetteer reconcile + confidence threshold; unmapped surfaced in UI (already supported).

#### QA
| # | Maps to | Test case | Type |
|---|---|---|---|
| T1 | AC1 | known-location article → correct city/province/coords | unit |
| T2 | AC2 | ambiguous/none → counted unmapped | unit |
| T3 | AC3 | rollup aggregates heat/severity/count per city | integration |
| T4 | AC4 | served points match `CityMapPoint`/`TopCity` | unit |

**Governance edge cases:** low-confidence geocodes flagged not asserted; mapped vs unmapped counts honest; gazetteer versioned.

#### Revision history
| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-05-25 | Initial plan from architecture spec |

---

### U4. Crisis snapshots & trends

- **Version:** 1.0 · **Stage:** 2-understand · **Sprint:** S4 · **Status:** Planned · **Spec ref:** §9.4, E5 · **Owner:** Dev B + Dev A

#### PM
**Background (why):** Today's dashboard is a single frozen moment with faked timestamps — there is no
history. Operators need to see whether a crisis is escalating or cooling. Periodic snapshots turn
point-in-time data into real time-series, unlocking trend charts and the "is this getting worse?"
question that matters most in a crisis.

**Acceptance criteria:**
- **AC1** — *Given* enriched data, *When* the rollup task runs on schedule, *Then* a `crisis_snapshots` row captures score, level, article_count, high_crisis_count, mapped/unmapped counts at that time.
- **AC2** — *Given* accumulated snapshots, *When* the trends API is queried for a range, *Then* it returns a time-series suitable for charting.
- **AC3** — *Given* the index computation, *When* it runs, *Then* the overall crisis score is derived from current articles (not a static constant) and is reproducible.
- **AC4** — *Given* retention policy, *When* snapshots age beyond 1y, *Then* they are downsampled, not lost.

#### Architecture
**Impact — files add/change:**
- `add` `services/pipeline/enrich/rollup_snapshot.py` (compute + insert snapshot)
- `add` (web) `apps/web/app/api/v1/trends/route.ts` (reads snapshots) — pairs with A2 charts
- `add` scheduled rollup in Beat (W1)

**Data-model / API changes:** `crisis_snapshots` time-series; index on `captured_at`.
**Reuse:** scoring inputs from U2/U3; `crisis_score` shape from current JSON.
**Risks:** snapshot cadence vs cost/storage → align to crawl cadence; downsample old data.

#### QA
| # | Maps to | Test case | Type |
|---|---|---|---|
| T1 | AC1 | rollup writes a snapshot with correct aggregates | integration |
| T2 | AC2 | trends API returns ordered series for a range | integration |
| T3 | AC3 | score recomputation deterministic for fixed input | unit |
| T4 | AC4 | downsampling job collapses old rows; recent intact | integration |

**Governance edge cases:** snapshots immutable (append-only); timezone consistency; no faked timestamps.

#### Revision history
| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-05-25 | Initial plan from architecture spec |

---

### U5. Predictions, insights, actor & leadership analytics

- **Version:** 1.0 · **Stage:** 2-understand · **Sprint:** S4–S5 · **Status:** Planned · **Spec ref:** §8, §9, E5 · **Owner:** Dev B

#### PM
**Background (why):** Beyond raw scoring, the dashboard's Insight, Prediction meters, "Homeless
Media" actor analysis, and Leadership Sentiment widgets are the analytical payoff operators act on.
These must be generated from real data instead of canned JSON, with reasoning and recommendations
that hold up.

**Acceptance criteria:**
- **AC1** — *Given* current enriched data, *When* the insight/prediction task runs, *Then* it produces `insights` and `predictions` (probability, answer_label, reasoning, timeframe, tone) matching the UI shapes.
- **AC2** — *Given* monitored social actors, *When* analysis runs, *Then* `social_actors`/`actor_posts` carry influence/credibility/sentiment/risk + summaries per the `SocialActor` shape.
- **AC3** — *Given* monitored leaders, *When* analysis runs, *Then* `leader_sentiment`/`leader_articles` populate sentiment score/trend/insight/prediction per the `Leader` shape.
- **AC4** — *Given* all four analytics, *When* served via the dashboard API, *Then* they match the existing `Insight`/`Prediction`/`ActorThreadAnalysis`/`LeadershipSentiment` types exactly.

#### Architecture
**Impact — files add/change:**
- `add` `services/pipeline/enrich/{insights,predictions,actors,leaders}.py`
- `add` rollup wiring into Beat schedule

**Data-model / API changes:** `insights`, `predictions`, `social_actors`, `actor_posts`, `leaders`, `leader_sentiment`, `leader_articles`.
**Reuse:** rich type shapes already in `lib/mbg/types.ts`; existing components consume them unchanged.
**Risks (R2):** higher-token analytics → stronger model only where needed; cache between runs.

#### QA
| # | Maps to | Test case | Type |
|---|---|---|---|
| T1 | AC1 | fixtures → insights/predictions in correct shape | integration |
| T2 | AC2 | actor analysis fields populated; risk levels valid enum | integration |
| T3 | AC3 | leadership sentiment/articles populated | integration |
| T4 | AC4 | served payloads validate against TS types | unit |

**Governance edge cases:** reasoning grounded in stored data (no hallucinated sources); restricted/unverified actors handled conservatively; cost logged.

#### Revision history
| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-05-25 | Initial plan from architecture spec |

---

### U6. Semantic search & embedding index (assistant RAG layer)

- **Version:** 1.0 · **Stage:** 2-understand · **Sprint:** S4–S5 · **Status:** Planned · **Spec ref:** §8 extension (new scope), pairs with U2 v2.0 · **Owner:** Dev B

#### PM
**Background (why):** U2 turns unstructured articles into **structured metrics** (score, dominant
issue, sentiment, geocode, keywords). For most assistant questions — "what's the current crisis
score?", "which cities spiked this week?", "how is leader X trending?" — those structured tables are
the right answer and the assistant can read them with plain SQL/API tools. **But** for open-ended
*narrative* questions — "tell me about the rice supply crisis", "what are people saying about the
rupiah drop?", "find articles similar to this one" — structured aggregates fall short; the user
wants the actual story from raw articles and posts. Without semantic retrieval the assistant (A4/A5)
will sound shallow on exactly the questions analysts care most about. This adds a **small, focused
RAG layer**: pgvector embedding index over `articles` and `actor_posts`, exposed to the assistant as
search **tools** it can call alongside its structured query tools. **Not** a full RAG replacement
for the enrichment pipeline — structured retrieval stays the default; semantic search is invoked
only when the question warrants it.

**Scope decisions (resolved during design):**
- **Structured-first, RAG-as-tool**, not RAG-first. The assistant prefers structured SQL/API tools;
  semantic search is one tool among several. Documented in the assistant system prompt.
- **pgvector on the existing Postgres** — no new vector DB service. Keeps infra surface small and
  reuses the P3 Alembic-owned schema contract.
- **Embeddings computed at enrichment time** (one call per article during U2), not on-demand.
  Cheap embedding model; cost flows through the U1 ledger like any other LLM call.

**Acceptance criteria:**
- **AC1** — *Given* an article whose enrichment has produced an embedding (U2 v2.0), *When* it is
  persisted, *Then* `articles.embedding` is stored and the pgvector index includes it; same for
  `actor_posts`.
- **AC2** — *Given* a semantic query, *When* `search_articles(q, k, filters)` is called, *Then*
  the top-k articles by cosine similarity are returned, with optional metadata filters (date range,
  city, province, dominant_issue, source, tenant subscription) applied **before** the similarity
  cut so results are correct, not just top-k.
- **AC3** — *Given* social posts, *When* `search_actor_posts(q, k)` is called, *Then* top-k
  semantically similar posts are returned, also tenant-scoped.
- **AC4** — *Given* the assistant (A4/A5), *When* a user asks a narrative question, *Then* the LLM
  may call `search_articles` / `search_actor_posts` as tools alongside its structured tools and
  ground its answer with provenance (article ids + `raw_uri`).
- **AC5** — *Given* a hybrid question ("high-crisis food-supply articles in Java this week"),
  *When* served, *Then* metadata filters and vector similarity combine in a single query (filters
  applied first, then nearest-neighbor over the filtered set).
- **AC6** — *Given* the U1 cost ledger, *When* embedding generation runs, *Then* every call writes
  a ledger row (model, tokens, cost) and respects the daily budget guard.
- **AC7** — *Given* tenant scoping (P8), *When* a tenant's user calls a search tool, *Then* results
  are restricted to articles whose source is in that tenant's `tenant_sources` subscription.

#### Architecture
**Impact — files add/change:**
- `add` Alembic migration `<ts>_enable_pgvector_and_embeddings.py` — `CREATE EXTENSION vector`;
  adds `articles.embedding vector(<dim>)` and `actor_posts.embedding vector(<dim>)`; creates HNSW
  indexes on both
- `change` `services/pipeline/db/models/content.py` — `Article.embedding`; configure pgvector type
- `change` `services/pipeline/db/models/social.py` — `ActorPost.embedding`
- `add` `services/pipeline/llm/embed.py` — embedding wrapper over LiteLLM (model selectable per
  U1 config; logs to ledger)
- `change` `services/pipeline/enrich/article.py` (U2) — invoke embedding step after enrichment
  output is validated; store on the same row write
- `change` `services/pipeline/enrich/actors.py` (U5) — invoke embedding for new posts
- `add` `services/pipeline/search/semantic.py` — `search_articles(q, k, filters)`,
  `search_actor_posts(q, k, filters)`; applies tenant + metadata filters then orders by
  `embedding <=> $1` (cosine distance)
- `add` `apps/web/app/api/v1/search/articles/route.ts` — BFF wrapper (RBAC + tenant scope + rate
  limit); calls the AI service or Postgres directly via Kysely
- `add` `apps/web/app/api/v1/search/actor-posts/route.ts` — same pattern
- `add` `apps/web/lib/db/search.ts` — Kysely query helpers for pgvector (raw SQL fragment for the
  similarity operator until codegen catches up)
- `change` `apps/web/lib/db/types.gen.ts` — regenerate after migration
- `change` (later, A4/A5) assistant tool registry — register `search_articles` and
  `search_actor_posts` alongside structured query tools; system prompt instructs structured-first
- `add` `docs/runbooks/embedding-model.md` — chosen model, dimension, evaluation notes, change
  procedure

**Data-model / API changes:**
- `articles.embedding vector(<dim>)`, `actor_posts.embedding vector(<dim>)` — dim recorded in
  `docs/runbooks/embedding-model.md` and pinned in U1 config; switching providers requires recompute
- New indexes: HNSW on both (`USING hnsw (embedding vector_cosine_ops)`)
- New API: `POST /api/v1/search/articles { q, k, filters }` → `[{ article, score }]`;
  `POST /api/v1/search/actor-posts { q, k, filters }` → `[{ post, score }]`
- pgvector extension added to the Postgres dependency list (P2 infra + P3 migration ownership)

**Reuse:**
- U1 LiteLLM abstraction — LiteLLM exposes embeddings via the same client; one new wrapper, no
  new provider dependency.
- U2 enrichment task already runs per new article — extend it, don't add a new pipeline stage.
- P3 Alembic ownership pattern (no second migration source).
- P6 RBAC for the new endpoints; P8 tenant scoping in `search/semantic.py` and the BFF wrappers.
- A4/A5 assistant tool-use mechanism (same registry pattern as structured tools).

**Risks:**
- **N1 — Embedding model lock-in by dimension.** Vectors are tied to one model's dimension;
  switching providers means recomputing every embedding. *Mitigation:* pin model + dim in U1 config
  and `embedding-model.md`; reserve a follow-up runbook for the recompute procedure (batched,
  budget-capped).
- **N2 — Indonesian-language recall.** Some embedding models underperform on Bahasa Indonesia.
  *Mitigation:* evaluate candidates (e.g., `text-embedding-3-small`, `multilingual-e5`, Cohere
  multilingual) against a small Indonesian crisis-article eval set before locking in; document
  recall numbers in `embedding-model.md`.
- **N3 — pgvector index tuning.** HNSW vs IVFFlat is a recall/build-time/memory tradeoff.
  *Mitigation:* default HNSW with conservative params; benchmark on the real corpus during S4 and
  document chosen params.
- **N4 — Cross-tenant leak via search.** Search must filter by `tenant_sources` server-side;
  client-only filtering is unsafe. *Mitigation:* tenant filter applied in `search/semantic.py`
  before similarity ranking; integration test asserts a tenant-B user cannot retrieve tenant-A-only
  articles even with crafted filters.
- **N5 — Assistant over-uses RAG when structured query is correct.** Could re-summarize from raw
  articles instead of reading the cheap aggregate. *Mitigation:* system-prompt instructions "prefer
  structured tools for aggregates; use search for narratives/exploration"; weekly review of
  assistant traces in the cost ledger to catch drift.
- **N6 — Cost spike on backfill.** Embedding every backfilled article at once (W5) can blow budget.
  *Mitigation:* batched embedding with a budget cap per run; backfill embeddings can lag enrichment
  by hours without breaking the dashboard.

#### QA
| # | Maps to | Test case | Type |
|---|---|---|---|
| T1 | AC1 | enriching a fixture article writes `embedding`; index contains the new vector; round-trip read returns the same vector | integration |
| T2 | AC2 | semantic query returns top-k by similarity; metadata filter (e.g., `dominant_issue='food_safety'`) is applied before ranking; results stable for fixed seed | integration |
| T3 | AC3 | `search_actor_posts` returns relevant posts; respects tenant scope | integration |
| T4 | AC4 | assistant given "tell me about the rice supply crisis" invokes `search_articles`, returns answer citing returned article ids + `raw_uri` | integration |
| T5 | AC5 | hybrid query (filters + similarity) returns the intersection, not the union; explain plan shows filter-first | integration |
| T6 | AC6 | each embedding call writes a ledger row with model/tokens/cost; exceeding daily budget pauses non-critical embedding | integration |
| T7 | AC7 | tenant-B user calling search cannot retrieve tenant-A-only articles even with crafted filters | integration |

**Governance edge cases:** tenant scoping enforced server-side (P8); cost logged per call (U1);
embedding dimension + model recorded in a runbook so changes require an explicit recompute plan;
PII in retrieved passages already minimized by U2 summary policy; search endpoints rate-limited
(P7) to prevent assistant runaway loops.

#### Revision history
| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-05-26 | Initial plan — RAG layer added after the structured-first / RAG-as-tool decision; pgvector on existing Postgres; assistant gains search tools alongside its structured query tools |
