# Stage 0 — Platform

> Cross-cutting foundation: monorepo, infrastructure, database, storage, auth, RBAC, observability,
> hardening, launch. See `../README.md` for the SOP and `_index.md` for the register.

---

### P1. Monorepo foundation & tooling

- **Version:** 1.0 · **Stage:** 0-platform · **Sprint:** S1 · **Status:** Built · **Spec ref:** §4–5, E1 · **Owner:** DevOps/Dev C

#### PM
**Background (why):** The product is a static single Next.js app. Topology C needs a TS frontend
**and** a Python pipeline shipped together. Without a clean polyglot monorepo, the two codebases
drift, local setup is ad-hoc, and contracts can't be generated. This unlocks every later feature.

**Acceptance criteria:**
- **AC1** — *Given* a fresh checkout, *When* a dev runs `task setup`, *Then* JS deps (pnpm) and Python deps (uv) install and the workspace builds with no errors.
- **AC2** — *Given* the monorepo, *When* the existing app is migrated, *Then* the current dashboard runs from `apps/web` with identical behaviour to today.
- **AC3** — *Given* Turborepo + Taskfile, *When* a dev runs `task dev`, *Then* web and a Python stub start together and `task lint`/`task typecheck` run across both languages.

#### Architecture
**Impact — files add/change:**
- `add` `pnpm-workspace.yaml`, `turbo.json`, `Taskfile.yml`, `pyproject.toml`, `uv.lock`
- `change` move existing app → `apps/web/*` (update import alias `@/*`, `tsconfig`, `next.config.ts`)
- `add` `services/pipeline/` skeleton (FastAPI stub, `worker.py`, `beat.py`)
- `add` `packages/contracts/` placeholder

**Data-model / API changes:** none.
**Reuse:** entire existing Next app, `tsconfig`, eslint config.
**Risks:** import-path churn during the move (mitigate with a single codemod commit + green build gate).

#### QA
| # | Maps to | Test case | Type |
|---|---|---|---|
| T1 | AC1 | `task setup` on clean clone exits 0; lockfiles present | integration (CI) |
| T2 | AC2 | Existing dashboard smoke test passes from `apps/web` | e2e |
| T3 | AC3 | `task dev` boots web + python stub; `task lint`/`typecheck` pass both stacks | integration (CI) |

**Governance edge cases:** CI must fail the build if either language's typecheck/lint fails (no silent skips).

#### Revision history
| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-05-25 | Initial plan from architecture spec |

---

### P2. DigitalOcean infrastructure & CI/CD

- **Version:** 1.0 · **Stage:** 0-platform · **Sprint:** S1 · **Status:** Planned · **Spec ref:** §12, E1 · **Owner:** DevOps/Dev C

#### PM
**Background (why):** Production needs reproducible infra and automated, safe deploys. Manual
provisioning and click-ops don't scale or audit. This gives staging + prod parity and a one-path
deploy so the team ships confidently from day one.

**Acceptance criteria:**
- **AC1** — *Given* Terraform, *When* `terraform apply` runs, *Then* DO Managed Postgres, Redis/Valkey, Spaces bucket(s) and a Container Registry exist for the target environment.
- **AC2** — *Given* an App Platform app-spec, *When* it deploys, *Then* `web`, `ai-api`, `worker`, `beat` components run with health checks passing.
- **AC3** — *Given* a push to `main`, *When* CI runs, *Then* lint+typecheck+test pass, images build & push to DOCR, migrations run, and staging deploys; prod requires a tagged release.

#### Architecture
**Impact — files add/change:**
- `add` `infra/terraform/*` (DO provider: postgres, redis, spaces, docr, app spec)
- `add` `infra/docker/Dockerfile.web`, `Dockerfile.pipeline`, `docker-compose.yml`
- `add` `.github/workflows/ci.yml`, `deploy.yml`
- `add` release step: `alembic upgrade head` pre-deploy

**Data-model / API changes:** none (DB instance only).
**Reuse:** existing `vercel.json` retired; Next standalone build output.
**Risks:** secret handling — use DO encrypted env + GH Actions secrets; never commit secrets.

#### QA
| # | Maps to | Test case | Type |
|---|---|---|---|
| T1 | AC1 | `terraform plan` clean; apply on staging creates all resources | integration |
| T2 | AC2 | All 4 components report healthy post-deploy | integration |
| T3 | AC3 | PR pipeline blocks on failing test; tagged release deploys prod; migration step runs once | integration (CI) |

