# Multitenant Architecture & Tenant Onboarding — Design Spec

**Date:** 2026-06-03 (designed 2026-06-01, approved 2026-06-03)
**Status:** Approved (design)
**Scope:** Nexorus ATLAS production platform (this repo, `atlas-static`, is the single-tenant demo the design generalizes from)

---

## 1. Overview

Nexorus ATLAS becomes a **multitenant product**: each tenant (e.g. Danantara)
gets its own ATLAS dashboard at its own subdomain. Dashboards are composed of
widgets — **common** widgets shared across tenants (same widget, different
data) and **custom** widgets built for a single tenant.

The platform runs on **Kubernetes**. Tenant isolation = each tenant's pods run
in their **own namespace**. Onboarding a new tenant must be an automated,
repeatable control-plane operation — not a manual deployment.

### Goals
- A **widget registry** so widgets are published once and composed per tenant.
- A **tenant manifest** that declaratively describes everything about a tenant.
- A deterministic, idempotent **onboarding pipeline** that provisions a new
  tenant end-to-end (namespace → schema → identity → routing → deploy → smoke
  test → activate).
- **Defense-in-depth isolation** so no tenant can ever see another tenant's
  data, widgets, or config.

### Non-goals (out of scope)
- Migrating this static demo repo itself to the multitenant architecture
  (this spec is the production target; implementation is decomposed separately).
- Per-tenant SSO federation at launch (designed for, added later).
- Billing/metering beyond per-tenant LLM cost logging.

### Locked decisions

| Decision | Choice |
|---|---|
| Onboarding trigger | Automated internal pipeline (control-plane action by ops admin) |
| Data layout | Schema-per-tenant + a `shared` schema, in **one shared Postgres cluster** with per-schema roles. DB-per-tenant reserved as the "dedicated tier" upgrade. |
| Widget delivery | Federated/pluggable remotes, runtime-loaded from a registry (**Module Federation**) |
| Widget upgrades | **Pinned versions, opt-in upgrades** (never forced) |
| Routing | Subdomain per tenant → ingress → tenant namespace |
| Auth | **Central IdP (OIDC)** now; per-tenant SSO federation later |
| Topology | **Hybrid / tiered** (Approach C): tenant data & compute in-namespace, genuinely-shared infra central |
| Tenant config authority | **Control-plane DB is the source of truth**; manifests are materialized into namespaces |
| News/social corpus | **Shared raw corpus, derive per-tenant** analytics |
| Blueprints | **Curated blueprints with overrides** (e.g. `sovereign-wealth`) |

---

## 2. System topology

Two planes in one cluster: a **platform (control) plane** and many **tenant
data planes**, separated by namespace.

```
                         ┌───────────────────────────────────────────┐
  *.nexorus.io  ──────▶  │  INGRESS (wildcard TLS)                   │
  danantara.nexorus.io   │  routes by subdomain → tenant namespace   │
                         └───────────────┬───────────────────────────┘
                                         │
        ┌────────────────────────────────┼─────────────────────────────┐
        ▼                                                              ▼
┌───────────────────────────┐                          ┌───────────────────────────┐
│ ns: platform (shared)     │                          │ ns: tenant-danantara      │
│                           │                          │                           │
│ • Control Plane API       │  provisions / configures │ • Atlas app-shell (Next)  │
│   (onboarding orchestrator)│ ───────────────────────▶ │ • BFF  /api/v1/*          │
│ • Tenant Registry DB      │                          │ • AI workers (tenant)     │
│ • Widget Registry +       │  serves remote bundles   │ • Tenant DB schema        │
│   Remote-bundle CDN       │ ◀────────loads widgets── │   (in shared PG cluster)  │
│ • Market-data ingestion   │  shared schema (RO)      │                           │
│   → shared PG schema      │ ◀──────────────────────── │ reads shared market data  │
│ • Central IdP             │  authn (OIDC)            │ validates tokens          │
│ • Model Gateway (LiteLLM) │ ◀────all LLM calls + cost│ AI workers call gateway   │
└───────────────────────────┘                          └───────────────────────────┘
                                                       (repeat per tenant namespace)
```

**Key points:**
- **One Postgres cluster, many schemas:** `control` + `shared` + `tenant_<slug>`
  per tenant (see §5). A tenant's BFF connects with a role scoped to *its*
  schema + read-only on `shared`.
- **Per-tenant namespace** holds only things that touch tenant data: app-shell,
  BFF, AI workers, plus `ResourceQuota`/`NetworkPolicy`. NetworkPolicy denies
  cross-tenant traffic; tenants may only reach the platform namespace's shared
  endpoints.
- **Platform namespace** holds the control plane + four shared services:
  widget registry/CDN, market-data ingestion, central IdP, model gateway
  (LiteLLM, per-tenant cost logging).
