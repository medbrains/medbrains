#!/usr/bin/env python3
"""Off-transaction reads of an RLS-policed table on a caller-supplied id.

Two things have to both be true for tenant isolation to hold on a query, and a
handler that reads outside a transaction has neither.

The first is the tenant context. `set_tenant_context` sets `app.tenant_id` for
the duration of a transaction, and the policies read it back. A query issued on
`&state.db` runs on a pooled connection with no such context, so a policy of the
form `tenant_id::text = current_setting('app.tenant_id', true)` compares against
NULL.

The second is that the policy applies at all. 733 tables declare `ENABLE ROW
LEVEL SECURITY`; only 85 add `FORCE`. Postgres does not apply a policy to the
table's owner unless it is forced, and the shipped configuration connects as
`POSTGRES_USER`, which owns every table. Verified directly rather than inferred:
with `ENABLE` alone the owner selects every row and only `FORCE` filters.

So a pool read of a policed table, keyed on an id from the request path, with no
`tenant_id` in the SQL, is isolated by nothing at all.

`list_user_assignments` was one. It took a user id from the path and read

    SELECT username, COALESCE(full_name, ''), COALESCE(email, '') FROM users
    WHERE id = $1

returning any user's name and email in any tenant to anyone holding
`admin.system_state.view`. The assignments query directly beneath it was already
scoped to the caller's group, so the response came back with an empty assignment
list and a populated identity — the same shape as #4544, where the policed half
looked empty and the unpoliced half leaked.

Exit codes:
    0  Unscoped pool reads match what is recorded
    1  A new one appeared
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
MEDBRAINS = REPO_ROOT / "medbrains"
MIGRATIONS = MEDBRAINS / "crates" / "medbrains-db" / "src" / "migrations"
CRATES = MEDBRAINS / "crates"

# Handlers reading a policed table off-transaction on a caller-supplied id with
# no tenant predicate, and the reason it is not a hole. A new one fails.
RECORDED_UNSCOPED = {
    # The id was already resolved through `SELECT * FROM integration_pipelines
    # WHERE id = $1 AND tenant_id = $2` earlier in the same handler, so the
    # pipeline is tenant-verified before its executions are read.
    "trigger_pipeline",
}

RLS_ENABLED = re.compile(r"ALTER TABLE (?:ONLY )?(?:public\.)?(\w+) ENABLE ROW LEVEL SECURITY")
FUNCTION = re.compile(r"^(?:pub )?(?:async )?fn (\w+)\(", re.M)
# One `sqlx::query…` call through its bind chain to the awaiting fetch. Spanned
# to `.await` rather than by balancing parens, because the SQL is often a
# `format!` and the parens nest.
STATEMENT = re.compile(r"sqlx::query\w*(?:::<[^>]*>)?\(.*?\.await", re.S)
OFF_TRANSACTION = re.compile(r"\(&\*?state\.db\)|\(&pool\)")
TABLE = re.compile(r"(?:FROM|JOIN|UPDATE|INTO)\s+(?:public\.)?(\w+)")
EXTRACTED = re.compile(r"(?:Path|Query)\((\w+)\)")


def policed_tables() -> set[str]:
    tables: set[str] = set()
    for path in sorted(MIGRATIONS.glob("*.sql")):
        tables |= set(RLS_ENABLED.findall(path.read_text(encoding="utf-8", errors="ignore")))
    return tables


def main() -> int:
    if not MIGRATIONS.exists():
        print(f"ERROR: {MIGRATIONS} not found", file=sys.stderr)
        return 2

    policed = policed_tables()
    if not policed:
        print("ERROR: parsed no RLS-enabled tables — the pattern broke", file=sys.stderr)
        return 2

    on_transaction = 0
    failures: list[str] = []

    for path in sorted(CRATES.rglob("*.rs")):
        if "/tests/" in str(path) or "loadtest" in str(path) or "seed" in str(path):
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        functions = [(m.start(), m.group(1)) for m in FUNCTION.finditer(text)]

        for index, (start, name) in enumerate(functions):
            end = functions[index + 1][0] if index + 1 < len(functions) else len(text)
            body = text[start:end]
            if "Extension(claims)" not in body:
                continue
            extracted = set(EXTRACTED.findall(body))
            if not extracted:
                continue

            for statement in STATEMENT.finditer(body):
                sql = statement.group(0)
                if not OFF_TRANSACTION.search(sql):
                    on_transaction += 1
                    continue
                if not set(TABLE.findall(sql)) & policed:
                    continue
                # An explicit tenant predicate isolates the row on its own.
                if "tenant_id" in sql:
                    continue
                bound = set(re.findall(r"\.bind\(&?(\w+)\)", sql))
                if not extracted & bound:
                    continue
                if name in RECORDED_UNSCOPED:
                    continue
                line = text[:start].count("\n") + body[: statement.start()].count("\n") + 1
                failures.append(f"{name} — {path.relative_to(CRATES)}:{line}")

    print(
        f"statements inside a transaction: {on_transaction} | "
        f"policed tables: {len(policed)}"
    )

    if failures:
        print(f"\n=== {len(failures)} UNSCOPED POOL READ OF A POLICED TABLE ===")
        for failure in failures:
            print(f"  ✗ {failure}")
        print(
            "\nNo tenant context applies on a pooled connection, and the policy is "
            "not forced, so nothing isolates this row. Add a tenant_id predicate, "
            "move the query into the request's transaction, or record it with the "
            "reason the id was already verified."
        )
        return 1

    print("✓ Off-transaction reads of policed tables match what is recorded.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
