#!/usr/bin/env python3
"""Every upsert on a partial unique key names the key's predicate.

    python3 scripts/check_partial_upserts.py              # whole workspace
    python3 scripts/check_partial_upserts.py FILE.rs ...  # just these files

A unique key that holds among live rows only (`CREATE UNIQUE INDEX … WHERE
deleted_at IS NULL`, #4690) is matched by `ON CONFLICT (cols)` only when the
upsert repeats the predicate: `ON CONFLICT (cols) WHERE deleted_at IS NULL`.
Without it Postgres refuses the statement at run time — and a boot seed that
does so stops the server from starting. The compiler cannot see this; this
does.

It also checks the other half of the same trap (``--`` revival): an upsert
whose key is a full (not live-rows-only) key on a soft-deletable table can
conflict with a soft-deleted row. `DO UPDATE SET value = …` then writes the
new value into a row that stays deleted — the save "succeeds" and every reader
that honours soft-delete still sees nothing. Such an upsert must reset
`deleted_at` (`deleted_at = NULL, deleted_by = NULL, delete_reason = NULL`),
or carry `// upsert-keeps-deleted: <reason>` within the statement's lines.

Keys are read from the migrations in order: a partial unique index makes a key
partial, a full unique index or constraint on the same columns (not later
dropped) satisfies a bare ON CONFLICT, and DROP INDEX / DROP CONSTRAINT
removes what it names.
"""

from __future__ import annotations

import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CRATES = os.path.join(ROOT, "crates")
MIGRATIONS = os.path.join(CRATES, "medbrains-db-migrations", "src", "migrations")

INDEX = re.compile(
    r"CREATE UNIQUE INDEX (?:IF NOT EXISTS )?(\w+)\s+ON (?:ONLY )?(?:public\.)?(\w+)"
    r"(?:\s+USING \w+)?\s*\(([^;]*?)\)\s*(WHERE [^;]+)?;",
    re.I,
)
CONSTRAINT = re.compile(
    r"ALTER TABLE (?:ONLY )?(?:public\.)?(\w+)\s+ADD CONSTRAINT (\w+) UNIQUE\s*\(([^)]*)\)",
    re.I,
)
DROPPED = re.compile(r"DROP (?:INDEX|CONSTRAINT) (?:IF EXISTS )?(?:public\.)?(\w+)", re.I)
INSERT = re.compile(r"INSERT INTO\s+(?:public\.)?(\w+)", re.I)
# The predicate may follow a Rust string's `\` line continuation.
CONFLICT = re.compile(r"ON CONFLICT\s*\(([^)]*)\)([\s\\]*WHERE\b)?", re.I)


def key(table: str, cols: str) -> tuple[str, tuple[str, ...]]:
    return table.lower(), tuple(sorted(c.strip().lower() for c in cols.split(",")))


def partial_keys() -> set[tuple[str, tuple[str, ...]]]:
    partial: dict[str, tuple] = {}
    full: dict[str, tuple] = {}
    for name in sorted(os.listdir(MIGRATIONS)):
        if not name.endswith(".sql"):
            continue
        with open(os.path.join(MIGRATIONS, name), encoding="utf-8") as fh:
            sql = fh.read()
        # Statements apply in file order; drops come before re-creates.
        events = [(m.start(), "drop", m) for m in DROPPED.finditer(sql)]
        events += [(m.start(), "index", m) for m in INDEX.finditer(sql)]
        events += [(m.start(), "constraint", m) for m in CONSTRAINT.finditer(sql)]
        for _, kind, m in sorted(events, key=lambda e: e[0]):
            if kind == "drop":
                partial.pop(m.group(1), None)
                full.pop(m.group(1), None)
            elif kind == "index":
                target = partial if m.group(4) else full
                target[m.group(1)] = key(m.group(2), m.group(3))
            else:
                full[m.group(2)] = key(m.group(1), m.group(3))
    return set(partial.values()) - set(full.values())


def rust_files(paths: list[str]):
    if paths:
        yield from (p for p in paths if p.endswith(".rs"))
        return
    for dirpath, _, files in os.walk(CRATES):
        if "/target" not in dirpath:
            yield from (os.path.join(dirpath, f) for f in files if f.endswith(".rs"))


DO_UPDATE = re.compile(r"DO\s+UPDATE\s+SET\b", re.I)
KEEPS_DELETED = "upsert-keeps-deleted:"


def soft_deletable_tables() -> set[str]:
    """Tables under `soft_delete_guardrail()` — a DELETE leaves a row behind."""
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from check_soft_delete_filter import guarded_tables  # noqa: E402

    return guarded_tables()


def revival_violations(paths: list[str]) -> list[str]:
    soft = soft_deletable_tables()
    found = []
    for path in rust_files(paths):
        with open(path, encoding="utf-8") as fh:
            src = fh.read()
        for m in INSERT.finditer(src):
            table = m.group(1).lower()
            if table not in soft:
                continue
            nxt = INSERT.search(src, m.end())
            end = nxt.start() if nxt else len(src)
            segment = src[m.end() : end][:3000]
            c = CONFLICT.search(segment)
            if not c or c.group(2):  # no upsert, or live-rows-only key
                continue
            # The statement ends at the closing quote of the SQL literal.
            stmt_end = segment.find('"', c.end())
            stmt = segment[: stmt_end if stmt_end != -1 else len(segment)]
            if not DO_UPDATE.search(stmt) or "deleted_at" in stmt[c.end():]:
                continue
            if KEEPS_DELETED in segment:
                continue
            line = src.count("\n", 0, m.start()) + 1
            rel = os.path.relpath(path, ROOT)
            found.append(
                f"{rel}:{line}: INSERT INTO {table} … ON CONFLICT ({c.group(1)}) DO UPDATE "
                "can hit a soft-deleted row and leave it deleted; add "
                "`deleted_at = NULL, deleted_by = NULL, delete_reason = NULL` to the SET"
            )
    return found


def violations(paths: list[str]) -> list[str]:
    keys = partial_keys()
    found = []
    for path in rust_files(paths):
        with open(path, encoding="utf-8") as fh:
            src = fh.read()
        for m in INSERT.finditer(src):
            nxt = INSERT.search(src, m.end())
            segment = src[m.end() : nxt.start() if nxt else len(src)][:3000]
            c = CONFLICT.search(segment)
            if c and not c.group(2) and key(m.group(1), c.group(1)) in keys:
                line = src.count("\n", 0, m.start()) + 1
                rel = os.path.relpath(path, ROOT)
                found.append(
                    f"{rel}:{line}: INSERT INTO {m.group(1)} … ON CONFLICT ({c.group(1)}) "
                    "targets a live-rows-only key; write "
                    f"ON CONFLICT ({c.group(1)}) WHERE deleted_at IS NULL"
                )
    return found


def main() -> int:
    found = violations(sys.argv[1:])
    revived = revival_violations(sys.argv[1:])
    for v in found + revived:
        print(v)
    if found:
        print(f"check-partial-upserts: {len(found)} upsert(s) would fail at run time")
    if revived:
        print(f"check-partial-upserts: {len(revived)} upsert(s) can update a soft-deleted row")
    if found or revived:
        return 1
    print("check-partial-upserts: OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
