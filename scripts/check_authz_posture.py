#!/usr/bin/env python3
"""Static authz posture checks for MedBrains.

This is intentionally narrow: it catches fail-open patterns that have
already caused drift in the authorization layer. It is not a substitute
for unit/integration tests.
"""

from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1] / "medbrains"


def read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding="utf-8")


def uncaveated_decision_queries(pg: str) -> list[str]:
    """Every authorization *decision* over relation_tuples must exclude caveated
    tuples — the caveat evaluator does not run in SQL, so a caveated tuple that
    reaches a decision is granted without its condition ever being checked.

    Decisions are `SELECT EXISTS`/`SELECT 1` probes; the plain listing query that
    returns the caveat column for display is not one and is skipped. This replaces
    an older `count("caveat IS NULL") < 5` heuristic that silently went stale when
    the crate split consolidated the query sites from five down to two.
    """
    failures = []
    for match in re.finditer(r"FROM relation_tuples", pg):
        preceding = pg[max(0, match.start() - 400) : match.start()]
        if "EXISTS" not in preceding and "SELECT 1" not in preceding:
            continue  # listing/read query, not an authorization decision
        query = pg[match.start() : match.start() + 800]
        if "caveat IS NULL" not in query:
            line = pg[: match.start()].count("\n") + 1
            failures.append(
                f"backend_pg.rs:{line} authz decision resolves relation_tuples "
                "without excluding caveated tuples"
            )
    if not failures and "caveat IS NULL" not in pg:
        failures.append("Postgres authz fallback no longer filters caveated tuples at all")
    return failures


def main() -> int:
    failures: list[str] = []

    authorization = read("crates/medbrains-server-core/src/middleware/authorization.rs")
    if "department_ids.is_empty() ||" in authorization:
        failures.append("department scope is fail-open on empty department_ids")
    if "fn scoped_department_ids" in authorization and "claims.department_ids.is_empty()" in authorization:
        failures.append("scoped_department_ids treats empty department_ids as unscoped")

    auth_middleware = read("crates/medbrains-server-core/src/middleware/auth.rs")
    if "claims.perm_version == 0" in auth_middleware or "claims.perm_version <= 0 {\n        return Ok" in auth_middleware:
        failures.append("legacy perm_version=0 tokens are still accepted")
    if "None => Ok" in auth_middleware:
        failures.append("missing user row is still accepted during perm_version verification")

    field_access = read("crates/medbrains-server-core/src/middleware/field_access.rs")
    if "Stubbed to always return an empty map" in field_access:
        failures.append("field-access middleware is still stubbed")

    auth_route = read("crates/medbrains-auth/src/lib.rs")
    if "HashMap<String, medbrains_core::form::FieldAccessLevel> = HashMap::new()" in auth_route:
        failures.append("/auth responses still return an empty field_access map")

    spicedb = read("crates/medbrains-authz/src/backend_spicedb.rs")
    if "HasPermission | Permissionship::ConditionalPermission" in spicedb:
        failures.append("SpiceDB Check/BulkCheck treats conditional permission as allowed")
    if "LookupPermissionship::ConditionalPermission" in spicedb:
        failures.append("SpiceDB LookupResources treats conditional permission as allowed")
    if "role-subject grants are disabled" not in spicedb:
        failures.append("SpiceDB role-subject grants are not explicitly fail-closed")

    pg = read("crates/medbrains-authz/src/backend_pg.rs")
    failures.extend(uncaveated_decision_queries(pg))

    if failures:
        print("❌ Authz posture check failed:")
        for failure in failures:
            print(f"  - {failure}")
        return 1

    print("✅ Authz posture check passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
