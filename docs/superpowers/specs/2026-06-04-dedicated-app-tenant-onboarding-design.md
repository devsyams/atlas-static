# Dedicated-App Tenant Onboarding (Variant B) — Design Spec

**Date:** 2026-06-04
**Status:** Approved (design)
**Scope:** Nexorus ATLAS production platform — an alternative to the federated-widget
multitenancy of [Variant A](2026-06-03-multitenant-onboarding-architecture-design.md)

---

## 1. Overview

This is a **variant** of the multitenant onboarding architecture. Instead of one
runtime-configurable app loading federated widgets per tenant, **each tenant
dashboard is its own dedicated application** — a separately built and deployed
Next.js app — running on shared Kubernetes, isolated by namespace. When an app
needs persistence it connects to a **shared PostgreSQL instance** where data is
isolated **by schema per tenant**.

### When to choose this variant

Variant B fits when tenants are **highly bespoke** (each dashboard differs
materially), the team is **small**, and the tenant count is **modest** (roughly
≤ 15–20). It trades fleet-wide leverage for simplicity: there is no widget
registry, no model gateway, and no control-plane service to build or operate.

### Goals
- Each tenant runs an independent, separately-versioned application.
- Tenants are isolated by **Kubernetes namespace**.
- Apps that need a database connect to a **shared Postgres instance**, isolated by
  **schema per tenant** (`tenant_<slug>`), reached through a per-tenant scoped role.
- Onboarding is **declarative and auditable** via Git (GitOps), starting from a
  scaffold CLI.
- Code is reused at **build time** through a shared-package monorepo.

### Non-goals (out of scope)
- Runtime widget federation / a widget registry CDN (that is Variant A).
- A control-plane API/service or a `control` DB schema — Git is the control plane.
- A per-tenant model gateway — apps that use AI call a shared gateway if/when added.
- Migrating the `atlas-static` demo repo itself into the monorepo.

### Locked decisions

| Decision | Choice |
|---|---|
| App model | **One dedicated app per tenant**, one Docker image + Helm release each |
| Isolation | Kubernetes **namespace per tenant** |
| Database | **Shared Postgres instance**, **schema per tenant**, per-schema scoped role; **only provisioned when the app needs it** |
| Code reuse | **Monorepo + shared packages** (`packages/widgets`, `packages/ui`, `packages/bff-core`), Turbo build orchestration |
| Auth | **Central IdP (OIDC / Keycloak)**, one OIDC client + org per app; per-tenant SSO federation possible later |
| Onboarding | **Scaffold CLI + GitOps** — merge a PR; CI/CD reconciles infra declaratively |
| Tenant config authority | **Git** (`infra/tenants/<slug>.yaml`) is the source of truth |
| Widget/version upgrades | **Per-app, pinned, opt-in** — a tenant gets a change when its app is rebuilt |

---

## 2. System topology

Two planes in one cluster: a **thin platform plane** and many **dedicated tenant
apps**, separated by namespace, all able to reach one shared Postgres instance.

```
                         ┌───────────────────────────────────────────┐
  *.nexorus.io  ──────▶  │  INGRESS (wildcard TLS)                   │
  danantara.nexorus.io   │  routes by subdomain → tenant namespace   │
                         └───────────────┬───────────────────────────┘
                                         │
   ┌─────────────────────────┐  ┌────────┴──────────┐  ┌───────────────────────┐
   │ ns: platform (thin)     │  │ ns: tenant-danantara│ │ ns: tenant-pertamina  │
   │                         │  │                     │ │                       │
   │ • Central IdP (Keycloak)│  │ • danantara-app     │ │ • pertamina-app       │
   │ • CD controller (ArgoCD)│  │   (dedicated Next.js│ │   (dedicated Next.js  │
   │ • Monitoring / logs     │  │    app: UI + BFF)   │ │    app: UI + BFF)     │
   │                         │  │ • NetworkPolicy     │ │ • NetworkPolicy       │
   │                         │  │ • ResourceQuota     │ │ • ResourceQuota       │
   └─────────────────────────┘  └─────────┬───────────┘ └───────────┬───────────┘
                                          │ (only if app needs DB)  │
                                          ▼                         ▼
                         ┌───────────────────────────────────────────────────┐
                         │  Shared PostgreSQL instance                        │
                         │   ├── tenant_danantara   (danantara role: RW)      │
                         │   ├── tenant_pertamina   (pertamina role: RW)      │
                         │   └── shared (optional)  (all app roles: RO)       │
                         └───────────────────────────────────────────────────┘
```

