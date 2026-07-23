#!/usr/bin/env python3
"""Reads of the tenant registry keyed on a caller-supplied id.

`tenants` is the one table that deliberately has no row-level security — it is
the registry every other tenant's row lives in, and looking a tenant up by host
or by code has to work before any tenant context exists. That makes it the one
table where `set_tenant_context` buys nothing: a handler joining `tenants` on an
id taken from the request path reaches any hospital's row, in any tenant.

`get_hospital_kpi` did exactly that. `GET /api/multi-hospital/hospitals/
{tenant_id}/kpi` took the tenant id from the path, held only
`admin.system_state.view`, and returned that hospital's name, branch code and
region — no group membership required, so any hospital's admin could walk the
registry. The KPI figures themselves came back zeroed, because
`group_kpi_snapshots` *is* policed and the LEFT JOIN yielded nulls, which is
what kept it quiet: the response looked empty rather than wrong. Its two
siblings in the same file, `get_group_dashboard` and `list_group_kpis`, both
call `require_group_access` immediately after setting tenant context.

So the criterion is the pair: a handler reads `tenants` keyed on an id it did
not take from `claims`, *and* performs no ownership check. Reads keyed on
`claims.tenant_id`, and reads with no id at all (timezone lookups, active-tenant
rollups), are not flagged — 50 of those exist and adding a check to any of them
would say nothing.

Exit codes:
    0  Unowned registry reads match what is recorded
    1  A new one appeared
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
CRATES = REPO_ROOT / "medbrains" / "crates"

# Handlers reading `tenants` on a caller-supplied id with no ownership check,
# and the reason it is not a hole. Empty is the goal; a new one fails.
RECORDED_UNOWNED: set[str] = set()

FUNCTION = re.compile(r"^(?:pub )?(?:async )?fn (\w+)\(", re.M)
REGISTRY_READ = re.compile(r"(?:FROM|JOIN) tenants\b")
# `require_group_access`, `require_super_admin`, `require_patient_access`, …
OWNERSHIP = re.compile(r"require_\w*(?:access|admin|owner)\w*\s*\(")
# Uuid ids arriving from the request, as `Path(x): Path<Uuid>` or a `Query`
# struct field. The registry read is only reachable if one of these is bound.
EXTRACTED = re.compile(r"(?:Path|Query)\((\w+)\)")
SQL_CONST = re.compile(r'const (\w+): &str = ((?:"(?:[^"\\]|\\.)*"\s*\\?\s*)+);', re.S)
# One `sqlx::query…` call through its `.bind(…)` chain to the awaiting fetch.
# Taken to `.await` rather than by balancing parens, because the SQL itself is
# often a `format!` and the parens nest.
STATEMENT = re.compile(r"sqlx::query\w*(?:::<[^>]*>)?\(.*?\.await", re.S)


def main() -> int:
    if not CRATES.exists():
        print(f"ERROR: {CRATES} not found", file=sys.stderr)
        return 2

    owned = 0
    failures: list[str] = []

    for path in sorted(CRATES.rglob("*.rs")):
        if "/tests/" in str(path) or "loadtest" in str(path) or "seed" in str(path):
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        if "tenants" not in text:
            continue
        functions = [(m.start(), m.group(1)) for m in FUNCTION.finditer(text)]

        # `get_hospital_kpi` holds its SELECT in a module-level const and
        # interpolates it, so the words "FROM tenants" never appear inside the
        # handler. Interpolating such a const counts as reading the registry.
        registry_consts = {
            m.group(1) for m in SQL_CONST.finditer(text) if REGISTRY_READ.search(m.group(2))
        }

        for index, (start, name) in enumerate(functions):
            end = functions[index + 1][0] if index + 1 < len(functions) else len(text)
            body = text[start:end]

            # Only request handlers can be reached with an attacker's id.
            if "Extension(claims)" not in body:
                continue
            extracted = set(EXTRACTED.findall(body))
            if not extracted:
                continue

            unsafe = False
            for statement in STATEMENT.finditer(body):
                sql = statement.group(0)
                if not (
                    REGISTRY_READ.search(sql) or any(const in sql for const in registry_consts)
                ):
                    continue
                bound = set(re.findall(r"\.bind\(&?(?:\w+\.)?(\w+)\)", sql))
                # Every safe read reaches `tenants` through a column the query has
                # already pinned to the caller's tenant — `JOIN tenants t ON
                # t.id = a.tenant_id` beside `WHERE a.tenant_id = $2`. Binding
                # claims.tenant_id is what makes that pin possible.
                if "tenant_id" in bound and ".bind(claims.tenant_id)" in sql.replace("&", ""):
                    continue
                if extracted & bound:
                    unsafe = True
            if not unsafe:
                continue

            owned += 1
            if OWNERSHIP.search(body):
                continue
            line = text[:start].count("\n") + 1
            if name in RECORDED_UNOWNED:
                continue
            failures.append(f"{name} — {path.relative_to(CRATES)}:{line}")

    print(f"registry reads keyed on a caller-supplied id, all with an ownership check: {owned}")

    if failures:
        print(f"\n=== {len(failures)} REGISTRY READ WITH NO OWNERSHIP CHECK ===")
        for failure in failures:
            print(f"  ✗ {failure}")
        print(
            "\n`tenants` carries no RLS policy, so this reaches any hospital's row "
            "regardless of the caller's tenant context. Resolve the target's group "
            "and call require_group_access, as the sibling handlers do."
        )
        return 1

    print("✓ Every registry read on a caller-supplied id has an ownership check.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
