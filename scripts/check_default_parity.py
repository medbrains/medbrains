#!/usr/bin/env python3
"""
Server-default vs column-default parity.

A handler that writes `body.flag.unwrap_or(x)` is choosing what an omitted
field means. The column usually declares the same thing with a DEFAULT, and
when the two disagree the schema documents one behaviour while the server
performs another — silently, because the insert always supplies a value so the
column default never runs.

53 of these agree with their column. One does not:

    pharmacy_substitutes.is_therapeutic_equivalent
        schema DEFAULT true, server writes false

That one is left alone deliberately. The server is the safer of the two: not
presuming a substitute is therapeutically equivalent unless someone says so is
the conservative reading for a drug substitution, and changing it to match the
schema would make the system claim an equivalence nobody asserted. Correcting
the column default instead is a migration and a clinical call, so it is
recorded here rather than decided.

Ten more columns carry no declared default at all. Every one of those writes
`false`, and they are consent and legal flags — ipd_dama_records.patient_signed
/ relative_signed / witness_signed, is_mlc_case, autopsy_required,
roi_requests.authorization_obtained — where false is the direction that does
not claim something was obtained. They are reported as informational, not
failed.

Resolution is by (table, column), taken from the enclosing INSERT. Matching on
the column name alone is not sound: `is_primary` exists on seven tables with
both defaults, and would report a mismatch that isn't one.

Exit codes:
    0  Disagreements match what is recorded
    1  A new one appeared
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
MIGRATIONS = REPO_ROOT / "medbrains" / "crates" / "medbrains-db" / "src" / "migrations"
CRATES = REPO_ROOT / "medbrains" / "crates"

# (table, column) -> the server's default, where it deliberately differs from
# the column's DEFAULT. Removing an entry is always welcome; a new one fails.
RECORDED_DISAGREEMENTS = {
    ("pharmacy_substitutes", "is_therapeutic_equivalent"): "false",
}

BIND = re.compile(r"\.bind\(\s*(?:&)?body\.(\w+)\s*\.unwrap_or\((true|false)\)\s*\)")
INSERT = re.compile(r"INSERT INTO (?:public\.)?(\w+)")


def column_defaults() -> dict[tuple[str, str], str]:
    defaults: dict[tuple[str, str], str] = {}
    for path in sorted(MIGRATIONS.glob("*.sql")):
        text = path.read_text(encoding="utf-8", errors="ignore")
        for table in re.finditer(
            r"CREATE TABLE (?:IF NOT EXISTS )?(?:public\.)?(\w+)\s*\((.*?)\n\);", text, re.S
        ):
            for line in table.group(2).splitlines():
                column = re.match(
                    r"\s*([a-z_0-9]+)\s+boolean\s+DEFAULT\s+(true|false)", line
                )
                if column:
                    defaults[(table.group(1), column.group(1))] = column.group(2)
    return defaults


def main() -> int:
    if not MIGRATIONS.exists():
        print(f"ERROR: {MIGRATIONS} not found", file=sys.stderr)
        return 2

    defaults = column_defaults()
    if not defaults:
        print("ERROR: parsed no column defaults — the pattern broke", file=sys.stderr)
        return 2

    agree = 0
    undeclared: list[str] = []
    failures: list[str] = []

    for path in sorted(CRATES.rglob("*.rs")):
        if "/tests/" in str(path):
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        for match in BIND.finditer(text):
            column, value = match.group(1), match.group(2)
            preceding = INSERT.findall(text[: match.start()])
            if not preceding:
                continue
            table = preceding[-1]
            declared = defaults.get((table, column))
            line = text[: match.start()].count("\n") + 1
            where = f"{path.relative_to(CRATES)}:{line}"
            if declared is None:
                undeclared.append(f"{table}.{column} (server {value}) — {where}")
            elif declared == value:
                agree += 1
            elif RECORDED_DISAGREEMENTS.get((table, column)) == value:
                continue
            else:
                failures.append(
                    f"{table}.{column} — server writes {value}, schema DEFAULT "
                    f"{declared} ({where})"
                )

    print(
        f"server defaults bound to a column: {agree + len(failures) + len(undeclared)} "
        f"({agree} match the column, {len(undeclared)} columns declare no default)"
    )

    if failures:
        print(f"\n=== {len(failures)} SERVER DEFAULT CONTRADICTING ITS COLUMN ===")
        for failure in failures:
            print(f"  ✗ {failure}")
        print(
            "\nThe schema documents one meaning for an omitted field and the server "
            "applies another. Make them agree, or record the difference with the "
            "reason the server is right."
        )
        return 1

    print("✓ Server defaults agree with their column defaults.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