**Key points:**
- **Platform namespace is thin:** central IdP, the CD controller, and observability.
  No widget registry, no control-plane API, no model gateway, no `control` schema.
- **Each tenant namespace runs exactly one dedicated app** (its own image), plus
  `NetworkPolicy` and `ResourceQuota`. The app bundles both its UI and its BFF.
- **Shared Postgres, schema-per-tenant:** an app that persists data connects with a
  role scoped to its own `tenant_<slug>` schema only. Apps that don't need a database
  get no schema, no role, and no credentials.
- **Optional `shared` schema:** if several apps consume the same market/reference
  data, it lives once in `shared` with read-only grants. Omitted entirely if unused.

### How this differs from Variant A

| Concern | Variant A (federated widgets) | Variant B (dedicated apps) |
|---|---|---|
| App | One configurable app, widgets loaded at runtime | One dedicated app per tenant |
| Widget reuse | Runtime federation via registry/CDN | Build-time via shared packages |
| Tenant config | `control` DB, rendered into namespace | Git manifest, reconciled by CD |
| Control plane | Onboarding API service | Git + CD controller |
| DB | Always per-tenant schema | Per-tenant schema **only if the app needs it** |
| Best for | Many tenants, mostly common widgets | Few, highly bespoke tenants |

---

## 3. Code plane — the monorepo

All tenant apps and shared code live in **one monorepo**, built with Turbo.

```
nexorus-tenants/
├── apps/
│   ├── _template/            # scaffold baseline for a new tenant app
│   ├── danantara/            # dedicated app — bespoke pages, widgets, branding
│   │   ├── app/              # Next.js routes + BFF (/api/v1/*)
│   │   ├── widgets/          # tenant-bespoke widgets (compiled only here)
│   │   └── Dockerfile        # → registry.nexorus.io/danantara-app
│   └── pertamina/
├── packages/
│   ├── widgets/              # shared widget library (build-time reuse)
│   ├── ui/                   # design system / theme tokens
│   └── bff-core/             # OIDC client, schema-scoped DB client, API helpers, RBAC
├── infra/
│   ├── chart/                # ONE parameterized Helm chart for every tenant app
│   └── tenants/              # <slug>.yaml — the tenant manifest (GitOps source of truth)
└── turbo.json                # build orchestration (only changed apps rebuild)
```

**Build-time reuse, pinned per app.** An app imports `@nexorus/widgets`,
`@nexorus/ui`, and `@nexorus/bff-core`. A shared improvement reaches a tenant only
when **that tenant's app is rebuilt and redeployed** — the same deliberate, opt-in
upgrade property Variant A gets from pinned widget versions, achieved here through
the dependency graph + per-app image tags.

**Bespoke code is physically isolated.** A tenant's custom widgets live inside its
own `apps/<slug>/widgets` folder; no other tenant's build ever compiles or ships
them. This is isolation at the build layer, before any runtime control even applies.

---

## 4. Tenant manifest (`infra/tenants/<slug>.yaml`)

Everything environment-specific about a tenant is one declarative, version-controlled
file. **Git is the source of truth** — there is no control-plane database.

```yaml
slug: danantara
displayName: Danantara Indonesia
subdomain: danantara                 # → danantara.nexorus.io
locale: id-ID
image:
  repository: registry.nexorus.io/danantara-app
  tag: "1.4.0"                       # pinned per tenant; bump to roll out a change
database:
  required: true                     # ← the "if the tenant requires DB access" flag
  schema: tenant_danantara
  sharedReadOnly: true               # also grant RO on the shared schema
identity:
  org: danantara                     # IdP org / realm
  client: danantara-app              # OIDC client id
resources:
  quota: standard                    # maps to a ResourceQuota/LimitRange preset
status: active                       # active | suspended
```

