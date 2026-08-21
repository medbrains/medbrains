#!/usr/bin/env python3
"""Rank the unindexed foreign keys by whether an index would actually help.

    python3 scripts/triage_fk_indexes.py
    python3 scripts/triage_fk_indexes.py --emit-sql

983 of 2,254 foreign keys have no index on the referencing column. Indexing all
983 would be its own anti-pattern: an index nobody reads still costs write
throughput, disk, and vacuum time on every insert, and a hospital's write path
is not somewhere to spend that speculatively.

## Why the usual argument does not apply here

The standard reason to index a foreign key is that a parent `DELETE` scans the
whole child table to check the constraint. That barely applies to this schema:
**757 of 872 tables carry a `soft_delete_guardrail` trigger** that rewrites
`DELETE` into an `UPDATE` of `deleted_at`, so the constraint check never fires.
1,976 of the foreign keys are `NO ACTION` besides.

What is left is join cost — and that is decided by whether the column is
actually used in a query, not by whether a constraint exists. So the ranking
below is driven by real usage found in the Rust sources, not by the catalog
alone.

## Signals

* **queried** — the column appears in a `WHERE` or `JOIN` in the codebase.
  Strongest signal: somebody looks rows up by it.
* **cascade** — `ON DELETE CASCADE` or `SET NULL`, which does fire on the
  115 tables without the guardrail.
* **hot parent** — child of a table that grows without bound (patients,
  encounters, orders), where a sequential scan gets worse every month.
"""

from __future__ import annotations

import argparse
import collections
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Tables that grow with activity rather than with configuration. A missing
# index on a child of one of these degrades continuously; on a child of a
# lookup table it does not.
HOT_PARENTS = {
    "patients", "encounters", "admissions", "appointments", "prescriptions",
    "lab_orders", "invoices", "invoice_items", "payments", "pharmacy_orders",
    "audit_log", "notifications", "visits", "er_visits", "radiology_orders",
    "camp_registrations", "approval_requests", "workflow_instances",
}


def unindexed_fks() -> list[dict]:
    """Foreign keys with no index whose leading columns match."""
    sql = """
    WITH fks AS (
      SELECT c.oid, c.conrelid, c.conkey,
             t.relname AS child,
             (SELECT relname FROM pg_class WHERE oid = c.confrelid) AS parent,
             (SELECT attname FROM pg_attribute
               WHERE attrelid = c.conrelid AND attnum = c.conkey[1]) AS col,
             c.confdeltype AS del,
             EXISTS (SELECT 1 FROM pg_trigger g JOIN pg_proc p ON p.oid = g.tgfoid
                      WHERE g.tgrelid = c.confrelid
                        AND p.proname = 'soft_delete_guardrail') AS parent_soft_deletes
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE c.contype = 'f' AND n.nspname = 'public'
    )
    SELECT child, col, parent, del, parent_soft_deletes FROM fks f
    WHERE NOT EXISTS (
      SELECT 1 FROM pg_index i WHERE i.indrelid = f.conrelid
        AND (i.indkey::smallint[])[0:array_length(f.conkey,1)-1] @> f.conkey)
    ORDER BY child, col;
    """
    out = subprocess.run(
        ["docker", "compose", "exec", "-T", "postgres", "psql", "-U", "medbrains",
         "-d", "medbrains", "-At", "-F", "\t", "-c", sql],
        cwd=ROOT, capture_output=True, text=True,
    ).stdout
    rows = []
    for line in out.strip().split("\n"):
        parts = line.split("\t")
        if len(parts) != 5:
            continue
        rows.append({
            "child": parts[0], "col": parts[1], "parent": parts[2],
            "del": parts[3], "soft": parts[4] == "t",
        })
    return rows


