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

### U2. Article enrichment (score / issues / sentiment / summary / keywords)

- **Version:** 1.0 · **Stage:** 2-understand · **Sprint:** S4 · **Status:** Planned · **Spec ref:** §8, §9, E5 · **Owner:** Dev B

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

#### Architecture
**Impact — files add/change:**
- `add` `services/pipeline/enrich/article.py` (prompt + structured call → enrichment row)
- `add` keyword extraction → `keywords` rollup contribution
- `change` enqueue hook from W4 triggers this task

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

**Governance edge cases:** cost logged per article (U1); idempotency prevents double-spend; PII in summaries minimized.

#### Revision history
| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-05-25 | Initial plan from architecture spec |

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