**Governance edge cases:** secrets masked in logs; failed migration aborts deploy (no partial release); prod deploy gated on tag, not branch.

#### Revision history
| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-05-25 | Initial plan from architecture spec |

---

### P3. Database schema, migrations & type generation

- **Version:** 1.0 · **Stage:** 0-platform · **Sprint:** S1–S2 · **Status:** Built · **Spec ref:** §4, §9, E2 · **Owner:** Dev B + Dev A

#### PM
**Background (why):** All data must live in a real store with history and provenance. Today's static
JSON fakes freshness and has no schema. A single source-of-truth schema (Alembic) with generated TS
types removes drift and lets both languages share the contract safely.

**Acceptance criteria:**
- **AC1** — *Given* SQLAlchemy models, *When* `alembic upgrade head` runs, *Then* all spec §9 tables exist with indexes (incl. articles FTS, time-series on `crisis_snapshots`).
- **AC2** — *Given* the live schema, *When* `kysely-codegen` runs, *Then* TS DB types are generated and the BFF compiles against them.
- **AC3** — *Given* `mbg-crisis-data-v2.json`, *When* the seed migration runs, *Then* the DB is populated with equivalent demo data and the dashboard renders from it.
- **AC4** — *Given* the rule "Alembic owns schema", *When* CI checks, *Then* no TS migration tool is present and codegen output is up to date.

#### Architecture
**Impact — files add/change:**
- `add` `services/pipeline/db/models/*.py`, `services/pipeline/db/migrations/*` (Alembic)
- `add` `services/pipeline/db/seed.py` (loads static JSON → tables)
- `add` `apps/web/lib/db/types.gen.ts` (kysely-codegen output), `apps/web/lib/db/client.ts` (Kysely)
- `change` `lib/mbg/data.ts` consumers will later read DB (see A1)

**Data-model / API changes:** full schema from spec §9 (users/sessions/audit, sources, articles, article_enrichment, crisis_snapshots, cities/city_metrics, keywords, predictions, insights, market_ticker, social_actors/actor_posts, leaders/leader_sentiment/leader_articles, ai_conversations/ai_messages, dashboard_layouts).
**Reuse:** `lib/mbg/types.ts` shapes inform columns; existing JSON as seed fixture.
**Risks:** schema/型 drift between Python and TS → mitigated by codegen + CI drift check.

#### QA
| # | Maps to | Test case | Type |
|---|---|---|---|
| T1 | AC1 | migration up/down round-trips; key indexes present | integration |
| T2 | AC2 | codegen produces types; BFF typechecks | integration (CI) |
| T3 | AC3 | seed loads; row counts match JSON; dashboard renders | integration |
| T4 | AC4 | CI fails if codegen stale or a TS migration dep appears | integration (CI) |

**Governance edge cases:** migrations are forward-only in prod; seed runs only in non-prod; PII columns (email) noted for audit.

#### Revision history
| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-05-25 | Initial plan from architecture spec |

---

### P4. Object storage (Spaces) integration

- **Version:** 1.0 · **Stage:** 0-platform · **Sprint:** S2 · **Status:** Planned · **Spec ref:** §9.2, E2 · **Owner:** Dev B

#### PM
**Background (why):** Raw article snapshots (provenance/audit), avatars, the 343 KB GeoJSON, and
generated PDF exports don't belong in Postgres or the repo's `public/`. Object storage keeps blobs
cheap, private, and signed-URL accessible — and makes ingestion auditable.

**Acceptance criteria:**
- **AC1** — *Given* Spaces credentials, *When* a worker stores a blob, *Then* it lands in a private bucket and a `raw_uri` pointer is saved.
- **AC2** — *Given* a private object, *When* the web app needs it, *Then* it serves via a short-lived signed URL (no public ACL).
- **AC3** — *Given* existing static assets (avatars, geojson), *When* migrated, *Then* they load from Spaces and `public/` references are removed.

#### Architecture
**Impact — files add/change:**
- `add` `services/pipeline/storage/spaces.py` (boto3 client, put/sign)
- `add` `apps/web/lib/storage.ts` (signed-URL helper, AWS SDK S3 client)
- `change` avatar/geojson references → Spaces-backed URLs

