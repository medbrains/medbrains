#!/usr/bin/env python3
"""A list must not show what somebody deleted.

    python3 scripts/check_soft_delete_filter.py              # report
    python3 scripts/check_soft_delete_filter.py --check      # fail on new leaks
    python3 scripts/check_soft_delete_filter.py --update-baseline

Most tables carry `soft_delete_guardrail()` (migration 0001): a `DELETE` never
removes the row, it sets `deleted_at` (and `is_active = false`). Row-level
security scopes by tenant only. So a delete "works" — the handler returns 200
— and the row stays on every list whose query does not say
`deleted_at IS NULL`. An administrator deletes a department and it is still
there; a clinician removes a wrong allergy and it is still on the chart.

This flags `list_*` / `search_*` handlers that read a guarded table and never
mention `deleted_at` (or filter `is_active`, which the trigger clears). It
reads the whole function body, so a builder that pushes the predicate into a
conditions vec counts. A read that must see deleted rows (audit, restore)
says so with `// allow-soft-deleted: <reason>` in its body.

The baseline records the leaks that existed when the check arrived; `--check`
fails on any new one, and on a baseline entry that has since been fixed, so
the list only shrinks.

A second rule has no baseline: a `DELETE` on a guarded table followed by a
`rows_affected() == 0` "not found" check. The trigger cancels the delete, so
the count is always 0 and the handler answers 404 for a row it just removed —
the clinician is told the allergy they deleted "was not found". Soft-delete
explicitly with `UPDATE ... SET deleted_at = now(), ... WHERE ... AND
deleted_at IS NULL`, whose count is real.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CRATES = os.path.join(ROOT, "crates")
MIGRATIONS = os.path.join(CRATES, "medbrains-db-migrations", "src", "migrations")
BASELINE = os.path.join(ROOT, "scripts", "soft_delete_filter.baseline.json")

GUARDED = re.compile(
    r"BEFORE DELETE ON (?:public\.)?(\w+)\s+FOR EACH ROW EXECUTE FUNCTION "
    r"(?:public\.)?soft_delete_guardrail\(\)",
    re.I,
)
HANDLER = re.compile(r"^\s*pub(?:\([^)]*\))? async fn ((?:list|search)_\w+)\s*[<(]", re.M)
FROM = re.compile(r"\b(?:FROM|JOIN)\s+(?:public\.)?([a-z_][a-z0-9_]*)", re.I)
DELETE = re.compile(r"\bDELETE\s+FROM\s+(?:public\.)?([a-z_][a-z0-9_]*)", re.I)
FILTERED = re.compile(
    r"deleted_at|(?:WHERE|AND)\s+(?:\w+\.)?is_active\b(?:\s*=\s*true\b|(?!\s*=))",
    re.I,
)
ALLOWED = "allow-soft-deleted:"
ZERO_CHECK = re.compile(r"rows_affected\(\)\s*==\s*0")


def guarded_tables() -> set[str]:
    tables: set[str] = set()
    for name in os.listdir(MIGRATIONS):
        if name.endswith(".sql"):
            with open(os.path.join(MIGRATIONS, name), encoding="utf-8") as fh:
                tables.update(t.lower() for t in GUARDED.findall(fh.read()))
    return tables


def rust_files():
    for dirpath, _, files in os.walk(CRATES):
        if "/target" in dirpath or "/tests" in dirpath:
            continue
        for name in files:
            if name.endswith(".rs"):
                yield os.path.join(dirpath, name)


def function_body(src: str, start: int) -> str:
    """From the signature to the closing brace at the signature's indent."""
    line_start = src.rfind("\n", 0, start) + 1
    indent = len(src[line_start:start]) - len(src[line_start:start].lstrip())
    end = re.compile(r"^" + " " * indent + r"\}", re.M).search(src, start)
    return src[start : end.end() if end else len(src)]


def scan(guarded: set[str]) -> tuple[dict[str, list[str]], set[str]]:
    leaks: dict[str, list[str]] = {}
    deleted_from: set[str] = set()
    sources = {path: open(path, encoding="utf-8").read() for path in rust_files()}
    for src in sources.values():
        deleted_from.update(t.lower() for t in DELETE.findall(src))
    for path, src in sources.items():
        rel = os.path.relpath(path, ROOT)
        for match in HANDLER.finditer(src):
            body = function_body(src, match.start())
            if ALLOWED in body or FILTERED.search(body):
                continue
            tables = sorted({t.lower() for t in FROM.findall(body)} & guarded)
            if tables:
                leaks[f"{rel}::{match.group(1)}"] = tables
    return leaks, deleted_from


def deletes_reporting_zero(guarded: set[str]) -> list[str]:
    """`DELETE` on a guarded table whose handler then treats 0 rows as absent."""
    found = []
    for path in rust_files():
        src = open(path, encoding="utf-8").read()
        for m in DELETE.finditer(src):
            if m.group(1).lower() in guarded and ZERO_CHECK.search(src, m.end(), m.end() + 900):
                line = src.count("\n", 0, m.start()) + 1
                found.append(f"{os.path.relpath(path, ROOT)}:{line}  {m.group(1)}")
    return found


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--update-baseline", action="store_true")
    args = ap.parse_args()

    guarded = guarded_tables()
    leaks, deleted_from = scan(guarded)
    zero = deletes_reporting_zero(guarded)

    if args.update_baseline:
        with open(BASELINE, "w", encoding="utf-8") as fh:
            json.dump(sorted(leaks), fh, indent=2)
            fh.write("\n")
        print(f"baseline written: {len(leaks)} leaking handlers")
        return 0

    live = {k for k, tables in leaks.items() if set(tables) & deleted_from}
    if not args.check:
        for key in sorted(leaks):
            mark = "  [deleted from]" if key in live else ""
            print(f"{key}  {', '.join(leaks[key])}{mark}")
        print(f"\n{len(leaks)} handlers leak; {len(live)} read tables the code deletes from.")
        return 0

    for site in zero:
        print(f"DELETE-404  {site}  — the trigger cancels the delete; its count is always 0")
    with open(BASELINE, encoding="utf-8") as fh:
        baseline = set(json.load(fh))
    new = sorted(set(leaks) - baseline)
    fixed = sorted(baseline - set(leaks))
    for key in new:
        print(f"NEW  {key}  reads {', '.join(leaks[key])} without `deleted_at IS NULL`")
    for key in fixed:
        print(f"FIXED  {key}  — remove it from the baseline (--update-baseline)")
    if new or fixed or zero:
        print(
            "\nA soft-deleted row stays on every list that does not filter it. Add "
            "`deleted_at IS NULL`, or `// allow-soft-deleted: <reason>` for a read "
            "that must see deleted rows.",
            file=sys.stderr,
        )
        return 1
    print(f"soft-delete filter: {len(leaks)} known leaks, none new")
    return 0


if __name__ == "__main__":
    sys.exit(main())