- A **"dedicated tier"** flag lets the most sensitive tenants pull shared
  components (incl. their own Postgres instance) into their namespace.

### Topology rationale (Approach C — hybrid/tiered)

Rejected alternatives:
- **A — Thin tenant / fat platform:** cheapest/most DRY, but shared services
  become a cross-tenant blast radius; tenant data crosses the namespace
  boundary — a harder compliance story for sovereign clients.
- **B — Fat tenant / thin platform:** maximal isolation, but market data gets
  fetched N×, AI infra duplicated per tenant, much higher cost.

C honors the isolation intent of namespace-per-tenant where it matters (tenant
data, AI, queries) while keeping genuinely-shared, non-sensitive infrastructure
(market feeds, widget catalog, identity) central so onboarding stays cheap and
fast.

---

## 3. Widget registry & federation

Three concepts: a **widget package**, the **registry**, and **runtime loading**.

### 3.1 Widget package (the unit of reuse)

Each widget is built and published independently as a federated remote module,
shipping a **manifest** describing its contract:

```jsonc
{
  "id": "reputation-index",
  "version": "2.3.0",
  "title": "Reputation & Trust Index",
  "scope": "common",                 // "common" | "custom"
  "remote": "https://cdn.nexorus.io/widgets/reputation-index/2.3.0/remoteEntry.js",
  "exposedModule": "./Widget",
  "dataContract": {                  // what the BFF must provide
    "endpoint": "/api/v1/widgets/reputation-index",
    "inputs": ["entityScope", "window"],
    "schemaRef": "reputation-index@2"
  },
  "defaultLayout": { "w": 4, "h": 5, "minW": 3, "minH": 4 },
  "entitlement": "media-intelligence" // feature/plan gate
}
```

### 3.2 The registry (shared, platform namespace)

A `shared.widget_registry` table + the CDN hosting built bundles. Holds every
published widget version. Two visibility classes:
- **`common`** widgets — available to any tenant (Reputation Index, Portfolio
  Value Map, Impact Simulator…).
- **`custom`** widgets — pinned to one `tenant_id`; the registry **refuses to
  serve them to any other tenant** (enforced at the bundle-serving layer, not
  just UI).

### 3.3 Runtime loading

The tenant's app-shell reads its **tenant manifest** (§4) → gets the list of
`{widgetId, version, layout, dataBinding}` → dynamically imports each
`remoteEntry.js` from the CDN → renders it into the `react-grid-layout` cell.

The widget receives a small, stable **host SDK** (props): its resolved data
endpoint, tenant theme tokens, locale, and an auth-scoped fetch. The widget
never knows about other tenants — it only gets its bound endpoint.

### Why this shape
- A new **common** widget = publish one version → appears in the catalog for
  everyone, opt-in per tenant. No tenant redeploys.
- A new **custom** widget for tenant X = publish a remote scoped to X → only X
  can load it. Core app untouched.
- **Versioning is explicit:** a tenant pins `reputation-index@2.3.0`; upgrades
  are deliberate, not forced.

> **Risk (carried to §9):** Module Federation has known friction with the
> Next.js App Router/Turbopack. A **federation spike** must confirm the shell
> bundler before committing implementation code.

---

## 4. Tenant configuration model

Everything about a tenant lives in **one declarative record** — the **tenant
manifest** — owned by the control plane and rendered into the data plane. It is
the contract the onboarding pipeline writes and the app-shell reads.

```jsonc
{
  "slug": "danantara",
  "displayName": "Danantara Indonesia",
  "status": "active",                  // provisioning | active | suspended
  "tier": "standard",                  // standard | dedicated
  "routing": { "subdomain": "danantara", "customDomain": null },
  "locale": "id-ID",
  "branding": {
    "logo": "cdn://tenants/danantara/logo.png",
    "title": "Pusat Komando Aset Negara — Danantara Indonesia",
    "themeTokens": { "accent": "oklch(...)" }
  },
  "identity": {
    "idp": "central",                  // central | sso
    "sso": null                        // { type: "oidc", issuer, clientId... } when federated
  },
  "entitlements": ["media-intelligence", "portfolio-markets", "briefing"],
  "dataSources": [                     // drives the data-sources panel + connectors
    { "id": "idx", "mode": "live" },
    { "id": "forex", "mode": "live" },
    { "id": "x-social", "mode": "demo" }
  ],
  "entityScope": ["DANANTARA", "PERTAMINA", "PLN", "GIAA"],   // tenant watchlist
  "dashboard": {
    "layout": [
      { "widgetId": "reputation-index", "version": "2.3.0",
        "grid": { "x": 0, "y": 0, "w": 4, "h": 5 },
        "dataBinding": { "entityScope": "$tenant.entityScope", "window": "14d" } },
      { "widgetId": "portfolio-value-map", "version": "1.8.0", "grid": {} },
      { "widgetId": "danantara-soe-treemap", "version": "1.0.0", "grid": {} }  // custom
    ]
  }
}
```

