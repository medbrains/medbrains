#!/usr/bin/env python3
"""Ask Postgres to parse every runtime query in the workspace.

`check_sql_schema.py` reads the migrations and reports identifiers that cannot
resolve. It found 356, and it cannot find everything: it does not know types.

`tenant_critical` shipped with `$3 IS NOT NULL` in its WHERE clause. Every
identifier in it exists. It compiles, it passes clippy, and it fails every time
it runs -- the planner has nothing to infer a parameter type from, sqlx parses
with unspecified types, and the server answers "could not determine data type
of parameter $3". No amount of reading the DDL finds that. Only the server
knows.

So this hands each query to Postgres and asks it to PREPARE. That parses,
resolves and type-checks the statement without running it: no rows are read,
nothing is written, and the answer is the one the server would give in
production.

It needs a database with the schema in it. `--from` names one to clone (a
scratch copy is made and dropped, so the source is never touched).
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "medbrains"
CRATES = ROOT / "crates"
BASELINE = Path(__file__).resolve().parent / "sql_prepare_baseline.txt"
SCRATCH = "mb_prepare_check"


def rust_sql_literals(path: Path) -> list[tuple[int, str]]:
    """Every string literal that looks like a whole SQL statement."""
    text = path.read_text(errors="ignore")
    out = []
    for m in re.finditer(r'"((?:[^"\\]|\\.)*)"', text, re.S):
        # Raw strings belong to `sqlx::query!`, the compile-time macro, which
        # the compiler already checks. This pattern would match from the quote
        # after `r#` to the next quote inside the SQL, hand Postgres a
        # fragment, and report a syntax error that is entirely its own doing.
        if text[max(0, m.start() - 2) : m.start()].endswith(("r#", 'r')):
            continue
        # A fragment, not a statement: `String::from("SELECT ... WHERE x = $1")`
        # and `const SOMETHING: &str = "SELECT ..."` both have their GROUP BY,
        # ORDER BY and remaining filters pushed on at run time, so handing the
        # opening half to the server reports a query nobody ever sends.
        lead = text[max(0, m.start() - 220) : m.start()]
        if re.search(r"String::from\(\s*$", lead) or re.search(r"const\s+\w+:\s*&str\s*=\s*$", lead):
            continue
        sql = re.sub(r"\\\s*\n\s*", " ", m.group(1))
        sql = sql.replace('\\"', '"').replace("\\'", "'")
        if not re.match(r"\s*(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|WITH)\b", sql, re.I):
            continue
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
        # Built at run time. The identifiers are not known until it executes,
        # so there is nothing here for the server to parse.
        if "{" in sql:
            continue
        out.append((text[: m.start()].count("\n") + 1, sql))
    return out


def psql(db: str, sql: str, stop_on_error: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["psql", "-h", "127.0.0.1", "-U", "apple", "-d", db, "-X", "-q",
         "-v", "ON_ERROR_STOP=" + ("1" if stop_on_error else "0"), "-f", "-"],
        input=sql, capture_output=True, text=True, check=False,
    )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--from", dest="source", default="mb_schema",
                    help="database to clone the schema from (default: mb_schema)")
    ap.add_argument("--update", action="store_true", help="rewrite the baseline")
    ap.add_argument("--keep", action="store_true", help="leave the scratch database behind")
    args = ap.parse_args()

    probe = psql("postgres", f"SELECT 1 FROM pg_database WHERE datname='{args.source}'")
    if probe.returncode != 0 or "1" not in probe.stdout:
        print(f"no database named {args.source!r} to clone -- skipping.\n"
              f"This check needs a schema database; pass --from <name>.", file=sys.stderr)
        return 0

    psql("postgres", f'DROP DATABASE IF EXISTS "{SCRATCH}"', stop_on_error=False)
    made = psql("postgres", f'CREATE DATABASE "{SCRATCH}" TEMPLATE "{args.source}"')
    if made.returncode != 0:
        print(f"could not clone {args.source}: {made.stderr.strip()}", file=sys.stderr)
        return 2

    try:
        # Apply any migration the schema database has not seen. Cheap, and it
        # means a new migration is covered the day it is written.
        migrations = sorted((ROOT / "crates/medbrains-db/src/migrations").glob("*.sql"))
        for path in migrations:
            psql(SCRATCH, path.read_text(errors="ignore"), stop_on_error=False)

        statements, index = [], []
        for path in sorted(CRATES.glob("*/src/**/*.rs")):
            if "/tests/" in str(path):
                continue
            rel = path.relative_to(ROOT)
            for line, sql in rust_sql_literals(path):
                name = f"p{len(index)}"
                index.append((f"{rel}:{line}", sql))
                # `\\warn`, not `\\echo`: the marker has to go to stderr, where the
                # errors go, or the two streams interleave by luck and every
                # error is attributed to whatever was echoed last.
                statements.append(
                    f"\\warn <<{name}>>\nPREPARE {name} AS {sql};\nDEALLOCATE {name};"
                )

        run = psql(SCRATCH, "\n".join(statements), stop_on_error=False)

        # psql writes the marker to stdout and the error to stderr, so the two
        # are interleaved only by ordering. Walk stderr, attributing each error
        # to the marker most recently echoed.
        failures = []
        current = None
        for raw in run.stderr.splitlines():
            marker = re.match(r"<<(p\d+)>>", raw.strip())
            if marker:
                current = int(marker.group(1)[1:])
                continue
            # psql prefixes with `psql:<stdin>:12: `, so the line never starts
            # with ERROR. The DEALLOCATE after a failed PREPARE then reports
            # that the statement does not exist, which is the same failure
            # again wearing a second hat.
            err = re.search(r"\bERROR:\s*(.+)$", raw)
            if err and current is not None and current < len(index):
                message = err.group(1).strip()
                if re.match(r'prepared statement "p\d+" does not exist', message):
                    continue
                where, _ = index[current]
                failures.append(f"{where}  {message}")
                current = None

        found = sorted(set(failures))

        if args.update:
            BASELINE.write_text("\n".join(found) + "\n")
            print(f"baseline written: {len(found)} known failure(s) of {len(index)} statements")
            return 0

        def key(entry: str) -> str:
            path, _, rest = entry.partition(":")
            return path + "::" + rest.split("  ", 1)[-1].strip()

        known = {key(l) for l in BASELINE.read_text().splitlines() if l.strip()} \
            if BASELINE.exists() else set()
        fresh = [f for f in found if key(f) not in known]

        if fresh:
            print(f"\nqueries Postgres refuses to parse, not in the baseline ({len(fresh)}):\n")
            for row in fresh:
                print("  " + row)
            print("\nEach fails the first time it is served. Fix it, or if this is\n"
                  "expected run: python3 scripts/check_sql_prepare.py --update\n")
            return 1

        print(f"no new unparseable queries "
              f"({len(index)} statements checked, {len(found)} known)")
        return 0
    finally:
        if not args.keep:
            psql("postgres", f'DROP DATABASE IF EXISTS "{SCRATCH}"', stop_on_error=False)


if __name__ == "__main__":
    sys.exit(main())
