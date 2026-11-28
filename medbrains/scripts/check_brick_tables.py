#!/usr/bin/env python3
"""Report: SQL in one brick's crates that touches another brick's tables.

    python3 scripts/check_brick_tables.py              # print the diff against the baseline
    python3 scripts/check_brick_tables.py --update     # record today's numbers
    python3 scripts/check_brick_tables.py --pairs      # today's numbers, baseline format
    python3 scripts/check_brick_tables.py --tables A B # the tables behind one pair
    python3 scripts/check_brick_tables.py --self-test

REPORT ONLY: it always exits 0 (the self-test aside). In CI a rise in WRITES for
a brick pair is a warning on the run; reads are printed. It becomes a failing
check once the numbers have been watched for a while.

"One brick, one owner of its data" (docs/architecture/MODULE-BRICKS.md). A crate's
brick comes from `bricks/crates.txt`. A table's owner is worked out from the
code: the class whose crates have the most write statements on it (a tie goes to
the alphabetically first). A reference counts when the crate is a brick's, the
owner is a different brick, and neither is base, shared or the shell. Each
`INSERT INTO`, `UPDATE`, `DELETE FROM` target is one write; each `FROM` or
`JOIN` target is one read.

Known blind spots, all of which make the numbers too LOW:
- only upper-case SQL keywords in `.rs` and `.sql` under `crates/*/src` are seen;
  lower-case SQL, a table name put together at run time, and SQL outside `src/`
  are missed;
- views and SQL functions are not followed: a read through a view counts for
  nobody, and a function that writes three bricks' tables is invisible;
- a table nobody writes from app code has no owner and is never counted;
- the owner is a guess from write counts, so it can be wrong for a table several
  bricks write (`encounters`, `invoices`), and it can move when code moves.
"""

from __future__ import annotations

import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CRATES = ROOT / "crates"
MIGRATIONS = CRATES / "medbrains-db-migrations" / "src" / "migrations"
CLASSES = ROOT / "bricks" / "crates.txt"
BASELINE = ROOT / "scripts" / "brick_tables.baseline.txt"
# Seeds, migrations and importers write every brick's tables by design.
SETUP = {"medbrains-seed", "medbrains-db-migrations", "medbrains-loadtest", "medbrains-history-import"}
BRICK_KINDS = ("brick:", "multi-brick:", "not-yet-brick:")

CREATE = re.compile(r'CREATE TABLE (?:IF NOT EXISTS )?(?:public\.)?"?([a-z_0-9]+)"?', re.I)
WRITE = re.compile(r"\b(?:INSERT INTO|UPDATE|DELETE FROM)\s+(?:ONLY\s+)?(?:public\.)?([a-z_0-9]+)")
READ = re.compile(r"(?<!DELETE )\b(?:FROM|JOIN)\s+(?:ONLY\s+)?(?:public\.)?([a-z_0-9]+)")
HEADER = """\
# SQL references from one brick's crates to tables another brick owns, on 2026-11-23.
# Written by scripts/check_brick_tables.py --update; the report prints the difference.
# from -> to  reads  writes
"""


def brick_of(cls: str) -> str | None:
    """The brick id of a crate class, or None for base, shared, shell, tooling and native."""
    return cls.split(":", 1)[1] if cls.startswith(BRICK_KINDS) else None


def scan(sources: dict[str, list[str]], known: set[str]) -> tuple[dict, dict]:
    """`table -> crate -> count` for writes and for reads, over each crate's source texts."""
    writes: dict[str, Counter] = {}
    reads: dict[str, Counter] = {}
    for crate, texts in sources.items():
        for text in texts:
            text = re.sub(r"//[^\n]*", "", text)
            for found, pattern in ((writes, WRITE), (reads, READ)):
                for table in pattern.findall(text):
                    if table in known:
                        found.setdefault(table, Counter())[crate] += 1
    return writes, reads


def owners(writes: dict[str, Counter], classes: dict[str, str]) -> dict[str, str]:
    """Each written table's owner: the brick id or class with the most writes, ties by name."""
    out = {}
    for table, by_crate in writes.items():
        by_owner = Counter()
        for crate, count in by_crate.items():
            by_owner[brick_of(classes[crate]) or classes[crate]] += count
        out[table] = min(by_owner, key=lambda owner: (-by_owner[owner], owner))
    return out


def cross_brick(sources: dict[str, list[str]], known: set[str], classes: dict[str, str]) -> tuple[dict, Counter]:
    """`(from, to) -> [reads, writes]`, and `(from, to, table) -> count` for the detail view."""
    writes, reads = scan(sources, known)
    owner = owners(writes, classes)
    bricks = {brick_of(cls) for cls in classes.values()} - {None}
    pairs: dict[tuple[str, str], list[int]] = {}
    tables = Counter()
    for slot, found in ((0, reads), (1, writes)):
        for table, by_crate in found.items():
            dst = owner.get(table)
            for crate, count in by_crate.items():
                src = brick_of(classes[crate])
                if src and dst in bricks and src != dst:
                    pairs.setdefault((src, dst), [0, 0])[slot] += count
                    tables[(src, dst, table)] += count
    return pairs, tables


def read_baseline(text: str) -> dict[tuple[str, str], list[int]]:
    """The baseline as `(from, to) -> [reads, writes]`; lines read `from -> to R W`."""
    rows = (line.split() for line in text.splitlines() if line.strip() and not line.startswith("#"))
    return {(src, dst): [int(r), int(w)] for src, _, dst, r, w in rows}


