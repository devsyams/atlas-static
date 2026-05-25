# Study-plan template (one feature)

> Copy this block into the appropriate stage file. Keep the heading ID stable (it's referenced
> from `_index.md`). Fill every section before build; no `TBD` at sign-off.

---

### `<ID>`. `<Feature name>`

- **Version:** 1.0 · **Stage:** `<0-platform | 1-watch | 2-understand | 3-act>` · **Sprint:** `<n>`
  · **Status:** Planned · **Spec ref:** `<§ in architecture spec>` · **Owner:** `<role>`

#### PM
**Background (why):** What pain does this remove, who feels it, what are the stakes, what does it
unlock? (2–5 sentences.)

**Acceptance criteria (Given / When / Then):**
- **AC1** — *Given* … *When* … *Then* …
- **AC2** — *Given* … *When* … *Then* …

#### Architecture
**Impact — files add/change:**
- `add` `<path>` — purpose
- `change` `<path>` — what changes

**Data-model / API changes:** tables/columns, migrations, endpoints, contracts.

**Reuse:** existing code/components/libraries leveraged.

**Risks:** technical/cost/legal risks + mitigation; link spec Risk IDs where relevant.

#### QA
| # | Maps to | Test case | Type |
|---|---|---|---|
| T1 | AC1 | … | unit / integration / e2e |
| T2 | AC2 | … | … |

**Governance edge cases:** authz/RBAC, rate-limit, cost guardrail, audit, failure/degradation.

#### Revision history
| Version | Date | Change |
|---|---|---|
| 1.0 | YYYY-MM-DD | Initial plan from architecture spec |
