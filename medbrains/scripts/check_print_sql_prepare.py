#!/usr/bin/env python3
"""PREPARE every SQL statement in a crate against the dev database.

    python3 scripts/check_print_sql_prepare.py                       # print-data
    python3 scripts/check_print_sql_prepare.py crates/medbrains-ipd/src

`check_print_data_schema.py` matches table and column names by pattern, and an
unqualified column slips past it: the MLC register summary filtered `mlc_cases`
on `period`, `age` and `outcome`, none of which exist, and the checker called it
runnable. PREPARE asks Postgres itself — every table, column, cast and operator
is resolved — without executing anything.

Needs the dev database up (docker compose). Reports, exits 1 on any failure.
"""
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / (sys.argv[1] if len(sys.argv) > 1 else "crates/medbrains-print-data/src")

# Where a call's first argument starts. What follows is one of: a plain or raw
# string literal, `concat!(` of literals, or the name of a `const` &str.
CALL = re.compile(r"sqlx::query(?:_as|_scalar)?(?:::<[^(]*>|!)?\(\s*(?:[A-Z]\w*\s*,\s*)?", re.S)
PLAIN = re.compile(r'"((?:[^"\\]|\\.)*)"', re.S)
RAW = re.compile(r'r(#*)"(.*?)"\1', re.S)
CONST = re.compile(r'const (\w+): &str =\s*(r#*"|")', re.S)


def unescape(rust: str) -> str:
    """A Rust literal with `\\` line continuations, as the SQL Postgres sees."""
    sql = re.sub(r"\\\n\s*", "", rust)
    return sql.replace('\\"', '"').replace("\\\\", "\\")


def literal_at(text: str, pos: int) -> str | None:
    """The SQL a literal (plain, raw or concat!) starting at `pos` spells."""
    rest = text[pos:]
    if rest.startswith("concat!("):
        depth, end = 0, 0
        for end, ch in enumerate(rest):
            depth += ch == "("
            depth -= ch == ")"
            if depth == 0 and ch == ")":
                break
        lits = re.findall(r'r(#*)"(.*?)"\1|"((?:[^"\\]|\\.)*)"', rest[:end], re.S)
        return "".join(raw if raw else unescape(plain) for _, raw, plain in lits)
    raw = RAW.match(rest)
    if raw:
        return raw.group(2)
    plain = PLAIN.match(rest)
    return unescape(plain.group(1)) if plain else None


def statements() -> tuple[list[tuple[str, int, str]], int]:
    found, total = [], 0
    for path in sorted(SRC.rglob("*.rs")):
        text = path.read_text(errors="ignore")
        consts = {}
        for m in CONST.finditer(text):
            sql = literal_at(text, m.end() - len(m.group(2)))
            if sql:
                consts[m.group(1)] = sql
        for m in CALL.finditer(text):
            total += 1
            sql = literal_at(text, m.end())
            if sql is None:
                name = re.match(r"&?(\w+)\s*\)", text[m.end():])
                sql = consts.get(name.group(1)) if name else None
            if sql is not None:
                line = text.count("\n", 0, m.start()) + 1
                found.append((str(path.relative_to(ROOT)), line, sql))
    return found, total


def prepare(sql: str) -> str | None:
    """None when Postgres accepts the statement, else its error line."""
    script = f"BEGIN;\nPREPARE chk AS {sql};\nROLLBACK;\n"
    run = subprocess.run(
        ["docker", "compose", "exec", "-T", "postgres", "psql", "-U", "medbrains",
         "-d", "medbrains", "-v", "ON_ERROR_STOP=1", "-q"],
        input=script, capture_output=True, text=True, cwd=ROOT,
    )
    if run.returncode == 0:
        return None
    return next((l for l in run.stderr.splitlines() if "ERROR" in l), run.stderr.strip())


def main() -> int:
    failures = 0
    stmts, total = statements()
    for file, line, sql in stmts:
        error = prepare(sql)
        if error:
            failures += 1
            print(f"{file}:{line}: {error}")
    print(f"{len(stmts)} statements, {failures} rejected by Postgres")
    # A query assembled with format! or a const is not a literal; say how many
    # this cannot see rather than imply it checked them.
    print(f"{total - len(stmts)} queries not checked (built at runtime)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