**Data-model / API changes:** `raw_uri` columns already in schema (P3); add `photo_uri`/`avatar` URIs.
**Reuse:** existing avatars in `public/social-media-avatars/*`, `public/geo/*`.
**Risks:** accidental public ACL → enforce private + signed URLs in tests.

#### QA
| # | Maps to | Test case | Type |
|---|---|---|---|
| T1 | AC1 | put → object exists; pointer persisted | integration |
| T2 | AC2 | signed URL works, expires; unsigned access 403 | integration |
| T3 | AC3 | dashboard avatars/map render from Spaces | e2e |

**Governance edge cases:** no public-read buckets; signed-URL TTL bounded; retention policy (raw 90d) configured.

#### Revision history
| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-05-25 | Initial plan from architecture spec |

---

### P5. Authentication — email/password + sessions

- **Version:** 1.0 · **Stage:** 0-platform · **Sprint:** S2 · **Status:** Built · **Spec ref:** §10, E3 · **Owner:** Dev A

#### PM
**Background (why):** Current "auth" is hardcoded credentials in client code + a presence cookie —
zero security. An internal crisis tool with sensitive intel needs real authentication: hashed
passwords, server-side sessions, and a real login gate. This is a launch blocker.

**Acceptance criteria:**
- **AC1** — *Given* a provisioned user, *When* they submit correct email/password, *Then* a server-side session is created (httpOnly, SameSite, secure) and they reach the dashboard.
- **AC2** — *Given* wrong credentials, *When* submitted, *Then* login is rejected with a generic error and no session is set.
- **AC3** — *Given* no/expired session, *When* any protected route is requested, *Then* the user is redirected to `/login`; an authed user hitting `/login` is bounced home.
- **AC4** — *Given* a session, *When* it expires or the user logs out, *Then* access is revoked.

#### Architecture
**Impact — files add/change:**
- `add` Auth.js v5 config (`apps/web/auth.ts`), Credentials provider, `@auth/kysely-adapter`
- `add` Argon2id hashing util; `apps/web/app/api/auth/*`
- `change` `middleware.ts` — replace presence-cookie with real session + matcher
- `change` `app/login/page.tsx` — remove hardcoded creds; call auth endpoint; keep NeuralIgnition

**Data-model / API changes:** `users`, `sessions`, `accounts` (Auth.js adapter); password_hash on users.
**Reuse:** existing login UI/animation; existing middleware redirect logic shape.
**Risks:** session-cookie misconfig → test flags; demo creds must be fully removed.

#### QA
| # | Maps to | Test case | Type |
|---|---|---|---|
| T1 | AC1 | valid login → session cookie set; dashboard reachable | e2e |
| T2 | AC2 | invalid login → 401, no cookie, generic message | integration |
| T3 | AC3 | protected route unauth → /login; authed → /login bounces home | e2e |
| T4 | AC4 | logout/expiry → protected route redirects | integration |
| T5 | — | grep: no hardcoded credentials remain in client bundle | unit |

**Governance edge cases:** Argon2id params set; cookies httpOnly+secure+SameSite; login rate-limited (ties to P7); timing-safe compare; login success/failure audited (P6).

#### Revision history
| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-05-25 | Initial plan from architecture spec |

---

### P6. RBAC, route guards & audit log

- **Version:** 1.0 · **Stage:** 0-platform · **Sprint:** S2 · **Status:** Built · **Spec ref:** §10, E3 · **Owner:** Dev A

#### PM
**Background (why):** Not everyone should do everything. Admins manage users/sources; analysts use
the full dashboard + assistant; viewers are read-only. Sensitive actions must be traceable. Without
RBAC + audit, the tool can't be trusted internally or pass a basic security review.

**Acceptance criteria:**
- **AC1** — *Given* a user with role R, *When* they call an endpoint requiring role > R, *Then* it returns 403 and the UI hides the control.
- **AC2** — *Given* admin-only actions (provision user, edit source), *When* a non-admin attempts them, *Then* they're blocked server-side regardless of UI.
- **AC3** — *Given* a sensitive action (login, user provisioning, source change), *When* it occurs, *Then* an `audit_log` row records actor, action, target, timestamp.
- **AC4** — *Given* no Settings UI (out of scope), *When* the first admin is needed, *Then* a seed/CLI provisions it.

