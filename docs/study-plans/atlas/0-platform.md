# Stage 0 — Platform

> Cross-cutting foundation: monorepo, infrastructure, database, storage, auth, RBAC, observability,
> hardening, launch. See `../README.md` for the SOP and `_index.md` for the register.

---

### P1. Monorepo foundation & tooling

- **Version:** 1.0 · **Stage:** 0-platform · **Sprint:** S1 · **Status:** Planned · **Spec ref:** §4–5, E1 · **Owner:** DevOps/Dev C

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

- **Version:** 1.0 · **Stage:** 0-platform · **Sprint:** S1–S2 · **Status:** Planned · **Spec ref:** §4, §9, E2 · **Owner:** Dev B + Dev A

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

- **Version:** 1.0 · **Stage:** 0-platform · **Sprint:** S2 · **Status:** Planned · **Spec ref:** §10, E3 · **Owner:** Dev A

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

- **Version:** 1.0 · **Stage:** 0-platform · **Sprint:** S2 · **Status:** Planned · **Spec ref:** §10, E3 · **Owner:** Dev A

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

### P8. Nexorus cross-app link (autologin: home + per-topic deep link)

- **Version:** 2.0 · **Stage:** 0-platform · **Sprint:** demo · **Status:** In progress
  · **Spec ref:** `docs/superpowers/specs/2026-06-14-nexorus-topic-deeplink-design.md`
  (client request, 2026-06-11; topic deep link 2026-06-14) · **Owner:** platform

#### PM
**Background (why):** The ATLAS dashboards are deliberately glanceable; when a demo user (the
boss's client, or an exec on the Danantara/BUMN boards) wants to dig deeper, the detail lives in
**Nexorus OpenGate** (`opengate.nexorus.io`) — a separate, already-live app with its own login.
Asking the user to log in again mid-demo kills the flow and hides the fact that the two products
are one platform. OpenGate exposes an autologin magic-link API
(`GET /autologin/autologin_generate?api_key=…` → `{ ok, login_url, expires_in }`); one click in
the ATLAS gear menu should land the user in OpenGate already signed in.

**v2.0 — per-topic deep link (2026-06-14):** the topics API now returns an `idQuery` per topic,
and Nexorus has a per-topic detail page at
`https://nexorus.garudaperkasa.io/dashboard_demo?id=monitoring&idquery=<idQuery>`. Landing on the
Nexorus *home* still requires the exec to find the same topic by hand. The autologin magic link
already lands the user on the right destination **based on `idquery`** (same mechanism as the
gear-menu home link; `api_key` stays server-side). So we extend the cross-app link with a
**"View in Nexorus"** deep link inside the ATLAS topic detail modal that carries the topic's
`idQuery` through the magic-link BFF, landing the user on **that topic** in Nexorus, signed in.
The gear-menu home item is unchanged (OpenGate == Nexorus dashboard home). `id=monitoring` is a
constant; only `idquery` varies per topic.

**Acceptance criteria (Given / When / Then):**
- **AC1** — *Given* a signed-in ATLAS user on any page (including the minimal-chrome executive
  dashboards and a `danantara`-scoped demo user), *When* they open the gear menu, *Then* a
  **"Nexorus Opengate"** item with an external-link icon is visible as a fixed entry at the bottom
  of the dropdown, below a divider.
- **AC2** — *Given* the gear menu is open, *When* the user clicks "Nexorus Opengate", *Then* a
  **new tab** opens that lands on the `login_url` returned by OpenGate's autologin API (user is
  signed in to OpenGate), and the ATLAS tab stays where it was.
- **AC3** — *Given* OpenGate is unreachable, times out, returns `ok: false`, or omits
  `login_url`, *When* the user clicks the item, *Then* the new tab is redirected to
  `https://opengate.nexorus.io` (normal login page) as a graceful fallback — never a raw error.
- **AC4** — *Given* any request/response visible to the browser, *Then* the OpenGate API key
  never appears in any URL, header, or body (it is used server-side only).
- **AC5** — *Given* a request to the autologin BFF route **without** a valid ATLAS session
  cookie, *When* it is hit directly, *Then* it redirects to `/login` and no OpenGate link is
  generated (the route must not be an anonymous OpenGate-session minter; middleware skips
  `/api`, so the route checks the cookie itself).
