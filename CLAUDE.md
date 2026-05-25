@AGENTS.md

# Nexorus ATLAS — Project Rules for Claude

> Loaded every session. These rules govern how features are built in this repo.
> Full procedure: `docs/study-plans/README.md` (the SOP).

## The feature rule (MANDATORY)

**No feature work starts without a study plan.** Before writing or modifying any
*feature* code, the feature's study plan must exist and be current.

- **New feature** → run **`/create-feature <name>`**: scaffold its study-plan block
  (PM → Architecture → QA) in the right stage file, add it to
  `docs/study-plans/atlas/_index.md` at **v1.0**, complete the three sections, get
  sign-off, *then* implement with TDD.
- **Changing an existing feature's behavior or scope** → run
  **`/change-feature <name>`**: update the affected study-plan section(s), **bump the
  version** (MAJOR for behavior/scope, MINOR for doc-only), add a Revision-history
  row, update the index, *then* implement with TDD.

If asked to build or alter a feature without a study plan, create/update the plan
**first** — don't skip the gate. (If the user insists on skipping, confirm explicitly.)

**Not a feature change** (no study plan needed): typo/comment fixes, dependency
bumps, pure refactors with no behavior change, doc-only edits. Use judgment; when in
doubt, ask.

## How we build (study plan → TDD)

1. **PM** — business **background** (why it's needed: the pain, who feels it, the
   stakes, what it unlocks) + acceptance criteria (Given/When/Then).
2. **Architecture** — impact analysis: which files change/add — pipeline/domain
   `services/pipeline/*` (Python), API/BFF `apps/web/app/api/v1/*`, UI
   `apps/web/app/*` + `apps/web/components/*`, contracts `packages/contracts/*`,
   tests — plus data-model/API changes, reuse, and risks.
   *(Until the monorepo migration lands — feature **P1** — the web app still lives at
   repo root: `app/`, `components/`, `lib/`.)*
3. **QA** — test cases mapped 1:1 to acceptance criteria + governance edge cases.
4. **Build** — TDD: write the QA cases as failing tests first, watch them fail, then
   minimal code to green.

## Engineering guardrails (a feature must follow)

Derived from the architecture spec (`docs/superpowers/specs/2026-05-25-atlas-production-architecture-design.md`):

- **API-first**: the UI calls `/api/v1/*` (the BFF) via the client layer; it **never**
  reads the database or an LLM directly.
- **Postgres is the single source of truth & schema contract**: **Alembic owns
  migrations** (`services/pipeline/db`); the TS side is **read-only via Kysely +
  `kysely-codegen`**. Never add a second migration source.
- **Model-agnostic AI**: all LLM calls route through the LiteLLM abstraction in the
  Python service; **never hardcode a provider/model**, and **every call is
  cost/token-logged** to the ledger.
- **Secrets stay server-side**: provider/LLM keys live only in the Python service;
  never client-side.
- **RBAC enforced server-side**: admin / analyst / viewer checked in `middleware` +
  per route; UI gating is never the only gate.
- **Audit sensitive actions**: auth events and admin/source changes append to
  `audit_log`.
- **Sources behind the connector abstraction**: every feed/platform implements
  `SourceConnector`; social platforms respect ToS + cost caps (spec Risk R1).
- **Graceful degradation**: the AI assistant keeps a deterministic scripted fallback;
  the dashboard serves cached/last-known data when upstreams fail.
- **TDD**: tests are **vitest** for TS (`apps/web/**/*.test.ts`) and **pytest** for
  Python (`services/pipeline/**/test_*.py`).

## Docs map

- SOP + versioning rule: `docs/study-plans/README.md`
- Study-plan template: `docs/study-plans/_TEMPLATE.md`
- ATLAS feature plans (by product stage):
  `docs/study-plans/atlas/{0-platform,1-watch,2-understand,3-act}.md` + `_index.md`
- Production architecture / WBS / sprint plan:
  `docs/superpowers/specs/2026-05-25-atlas-production-architecture-design.md`
