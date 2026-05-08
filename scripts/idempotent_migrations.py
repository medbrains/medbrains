#!/usr/bin/env python3
"""
One-shot idempotency sweep for migration files.

⚠ DANGER ⚠ — Editing a migration file's content after it's been applied
to a live DB makes `sqlx::migrate!()` fail with `VersionMismatch(N)`.
sqlx records the SHA-256 of each migration in `_sqlx_migrations` when
applied; changing the file changes the hash; the next deploy refuses
to start. We learned this the hard way mid-session — the bulk rewrite
broke the live deploy and required a full revert.

The safe usage pattern is:
  • run on FRESH-DB-ONLY repos (initial development)
  • or run only on migration files that have NOT YET been applied
    anywhere (new files added in the current PR)

This script ENFORCES that by default — it skips any migration file
whose `applied=true` is recorded in `scripts/.migrations_applied.json`.
Pass `--force` to bypass (you'd better know what you're doing).

Rewrites every CREATE TABLE → CREATE TABLE IF NOT EXISTS, every
CREATE INDEX → CREATE INDEX IF NOT EXISTS, and prepends DROP POLICY
IF EXISTS before each CREATE POLICY (so fresh re-apply is safe). After
running, refresh the baseline with `check_migrations.py --update-baseline`.

Usage:
    python3 scripts/idempotent_migrations.py             # safe — skips applied
    python3 scripts/idempotent_migrations.py --dry-run
    python3 scripts/idempotent_migrations.py --force     # ⚠ live-DB-breaking
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
MIGRATIONS = REPO_ROOT / "medbrains" / "crates" / "medbrains-db" / "src" / "migrations"
APPLIED_LIST = REPO_ROOT / "scripts" / ".migrations_applied.json"

RE_CREATE_TABLE = re.compile(
    r"\bCREATE\s+TABLE\b(?!\s+IF\s+NOT\s+EXISTS)", re.IGNORECASE
)
RE_CREATE_INDEX = re.compile(
    r"\bCREATE\s+(UNIQUE\s+)?INDEX\b(?!\s+IF\s+NOT\s+EXISTS)", re.IGNORECASE
)
RE_CREATE_POLICY = re.compile(
    r"(\bCREATE\s+POLICY\s+(\w+)\s+ON\s+(?:public\.)?(\w+))",
    re.IGNORECASE,
)


def patch_file(path: Path, dry_run: bool) -> tuple[int, int, int]:
    src = path.read_text()
    orig = src

    # 1. CREATE TABLE → CREATE TABLE IF NOT EXISTS
    table_count = 0

    def table_sub(m: re.Match[str]) -> str:
        nonlocal table_count
        table_count += 1
        return m.group(0).replace("TABLE", "TABLE IF NOT EXISTS", 1)

    src = RE_CREATE_TABLE.sub(table_sub, src)

    # 2. CREATE INDEX → CREATE INDEX IF NOT EXISTS
    index_count = 0

    def index_sub(m: re.Match[str]) -> str:
        nonlocal index_count
        index_count += 1
        unique = m.group(1) or ""
        return f"CREATE {unique}INDEX IF NOT EXISTS"

    src = RE_CREATE_INDEX.sub(index_sub, src)

    # 3. Insert DROP POLICY IF EXISTS before each CREATE POLICY (only
    #    if not already present). Tracks per-(name, table) pair to avoid
    #    duplicating the DROP if it already appears.
    policy_count = 0

    def policy_sub(m: re.Match[str]) -> str:
        nonlocal policy_count
        full_create = m.group(1)
        name = m.group(2)
        tbl = m.group(3)
        # Already preceded by a DROP for this exact pair?
        # Look back ~200 chars in the original source.
        idx = m.start()
        prefix = src[max(0, idx - 200) : idx]
        if re.search(
            rf"DROP\s+POLICY\s+IF\s+EXISTS\s+{re.escape(name)}\s+ON\s+(?:public\.)?{re.escape(tbl)}\b",
            prefix,
            re.IGNORECASE,
        ):
            return full_create
        policy_count += 1
        return f"DROP POLICY IF EXISTS {name} ON {tbl};\n{full_create}"

    src = RE_CREATE_POLICY.sub(policy_sub, src)

    if src != orig and not dry_run:
        path.write_text(src)

    return table_count, index_count, policy_count


def load_applied() -> set[str]:
    """Load the set of migration filenames that are known applied to a
    live DB. We don't query Postgres directly — instead the operator
    runs `make db-mark-applied` which dumps `SELECT version FROM
    _sqlx_migrations` to this JSON file. The script refuses to edit
    these by default."""
    if not APPLIED_LIST.exists():
        return set()
    return set(json.loads(APPLIED_LIST.read_text()))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument(
        "--force",
        action="store_true",
        help="DANGER: also rewrite migrations already applied to live DB. "
        "This will trigger sqlx VersionMismatch on next deploy.",
    )
    args = ap.parse_args()

    applied = load_applied()
    files = sorted(MIGRATIONS.glob("*.sql"))
    total_tables = total_indexes = total_policies = 0
    changed_files = 0
    skipped_applied = 0

    for f in files:
        if not args.force and f.name in applied:
            skipped_applied += 1
            continue
        t, i, p = patch_file(f, args.dry_run)
        if t or i or p:
            changed_files += 1
            print(f"{f.name}: tables={t} indexes={i} policies={p}")
        total_tables += t
        total_indexes += i
        total_policies += p

    if skipped_applied:
        print(
            f"\nSkipped {skipped_applied} already-applied migrations "
            f"(safe). Pass --force to rewrite them anyway."
        )

    print(
        f"\nTotal: {changed_files} files {'would be' if args.dry_run else 'were'} updated. "
        f"+IF NOT EXISTS on {total_tables} tables / {total_indexes} indexes, "
        f"+DROP POLICY IF EXISTS for {total_policies} policies."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
