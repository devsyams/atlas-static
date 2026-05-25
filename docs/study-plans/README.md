# Study Plans — Standard Operating Procedure (SOP)

> The procedure referenced by `CLAUDE.md`. **No feature work starts without a study plan.**
> This SOP is project-agnostic; the per-project plans live under `docs/study-plans/<project>/`
> (this repo: `docs/study-plans/atlas/`).

## 1. The rule

Before writing or modifying any **feature** code, that feature's study plan must **exist and be
current**. A study plan is three sections — **PM → Architecture → QA** — completed and signed off,
*then* the feature is built with TDD.

- **New feature** → `/create-feature <name>`: scaffold its plan block in the right **stage file**,
  add it to `atlas/_index.md` at **v1.0**, complete PM/Architecture/QA, get sign-off, then build.
- **Changing an existing feature's behaviour or scope** → `/change-feature <name>`: update the
  affected section(s), **bump the version**, add a Revision-history row, update the index, then build.

**Not a feature change** (no plan needed): typo/comment fixes, dependency bumps, pure refactors with
no behaviour change, doc-only edits. When in doubt, ask.

## 2. The three sections

1. **PM** — **Background** (why this is needed: the pain, who feels it, the stakes, what it unlocks)
   + **Acceptance criteria** written as **Given / When / Then**.
2. **Architecture** — **impact analysis**: which files are added/changed (web `apps/web/*`, pipeline
   `services/pipeline/*`, contracts `packages/contracts/*`, infra `infra/*`, tests), plus
   data-model/API changes, reuse, and risks.
3. **QA** — test cases mapped **1:1** to the acceptance criteria, plus **governance edge cases**
   (authz, rate-limit, cost, audit, degradation/failure).

Then **Build (TDD):** write the QA cases as failing tests first, watch them fail, then write the
minimal code to green. Tests: **vitest** for TS (`apps/web/**/*.test.ts`), **pytest** for Python
(`services/pipeline/**/test_*.py`).

## 3. Stage taxonomy (this project)

ATLAS is a monitoring/intelligence product, so features file under one of four stages:

| Stage | File | Holds |
|---|---|---|
| **0 — Platform** | `atlas/0-platform.md` | Cross-cutting: monorepo, infra, DB/schema, storage, auth, RBAC, observability, hardening, launch |
| **1 — Watch** | `atlas/1-watch.md` | Ingestion: source registry, scheduler, RSS/news/social connectors, normalize/dedup/raw store |
| **2 — Understand** | `atlas/2-understand.md` | AI enrichment & analytics: LLM abstraction, scoring, geocoding, snapshots/trends, predictions |
| **3 — Act** | `atlas/3-act.md` | Surfaces & actions: dashboard API, widgets, layouts, AI assistant, real-time alerts, War Room |

Pick the stage by the feature's **primary capability**, not the sprint it lands in.

## 4. Versioning rule

Each feature plan carries a `Version`. On change:

- **MAJOR** (x.0) — behaviour or scope change (new/changed acceptance criteria).
- **MINOR** (1.x) — doc-only clarification, no behaviour/scope change.

Every change adds a row to the feature's **Revision history** and updates `atlas/_index.md`.

## 5. Status values

`Planned` → `In progress` → `Built` (code + tests green) → `Shipped` (in production). Tracked per
feature in `atlas/_index.md`.

## 6. Engineering guardrails (every feature must follow)

Derived from the architecture spec (`docs/superpowers/specs/2026-05-25-atlas-production-architecture-design.md`):

- **API-first** — the UI calls `/api/v1/*` (BFF); it never reads the database or LLM directly.
- **Postgres is the single source of truth & schema contract** — **Alembic owns migrations**; the TS
  side is **read-only via Kysely + `kysely-codegen`**. Never introduce a second migration source.
- **Model-agnostic AI** — all LLM calls route through the LiteLLM abstraction in the Python service;
  **never hardcode a provider/model**, and **every call is cost/token-logged**.
- **Secrets stay server-side** — LLM/provider keys live only in the Python service; never client-side.
- **RBAC enforced server-side** — admin / analyst / viewer checked in middleware + per route.
- **Audit sensitive actions** — auth events and admin actions append to `audit_log`.
- **Sources behind the connector abstraction** — every feed/platform implements `SourceConnector`;
  social platforms respect ToS and cost caps (see spec Risk R1).
- **Graceful degradation** — the AI assistant keeps a deterministic scripted fallback; the dashboard
  serves cached/last-known data when upstreams fail.
- **TDD** — QA cases become failing tests first.

## 7. Docs map

- SOP (this file): `docs/study-plans/README.md`
- Per-feature template: `docs/study-plans/_TEMPLATE.md`
- ATLAS feature plans (by stage): `docs/study-plans/atlas/{0-platform,1-watch,2-understand,3-act}.md` + `_index.md`
- Source architecture spec: `docs/superpowers/specs/2026-05-25-atlas-production-architecture-design.md`
