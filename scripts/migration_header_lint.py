#!/usr/bin/env python3
"""
Migration Header Lint — verifies new migrations (>=124) carry the
mandatory header block:

    -- ====================================================================
    -- Migration: NNN_<name>.sql
    -- RLS-Posture: tenant-scoped | department-scoped | tenant+dept | bypass-only | catalog | not-applicable
    -- Tenant-Column: tenant_id  (or N/A)
    -- New-Tables: foo, bar, baz  (comma-separated, or none)
    -- Drops: none  (or comma-separated)
    -- ====================================================================

Migration 123 (`123_drop_builders.sql`) predates this rule and is exempt.
All migrations from 124 onward must comply.

Exit codes:
    0  All compliant
    1  One or more missing required keys or invalid values
"""

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
MIGRATIONS_DIR = (
    REPO_ROOT / "medbrains" / "crates" / "medbrains-db-migrations" / "src" / "migrations"
)

ENFORCE_FROM = 124
# ── Applied migrations are immutable ────────────────────────────────────
#
# sqlx records a SHA-384 of every migration it applies and refuses to start
# when a file no longer matches: `Error: VersionMismatch(890)`. Headers were
# added to these 25 on 2026-09-06 and the rebuilt server would not boot
# against any database that had already run them — which is every database.
# They were restored byte-for-byte.
#
# So these keep their original text for as long as they exist. The convention
# applies to migrations written from now on; `check_migration_immutable.py`
# refuses any edit to a migration that is already on master.
IMMUTABLE_APPLIED = {
    "0890_views_and_table_functions.sql",
    "0900_cross_module_foreign_keys.sql",
    "0910_partition_indexes.sql",
    "0950_reference_data.sql",
    "0960_foreign_key_indexes.sql",
    "0978_automation.sql",
    "0979_token_priority_vocabulary.sql",
    "0980_automation_state.sql",
    "0981_app_role_without_rls_bypass.sql",
    "0982_tenant_visibility.sql",
    "0983_department_policies_scope_to_tenant.sql",
    "0984_outbox_worker_role.sql",
    "0985_group_scope.sql",
    "0986_preauth_lookups.sql",
    "0987_share_link_and_onboarding_lookups.sql",
    "1001_token_scope_locations.sql",
    "1003_queue_status_expired.sql",
    "1006_token_queue_ageing.sql",
    "1007_token_priority_escalation.sql",
    "1008_lab_dispatch_void.sql",
    "1009_bed_states_follow_bed_locations.sql",
    "1010_drop_dead_bed_reservation_columns.sql",
    "1011_ward_clinical_scores.sql",
    "1012_blood_component_quarantine.sql",
    "1013_pharmacy_day_settlement_upsert_key.sql",
    # Applied before they were linted; adding the header to 1016 is what
    # produced VersionMismatch(1016) in e3f49fba. 1017 declares its posture,
    # which check_rls.py reads; the other three keys can never be added.
    "1016_nurse_call_escalation.sql",
    "1017_partition_rls.sql",
}

  # migrations >= this must comply
REQUIRED_KEYS = ("RLS-Posture", "Tenant-Column", "New-Tables", "Drops")
VALID_POSTURES = {
    "tenant-scoped",
    "department-scoped",
    "tenant+dept",
    "bypass-only",
    "catalog",
    "not-applicable",
}

HEADER_KEY_RE = re.compile(r"--\s*([A-Za-z][A-Za-z\-]+)\s*:\s*(.+?)\s*$", re.MULTILINE)


def parse_header(sql: str) -> dict[str, str]:
    head = []
    for line in sql.splitlines():
        s = line.strip()
        if not s:
            if head:
                break
            continue
        if not s.startswith("--"):
            break
        head.append(line)
    text = "\n".join(head)
    return {m.group(1): m.group(2) for m in HEADER_KEY_RE.finditer(text)}


def main() -> int:
    if not MIGRATIONS_DIR.exists():
        print(f"ERROR: migrations dir not found: {MIGRATIONS_DIR}", file=sys.stderr)
        return 2

    errors: list[str] = []
    immutable = 0

    for path in sorted(MIGRATIONS_DIR.glob("*.sql")):
        m = re.match(r"(\d+)_", path.name)
        if not m:
            errors.append(f"{path.name}: filename doesn't start with NNN_")
            continue
        mig_no = int(m.group(1))
        if mig_no < ENFORCE_FROM:
            continue

        if path.name in IMMUTABLE_APPLIED:
            immutable += 1
            continue

        header = parse_header(path.read_text(encoding="utf-8"))
        for key in REQUIRED_KEYS:
            if key not in header:
                errors.append(f"{path.name}: missing required header key '{key}'")
        posture = header.get("RLS-Posture")
        # A trailing parenthetical narrows the claim rather than weakening it:
        # "tenant-scoped (per table)" asserts tenant-scoped and says where. The
        # lint compared the whole string, so the more informative header failed
        # while the barer one passed.
        if posture:
            posture = posture.split("(", 1)[0].strip()
        if posture and posture not in VALID_POSTURES:
            errors.append(
                f"{path.name}: invalid RLS-Posture '{posture}' "
                f"(allowed: {', '.join(sorted(VALID_POSTURES))})"
            )

    if errors:
        print(f"=== {len(errors)} MIGRATION HEADER ERRORS ===")
        for e in errors:
            print(f"  ✗ {e}")
        print()
        print("Required header block (migrations >= 124):")
        print("  -- ====================================================================")
        print("  -- Migration: NNN_<name>.sql")
        print("  -- RLS-Posture: tenant-scoped | department-scoped | tenant+dept | bypass-only | catalog | not-applicable")
        print("  -- Tenant-Column: tenant_id  (or N/A)")
        print("  -- New-Tables: foo, bar  (or none)")
        print("  -- Drops: none  (or comma-separated)")
        print("  -- ====================================================================")
        return 1

    print(
        f"✓ migration headers: all checked migrations >= {ENFORCE_FROM} valid; "
        f"{immutable} applied before the convention and immutable (see IMMUTABLE_APPLIED)."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
