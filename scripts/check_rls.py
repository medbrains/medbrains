#!/usr/bin/env python3
"""
RLS Coverage Check — verifies every tenant_id-bearing table has matching RLS policy.

Statically parses every SQL migration under crates/medbrains-db/src/migrations/:
  - Detect CREATE TABLE statements with `tenant_id UUID` column
  - Detect ALTER TABLE ... ADD COLUMN tenant_id (later additions)
  - Detect ALTER TABLE ... ENABLE ROW LEVEL SECURITY
  - Detect CREATE POLICY tenant_isolation_<name> ON <table>
  - Detect SELECT apply_tenant_rls('<name>') helper calls
  - Parse migration header `RLS-Posture:` declarations

A table is COVERED if any of:
  1. RLS enabled + at least one tenant-isolation policy referencing it
  2. apply_tenant_rls('<name>') was called
  3. Migration header declared the table as `bypass-only`, `catalog`, or `not-applicable`

Exit codes:
    0  All tenant-bearing tables have RLS coverage
    1  One or more gaps OR malformed migration headers
"""

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
MIGRATIONS_DIR = REPO_ROOT / "medbrains" / "crates" / "medbrains-db" / "src" / "migrations"

# Tables that intentionally have tenant_id but skip RLS. Add with care.
ALLOWLIST = {
    # Add table names here only with explicit justification in header
}

VALID_POSTURES = {
    "tenant-scoped",
    "department-scoped",
    "tenant+dept",
    "bypass-only",
    "catalog",
    "not-applicable",
}

CREATE_TABLE_RE = re.compile(
    r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\((.*?)\)\s*(?:PARTITION|;)",
    re.IGNORECASE | re.DOTALL,
)
TENANT_COL_RE = re.compile(r"\btenant_id\s+UUID\b", re.IGNORECASE)
ALTER_ADD_TENANT_RE = re.compile(
    r"ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?tenant_id\s+UUID",
    re.IGNORECASE,
)
ENABLE_RLS_RE = re.compile(
    r"ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY",
    re.IGNORECASE,
)
POLICY_RE = re.compile(
    r"CREATE\s+POLICY\s+\w+\s+ON\s+([a-zA-Z_][a-zA-Z0-9_]*)",
    re.IGNORECASE,
)
APPLY_TENANT_RLS_RE = re.compile(
    r"SELECT\s+apply_tenant_rls(?:_with_global)?\(\s*'([a-zA-Z_][a-zA-Z0-9_]*)'\s*\)",
    re.IGNORECASE,
)
HEADER_KEY_RE = re.compile(r"--\s*([A-Za-z][A-Za-z\-]+)\s*:\s*(.+?)\s*$", re.MULTILINE)


def strip_sql_comments(sql: str) -> str:
    sql = re.sub(r"/\*.*?\*/", "", sql, flags=re.DOTALL)
    sql = re.sub(r"--[^\n]*", "", sql)
    return sql


def parse_header(sql: str) -> dict[str, str]:
    """Parse top-of-file `-- Key: Value` comment block."""
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

    files = sorted(MIGRATIONS_DIR.glob("*.sql"))
    if not files:
        print(f"ERROR: no migrations found in {MIGRATIONS_DIR}", file=sys.stderr)
        return 2

    tenant_tables: dict[str, str] = {}        # table -> first_seen_migration
    rls_enabled: set[str] = set()
    policies_on: set[str] = set()
    posture_overrides: dict[str, str] = {}    # table -> posture from migration header
    header_errors: list[str] = []

    for path in files:
        raw = path.read_text(encoding="utf-8")
        header = parse_header(raw)
        sql = strip_sql_comments(raw)

        # Header validation — only enforce for new migrations from 123 onward
        # Migration number is leading zero-padded prefix.
        m = re.match(r"(\d+)_", path.name)
        mig_no = int(m.group(1)) if m else 0
        if mig_no >= 124:  # 123_drop_builders.sql predates RFC-INFRA-2026-002
            posture = header.get("RLS-Posture")
            if not posture:
                header_errors.append(f"{path.name}: missing 'RLS-Posture:' header")
            elif posture not in VALID_POSTURES:
                header_errors.append(
                    f"{path.name}: invalid RLS-Posture '{posture}' "
                    f"(allowed: {', '.join(sorted(VALID_POSTURES))})"
                )

        # CREATE TABLE detection
        for match in CREATE_TABLE_RE.finditer(sql):
            tname = match.group(1).lower()
            body = match.group(2)
            if TENANT_COL_RE.search(body):
                tenant_tables.setdefault(tname, path.name)
                # Capture per-table posture if header carries `Per-Table:` lines (future use)
                if "RLS-Posture" in header and posture_overrides.get(tname) is None:
                    posture_overrides[tname] = header["RLS-Posture"]

        # ALTER TABLE ADD COLUMN tenant_id — table becomes tenant-scoped
        for match in ALTER_ADD_TENANT_RE.finditer(sql):
            tname = match.group(1).lower()
            tenant_tables.setdefault(tname, path.name)

        # ENABLE RLS
        for match in ENABLE_RLS_RE.finditer(sql):
            rls_enabled.add(match.group(1).lower())

        # CREATE POLICY ... ON table
        for match in POLICY_RE.finditer(sql):
            policies_on.add(match.group(1).lower())

        # apply_tenant_rls('table') helper — counts as enabled + policy
        for match in APPLY_TENANT_RLS_RE.finditer(sql):
            tname = match.group(1).lower()
            rls_enabled.add(tname)
            policies_on.add(tname)

    # Compute gaps
    bypass_postures = {"bypass-only", "catalog", "not-applicable"}
    gaps: list[tuple[str, str, str]] = []  # (table, first_seen_migration, reason)

    for table, first_mig in sorted(tenant_tables.items()):
        if table in ALLOWLIST:
            continue
        posture = posture_overrides.get(table, "")
        if posture in bypass_postures:
            continue
        missing = []
        if table not in rls_enabled:
            missing.append("RLS not enabled")
        if table not in policies_on:
            missing.append("no policy")
        if missing:
            gaps.append((table, first_mig, "; ".join(missing)))

    # Report
    print(f"Scanned {len(files)} migrations, {len(tenant_tables)} tenant_id-bearing tables.")
    print(f"  RLS enabled on:   {len(rls_enabled)} tables")
    print(f"  Policies on:      {len(policies_on)} tables")

    if header_errors:
        print(f"\n=== {len(header_errors)} HEADER ERRORS ===")
        for e in header_errors:
            print(f"  ✗ {e}")

    if gaps:
        print(f"\n=== {len(gaps)} TABLES MISSING RLS COVERAGE ===")
        print(f"{'TABLE':<48} {'FIRST SEEN':<40} REASON")
        print("-" * 120)
        for table, first_mig, reason in gaps:
            print(f"{table:<48} {first_mig:<40} {reason}")
        print()

    if header_errors or gaps:
        return 1

    print("\n✓ All tenant-scoped tables have RLS coverage. Headers OK.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
