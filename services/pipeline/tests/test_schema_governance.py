"""P3 AC4 (governance): Alembic is the single source of schema truth — no TS-side
migration tool may creep into the workspace. (Codegen-freshness is the other half of
AC4 and is enforced as a CI step via `task db:check`, which git-diffs the generated
types after regenerating them.)"""

import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]

# TS migration tools that would create a second source of schema truth.
FORBIDDEN = {
    "prisma",
    "@prisma/client",
    "drizzle-kit",
    "drizzle-orm",
    "typeorm",
    "knex",
    "node-pg-migrate",
    "@mikro-orm/cli",
    "@mikro-orm/migrations",
}


def _package_jsons() -> list[Path]:
    return [
        *REPO_ROOT.glob("apps/*/package.json"),
        *REPO_ROOT.glob("packages/*/package.json"),
        REPO_ROOT / "package.json",
    ]


def test_no_ts_migration_tool_present():
    offenders: dict[str, set[str]] = {}
    for pkg in _package_jsons():
        if not pkg.exists():
            continue
        data = json.loads(pkg.read_text(encoding="utf-8"))
        deps = {**data.get("dependencies", {}), **data.get("devDependencies", {})}
        bad = FORBIDDEN & set(deps)
        if bad:
            offenders[str(pkg.relative_to(REPO_ROOT))] = bad
    assert not offenders, f"TS migration tooling found (Alembic must own the schema): {offenders}"
