#!/usr/bin/env python3
"""Which print-data handlers can actually run against the schema.

    python3 scripts/check_print_data_schema.py            # summary
    python3 scripts/check_print_data_schema.py --detail   # per handler

Reports, it does not gate — the answer is "build the schema or delete the
handler", and neither belongs in a pre-commit check.

`medbrains-print-data` renders every printed clinical and legal document, and
a large part of it queries a schema that was never built. Counting missing
TABLES understates it: `get_transfer_summary_print_data` selects
`pt.tenant_id`, `pt.from_ward_id` and `pt.to_bed_id` from `patient_transfers`,
which exists — as an INTER-TENANT referral record with `source_tenant_id`,
`dest_tenant_id` and no ward or bed columns at all. The name collides with an
intra-hospital ward move that does not exist. The table check calls that
handler live; it cannot run.

So a handler is broken if it names a missing table OR a missing column, and
those are counted separately because they need different fixes.

Requires a migrated database:

    docker compose exec -T postgres psql -U medbrains -d medbrains \\
      -tAc "select table_name from information_schema.tables where table_schema='public'"
"""

from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "crates", "medbrains-print-data", "src")

PSQL = [
    "docker", "compose", "exec", "-T", "postgres",
    "psql", "-U", "medbrains", "-d", "medbrains", "-tAc",
]
# SQL keywords and CTE-ish names that follow FROM/JOIN but are not tables.
NOISE = {"select", "lateral", "unnest", "generate_series", "combined", "age"}
HANDLER = re.compile(r"^pub async fn (\w+)\(", re.M)
# `FROM tbl alias` / `JOIN tbl AS alias` — the alias is optional.
SOURCE = re.compile(r"(?:FROM|JOIN)\s+([a-z_][a-z0-9_]*)(?:\s+(?:AS\s+)?([a-z][a-z0-9_]*))?", re.I)
QUALIFIED = re.compile(r"\b([a-z][a-z0-9_]*)\.([a-z_][a-z0-9_]*)\b")
# Only text inside a Rust string literal is SQL. Without this, `tenant.to_string()`
# and `dept.format(..)` are read as `tenants.to_string` and `departments.format`
# — two columns that do not exist, reported against handlers that are fine.
SQL_LITERAL = re.compile(r'"((?:[^"\\]|\\.)*)"', re.S)


def schema() -> tuple[set[str], set[str]]:
    def run(sql: str) -> set[str]:
        out = subprocess.run(PSQL + [sql], capture_output=True, text=True, cwd=ROOT)
        if out.returncode != 0:
            raise SystemExit(
                "could not read the schema — is postgres up?\n"
                "  docker compose up -d postgres\n" + out.stderr.strip()
            )
        return {line.strip() for line in out.stdout.splitlines() if line.strip()}

    tables = run("select table_name from information_schema.tables where table_schema='public'")
    cols = run(
        "select table_name||'.'||column_name from information_schema.columns "
        "where table_schema='public'"
    )
    return tables, cols


def audit(tables: set[str], cols: set[str]) -> list[tuple[str, str, list[str], list[str]]]:
    out = []
    for name in sorted(os.listdir(SRC)):
        if not name.endswith(".rs"):
            continue
        text = open(os.path.join(SRC, name), encoding="utf-8", errors="replace").read()
        marks = [(m.group(1), m.start()) for m in HANDLER.finditer(text)]
        for i, (handler, start) in enumerate(marks):
            end = marks[i + 1][1] if i + 1 < len(marks) else len(text)
            # SQL only — see SQL_LITERAL. Joined so a statement split across
            # several adjacent literals still reads as one string.
            body = " ".join(SQL_LITERAL.findall(text[start:end]))

            alias: dict[str, str] = {}
            missing_tables: list[str] = []
            for tbl, al in SOURCE.findall(body):
                if tbl in NOISE:
                    continue
                if tbl not in tables:
                    if tbl not in missing_tables:
                        missing_tables.append(tbl)
                    continue
                alias[al or tbl] = tbl
                alias[tbl] = tbl

            missing_cols: list[str] = []
            for al, col in QUALIFIED.findall(body):
                if al not in alias:
                    continue
                ref = f"{alias[al]}.{col}"
                if ref not in cols and ref not in missing_cols:
                    missing_cols.append(ref)

            out.append((name, handler, missing_tables, missing_cols))
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--detail", action="store_true")
    args = ap.parse_args()

    tables, cols = schema()
    rows = audit(tables, cols)

    def state(mt: list[str], mc: list[str]) -> str:
        if mt and mc:
            return "BROKEN(table+column)"
        if mt:
            return "BROKEN(table)"
        if mc:
            return "BROKEN(column)"
        return "runnable"

    counts = Counter(state(mt, mc) for _, _, mt, mc in rows)
    print(f"print-data handlers: {len(rows)}\n")
    for k in ("runnable", "BROKEN(table)", "BROKEN(column)", "BROKEN(table+column)"):
        if counts[k]:
            print(f"  {k:22} {counts[k]:>4}")

    if args.detail:
        print()
        for name, handler, mt, mc in rows:
            if not mt and not mc:
                continue
            print(f"  {name}::{handler}")
            if mt:
                print(f"      missing tables : {', '.join(mt[:6])}")
            if mc:
                print(f"      missing columns: {', '.join(mc[:6])}")

    print(
        "\nA handler naming a missing table or column cannot run, and cannot be "
        "given a\nper-record authorization check either — there is nothing to "
        "resolve a patient\nthrough. Decide per module: build the schema, or "
        "delete the handler."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
