# Atlas-Static — Pooled Multi-Tenant Architecture

> **Status:** Draft for brainstorming · **Owner:** TBD · **Date:** 2026-07-28

## 1. Goal

Serve many tenants (organizations) from a **single shared application deployment and a single shared database** ("pooled" model), while giving each tenant an isolated view of their own dashboards and widgets. Reduce per-tenant operational overhead versus silo/one-DB-per-tenant, without sacrificing data isolation or the ability to ship tenant-specific dashboards.

**Success looks like:**
- One deploy, one DB, N tenants.
- A tenant can never read or write another tenant's data — enforced at the database layer, not just app code.
- New tenants are onboarded via config/seed, not code changes.
- Tenants can customize dashboards and have those changes persisted per-tenant.

## 2. Assumptions

| # | Assumption | Notes / risk if wrong |
|---|------------|------------------------|
| A1 | Postgres (or Postgres-compatible) is the primary store | RLS design below assumes PG; revisit if not |
| A2 | "atlas-static" serves largely static/prebuilt dashboards with some per-tenant customization | Drives the "template vs. instance" split |
| A3 | Tenant count is moderate-to-high (10s–1000s), data volume per tenant modest | If a whale tenant dominates, consider hybrid silo |
| A4 | Auth is handled by an IdP / JWT (OIDC) we can trust for tenant claims | Tenant resolution depends on a trustworthy claim |
| A5 | Widgets render from a defined catalog of widget types | New widget types = code; instances = data |
| A6 | Compliance does not (yet) require physical data separation | If it does, pooled model may need carve-outs |

## 3. Target Architecture

```
        ┌─────────────┐
Tenant →│  Edge / LB  │  (host or path routing, optional)
        └──────┬──────┘
               │
        ┌──────▼───────────────────────┐
        │  atlas-static app (shared)    │
        │  - resolve tenant             │
        │  - set session tenant context │
        │  - authz / RBAC               │
        └──────┬───────────────────────┘
               │  every query carries tenant_id
        ┌──────▼───────────────────────┐
        │  Postgres (shared, pooled)    │
        │  - RLS on every tenant table  │
        │  - app_current_tenant() GUC   │
        └───────────────────────────────┘
```

**Core principles:**
- **Single schema, `tenant_id` everywhere.** Every tenant-owned row carries `tenant_id`.
- **Defense in depth:** app-level scoping *and* database RLS. RLS is the backstop that survives app bugs.
- **Template + instance model:** shared dashboard *templates* (system-owned) instantiated into per-tenant *dashboards* on demand.
- **Connection pooling** with a per-request session variable that scopes all queries.

## 4. Tenant Resolution & Auth Flow

**Resolution strategies (pick one primary, allow fallback):**

| Strategy | Example | Pros | Cons |
|----------|---------|------|------|
| Subdomain | `acme.atlas.io` | Clean, cacheable | Cert/DNS mgmt |
| Path prefix | `atlas.io/t/acme` | Simple routing | Uglier URLs |
| JWT claim | `tenant_id` in token | Auth-native, no routing | Requires trusted IdP |

**Recommended:** JWT claim as source of truth, subdomain/path as UX convenience that must **match** the token claim (reject mismatches).

