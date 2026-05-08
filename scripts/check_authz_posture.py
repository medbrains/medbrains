#!/usr/bin/env python3
"""Static authz posture checks for MedBrains.

This is intentionally narrow: it catches fail-open patterns that have
already caused drift in the authorization layer. It is not a substitute
for unit/integration tests.
"""

from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1] / "medbrains"


def read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding="utf-8")


def main() -> int:
    failures: list[str] = []

    authorization = read("crates/medbrains-server/src/middleware/authorization.rs")
    if "department_ids.is_empty() ||" in authorization:
        failures.append("department scope is fail-open on empty department_ids")
    if "fn scoped_department_ids" in authorization and "claims.department_ids.is_empty()" in authorization:
        failures.append("scoped_department_ids treats empty department_ids as unscoped")

    auth_middleware = read("crates/medbrains-server/src/middleware/auth.rs")
    if "claims.perm_version == 0" in auth_middleware or "claims.perm_version <= 0 {\n        return Ok" in auth_middleware:
        failures.append("legacy perm_version=0 tokens are still accepted")
    if "None => Ok" in auth_middleware:
        failures.append("missing user row is still accepted during perm_version verification")

    field_access = read("crates/medbrains-server/src/middleware/field_access.rs")
    if "Stubbed to always return an empty map" in field_access:
        failures.append("field-access middleware is still stubbed")

    auth_route = read("crates/medbrains-server/src/routes/auth.rs")
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
    if pg.count("caveat IS NULL") < 5:
        failures.append("Postgres authz fallback can resolve caveated tuples without evaluation")

    if failures:
        print("❌ Authz posture check failed:")
        for failure in failures:
            print(f"  - {failure}")
        return 1

    print("✅ Authz posture check passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
