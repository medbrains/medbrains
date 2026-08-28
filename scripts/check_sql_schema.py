#!/usr/bin/env python3
"""Check runtime SQL against the migrations that define the schema.

Three lab print endpoints shipped querying tables and columns that do not
exist. `get_investigation_requisition_print_data` joined `lab_order_items`,
which no migration creates. `get_lab_report_full_print_data` selected
`FROM test_catalog`, when the table is `lab_test_catalog`. The bedside portal
read `lr.completed_at`, a column `lab_results` has never had. Each one failed
for every request it ever served.

Nothing caught them because these are runtime `sqlx::query_as` calls, not the
compile-time macros. The type checker sees a string. The only way to learn the
table is missing is to run the query, and nobody ran these.

So this reads the DDL out of the migrations and the SQL out of the Rust, and
reports references that cannot resolve. It is deliberately conservative: it
reports a table only when no migration mentions it at all, and a column only
when the alias unambiguously resolves to one known table. Anything it cannot
parse confidently, it skips -- a checker that cries wolf gets switched off.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "medbrains"
BASELINE = Path(__file__).resolve().parent / "sql_schema_baseline.txt"
MIGRATIONS = ROOT / "crates" / "medbrains-db" / "src" / "migrations"
CRATES = ROOT / "crates"

# Columns every query may name without the table declaring them.
UNIVERSAL = {"*", "count", "now", "current_date", "current_timestamp"}

# SQL keywords that can follow a table name and are not an alias.
NOT_AN_ALIAS = {
    "on", "where", "set", "using", "group", "order", "limit", "join", "inner",
    "left", "right", "full", "cross", "lateral", "union", "having", "returning",
    "values", "as", "and", "or", "for", "offset", "window", "except",
    "intersect", "fetch", "into",
}


def load_schema() -> dict[str, set[str]]:
    """Table -> columns, from CREATE TABLE plus later ADD COLUMN."""
    tables: dict[str, set[str]] = {}
    create = re.compile(
        r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?(\w+)\s*\((.*?)\n\);",
        re.S | re.I,
    )
    add_col = re.compile(
        r"ALTER\s+TABLE\s+(?:ONLY\s+)?(?:IF\s+EXISTS\s+)?(?:public\.)?(\w+)(.*?);",
        re.S | re.I,
    )
    col_name = re.compile(r"^\s*(\w+)\s+")

    for path in sorted(MIGRATIONS.glob("*.sql")):
        text = path.read_text(errors="ignore")
        for table, body in create.findall(text):
            cols = tables.setdefault(table.lower(), set())
            depth = 0
            line_acc = []
            for line in body.split("\n"):
                # Skip table-level constraints, which are not columns.
                stripped = line.strip().lower()
                if stripped.startswith(
                    ("constraint", "primary key", "foreign key", "unique", "check", "exclude")
                ):
                    continue
                m = col_name.match(line)
                if m and depth == 0:
                    cols.add(m.group(1).lower())
                depth += line.count("(") - line.count(")")
            _ = line_acc
        for table, rest in add_col.findall(text):
            for m in re.finditer(r"ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)", rest, re.I):
                tables.setdefault(table.lower(), set()).add(m.group(1).lower())
    return tables


def rust_sql_literals(path: Path) -> list[tuple[int, str]]:
    """Every string literal that looks like a SQL statement, with its line."""
    text = path.read_text(errors="ignore")
    out = []
    for m in re.finditer(r'"((?:[^"\\]|\\.)*)"', text, re.S):
        raw = m.group(1)
        # Rust line continuations: backslash-newline-indent collapses to nothing.
        sql = re.sub(r"\\\s*\n\s*", " ", raw)
        sql = sql.replace('\\"', '"').replace("\\'", "'")
        if not re.match(r"\s*(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|WITH)\b", sql, re.I):
            continue
        # `format!("UPDATE public.{table} SET ...")` builds the identifier at
        # run time. Nothing static can say what it resolves to, so the name is
        # replaced with a token the checks below treat as opaque.
        sql = re.sub(r"\{[^}]*\}", " __dynamic__ ", sql)
        sql = re.sub(r"\bpublic\.\s*__dynamic__", " __dynamic__ ", sql)
        if len(sql) < 30:
            continue
        # "Select an active staff member from this tenant" is an error message,
        # not a query. Requiring a second clause keyword keeps English prose
        # that happens to start with a verb out of the results.
        if not re.search(r"\b(FROM|VALUES|SET|WHERE|JOIN)\b", sql, re.I):
            continue
        # "Select an active staff member from this tenant" clears the test
        # above on the word "from". A real statement also has a placeholder, a
        # column list or a call in it; a sentence has none of the three.
        if not re.search(r"\$\d|,|\(", sql):
            continue
        out.append((text[: m.start()].count("\n") + 1, sql))
    return out


# `FROM` inside these is an argument separator, not a table clause.
FROM_FUNCS = ("extract", "substring", "trim", "position", "overlay")


def strip_from_functions(sql: str) -> str:
    """Blank out EXTRACT(... FROM col) and friends, balancing parentheses."""
    out = sql
    for func in FROM_FUNCS:
        while True:
            m = re.search(rf"\b{func}\s*\(", out, re.I)
            if not m:
                break
            depth, i = 0, m.end() - 1
            while i < len(out):
                if out[i] == "(":
                    depth += 1
                elif out[i] == ")":
                    depth -= 1
                    if depth == 0:
                        break
                i += 1
            out = out[: m.start()] + " " * (i + 1 - m.start()) + out[i + 1 :]
    return out


def aliases_and_tables(sql: str) -> tuple[dict[str, str], set[str], set[str]]:
    """alias -> table, all tables referenced, and names to ignore (CTEs etc)."""
    alias_map: dict[str, str] = {}
    tables: set[str] = set()
    opaque: set[str] = {"__dynamic__"}

    # Every CTE, not just the first: `WITH a AS (...), b AS (...)`.
    for m in re.finditer(r"(?:\bWITH\b|,)\s*(\w+)\s+AS\s*\(", sql, re.I):
        opaque.add(m.group(1).lower())
    # A derived table's alias: `FROM ( ... ) x`.
    for m in re.finditer(r"\)\s*(?:AS\s+)?(\w+)\b", sql, re.I):
        name = m.group(1).lower()
        if name not in NOT_AN_ALIAS:
            opaque.add(name)

    sql = strip_from_functions(sql)

    pattern = re.compile(
        r"(?<!DO )\b(?:FROM|JOIN|INSERT\s+INTO|UPDATE)\s+(?:ONLY\s+)?(?:public\.)?(\w+)"
        r"(\s*\()?"
        r"(?:\s+(?:AS\s+)?(\w+))?",
        re.I,
    )
    for m in pattern.finditer(sql):
        table = m.group(1).lower()
        # `FROM unnest($1)` / `FROM generate_series(...)` is a function call.
        if m.group(2):
            opaque.add(table)
            continue
        alias = (m.group(3) or "").lower()
        if table in {"select", "lateral", "set"}:
            continue
        tables.add(table)
        if alias and alias not in NOT_AN_ALIAS:
            alias_map[alias] = table
        alias_map.setdefault(table, table)
    return alias_map, tables, opaque


def main() -> int:
    schema = load_schema()
    known = set(schema)
    if not known:
        print("could not read any CREATE TABLE from the migrations", file=sys.stderr)
        return 2

    missing_tables: list[str] = []
    missing_columns: list[str] = []
    files = sorted(CRATES.glob("*/src/**/*.rs"))

    for path in files:
        if "/tests/" in str(path):
            continue
        rel = path.relative_to(ROOT)
        for line, sql in rust_sql_literals(path):
            alias_map, tables, opaque = aliases_and_tables(sql)

            for table in sorted(tables):
                if table in known or table in opaque:
                    continue
                # Only report a name no migration mentions anywhere; a table
                # created by an extension or a temp table is not our business.
                if re.search(rf"\b{re.escape(table)}\b", " ".join(known)):
                    continue
                missing_tables.append(f"{rel}:{line}  table `{table}` is not in any migration")

            for m in re.finditer(r"\b(\w+)\.(\w+)\b", sql):
                alias, col = m.group(1).lower(), m.group(2).lower()
                if alias in opaque or col in UNIVERSAL or alias not in alias_map:
                    continue
                table = alias_map[alias]
                if table not in schema:
                    continue
                if col in schema[table]:
                    continue
                missing_columns.append(
                    f"{rel}:{line}  {alias}.{col} -- `{table}` has no column `{col}`"
                )

    found = sorted(set(missing_tables) | set(missing_columns))

    if "--update" in sys.argv:
        BASELINE.write_text("\n".join(found) + "\n")
        print(f"baseline written: {len(found)} known unresolved reference(s)")
        return 0

    # A ratchet, not a gate. There are hundreds of these already and they are
    # somebody's afternoon each; failing the build on all of them would get the
    # check switched off within a day. What must not happen is a new one.
    # Keyed on file and finding, never on line number. Keying on the line
    # meant that editing anything above a known finding re-reported every
    # finding below it -- fifty-two of them, the first time this was used in
    # anger -- and the one genuinely new entry was lost in the noise.
    def key(entry: str) -> str:
        path, _, rest = entry.partition(":")
        return path + "::" + rest.split("  ", 1)[-1].strip()

    known = set()
    if BASELINE.exists():
        known = {key(l) for l in BASELINE.read_text().splitlines() if l.strip()}

    fresh = [f for f in found if key(f) not in known]
    fixed = len(known) - len({key(f) for f in found if key(f) in known})

    if fresh:
        print(f"\nSQL references that cannot resolve and are not in the baseline "
              f"({len(fresh)}):\n")
        for row in fresh:
            print("  " + row)
        print(
            "\nThese are runtime queries -- `sqlx::query_as`, not the macro -- so\n"
            "nothing else will tell you. Each fails the first time it is served.\n"
            "Fix the query, or if the schema genuinely changed run:\n"
            "    python3 scripts/check_sql_schema.py --update\n"
        )
        return 1

    msg = f"no new unresolved SQL references ({len(found)} known, {len(files)} files)"
    if fixed > 0:
        msg += f" -- {fixed} fewer than the baseline, run --update to bank it"
    print(msg)
    return 0


if __name__ == "__main__":
    sys.exit(main())