- **AC6** *(v2.0)* — *Given* a topic in the Danantara/BUMN detail modal whose feed payload
  carries an `idQuery`, *When* the user opens that topic's detail, *Then* a **"View in Nexorus"**
  item with an external-link icon is visible in the issue detail body.
- **AC7** *(v2.0)* — *Given* the topic detail is open, *When* the user clicks "View in Nexorus",
  *Then* a **new tab** opens that lands (signed in) on the Nexorus topic page
  (`dashboard_demo?id=monitoring&idquery=<idQuery>`), and the ATLAS tab stays where it was.
- **AC8** *(v2.0)* — *Given* a topic whose feed payload has **no** `idQuery`, *When* the user
  opens its detail, *Then* **no** "View in Nexorus" item renders (graceful degradation; older
  payloads keep working).
- **AC9** *(v2.0)* — *Given* the autologin BFF is called with an `idquery` param, *When* the
  upstream succeeds, *Then* the route forwards `idquery` to the magic-link call and 307s to the
  topic `login_url`; *When* `idquery` is missing, empty, or fails validation, *Then* the route
  behaves exactly as the home link (AC2/AC3). `idquery` is the **only** accepted client param and
  is strictly validated/encoded (no open-redirect or injection).

#### Architecture
**Impact — files add/change:**
- `add` `app/api/v1/opengate/autologin/route.ts` — GET BFF: checks `atlas_auth` cookie (AC5),
  server-side fetch of `${OPENGATE_AUTOLOGIN_BASE}?api_key=…` with a 5 s timeout, validates
  `ok === true` and a non-empty `login_url`, replies **307 → `login_url`**; any failure replies
  **307 → `https://opengate.nexorus.io`** (AC3). Marked `dynamic = "force-dynamic"`; never cached
  (each click mints a fresh link, so `expires_in` needs no client bookkeeping).
- `add` `app/api/v1/opengate/autologin/route.test.ts` — vitest unit tests (see QA).
- `change` `components/layout/AppShell.tsx` — fixed footer item in the gear `Dropdown`, rendered
  **outside** the grouped-nav loop (survives the `danantara` scope filter and the
  `minimalChrome` Dashboards-only filter): divider + `<a href="/api/v1/opengate/autologin"
  target="_blank" rel="noopener">` with an `ExternalLink` lucide icon, labelled "Nexorus Opengate".
- `change` `.env.example` — document `OPENGATE_AUTOLOGIN_BASE` (default
  `https://opengate.nexorus.io/autologin/autologin_generate`) and `OPENGATE_API_KEY`
  (falls back to `DANANTARA_TOPICS_API_KEY`, which is the key in use today).

**v2.0 — files add/change (per-topic deep link):**
- `change` `app/api/v1/opengate/autologin/route.ts` — accept an optional `idquery` query param,
  strictly validated (allowlisted charset, e.g. `^[A-Za-z0-9]+$`); when present and valid, forward
  it to the upstream `autologin_generate` call so the returned `login_url` lands on the topic
  (`dashboard_demo?id=monitoring&idquery=…`); when absent/empty/invalid, behave exactly as today
  (home). All existing guardrails kept (cookie gate, `force-dynamic`, 5 s timeout, home fallback).
- `change` `lib/danantara/ceo/topics-source.ts` — add `idQuery` to `UpstreamTopic`; map it through
  `toIssue` onto the `CeoIssue`.
- `change` `lib/danantara/ceo/types.ts` — add `idQuery?: string` to `CeoIssue`.
- `change` `components/danantara/ceo/DetailModal.tsx` — in the issue detail body, render a
  **"View in Nexorus"** `<a href="/api/v1/opengate/autologin?idquery=<encoded>" target="_blank"
  rel="noopener">` with an `ExternalLink` icon **only when** the issue has an `idQuery`.
- `change` `app/api/v1/opengate/autologin/route.test.ts`,
  `lib/danantara/ceo/topics-source.test.ts`, `components/danantara/ceo/DetailModal.test.tsx` —
  new vitest cases (see QA T6–T9).