def query_usage() -> collections.Counter:
    """How often each column name is filtered or joined on, across the Rust sources.

    Deliberately coarse: it counts a column *name*, not a name qualified by its
    table, so `patient_id` scores highly across the board. That is the right
    bias — a column used everywhere is one worth indexing wherever it appears —
    but it does mean the number is a signal and not a measurement.
    """
    usage: collections.Counter = collections.Counter()
    pattern = re.compile(
        r"(?:WHERE|AND|OR|JOIN\s+\w+\s+\w*\s*ON)\s+[\w.]*\b([a-z_]+_id)\b\s*(?:=|IN|=\s*ANY)",
        re.I,
    )
    crates = os.path.join(ROOT, "crates")
    for dirpath, _dirs, files in os.walk(crates):
        if "/target/" in dirpath:
            continue
        for name in files:
            if not name.endswith(".rs"):
                continue
            try:
                with open(os.path.join(dirpath, name), encoding="utf-8", errors="replace") as fh:
                    text = fh.read()
            except OSError:
                continue
            for match in pattern.finditer(text):
                usage[match.group(1).lower()] += 1
    return usage


def score(fk: dict, usage: collections.Counter) -> tuple[int, list[str]]:
    """Priority, and the reasons for it."""
    points, why = 0, []

    queried = usage.get(fk["col"], 0)
    if queried:
        points += min(queried, 40)
        why.append(f"queried {queried}x")

    # CASCADE and SET NULL genuinely scan the child — but only where the parent
    # is not soft-deleted, which is where the trigger does not apply.
    if fk["del"] in {"c", "n"} and not fk["soft"]:
        points += 25
        why.append("cascade on a hard-deleting parent")
    elif fk["del"] in {"c", "n"}:
        why.append("cascade, but parent soft-deletes")

    if fk["parent"] in HOT_PARENTS:
        points += 15
        why.append(f"child of {fk['parent']}")

    return points, why


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--emit-sql", action="store_true", help="print CREATE INDEX for tier 1")
    parser.add_argument("--tier1-cutoff", type=int, default=25)
    args = parser.parse_args()

    fks = unindexed_fks()
    if not fks:
        print("no unindexed foreign keys — nothing to triage")
        return 0
    usage = query_usage()

    scored = []
    for fk in fks:
        points, why = score(fk, usage)
        scored.append((points, fk, why))
    scored.sort(key=lambda item: -item[0])

    tier1 = [s for s in scored if s[0] >= args.tier1_cutoff]
    tier2 = [s for s in scored if 0 < s[0] < args.tier1_cutoff]
    tier3 = [s for s in scored if s[0] == 0]

    if args.emit_sql:
        print("-- Indexes for the foreign keys that evidence says are actually used.")
        print(f"-- Tier 1 of a triage over {len(fks)} unindexed foreign keys; the other")
        print(f"-- {len(fks) - len(tier1)} are left alone deliberately — an index nothing reads")
        print("-- still costs write throughput on every insert.\n")
        for points, fk, why in tier1:
            print(f"-- {fk['child']}.{fk['col']} -> {fk['parent']}: {', '.join(why)}")
            print(f"CREATE INDEX IF NOT EXISTS idx_{fk['child']}_{fk['col']}")
            print(f"    ON public.{fk['child']} ({fk['col']});\n")
        return 0

    print(f"{len(fks)} unindexed foreign keys\n")
    print(f"TIER 1 — index these ({len(tier1)}):")
    for points, fk, why in tier1[:30]:
        print(f"  {points:>3}  {fk['child']}.{fk['col']:<28} -> {fk['parent']:<24} {', '.join(why)}")
    if len(tier1) > 30:
        print(f"       … and {len(tier1) - 30} more")

    print(f"\nTIER 2 — some evidence, decide per case ({len(tier2)})")
    print(f"TIER 3 — no evidence of use, leave alone ({len(tier3)})")
    print(f"\n  {100 * len(tier1) // len(fks)}% warrant an index on current evidence,")
    print(f"  not {100}%. Run with --emit-sql for tier 1.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