**Request flow:**
1. Request arrives with bearer token (OIDC/JWT).
2. Validate token signature + expiry.
3. Extract `tenant_id` (and `user_id`, `roles`) from verified claims.
4. Cross-check against routing hint (subdomain/path); reject on mismatch.
5. Open/borrow a pooled DB connection; set session context:
   ```sql
   SET LOCAL app.current_tenant = '<tenant_id>';
   SET LOCAL app.current_role   = '<role>';
   ```
   (Use `SET LOCAL` inside a transaction so pooled connections don't leak context.)
6. RLS policies read `current_setting('app.current_tenant')` to scope every query.
7. App-layer authz (RBAC) applies on top for feature/action permissions.

## 5. How Dashboards & Widgets Are Stored

Two conceptual layers:

- **Templates (system-owned):** canonical dashboard definitions and widget-type catalog. `tenant_id IS NULL` (global) — read-only to tenants.
- **Instances (tenant-owned):** a tenant's actual dashboards + placed widgets + their config/layout. Always carry `tenant_id`.

**Layout & config** stored as structured JSONB (grid position, size, widget settings), keeping the schema stable while widget configs evolve. Widget *behavior* comes from the widget-type in code; widget *instance state* lives in the DB.

```
dashboard_template ──(instantiated)──► dashboard (tenant)
widget_type (catalog) ──(placed as)──► widget_instance (tenant, on a dashboard)
```

## 6. Creating New Tenant Dashboards

Two paths:

1. **Onboarding seed (default set):** when a tenant is provisioned, copy the "default" dashboard templates into `dashboard` + `widget_instance` rows scoped to the new `tenant_id`. Gives every tenant a working starting point.
2. **On-demand from template:** tenant user picks a template → app clones template definition into a new tenant-owned `dashboard` (+ widget instances), then it's theirs to edit.

**Design choice to decide:** *copy-on-create* (snapshot template at creation — stable, no drift) vs. *reference template* (live-linked, inherits template updates but harder to customize). Recommend **copy-on-create** for atlas-static's customization goals, with an optional "template version" pointer for future upgrade prompts.

## 7. How Custom Dashboards Are Persisted

- User edits (add/remove/move widget, change settings, rename) → writes to tenant-owned `dashboard` / `widget_instance` rows.
- **Layout** persisted as JSONB per dashboard (or per-widget position columns — see open questions).
- **Autosave vs. explicit save:** decide; autosave needs debouncing + optimistic concurrency (`version`/`updated_at` check) to avoid lost updates across a tenant's users.
- **Soft delete** (`deleted_at`) so tenants can recover accidentally removed dashboards.
- All writes automatically scoped by RLS → impossible to persist into another tenant.

## 8. Recommended DB Tables

| Table | Key columns | Scope | Purpose |
|-------|-------------|-------|---------|
| `tenant` | `id`, `slug`, `name`, `status`, `created_at` | global | Tenant registry |
| `app_user` | `id`, `tenant_id`, `email`, `external_id`, `roles` | tenant | Users (or map from IdP) |
| `widget_type` | `id`, `key`, `version`, `schema`, `defaults` | global | Widget catalog (code-backed) |
| `dashboard_template` | `id`, `key`, `name`, `definition (jsonb)`, `is_default` | global | Shared templates |
| `dashboard` | `id`, `tenant_id`, `name`, `template_key`, `template_version`, `layout (jsonb)`, `version`, `updated_at`, `deleted_at` | tenant | Tenant dashboards |
| `widget_instance` | `id`, `tenant_id`, `dashboard_id`, `widget_type_key`, `config (jsonb)`, `position (jsonb)` | tenant | Placed widgets |
| `tenant_settings` | `tenant_id`, `key`, `value (jsonb)` | tenant | Per-tenant config/branding |
| `audit_log` | `id`, `tenant_id`, `actor`, `action`, `entity`, `at` | tenant | Change/access trail |

**Conventions:**
- Every tenant table: `tenant_id` NOT NULL + FK to `tenant(id)`, indexed, and part of composite indexes (`(tenant_id, id)`, `(tenant_id, dashboard_id)`).
- Global/template tables have no `tenant_id` (or `NULL`), exposed read-only.

## 9. RLS / Security Model

**Enable RLS on every tenant-owned table** and define policies keyed off the session GUC.

```sql
ALTER TABLE dashboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON dashboard
  USING     (tenant_id = current_setting('app.current_tenant')::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
```

**Model rules:**
- App connects as a **non-superuser, non-owner** role so `FORCE ROW LEVEL SECURITY` and policies always apply (owners/superusers bypass RLS).
- `USING` guards reads; `WITH CHECK` guards writes → can't insert/move rows into another tenant.
- Template/global tables: separate policy or plain `GRANT SELECT` (read-only, no tenant scoping).
- Set context with `SET LOCAL` inside the request transaction; **never** rely on connection-level state with a shared pool.
- Migrations/admin jobs use a separate elevated role, explicitly and audibly.
- App-layer RBAC (roles/permissions) is *additive* — RLS handles tenant isolation, RBAC handles what a user can do within a tenant.

**Threats addressed:** app query missing a `WHERE tenant_id` clause, IDOR via guessed IDs, pooled-connection context leakage (mitigated by `SET LOCAL`).

## 10. Operational Concerns

| Area | Consideration |
|------|---------------|
| Connection pooling | Transaction-scoped `SET LOCAL`; if using PgBouncer, prefer transaction pooling and verify GUC behavior |
| Noisy neighbor | Per-tenant rate limits / query budgets; watch whale tenants |
| Migrations | Single schema → one migration for all tenants; must be backward-compatible (expand/contract) |
| Backups & restore | Shared backup; per-tenant restore needs logical export by `tenant_id` |
| Tenant offboarding | Hard-delete or export by `tenant_id`; document retention |
| Observability | Tag metrics/logs/traces with `tenant_id`; per-tenant dashboards for support |
| Data export/GDPR | "Give me my data" / "delete my data" queries keyed by `tenant_id` |
| Performance | Composite indexes lead with `tenant_id`; watch plan quality for large tenants |
| Secrets/branding | `tenant_settings` for per-tenant config; avoid code branches per tenant |
| Testing | Automated test that cross-tenant access is *denied* (RLS regression guard) |

## 11. Phased Rollout

| Phase | Scope | Exit criteria |
|-------|-------|---------------|
| 0 — Foundations | `tenant` table, tenant resolution, session context, RLS on core tables | Two seeded tenants fully isolated in tests |
| 1 — Read path | Serve templated dashboards + widgets read-only per tenant | Tenant sees only their dashboards |
| 2 — Onboarding | Provisioning + default dashboard seeding | New tenant self-serves with a working default |
| 3 — Customization | Create-from-template, edit, persist custom dashboards | Edits saved, isolated, recoverable |
| 4 — Ops hardening | Rate limits, audit log, per-tenant observability, backup/restore drills | Runbook + restore verified |
| 5 — Scale/refine | Concurrency (autosave), template versioning/upgrades | Lost-update-safe editing |

## 12. Open Questions (for the session)

1. **Layout storage:** JSONB blob per dashboard vs. per-widget position rows? (query/edit tradeoffs)
2. **Template linkage:** copy-on-create vs. live reference — and do we ever push template updates to existing tenant dashboards?
3. **Users:** own `app_user` table vs. purely IdP-driven identity? Where do roles live?
4. **Tenant ID type:** UUID vs. slug vs. numeric — and is it exposed in URLs?
5. **Pooler:** PgBouncer transaction mode compatibility with `SET LOCAL` — confirmed?
6. **Whale tenants:** at what size do we consider a hybrid silo carve-out?
7. **Concurrency model:** autosave vs. explicit save; how do we handle two users editing one dashboard?
8. **Compliance:** any tenant needing physical isolation now or in the roadmap?
9. **Widget config validation:** validate `config` JSONB against `widget_type.schema` at write time?
10. **Soft vs. hard delete** and retention windows for offboarded tenants?
11. **Admin/support access:** how do internal staff view a tenant's data safely and auditable?