The CD controller reconciles this file into cluster state. Git history is the audit
trail; `git revert` is the rollback.

---

## 5. Data model

The dividing principle is the same as Variant A — **public facts are shared; a
tenant's lens on them is private** — but the structure is simpler because config
lives in Git, not the database.

| Schema | Exists when | Contents | Access |
|---|---|---|---|
| **`tenant_<slug>`** | `database.required: true` | All of that tenant's private, derived data (analytics, AI artifacts, audit, saved views) | **RW** by that tenant's role only; no cross-tenant grant |
| **`shared`** (optional) | Multiple apps need common data | Market/reference data (IDX, forex, commodities, entity master) | **RO** to tenant roles that opt in (`sharedReadOnly: true`); written only by central ingestion |
| ~~`control`~~ | — | **Not used.** Tenant config is in Git. | — |

**Provisioning is conditional.** When `database.required` is `false`, the onboarding
pipeline skips schema/role/secret creation entirely — the app runs stateless or
against its own external store. When `true`, a provisioning Job creates the schema,
creates a login role scoped to it (and a RO grant on `shared` if requested), and
writes the credentials into the tenant namespace as a Kubernetes Secret.

---

## 6. Onboarding pipeline (scaffold CLI + GitOps)

Onboarding has two phases: humans develop the app, then merging the PR drives all
infrastructure declaratively. There is **no orchestrator service** — CI/CD plus the
CD controller reconcile Git state into the cluster.

```
PHASE 1 — DEVELOP (engineers)
  1. SCAFFOLD   pnpm new-tenant pertamina --blueprint=soe --db
                  → apps/pertamina/            (copied from _template)
                  → infra/tenants/pertamina.yaml (subdomain, image, db flag, idp org, quota)
  2. CUSTOMIZE  branding, pages, bespoke widgets; pick shared widgets from packages/widgets
  3. PR         open pull request → review → merge to main

PHASE 2 — RECONCILE (automation, triggered by merge)
  4. CI BUILD   turbo build (only the changed app) → docker push pertamina-app:1.0.0
  5. CD RECONCILE infra/tenants/pertamina.yaml:
       a. NAMESPACE   create ns tenant-pertamina + ResourceQuota + NetworkPolicy + RBAC
       b. DATABASE    if database.required → Job: CREATE SCHEMA tenant_pertamina;
                      create scoped role (+ RO on shared if requested); creds → Secret
       c. IDENTITY    IdP: create org pertamina + register OIDC client; client secret → Secret
       d. DEPLOY      Helm release from infra/chart: app + Service + Ingress + TLS (cert-manager)
       e. SMOKE TEST  Job: app up? OIDC discovery ok? (if db) r/w own schema? ingress 200?
  6. LIVE       pertamina.nexorus.io serving; reconciliation status visible in CD UI
                (any step fails → CD reports degraded; fix forward or git revert)
```

Every reconcile step is **idempotent** — re-running converges to the same state, so a
failed sync is safe to retry after the cause is fixed.

### Blueprints

`--blueprint=<name>` selects which `_template` variant and which default
`packages/widgets` set the scaffold wires in (e.g. `soe` / `sovereign-wealth`
bundles reputation + portfolio + briefing widgets and the `--db` flag). Blueprints
are **curated**; per-tenant deviation happens by editing the scaffolded app, not by
forking the template.

### Day-2 operations
- **App update / shared-widget fix:** rebuild that tenant's app, bump `image.tag` in
  its yaml, merge → CD rolls it out. Each tenant adopts on its own schedule.
- **Config change** (quota, enable shared RO, SSO): edit the yaml, merge.
- **Suspend:** set `status: suspended` → CD scales the deployment to zero, keeps data.
- **Offboard:** delete the app folder + the yaml; a Job archives then drops the schema;
  Git history retains the full audit trail.

---

## 7. Auth & isolation