def format_pairs(pairs: dict[tuple[str, str], list[int]]) -> str:
    """Baseline lines for the given counts, sorted."""
    return "".join(f"{src} -> {dst} {r} {w}\n" for (src, dst), (r, w) in sorted(pairs.items()))


def diff(live: dict, base: dict) -> tuple[list[str], list[str]]:
    """Pairs whose writes rose (the warnings), and every other change (for the log)."""
    warn, info = [], []
    for pair in sorted(live.keys() | base.keys()):
        (r, w), (br, bw) = live.get(pair, [0, 0]), base.get(pair, [0, 0])
        name = f"{pair[0]} -> {pair[1]}"
        if w > bw:
            warn.append(f"{name}: writes {bw} -> {w} (+{w - bw})")
        elif w < bw:
            info.append(f"{name}: writes {bw} -> {w}")
        if r != br:
            info.append(f"{name}: reads {br} -> {r}")
    return warn, info


def load() -> tuple[dict[str, list[str]], set[str], dict[str, str]]:
    """Source texts per classified crate, the tables the migrations create, and the crate classes."""
    lines = (line.split() for line in CLASSES.read_text(encoding="utf-8").splitlines() if line.strip() and not line.startswith("#"))
    classes = {crate: cls for crate, cls in lines}
    known = {t for p in MIGRATIONS.glob("*.sql") for t in CREATE.findall(re.sub(r"--[^\n]*", "", p.read_text(encoding="utf-8")))}
    sources: dict[str, list[str]] = {}
    for path in [*CRATES.glob("*/src/**/*.rs"), *CRATES.glob("*/src/**/*.sql")]:
        crate = path.relative_to(CRATES).parts[0]
        if crate in classes and crate not in SETUP:
            sources.setdefault(crate, []).append(path.read_text(encoding="utf-8", errors="ignore"))
    return sources, known, classes


def self_test() -> int:
    """Prove a cross-brick write and read are counted, and that base, shared and own tables are not."""
    classes = {"lab": "brick:lab", "bill": "brick:billing", "bill2": "brick:billing", "camp": "not-yet-brick:camp",
               "db": "base", "tok": "shared-health-service", "srv": "shell"}
    known = {"invoices", "lab_orders", "tokens", "users"}
    src = {
        "bill": ['q("INSERT INTO invoices (id) VALUES ($1)"); q("UPDATE invoices SET x = 1"); q("SELECT 1 FROM lab_orders JOIN users u ON true");'],
        "bill2": ['q("DELETE FROM invoices WHERE id = $1");'],
        "lab": ['q("INSERT INTO lab_orders (id) VALUES ($1)");\n// q("UPDATE invoices SET commented = 1")\nq("SELECT * FROM invoices i JOIN tokens t ON true");'],
        "tok": ['q("INSERT INTO tokens (id) VALUES ($1)"); q("UPDATE invoices SET t = 1");'],
        "db": ['q("INSERT INTO users (id) VALUES ($1)"); q("SELECT 1 FROM unknown_table");'],
        "srv": ['q("UPDATE lab_orders SET s = 1");'], "camp": [],
    }
    pairs, tables = cross_brick(src, known, classes)
    # billing reads lab's table; lab reads billing's. Shared, base and shell crates count for nobody.
    assert pairs == {("billing", "lab"): [1, 0], ("lab", "billing"): [1, 0]}, pairs
    assert tables[("lab", "billing", "invoices")] == 1
    # Lower-case SQL is the stated blind spot; a DELETE is one write and not a read as well.
    src["camp"] = ['q("UPDATE invoices SET paid = true"); q("DELETE FROM invoices"); q("update invoices set lower = 1");']
    pairs, _ = cross_brick(src, known, classes)
    assert pairs[("camp", "billing")] == [0, 2]
    base = {("billing", "lab"): [1, 0], ("lab", "billing"): [3, 2]}
    assert diff(pairs, base) == (["camp -> billing: writes 0 -> 2 (+2)"], ["lab -> billing: writes 2 -> 0", "lab -> billing: reads 3 -> 1"])
    assert read_baseline(HEADER + format_pairs(pairs)) == pairs
    # A tie on writes goes to the first name, so the owner does not depend on file order.
    assert owners({"t": Counter({"lab": 2, "bill": 1, "bill2": 1})}, classes) == {"t": "billing"}
    print("✓ self-test passed")
    return 0


def main() -> int:
    """Print the report; warn on a rise in writes; never fail."""
    if "--self-test" in sys.argv:
        return self_test()
    pairs, tables = cross_brick(*load())
    if "--pairs" in sys.argv:
        print(format_pairs(pairs), end="")
        return 0
    if "--tables" in sys.argv:
        src, dst = sys.argv[sys.argv.index("--tables") + 1 :][:2]
        for (a, b, table), count in sorted(tables.items(), key=lambda row: -row[1]):
            if (a, b) == (src, dst):
                print(f"{count:4} {table}")
        return 0
    if "--update" in sys.argv:
        BASELINE.write_text(HEADER + format_pairs(pairs), encoding="utf-8")
    warn, info = diff(pairs, read_baseline(BASELINE.read_text(encoding="utf-8")))
    reads, writes = (sum(p[i] for p in pairs.values()) for i in (0, 1))
    print(f"cross-brick table references: {reads} reads, {writes} writes over {len(pairs)} brick pairs (report only)")
    for line in info:
        print(f"  {line}")
    for line in warn:
        print(f"::warning title=Cross-brick table write::{line}. A brick writes another brick's table; see --tables.")
    if not warn and not info:
        print("  no change from scripts/brick_tables.baseline.txt")
    return 0


if __name__ == "__main__":
    sys.exit(main())
