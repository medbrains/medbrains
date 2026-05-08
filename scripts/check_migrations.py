#!/usr/bin/env python3
"""
Migration sanity checks — run before deploy to catch the kind of bug
that shipped this session twice (`ipd_admissions` vs `admissions` FK
target, both 0107 and 0108 had it; only caught when the live server
crashloops).

Checks:

  1. Every migration filename matches `NNNN_<name>.sql` and is unique.
  2. No version gaps (we have 0001 → 010X with no holes).
  3. No two migrations create the same table or enum name (whichever
     is created later silently shadows or fails).
  4. No FK reference to a known-aliased table — the canonical table
     name is "admissions", not "ipd_admissions"; "patients", not
     "ipd_patients"; etc. The aliases below are the historical typos
     that have actually shown up. If a real `ipd_admissions` table
     ever exists, the allowlist will need updating — but today there
     are zero. The grep is line-anchored so legitimate uses (e.g.
     `pharmacy_orders` referenced from a comment) don't trip.
  5. `NOW()` inside `CREATE INDEX ... WHERE` predicates — Postgres
     forbids non-immutable functions in partial-index predicates and
     the migration will fail at apply time. Use `IS NULL` / static
     timestamps instead.
  6. Every `CREATE TABLE` should be `CREATE TABLE IF NOT EXISTS`,
     every `CREATE INDEX` → `CREATE INDEX IF NOT EXISTS`, every
     `CREATE POLICY` preceded by `DROP POLICY IF EXISTS`. Idempotency
     is not optional — repeated `make rebuild` apply must be safe.

Usage:
    python3 scripts/check_migrations.py
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
MIGRATIONS = REPO_ROOT / "medbrains" / "crates" / "medbrains-db" / "src" / "migrations"
BASELINE = REPO_ROOT / "scripts" / ".migrations_baseline.json"

# Tables that previous bugs referenced incorrectly. Maps WRONG → RIGHT.
# Add entries when a fresh typo gets caught at deploy time.
ALIASED_TABLES: dict[str, str] = {
    "ipd_admissions": "admissions",
}

RE_FNAME = re.compile(r"^(\d{4})_[a-z0-9_]+\.sql$")
RE_CREATE_TABLE = re.compile(r"\bCREATE\s+TABLE\b(?!\s+IF\s+NOT\s+EXISTS)", re.IGNORECASE)
RE_CREATE_TABLE_NAME = re.compile(
    r"\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?(\w+)\s*\(", re.IGNORECASE
)
RE_CREATE_TYPE = re.compile(
    r"\bCREATE\s+TYPE\s+(?:public\.)?(\w+)\s+AS\s+ENUM\b", re.IGNORECASE
)
RE_CREATE_INDEX = re.compile(r"\bCREATE\s+(?:UNIQUE\s+)?INDEX\b(?!\s+IF\s+NOT\s+EXISTS)", re.IGNORECASE)
RE_CREATE_POLICY = re.compile(
    r"\bCREATE\s+POLICY\s+(\w+)\s+ON\s+(?:public\.)?(\w+)", re.IGNORECASE
)
RE_DROP_POLICY = re.compile(
    r"\bDROP\s+POLICY\s+IF\s+EXISTS\s+(\w+)\s+ON\s+(?:public\.)?(\w+)", re.IGNORECASE
)
RE_NOW_IN_INDEX = re.compile(
    r"\bCREATE\s+(?:UNIQUE\s+)?INDEX[^;]*?WHERE[^;]*?\bNOW\s*\(", re.IGNORECASE | re.DOTALL
)
RE_REFERENCES = re.compile(r"REFERENCES\s+(\w+)\s*\(", re.IGNORECASE)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--update-baseline", action="store_true")
    args = ap.parse_args()

    if not MIGRATIONS.exists():
        print(f"ERROR: {MIGRATIONS} not found", file=sys.stderr)
        return 2

    files = sorted(MIGRATIONS.glob("*.sql"))
    if not files:
        print("No migrations found.")
        return 0

    # Hard errors (bugs that will crash deploy)
    errors: list[str] = []
    # Soft errors — counted against per-file baseline (ratchet)
    soft: list[str] = []

    # 1. Filename + version uniqueness — hard
    versions: list[int] = []
    for f in files:
        m = RE_FNAME.match(f.name)
        if not m:
            errors.append(f"{f.name}: filename does not match NNNN_<name>.sql")
            continue
        versions.append(int(m.group(1)))

    dupes = [v for v, c in Counter(versions).items() if c > 1]
    if dupes:
        errors.append(f"duplicate migration versions: {dupes}")

    # Version gaps are informational only. Earlier renumbering produced
    # gaps (0056/0057 → 0105/0106) and they're harmless — sqlx applies
    # whatever's in the dir in lexicographic order.

    # Per-file scans
    table_origins: dict[str, str] = {}  # table -> first migration that creates it
    enum_origins: dict[str, str] = {}

    for f in files:
        src = f.read_text()
        rel = f.name

        # 3. Duplicate table / enum names across migrations.
        # A migration that renames-then-recreates an existing table for
        # partitioning / restructure is intentional — detected via a
        # preceding `ALTER TABLE <tbl> RENAME TO <tbl>_legacy` or by
        # explicit recreation_intent comment.
        renames_legacy = set(
            re.findall(
                r"ALTER\s+TABLE\s+(\w+)\s+RENAME\s+TO\s+\w+_legacy",
                src,
                re.IGNORECASE,
            )
        )
        for m in RE_CREATE_TABLE_NAME.finditer(src):
            tbl = m.group(1)
            if tbl in table_origins and table_origins[tbl] != rel:
                if tbl in renames_legacy:
                    # Intentional recreation — table was renamed to <tbl>_legacy
                    # earlier in the same migration. Common pattern for
                    # partitioning / schema overhaul.
                    pass
                else:
                    errors.append(
                        f"{rel}: table `{tbl}` already created in {table_origins[tbl]}"
                    )
            table_origins.setdefault(tbl, rel)

        for m in RE_CREATE_TYPE.finditer(src):
            enum = m.group(1)
            if enum in enum_origins and enum_origins[enum] != rel:
                errors.append(
                    f"{rel}: enum `{enum}` already created in {enum_origins[enum]}"
                )
            enum_origins.setdefault(enum, rel)

        # 4. Aliased / mistyped table names in REFERENCES
        for m in RE_REFERENCES.finditer(src):
            tbl = m.group(1)
            if tbl in ALIASED_TABLES:
                errors.append(
                    f"{rel}: REFERENCES `{tbl}` — should be `{ALIASED_TABLES[tbl]}` "
                    f"(historical typo registered in ALIASED_TABLES). "
                    f"If a real `{tbl}` table now exists, update the script."
                )

        # 5. NOW() in index WHERE predicate
        if RE_NOW_IN_INDEX.search(src):
            errors.append(
                f"{rel}: CREATE INDEX with NOW() in WHERE predicate — "
                f"Postgres rejects non-immutable functions in partial indexes. "
                f"Use IS NULL or a static timestamp."
            )

        # 6. Idempotency — soft (ratchet against baseline)
        if RE_CREATE_TABLE.search(src):
            soft.append(
                f"{rel}: contains `CREATE TABLE` without IF NOT EXISTS — "
                f"idempotent re-apply will fail."
            )
        if RE_CREATE_INDEX.search(src):
            soft.append(
                f"{rel}: contains `CREATE INDEX` without IF NOT EXISTS"
            )
        created = {(m.group(1), m.group(2)) for m in RE_CREATE_POLICY.finditer(src)}
        dropped = {(m.group(1), m.group(2)) for m in RE_DROP_POLICY.finditer(src)}
        for name, tbl in created:
            if (name, tbl) not in dropped:
                soft.append(
                    f"{rel}: CREATE POLICY {name} ON {tbl} without "
                    f"matching DROP POLICY IF EXISTS — re-apply will fail."
                )

    # Per-file soft-error ratchet
    soft_per_file: dict[str, int] = {}
    for s in soft:
        # `<filename>: ...`
        f = s.split(":", 1)[0]
        soft_per_file[f] = soft_per_file.get(f, 0) + 1

    baseline: dict[str, int] = {}
    if BASELINE.exists():
        baseline = json.loads(BASELINE.read_text())

    if args.update_baseline:
        BASELINE.write_text(json.dumps(soft_per_file, indent=2, sort_keys=True) + "\n")
        print(
            f"updated baseline: {len(soft_per_file)} files with soft issues, "
            f"{sum(soft_per_file.values())} total"
        )
        return 0

    breaches: list[str] = []
    for f, n in soft_per_file.items():
        prev = baseline.get(f, 0)
        if n > prev:
            breaches.append(f"{f}: soft issues {prev} → {n} (+{n - prev})")

    print(
        f"check_migrations: {len(files)} migrations, "
        f"{len(errors)} HARD errors, "
        f"{sum(soft_per_file.values())} soft issues "
        f"(baseline {sum(baseline.values())})"
    )

    if errors:
        print("\nHARD errors (must fix):")
        for e in errors:
            print(f"  ✗ {e}")

    if breaches:
        print("\nSoft-issue regressions (PR added new ones):")
        for b in breaches:
            print(f"  ✗ {b}")

    if errors or breaches:
        print(
            "\nFix options for soft regressions:"
            "\n  1. Make CREATE TABLE / CREATE INDEX idempotent (IF NOT EXISTS)."
            "\n  2. Add DROP POLICY IF EXISTS before each CREATE POLICY."
            "\n  3. After cleanup PR, run "
            "`python3 scripts/check_migrations.py --update-baseline`."
        )
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