#### Architecture
**Impact — files add/change:**
- `add` `apps/web/lib/authz.ts` (role checks), per-route guards, `requireRole()`
- `add` `apps/web/lib/audit.ts` → writes `audit_log`
- `add` `services/pipeline` CLI/seed for first admin
- `change` `middleware.ts` role-aware; UI conditionally renders admin controls

**Data-model / API changes:** `users.role` enum (admin/analyst/viewer), `audit_log` table.
**Reuse:** session from P5; Kysely client.
**Risks:** client-only gating (insecure) → all checks enforced server-side; tests assert server enforcement.

#### QA
| # | Maps to | Test case | Type |
|---|---|---|---|
| T1 | AC1 | viewer→write endpoint = 403; control hidden | integration + e2e |
| T2 | AC2 | analyst→admin endpoint = 403 even via direct API | integration |
| T3 | AC3 | each sensitive action writes one audit row with correct fields | integration |
| T4 | AC4 | seed creates admin; idempotent | integration |

**Governance edge cases:** privilege escalation attempts blocked + audited; audit log append-only; role changes audited.

#### Revision history
| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-05-25 | Initial plan from architecture spec |

---

### P7. Observability, hardening, backups & launch

- **Version:** 1.0 · **Stage:** 0-platform · **Sprint:** S1 (skeleton), S6 (hardening/launch) · **Status:** Planned · **Spec ref:** §11–13, E8–E9 · **Owner:** Dev C + all

#### PM
**Background (why):** A production crisis tool must be observable, resilient, and recoverable.
Without error tracking, freshness alerts, rate limiting, backups, and a tested restore, an outage or
breach is invisible until it hurts. This is the gate between "feature-complete" and "in production".

**Acceptance criteria:**
- **AC1** — *Given* the running system, *When* an error occurs in web/ai-api/worker, *Then* it's captured in Sentry with a trace, and structured logs ship to the log platform.
- **AC2** — *Given* the pipeline, *When* no successful crawl completes in N minutes, *Then* a freshness alert fires.
- **AC3** — *Given* abusive traffic, *When* it hits auth/AI endpoints, *Then* requests are rate-limited (Redis) and excess is rejected.
- **AC4** — *Given* security headers/CSP and dependency scanning, *When* CI runs and the app serves, *Then* headers are present and no high-severity dep vulns ship.
- **AC5** — *Given* Postgres backups, *When* a restore is rehearsed, *Then* a documented runbook restores the DB to a recovery point.
- **AC6** — *Given* perf targets (§13), *When* load-tested, *Then* cached dashboard p95 < 300 ms and assistant first-token < 2 s.

#### Architecture
**Impact — files add/change:**
- `add` Sentry + OpenTelemetry init (web + python); health-check endpoints
- `add` `apps/web/lib/ratelimit.ts` (Redis token bucket); security headers/CSP in `next.config.ts`/middleware
- `add` freshness alert task + monitor; dep-scan CI step
- `add` `docs/runbooks/*` (restore, incident, on-call); load-test scripts (k6)
- `change` DO Postgres backup/PITR config (Terraform, P2)

**Data-model / API changes:** none (uses `sources.last_run_at` for freshness).
**Reuse:** existing `LiveBadge`/offline handling; Redis from P2.
**Risks:** alert fatigue (tune thresholds); CSP breaking inline styles (test Tailwind/oklch usage).

#### QA
| # | Maps to | Test case | Type |
|---|---|---|---|
| T1 | AC1 | forced error appears in Sentry with trace id; logs structured | integration |
| T2 | AC2 | stale pipeline triggers alert; recovery clears it | integration |
| T3 | AC3 | burst on /api/v1/ai and /login → 429 after threshold | integration |
| T4 | AC4 | response carries security headers; CI dep-scan blocks high sev | integration (CI) |
| T5 | AC5 | rehearsed restore matches recovery point; runbook steps verified | manual + integration |
| T6 | AC6 | k6 run meets p95/first-token targets | performance |

**Governance edge cases:** secrets never logged; rate-limit shared across instances (Redis); backups encrypted; restore drill recorded.

#### Revision history
| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-05-25 | Initial plan from architecture spec |

---

### P8. Multi-tenancy & per-tenant narration

- **Version:** 1.0 · **Stage:** 0-platform · **Sprint:** S2–S3 · **Status:** Planned · **Spec ref:** §9–10 extension (new scope) · **Owner:** Dev A + Dev B