### Auth flow
Central Keycloak in the platform namespace; **each app is its own OIDC client in its
own org**. A user hits `pertamina.nexorus.io` → the app redirects to the IdP → the IdP
authenticates against the `pertamina` org → returns a token carrying `{ org, role }`.
The app's BFF (logic from `packages/bff-core`) validates the token, **asserts the
`org` claim matches the app's expected org** (the subdomain is never trusted on its
own), enforces RBAC per route, and — if the app uses a database — connects with its
schema-scoped Postgres role. Per-tenant enterprise SSO federates in later as an
alternate connection on that org, with no app code change.

### Isolation — defense in depth
1. **Build:** bespoke tenant code is in separate app folders; other apps never compile it.
2. **Network:** `NetworkPolicy` allows egress only to the IdP, the shared Postgres, and
   required platform endpoints; cross-tenant namespace traffic denied.
3. **Database:** per-schema login role; RW on own `tenant_<slug>` only, optional RO on
   `shared`, **no grant** to any other tenant schema.
4. **Identity:** org-scoped tokens; BFF rejects a token whose `org` ≠ the app's org.
5. **Secrets:** DB creds and OIDC client secret live only in the tenant namespace.
6. **Quotas:** `ResourceQuota`/`LimitRange` per namespace contain noisy neighbors.

### Graceful degradation
Shared data stale/down → app serves cached last-known; an app that uses AI falls back
to a deterministic scripted path (as the demo's `lib/ai/scripted.ts` already does).

---

## 8. Testing strategy

- **vitest** on shared packages (`widgets`, `ui`, `bff-core` — OIDC validation, RBAC,
  schema-scoped DB client) plus per-app tests. Turbo runs only the **affected**
  projects on each change.
- **Onboarding smoke-test Job** (pipeline step 5e) runs on every provision and is the
  gate before a tenant is considered live.
- **Cross-tenant isolation suite:** NetworkPolicy egress, cross-schema query attempts,
  and `org`-mismatch tokens must all **fail closed**.
- **Conditional-DB tests:** a `database.required: false` tenant must provision with no
  schema, role, or DB secret created.

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| **Fan-out maintenance** — a shared fix needs N app rebuilds/redeploys | Turbo affected-only builds; pinned per-app tags make rollout deliberate; revisit Variant A when tenant count grows |
| **Drift between apps** as they diverge | Keep logic in `packages/*`; `_template` stays current; periodic "sync" PRs to bump shared deps |
| Provisioning partial failure | Every CD reconcile step idempotent; CD reports degraded; fix-forward or `git revert` |
| Shared Postgres as a single point of contention | Connection limits + quotas per role; "dedicated tier" = move a hot tenant to its own instance (config-only change to its yaml) |
| Image sprawl in the registry | Retention policy on tenant image tags; one chart, not one chart per tenant |

---

## 10. Relationship to Variant A & migration path

Variant B is the **lower-investment starting point** and a natural **stepping stone**:
- Start here while tenants are few and bespoke — no platform services to build.
- `packages/widgets` is the seed of Variant A's widget registry; `infra/tenants/*.yaml`
  maps directly onto Variant A's tenant manifest; the central IdP and schema-per-tenant
  model are **identical** across both variants.
- When tenant count and widget commonality justify it, promote the shared widget library
  into a federated registry and the Git manifests into a control-plane DB — i.e. migrate
  to Variant A without rethinking auth or data isolation.

---

## 11. Implementation decomposition (next step)

Separate spec → plan → build cycles, in dependency order:

1. **`monorepo-foundation`** — Turbo monorepo, `packages/{ui,widgets,bff-core}`,
   `_template` app, `new-tenant` scaffold CLI.
2. **`tenant-helm-chart`** — one parameterized chart + the `infra/tenants/<slug>.yaml`
   schema; namespace, quota, NetworkPolicy, ingress/TLS.
3. **`db-provisioning`** — conditional schema/role/secret provisioning Job + the
   schema-scoped DB client in `bff-core`.
4. **`gitops-cd`** — CD wiring (CI build → image; controller reconciles tenant yamls)
   + the smoke-test Job + isolation test suite.

---

## Revision history

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-06-04 | Initial approved design (Variant B — dedicated apps per tenant) |
