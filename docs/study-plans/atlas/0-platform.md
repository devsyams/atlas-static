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
