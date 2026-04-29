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
MIGRATIONS_DIR = REPO_ROOT / "medbrains" / "crates" / "medbrains-db" / "src" / "migrations"

ENFORCE_FROM = 124  # migrations >= this must comply
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

    for path in sorted(MIGRATIONS_DIR.glob("*.sql")):
        m = re.match(r"(\d+)_", path.name)
        if not m:
            errors.append(f"{path.name}: filename doesn't start with NNN_")
            continue
        mig_no = int(m.group(1))
        if mig_no < ENFORCE_FROM:
            continue

        header = parse_header(path.read_text(encoding="utf-8"))
        for key in REQUIRED_KEYS:
            if key not in header:
                errors.append(f"{path.name}: missing required header key '{key}'")
        posture = header.get("RLS-Posture")
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

    print(f"✓ All migrations >= {ENFORCE_FROM} have valid headers.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