**Normalized in the control schema (not one blob):**
- `control.tenants` — identity, routing, tier, status, branding, locale, entitlements.
- `control.tenant_widgets` — one row per placed widget:
  `(tenant_id, widget_id, version, grid, data_binding)`. The join between a
  tenant and the widget registry; what "arrange layout" edits.
- `control.tenant_data_sources` — connector config + mode per tenant.
- `tenant_<slug>.*` — the tenant's actual data (§5).

**What this model gives us:**
1. **Onboarding is "create a manifest + reconcile it"** — the whole tenant is
   data, so provisioning is deterministic and repeatable (§6).
2. **Common vs custom is just a registry reference** — common and custom
   widgets sit in the same `layout` array; the registry enforces who may load
   which.
3. **Layout edits are writes to `tenant_widgets`** — the drag/resize grid
   persists per tenant, scoped by the BFF.

---

## 5. Data model (shared vs tenant)

The single Postgres cluster splits into **three schema classes**, each with its
own role grants:

| Schema | Contents | Who can read/write |
|---|---|---|
| **`control`** | `tenants`, `tenant_widgets`, `tenant_data_sources`, `entitlements`, platform `audit_log` | **Control-plane API only.** Tenants never query this directly — their resolved manifest is delivered into the namespace (ConfigMap + a config endpoint), so no tenant can see another's row. |
| **`shared`** | Market/reference data: **IDX prices, forex, commodities, macro indicators**; **reference entity master** (ticker→name→sector); the **widget registry catalog**; the **raw public news/social corpus** | **Read-only** to every tenant BFF role. Written only by central market-data ingestion + the registry publisher. |
| **`tenant_<slug>`** | All **derived, tenant-private** data (below) | **Read/write only** by that tenant's BFF role. No cross-tenant grant exists. |

**What lands in each tenant's private schema** (that tenant's *interpretation
of the world*):
- **Media-intelligence analytics:** reputation/trust index history, sentiment
  timeseries, share-of-voice, narrative/issue radar, crisis early-warning
  alerts, leadership sentiment, actor/influencer map — all scoped to *their*
  entity watchlist and framing.
- **Portfolio analytics:** holdings/NAV history, resilience index, sector
  allocation, capital-allocation suggestions, stress-test runs.
- **AI artifacts:** generated briefings, copilot chat history, impact-simulator
  runs, forecasts.
- **Tenant audit log:** who viewed/approved/changed what, in this workspace.

**Dividing principle:** *facts about the public world are shared; a tenant's
lens on those facts is private.* IDX closed at one price for everyone (shared);
"what that move does to Danantara's NAV and reputation" is Danantara's alone
(tenant). The reference entity master is shared; a tenant's **watchlist**
(which entities they track) is config in `control`, and their **analytics on
them** live in their schema.

**Corpus decision:** raw public news/social documents are ingested **once**
into `shared`; each tenant's pipeline **derives** its private analytics
(sentiment, narratives, alerts) from that shared corpus into its own schema.

---

## 6. Onboarding pipeline

Onboarding is the **control-plane API orchestrating a deterministic,
idempotent sequence**, triggered by an ops admin (UI or CLI) who supplies just:
`slug`, `displayName`, `tier`, `locale`, a **blueprint**, and branding/entity
overrides. Everything else is derived.

```
ops: "onboard danantara, blueprint=sovereign-wealth, locale=id-ID"
        │
        ▼  Control-Plane API runs the provisioning workflow:
 1. RECORD     control.tenants ← status=provisioning (validate slug + subdomain free)
 2. NAMESPACE  create ns tenant-danantara + ResourceQuota + NetworkPolicy + RBAC
 3. DATA       create schema tenant_danantara; run Alembic migrations;
               create scoped DB role + creds → K8s Secret
 4. IDENTITY   central IdP: create tenant org, seed admin user, roles (admin/analyst/viewer)
 5. ROUTING    ingress danantara.nexorus.io → tenant svc; cert via cert-manager
 6. CONFIG     materialize manifest from BLUEPRINT (widgets, layout, entitlements,
               data sources, watchlist) + apply overrides → control.tenant_widgets etc.
 7. DEPLOY     Helm release: app-shell + BFF + AI workers into ns,
               inject ConfigMap(manifest) + Secret(db, idp client)
 8. WIDGETS    resolve blueprint widget set vs registry; scope any custom widgets to tenant_id
 9. SMOKE TEST health gate: BFF up? reads shared? r/w tenant schema? widgets load? auth works?
10. ACTIVATE   status=active → live; emit audit event; notify ops
        │
        ▼  (any step fails → status=provisioning_failed, retry or teardown; every step idempotent)
```

