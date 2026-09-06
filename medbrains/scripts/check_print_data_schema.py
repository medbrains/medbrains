#!/usr/bin/env python3
"""Which runtime-SQL handlers can actually run against the schema.

    python3 scripts/check_print_data_schema.py            # summary
    python3 scripts/check_print_data_schema.py --detail   # per handler
    python3 scripts/check_print_data_schema.py --src crates/medbrains-workflow/src/orchestration

Runtime `sqlx::query` is not checked at compile time, so a statement naming a
column that does not exist compiles, ships, and fails only when it runs -- and
if the caller ends in `.ok()`, not even then. Two pipeline steps sat in
`default_pipelines.rs` that way: `UPDATE beds SET status` (no such column; the
live state is `bed_states.status`) and an INSERT into the statutory NDPS
register naming six columns that table does not have. Neither had ever written
anything, and nothing said so.

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
DEFAULT_SRC = os.path.join("crates", "medbrains-print-data", "src")

PSQL = [
    "docker", "compose", "exec", "-T", "postgres",
    "psql", "-U", "medbrains", "-d", "medbrains", "-tAc",
]
# SQL keywords and CTE-ish names that follow FROM/JOIN but are not tables.
# Keywords that follow FROM/JOIN in a fragment rather than naming a source.
# Dynamic SQL is assembled from pieces here — `" ORDER BY x DESC"` appended to
# a base query reads as `FROM ... DESC` once the pieces are scanned separately.
NOISE = {
    "select", "lateral", "unnest", "generate_series", "combined", "age",
    "and", "or", "not", "desc", "asc", "limit", "offset", "order", "group",
    "where", "having", "on", "as", "by", "union", "all", "distinct", "case",
    "when", "then", "else", "end", "left", "right", "inner", "outer", "full",
    "cross", "natural", "using", "returning", "values", "set", "into", "the",
    "it", "a", "an",
}
HANDLER = re.compile(r"^pub async fn (\w+)\(", re.M)
# `FROM tbl alias` / `JOIN tbl AS alias` — the alias is optional.
# The optional `schema.` prefix is consumed, not captured: `FROM
# public.automation_credentials` was reading as a table named `public`.
SOURCE = re.compile(
    r"(?:FROM|JOIN)\s+(?:[a-z_][a-z0-9_]*\.)?([a-z_][a-z0-9_]*)"
    r"(?:\s+(?:AS\s+)?([a-z][a-z0-9_]*))?",
    re.I,
)
QUALIFIED = re.compile(r"\b([a-z][a-z0-9_]*)\.([a-z_][a-z0-9_]*)\b")
# Only text inside a Rust string literal is SQL. Without this, `tenant.to_string()`
# and `dept.format(..)` are read as `tenants.to_string` and `departments.format`
# — two columns that do not exist, reported against handlers that are fine.
SQL_LITERAL = re.compile(r'"((?:[^"\\]|\\.)*)"', re.S)
# Reads and writes fail differently, and only reads are covered by SOURCE +
# QUALIFIED above: a write names its columns bare, inside a list or after SET,
# with no alias to hang them off. Both pipeline bugs were writes, which is why
# a checker that only understood FROM/JOIN reported the file clean.
INSERT = re.compile(
    r"INSERT\s+INTO\s+(?:[a-z_][a-z0-9_]*\.)?([a-z_][a-z0-9_]*)\s*\(([^)]*)\)", re.I | re.S
)
UPDATE = re.compile(
    r"UPDATE\s+(?:[a-z_][a-z0-9_]*\.)?([a-z_][a-z0-9_]*)\s+SET\s+(.*?)"
    r"(?:\bWHERE\b|\bRETURNING\b|$)",
    re.I | re.S,
)
SET_COL = re.compile(r"([a-z_][a-z0-9_]*)\s*=", re.I)
# A CTE is a source that exists only for the length of the statement, so it is
# not in the catalogue and must not be reported missing.
CTE = re.compile(r"(?:WITH(?:\s+RECURSIVE)?|,)\s+([a-z_][a-z0-9_]*)\s+AS\s*\(", re.I)
# SQL functions that take FROM as an argument separator rather than a clause.
FN_WITH_FROM = re.compile(r"\b(EXTRACT|SUBSTRING|TRIM|POSITION|OVERLAY)\s*\([^()]*$")
# Not every string in a handler is SQL. "…components from the same donation…"
# reads as `FROM the` if prose and statements are pooled together, so each
# literal is judged on its own and only the ones carrying a SQL verb are read.
SQL_VERB = re.compile(
    r"\b(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|JOIN|WITH\s+[a-z_]+\s+AS)\b", re.I
)


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


def write_columns(body: str) -> list[tuple[str, str]]:
    """Every (table, column) a write in this body names."""
    refs: list[tuple[str, str]] = []
    ctes = {m.lower() for m in CTE.findall(body)}
    for tbl, collist in INSERT.findall(body):
        if tbl.lower() in ctes:
            continue
        for col in collist.split(","):
            col = col.strip().strip('"')
            if re.fullmatch(r"[a-z_][a-z0-9_]*", col or "", re.I):
                refs.append((tbl, col))
    for tbl, assigns in UPDATE.findall(body):
        if tbl.lower() in ctes:
            continue
        # `SET a = $1, b = now()` -- take the left of each assignment only, so
        # a function call on the right is not read as a column.
        for part in assigns.split(","):
            m = SET_COL.match(part.strip())
            if m:
                refs.append((tbl, m.group(1)))
    return refs


def audit(tables: set[str], cols: set[str], src: str) -> list[tuple[str, str, list[str], list[str]]]:
    out = []
    for name in sorted(os.listdir(src)):
        if not name.endswith(".rs"):
            continue
        text = open(os.path.join(src, name), encoding="utf-8", errors="replace").read()
        marks = [(m.group(1), m.start()) for m in HANDLER.finditer(text)]
        for i, (handler, start) in enumerate(marks):
            end = marks[i + 1][1] if i + 1 < len(marks) else len(text)
            missing_tables: list[str] = []
            missing_cols: list[str] = []

            # One statement at a time. Pooling a handler's literals lets an
            # alias from one query answer for another -- `e` is `encounters`
            # in one widget and `bme_equipment` in the next, and the pooled
            # map reported `bme_equipment.patient_id` against a query that
            # never mentions it. A `\`-continued query is a single literal,
            # so each literal is a whole statement.
            for raw in SQL_LITERAL.findall(text[start:end]):
                # A `\` at end of line is Rust's string continuation, not SQL.
                # Left in place it separates a comma from the CTE name that
                # follows it, so `, \<newline> dept_expense AS (` was not read
                # as a CTE and the CTE was reported as a missing table.
                body = re.sub(r"\\\s*\n\s*", " ", raw)
                if not SQL_VERB.search(body):
                    continue

                alias: dict[str, str] = {}
                ctes = {m.lower() for m in CTE.findall(body)}
                for m in SOURCE.finditer(body):
                    tbl, al = m.group(1), m.group(2)
                    # System catalogs are real tables that information_schema
                    # does not list — `pg_roles` in the outbox worker's
                    # BYPASSRLS assertion is legitimate SQL, not a missing
                    # table.
                    if tbl.lower().startswith(("pg_", "information_schema")):
                        continue
                    # `EXTRACT(EPOCH FROM AVG(...))` is not a table named AVG.
                    # A name followed by `(` is a function call, never a source.
                    # Checked here rather than as a lookahead in SOURCE, which
                    # just backtracks to a shorter name that satisfies it.
                    if body[m.end(1) :].lstrip().startswith("("):
                        continue
                    # `EXTRACT(DAY FROM p.paid_at - ...)` — the FROM belongs to
                    # the function call, and what follows it is a column.
                    before = body[max(0, m.start() - 60) : m.start()].upper()
                    if FN_WITH_FROM.search(before):
                        continue
                    # Matched case-insensitively: SOURCE is, so `DESC` and
                    # `AND` arrive uppercase and never matched the lowercase set.
                    if tbl.lower() in NOISE or tbl.lower() in ctes:
                        continue
                    if tbl not in tables:
                        if tbl not in missing_tables:
                            missing_tables.append(tbl)
                        continue
                    alias[al or tbl] = tbl
                    alias[tbl] = tbl

                for tbl, col in write_columns(body):
                    if tbl not in tables:
                        if tbl not in missing_tables:
                            missing_tables.append(tbl)
                        continue
                    ref = f"{tbl}.{col}"
                    if ref not in cols and ref not in missing_cols:
                        missing_cols.append(ref)

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
    ap.add_argument(
        "--src",
        default=DEFAULT_SRC,
        help="directory of .rs files to audit, relative to the repo root",
    )
    args = ap.parse_args()

    src = args.src if os.path.isabs(args.src) else os.path.join(ROOT, args.src)
    if not os.path.isdir(src):
        raise SystemExit(f"no such directory: {src}")

    tables, cols = schema()
    rows = audit(tables, cols, src)

    def state(mt: list[str], mc: list[str]) -> str:
        if mt and mc:
            return "BROKEN(table+column)"
        if mt:
            return "BROKEN(table)"
        if mc:
            return "BROKEN(column)"
        return "runnable"

    counts = Counter(state(mt, mc) for _, _, mt, mc in rows)
    print(f"{os.path.relpath(src, ROOT)}: {len(rows)} handler(s)\n")
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