#### PM
**Background (why):** ATLAS was designed for a single tenant (MBG). The sales pipeline now includes
multiple enterprise clients who want the **same news/social ingestion backbone** but with a
**different dashboard layout, different narration tone/terminology, different source mix, and in at
least one case bespoke widgets** (e.g., an embedded CCTV feed for an operations-heavy client). Without
multi-tenancy this forces a fork per client — multiplying deploy/maintenance cost, blocking shared
improvements, and breaking the "one product" go-to-market. This feature establishes **one codebase,
one deployment, isolated data and presentation per tenant**, with a platform-admin console for
provisioning tenants and curating which widgets each one is allowed to use. It unlocks every
client-facing deal from this point forward.

**Scope decisions (resolved during design):**
- **Platform-curated widgets** (not self-serve). Platform admins decide which widgets each tenant
  may use; tenant admins only arrange what's been enabled. Prevents support sprawl with a small
  number of enterprise tenants.
- **Phase-1 admin UI is JSON-edit forms** (not a visual drag-drop layout builder). The visual
  builder is a future feature; layout JSON + a preview pane is enough to ship the business.
- **Shared ingestion + enrichment, tenant-scoped presentation.** `sources`, `articles`,
  `article_enrichment`, `cities` stay global; everything that depends on which sources/issues a
  tenant cares about (snapshots, metrics, keywords, predictions, insights, ticker, social/leader
  surfaces, assistant state) gains `tenant_id`.

**Acceptance criteria:**
- **AC1** — *Given* a `platform_admin`, *When* they provision a new tenant, *Then* a `tenants` row,
  an empty `tenant_layouts` default, empty `tenant_sources`/`tenant_issues`, and a seeded
  `tenant_admin` user exist; re-running provisioning is idempotent.
- **AC2** — *Given* a logged-in user belonging to tenant T, *When* they call any tenant-scoped read
  or write API, *Then* they only see rows where `tenant_id = T`, enforced both in middleware and by
  Postgres RLS (belt-and-suspenders); cross-tenant ID probing returns empty.
- **AC3** — *Given* the shared `sources` catalog, *When* a `tenant_admin` subscribes/unsubscribes
  a source, *Then* their tenant-scoped aggregates (snapshots, city metrics, keywords) are computed
  only over subscribed sources from that point forward.
- **AC4** — *Given* a tenant's active `prompt_packs`, *When* U2/A4/A5 invoke an LLM call for that
  tenant, *Then* the tenant's active prompt content is used, with documented fallback to the
  `default` tenant's pack if a key is missing.
- **AC5** — *Given* a widget registry and a tenant's `allowed_widgets` list, *When* a layout
  references a widget key not in the allowlist, *Then* the widget is not rendered and the omission
  is logged (not a crash).
- **AC6** — *Given* a user opening their dashboard, *When* layout resolution runs, *Then* the
  precedence is **user layout → tenant layout → built-in default** (first hit wins).
- **AC7** — *Given* a `platform_admin`, *When* they open `/admin`, *Then* they can create tenants,
  toggle feature flags, manage the widget allowlist per tenant, and view per-tenant LLM cost;
  *Given* a `tenant_admin`, *When* they open `/settings`, *Then* they can edit the tenant default
  layout (JSON + preview), the narration prompt pack, source/issue subscriptions, and the tenant's
  own users — but cannot reach `/admin` (403).
- **AC8** — *Given* per-tenant LLM activity, *When* `ai_messages` rows are written, *Then*
  `tenant_id` is recorded; *And* shared enrichment cost is amortized across subscribing tenants by a
  documented allocation (proportional to subscription) and surfaced in the platform-admin cost view.

**Open question for sign-off (defaulted):** Users belong to exactly **one** tenant
(`users.tenant_id NOT NULL`). Internal staff get their own `internal` tenant and become
`platform_admin` there; cross-tenant access is an elevated audited read path (no second tenant
membership). Upgrade to a `tenant_memberships(user_id, tenant_id, role)` join table later via
`/change-feature` if multi-tenant staff become a real need.

#### Architecture
**Impact — files add/change:**
- `add` `services/pipeline/db/models/tenancy.py` — `Tenant`, `TenantSource`, `TenantIssue`,
  `PromptPack`, `TenantLayout`
- `change` `services/pipeline/db/models/identity.py` — `User`: add `tenant_id`; drop global
  `email UNIQUE`, add `(tenant_id, email) UNIQUE`; `AuditLog`: add nullable `tenant_id` (null for
  cross-tenant platform actions)