**Data-model / API changes:** the BFF `GET /api/v1/opengate/autologin` now accepts one optional
client param `idquery` (307 redirect; still no JSON contract consumed by the UI). Upstream topics
payload gains an `idQuery` field per topic (read-only, passed through). No DB changes.

**Reuse:** server-side-key + env-config pattern from the Danantara topics BFF (A7 v31.0);
existing `Dropdown` and gear menu in `AppShell`; `atlas_auth` cookie convention from
`middleware.ts`/`lib/auth.ts`; v2.0 reuses the **same** P8 BFF route + the existing topics →
`CeoIssue` mapping pipeline (`topics-source.ts` → `DetailModal`).

**v2.0 — contract details to verify at build (both degrade to home if wrong):** (1) the real
upstream JSON key — client called it `idQuery`, the URL param is `idquery`; confirm against a live
`topics` payload before finalizing the mapping. (2) the autologin param name — assumed
`autologin_generate` accepts `idquery` directly; confirm against the live autologin response.

**Risks:** (1) magic links are short-lived/single-use → mitigated by generating a fresh link per
click, never prefetching; (2) upstream latency blocks the new tab on a blank page → 5 s abort +
fallback redirect; (3) the key is shared with the topics feed today → `OPENGATE_API_KEY` override
exists the day OpenGate issues its own key; (4) popup blockers → item is a real `<a>` so the
browser treats it as a user-gesture navigation, no `window.open` after `await`.

#### QA
| # | Maps to | Test case | Type |
|---|---|---|---|
| T1 | AC1 | gear menu renders a "Nexorus Opengate" anchor (`target="_blank"`, `rel="noopener"`, href `/api/v1/opengate/autologin`) below a divider; still present with `atlas_scope=danantara` and on a minimal-chrome path (`/danantara`) | component |
| T2 | AC2 | route: upstream 200 `{ok:true, login_url}` → 307 with `Location: login_url` | unit |
| T3 | AC3 | route: upstream network error · timeout · `ok:false` · missing `login_url` · non-200 → 307 with `Location: https://opengate.nexorus.io` | unit |
| T4 | AC4 | route responses (success + every failure mode) contain the API key in no header/body | unit |
| T5 | AC5 | route without `atlas_auth=1` cookie → 307 to `/login`; upstream is never called | unit |
| T6 | AC6/AC8 | DetailModal issue **with** `idQuery` renders a "View in Nexorus" anchor (`target="_blank"`, `rel="noopener"`, href `/api/v1/opengate/autologin?idquery=<encoded>`); issue **without** `idQuery` renders none | component |
| T7 | AC7/AC9 | route: `idquery` present + upstream 200 → 307 to the topic `login_url`, and `idquery` is forwarded to the upstream call | unit |
| T8 | AC9 | route: missing · empty · invalid-charset `idquery` → behaves as the home link (307 to `login_url`/home), `idquery` never reaches the redirect target unencoded (no open-redirect/injection) | unit |
| T9 | AC6/AC8 | mapping: upstream `idQuery` survives onto the `CeoIssue`; absent → `idQuery` undefined, no crash | unit |

**Governance edge cases:** key stays server-side and is never logged; route accepts **exactly one**
client param (`idquery`), strictly validated — still cannot be repointed as an open proxy or open
redirect; session-gated per AC5; degradation per AC3/AC9 is a redirect to the Nexorus/OpenGate home,
never a dead end; topics with no `idQuery` simply hide the deep link; no cost ledger impact (no LLM
call).

#### Revision history
| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-06-11 | Initial plan — gear-menu autologin deep link into OpenGate (client request) |
| 2.0 | 2026-06-14 | **MAJOR** — per-topic "View in Nexorus" deep link in the topic detail modal: topics API `idQuery` plumbed `UpstreamTopic`→`CeoIssue`→`DetailModal`; P8 BFF extended to forward a validated `idquery` so the magic link lands on the topic (`dashboard_demo?id=monitoring&idquery=…`); gear-menu home link unchanged. AC6–AC9 added; renamed "OpenGate cross-app link" → "Nexorus cross-app link" |
