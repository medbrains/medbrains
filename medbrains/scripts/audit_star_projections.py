#!/usr/bin/env python3
"""Which `SELECT *` structs disagree with their table.

`SELECT *` or `RETURNING *` decoded into a hand-written struct is the failure
mode behind several defects found in the 2026-09-06 sweep: the settlement
struct declared four columns `pharmacy_day_settlements` does not have, the
substitutes struct wanted `created_by` and `updated_at`, a duplicate
onboarding struct wanted three more, and the NDPS destruction register wanted
`updated_at`. In each case FromRow could not find a column, the query could
not decode, and the handler had never once returned a row.

The compiler cannot see any of it, because these are runtime queries. This
audit can: it pairs each `query_as::<_, Struct>("... * ... FROM table")` with
the live schema and reports the fields the table cannot supply.

It reports candidates, not verdicts. Two things it deliberately cannot know:

  joins and computed columns — `SELECT p.*, u.full_name AS user_name` supplies
  `user_name` from another table, and this only reads the base table, so
  struct fields fed by a join look missing. Most flags are this.

  `#[sqlx(rename = "...")]` IS honoured, because ignoring it produced a false
  positive worth remembering: `Encounter.chief_complaint` is renamed onto
  `encounters.chief_complaints`, and the code was correct.

So: treat output as a list to check, and confirm against the struct before
believing any of it.

    python3 scripts/audit_star_projections.py            # whole workspace
    python3 scripts/audit_star_projections.py <crate>    # one crate
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CRATES = ROOT / "crates"
SKIP = {"medbrains-loadtest"}

STRUCT = re.compile(r"pub struct (\w+)\s*\{(.*?)\n\}", re.S)
# A field, with the `#[sqlx(rename = "x")]` immediately above it if present.
FIELD = re.compile(r'(?:#\[sqlx\(rename\s*=\s*"(?P<ren>[^"]+)"\)\]\s*)?\n\s*pub (?P<name>\w+)\s*:')
QUERY_AS = re.compile(r'query_as::<\s*_\s*,\s*(\w+)\s*>\s*\(\s*"((?:[^"\\]|\\.)*)"', re.S)
STAR = re.compile(r"(SELECT|RETURNING)\s+\*", re.I)
SOURCE = re.compile(r"\b(?:FROM|INTO|UPDATE)\s+(?:[a-z_]+\.)?([a-z_][a-z0-9_]*)", re.I)


def structs() -> dict[str, set[str]]:
    """{struct -> column names it expects, after honouring sqlx renames}."""
    out: dict[str, set[str]] = {}
    for crate in sorted(CRATES.iterdir()):
        if not (crate / "src").is_dir() or crate.name in SKIP:
            continue
        for path in (crate / "src").rglob("*.rs"):
            text = path.read_text(encoding="utf-8", errors="replace")
            for m in STRUCT.finditer(text):
                cols = {
                    f.group("ren") or f.group("name")
                    for f in FIELD.finditer(m.group(2))
                }
                if cols:
                    out.setdefault(m.group(1), cols)
    return out


def pairs(only: str | None) -> list[tuple[str, str, str]]:
    """(crate, struct, table) for every star-projecting query_as."""
    seen: set[tuple[str, str, str]] = set()
    out: list[tuple[str, str, str]] = []
    for crate in sorted(CRATES.iterdir()):
        if not (crate / "src").is_dir() or crate.name in SKIP:
            continue
        if only and crate.name != only:
            continue
        for path in (crate / "src").rglob("*.rs"):
            text = path.read_text(encoding="utf-8", errors="replace")
            for m in QUERY_AS.finditer(text):
                sql = re.sub(r"\\\s*\n\s*", " ", m.group(2))
                if not STAR.search(sql):
                    continue
                src = SOURCE.search(sql)
                if not src:
                    continue
                key = (crate.name, m.group(1), src.group(1))
                if key not in seen:
                    seen.add(key)
                    out.append(key)
    return out


def schema(tables: list[str]) -> dict[str, set[str]]:
    if not tables:
        return {}
    names = ",".join("'" + t + "'" for t in tables)
    sql = (
        "select table_name||'|'||string_agg(column_name,',' order by column_name) "
        f"from information_schema.columns where table_name in ({names}) group by table_name"
    )
    res = subprocess.run(
        ["docker", "compose", "exec", "-T", "postgres", "psql",
         "-U", "medbrains", "-d", "medbrains", "-tAc", sql],
        capture_output=True, text=True, cwd=ROOT,
    )
    if res.returncode != 0:
        raise SystemExit(
            "could not read the schema — is postgres up?\n"
            "  docker compose up -d postgres\n" + res.stderr.strip()
        )
    return {
        line.split("|")[0]: set(line.split("|")[1].split(","))
        for line in res.stdout.splitlines() if "|" in line
    }


def main(argv: list[str]) -> int:
    only = argv[0] if argv and not argv[0].startswith("-") else None
    known = structs()
    rows = pairs(only)
    cols = schema(sorted({t for _c, _s, t in rows}))

    flagged = 0
    for crate, struct, table in rows:
        if table not in cols:
            print(f"MISSING TABLE  {crate:30} {struct:26} <- {table}")
            flagged += 1
            continue
        if struct not in known:
            continue
        missing = [f for f in sorted(known[struct]) if f not in cols[table]]
        if missing:
            print(f"CHECK          {crate:30} {struct:26} <- {table:28} {', '.join(missing[:6])}")
            flagged += 1

    print(
        f"\n{len(rows)} star-projecting struct/table pairs"
        f"{'' if only else f' across {len({r[0] for r in rows})} crates'}; "
        f"{flagged} to check."
    )
    print(
        "CHECK rows are candidates, not defects — a field supplied by a JOIN "
        "looks missing here.\nConfirm against the struct before believing one."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