- `change` `services/pipeline/db/models/aggregates.py` — add `tenant_id` to `CrisisSnapshot`,
  `CityMetric`, `Keyword`, `Prediction`, `Insight`, `MarketTicker`; rewrite time-series indexes as
  `(tenant_id, captured_at DESC)`
- `change` `services/pipeline/db/models/assistant.py` — add `tenant_id` to `AiConversation`,
  `AiMessage`, `DashboardLayout`
- `change` `services/pipeline/db/models/social.py` — add `tenant_id` to `SocialActor`, `ActorPost`,
  `Leader`, `LeaderSentiment`, `LeaderArticle`
- `add` Alembic migration `<ts>_add_multi_tenancy.py` — creates the 5 new tables; adds `tenant_id`
  columns (nullable → backfill to `default` tenant → set `NOT NULL`); creates indexes; enables RLS
  policies on every tenant-scoped table keyed on `current_setting('app.current_tenant_id')::int`
- `change` `services/pipeline/db/seed.py` — seed a `default` tenant; assign existing rows to it
- `change` `services/pipeline/ai_api/**` — LLM tasks load prompt content via
  `prompt_packs.get(tenant_id, key, active=true)` with fallback to `default`; pass `tenant_id`
  through to the cost ledger
- `change` `apps/web/middleware.ts` — resolve tenant from session; set Postgres GUC
  `app.current_tenant_id` on each request; enforce `platform_admin`-only routes
- `add` `apps/web/lib/tenant.ts` — `resolveTenant(session)`, `allowedWidgets(tenant)`,
  `resolveLayout(user, tenant)`
- `change` `apps/web/lib/authz.ts` — add `platform_admin` role tier above `admin`; tenant scoping
  on `requireRole`
- `change` `apps/web/app/api/v1/**` — every handler scoped by tenant_id (RLS is the safety net, not
  the only check)
- `add` `apps/web/app/admin/**` — platform-admin pages: tenant CRUD, feature flags, widget
  allowlist editor, per-tenant cost view
- `add` `apps/web/app/settings/**` — tenant-admin pages: layout JSON editor + preview, narration
  prompt editor, source/issue subscription toggles, tenant user management
- `add` `apps/web/components/widgets/registry.ts` — `{ widgetKey → () => dynamic import }`; render
  pipeline filters by `tenants.config_jsonb.allowed_widgets`
- `add` `apps/web/components/widgets/custom/<tenant-slug>/*` — bespoke widget folder per tenant
  (lazy-loaded, gated by allowlist)
- `add` `docs/runbooks/widgets/<slug>.md` — decision record per custom widget (CI check that
  every key under `custom/` has a matching runbook)
- `change` `packages/contracts/**` — add `Tenant`, `PromptPack`, `TenantLayout`, `WidgetKey` types
  and admin/settings payload shapes
- `change` `apps/web/lib/db/types.gen.ts` — re-generated via kysely-codegen after the migration

**Data-model / API changes:**
- **New tables (5):** `tenants(id, slug UNIQUE, name, status, config_jsonb, created_at)`,
  `tenant_sources(tenant_id, source_id, enabled, PK(tenant_id,source_id))`,
  `tenant_issues(tenant_id, issue_key, weight, PK(tenant_id,issue_key))`,
  `prompt_packs(id, tenant_id, key, version, content, active, updated_at, UNIQUE(tenant_id,key,version))`,
  `tenant_layouts(tenant_id PK, layout_jsonb, updated_at)`.
- **Columns added:** `tenant_id` on `users`, `audit_log`, `crisis_snapshots`, `city_metrics`,
  `keywords`, `predictions`, `insights`, `market_ticker`, `social_actors`, `actor_posts`, `leaders`,
  `leader_sentiment`, `leader_articles`, `ai_conversations`, `ai_messages`, `dashboard_layouts`.
- **Stay shared (no tenant_id):** `sources`, `articles`, `article_enrichment`, `cities`. Tenant
  views over them are joins through `tenant_sources` / `tenant_issues`.
- **Uniqueness shift:** `users.email` global UNIQUE → `(tenant_id, email)` UNIQUE.
- **Indexes:** every existing time-series index becomes `(tenant_id, captured_at DESC)`; add
  `tenant_id` btree on every newly tenant-scoped table.