### Blueprints (what makes "common widgets" real)

A **blueprint** is a named, curated starting template — e.g.
**`sovereign-wealth`** bundles Reputation Index + Portfolio Value Map + Impact
Simulator + Crisis Early-Warning + Briefing in a default layout, with
IDX/forex/commodity sources wired. Onboarding a new SWF tenant = pick that
blueprint, override logo/name/watchlist, go. Custom widgets get added to that
tenant's manifest afterward (or baked into a bespoke blueprint).

Blueprints are **curated with overrides**: a small set of maintained templates;
per-tenant deviation happens through manifest overrides, not blueprint forks.

### Day-2 operations

Reuse the same machinery: adding a widget, changing entitlements, enabling SSO,
or upgrading a pinned widget version are all **manifest edits the control plane
reconciles** — same path as onboarding, just incremental.

**Suspend/offboard** = reverse the sequence: disable ingress → scale down →
archive/drop schema → retain audit.

---

## 7. Auth, routing & isolation guardrails

### Auth flow (replaces the demo cookie auth)

- User hits `danantara.nexorus.io` → app-shell redirects to **central IdP**
  (OIDC) → IdP authenticates against the tenant org → issues a token carrying a
  **`tenant` claim + role** (`admin`/`analyst`/`viewer`).
- The **BFF validates the token on every request**, asserts the `tenant` claim
  matches the subdomain's namespace, enforces RBAC per route, and connects to
  Postgres with that tenant's scoped role. The subdomain is *never* trusted on
  its own — **the token is the authority**.
- Per-tenant SSO (OIDC/SAML) federates in later as an alternate IdP connection
  on the same tenant org — no app changes.

### Isolation — defense in depth (every layer assumes the one above can fail)

1. **Network:** `NetworkPolicy` lets a tenant namespace egress only to platform
   shared endpoints + the DB; cross-tenant traffic denied.
2. **Database:** per-schema role; BFF role has RW on `tenant_<slug>`, RO on
   `shared`, **no grant** to `control` or other tenant schemas.
3. **Widget registry:** serving a `custom` bundle checks the requester's tenant
   — tenant B cannot fetch tenant A's remote (authz at the CDN/registry edge,
   not just UI).
4. **Secrets:** DB creds, IdP client secrets live only in the tenant namespace.
5. **Model gateway:** every LLM call tagged with `tenant_id`, cost-logged, and
   budget-capped per tenant.
6. **Quotas:** `ResourceQuota`/`LimitRange` per namespace stop noisy neighbors.
7. **Audit:** sensitive actions (auth, approvals, config/source changes) append
   to the tenant audit log.

### Graceful degradation

- Shared market data stale/down → serve cached last-known.
- A widget remote fails to load → host SDK renders a fallback tile; the rest of
  the dashboard survives.
- AI gateway down → deterministic scripted fallback (the repo already has
  `lib/ai/scripted.ts`).

---

## 8. Testing strategy

- **vitest** (TS): BFF routes, host SDK, manifest resolution, RBAC enforcement.
- **pytest** (Python): connectors, ingestion, provisioning steps.
- **Cross-tenant isolation suite:** every illegal access attempt (cross-schema
  query, cross-tenant bundle fetch, mismatched token/subdomain) must fail
  closed.
- **Onboarding e2e:** provision a throwaway tenant in CI, smoke-test it, tear
  it down.

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| **Module Federation friction** with Next.js App Router/Turbopack (this repo's `AGENTS.md` warns this Next.js diverges from defaults) | **Federation spike first** — confirm the shell bundler can host MF remotes before any widget-registry implementation |
| Shared services as cross-tenant blast radius | Hybrid topology keeps tenant data/compute in-namespace; dedicated tier escape hatch |
| Provisioning partial failures | Every pipeline step idempotent; `provisioning_failed` status + retry/teardown |
| Noisy-neighbor tenants | ResourceQuota/LimitRange per namespace; per-tenant LLM budget caps |
| Sovereign-client compliance demands | Dedicated tier: own Postgres instance + shared components pulled in-namespace |

---

## 10. Implementation decomposition (next step)

This architecture is too large for one plan. Decompose into separate
spec → plan → build cycles, in dependency order:

1. **`widget-federation`** — the MF spike + host SDK + registry serving
   (unblocks everything widget-related; highest technical risk).
2. **`tenant-control-plane`** — control schema, tenant manifest CRUD, blueprint
   model.
3. **`data-schema-migrations`** — `control`/`shared`/`tenant_<slug>` Alembic
   structure + role grants.
4. **`onboarding-automation`** — the 10-step pipeline + smoke tests + day-2
   reconciliation.

---

## Revision history

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-06-03 | Initial approved design (brainstormed 2026-06-01) |