- **RLS:** policy `tenant_id = current_setting('app.current_tenant_id')::int` on all tenant-scoped
  tables; bypass via dedicated `platform_admin` DB role for cross-tenant ops.
- **New API surfaces:** `/api/v1/admin/tenants/*` (platform_admin only), `/api/v1/settings/*`
  (tenant_admin within own tenant).

**Reuse:**
- P5 sessions and P6 role-checking pattern (add one tier; same enforcement story).
- A3 `dashboard_layouts` pattern extended with `tenant_layouts` as the layer beneath user layouts.
- U1 LLM provider abstraction — LiteLLM layer unchanged; only the prompt content swaps per tenant.
- W1/W4 ingestion stays single-pipeline; only the **rollup** (U4) gains a per-tenant fan-out.

**Risks:**
- **M1 — Cross-tenant data leak.** Bug in middleware/RLS could expose another tenant's rows.
  *Mitigation:* RLS at the DB layer (not just app code), integration tests asserting isolation for
  every API route, contract tests for the GUC setter, security review before launch.
- **M2 — Retrofit churn on existing tables.** 15+ tables get a NOT NULL column; A1 (Built) and
  P3/P5/P6 schema all need adjustment. *Mitigation:* two-step migration (nullable + backfill +
  NOT NULL); A1 gets a `/change-feature` bump in the same sprint.
- **M3 — Enrichment cost attribution drift.** Shared enrichment vs per-tenant billing can desync.
  *Mitigation:* subscribe-time-weighted amortization with monthly reconciliation; rule documented
  in `docs/runbooks/cost-attribution.md`.
- **M4 — `widgets/custom/` sprawl.** A junk drawer of one-off widgets becomes unmaintainable.
  *Mitigation:* CI check that every custom widget has a decision record; revisit a real plugin SDK
  when the count crosses ~10.
- **M5 — Narration drift between tenants and product canonical copy.** Prompts diverge silently.
  *Mitigation:* `default` tenant prompt pack is canonical; per-tenant overrides are diffed against
  `default` in the editor; every prompt change is versioned and auditable.
- **M6 — Platform admin too powerful.** A `platform_admin` can read every tenant's data.
  *Mitigation:* every cross-tenant read writes an `audit_log` row with `target = tenant:<id>`,
  reviewed weekly; admin actions require re-auth (step-up) for write operations on other tenants.

#### QA
| # | Maps to | Test case | Type |
|---|---|---|---|
| T1 | AC1 | platform_admin creates tenant → row, default layout, initial admin user present; re-run is idempotent | integration |
| T2 | AC2 | user from tenant A querying tenant B IDs returns empty; direct API access 403; RLS-bypass attempt fails even if middleware skipped | integration |
| T3 | AC3 | subscribe/unsubscribe sources → next rollup includes/excludes correctly; aggregates of unsubscribed sources invisible to that tenant | integration |
| T4 | AC4 | LLM call for tenant T uses T's active prompt; missing key falls back to `default`; version bump picked up on next call | integration |
| T5 | AC5 | layout entry with non-allowlisted widget is skipped + logged; allowed widgets render; custom widget without a decision record fails CI | unit + e2e + CI |
| T6 | AC6 | resolveLayout returns user > tenant > built-in in that order; missing layers fall through cleanly | unit |
| T7 | AC7 | platform_admin can CRUD tenants/toggle flags/edit allowlist/view cost; tenant_admin gets 403 on `/admin` but can edit own tenant settings; never sees another tenant | integration + e2e |
| T8 | AC8 | `ai_messages.tenant_id` populated; per-tenant cost report sums correctly; enrichment amortization splits as documented | integration |

**Governance edge cases:** all cross-tenant operations are `platform_admin`-only and audited;
RLS verified by a CI integration test; `tenant_admin` inherits `analyst` scope **within own
tenant only**, never across; tenant feature flags (`allowed_widgets`) are platform-curated (resolved
design decision); per-tenant per-day LLM budget enforced (throttle + alert on exceed); tenant
deletion is soft-delete with retention honored per P4/P7; secrets in `tenants.config_jsonb` are
referenced (not stored plaintext) and never reach the client.

#### Revision history
| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-05-26 | Initial plan — multi-tenancy retrofit; platform-curated widgets; Phase-1 JSON admin UI; visual layout builder explicitly out of scope |
