#!/usr/bin/env python3
"""The Rust `Relation` enum and `schema.zed` must name the same relations.

    python3 scripts/check_relation_parity.py

There are two authorization backends and they read different vocabularies.

`SpiceDB` evaluates `infra/spicedb/schema.zed`, where a permission is spelled
out — `permission view = owner + attending + dept_member + group_member + …`.

`PgAuthzBackend`, which serves every check when the sidecar is unreachable or
`SPICEDB_ENDPOINT` is unset, does not read that file. It expands a requested
relation through `Relation::implied_by()` and matches the resulting *enum
codes* against `relation_tuples.relation`. A relation the enum does not know
is a relation the Postgres path can never match.

That is not a theoretical gap. `grant_raw` writes `dept_member` because the
schema defines it; the enum does not have it; so those grants work through
SpiceDB and silently do not work through Postgres. The fallback quietly
enforces a stricter policy than the schema — and the only signal is that
somebody loses access during an incident, which is the worst moment to find out.

The reverse direction is a write-time failure instead: an enum code with no
matching schema relation cannot be written to SpiceDB at all, because SpiceDB
rejects unknown relations.

Parent pointers (`relation encounter: encounter`) are excluded — they exist for
arrow traversal (`encounter->view`), not to name a subject.
"""

from __future__ import annotations

import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ZED = os.path.join(ROOT, "infra/spicedb/schema.zed")
RELATIONS = os.path.join(ROOT, "crates/medbrains-authz/src/relations.rs")

RELATION_DECL = re.compile(r"^\s*relation\s+(\w+)\s*:\s*(.+)$", re.M)
ENUM_CODE = re.compile(r'"([a-z_]+)"\s*=>\s*Self::')

# `member` is the target of every `#member` arrow, declared on department and
# access_group. Subjects are never granted it through relation_tuples.
NOT_A_SUBJECT = {"tenant", "member"}


def schema_subject_relations() -> set[str]:
    """Relations whose target is a subject, not another object."""
    with open(ZED, encoding="utf-8") as handle:
        text = handle.read()
    found = set()
    for name, target in RELATION_DECL.findall(text):
        target = target.split("//")[0].strip()
        # A parent pointer targets an object type; a subject relation targets a
        # user or a #member set.
        if "user" in target or "#member" in target:
            found.add(name)
    return found - NOT_A_SUBJECT


def enum_codes() -> set[str]:
    with open(RELATIONS, encoding="utf-8") as handle:
        return set(ENUM_CODE.findall(handle.read()))


def main() -> int:
    schema = schema_subject_relations()
    rust = enum_codes()

    unreachable = sorted(schema - rust)   # SpiceDB grants Postgres cannot match
    unwritable = sorted(rust - schema)    # enum codes SpiceDB would reject

    print(f"schema.zed subject relations: {len(schema)}   Relation enum codes: {len(rust)}")

    if not unreachable and not unwritable:
        print("\n✓ both backends name the same relations.")
        return 0

    if unreachable:
        print(
            f"\n{len(unreachable)} relation(s) in schema.zed with no enum variant —\n"
            f"grants using these work through SpiceDB and are INVISIBLE to the\n"
            f"Postgres fallback:\n"
        )
        for name in unreachable:
            print(f"   {name}")

    if unwritable:
        print(
            f"\n{len(unwritable)} enum code(s) with no schema.zed relation —\n"
            f"SpiceDB rejects unknown relations, so these cannot be written to it:\n"
        )
        for name in unwritable:
            print(f"   {name}")

    print(
        "\nAdd the variant to crates/medbrains-authz/src/relations.rs (with its\n"
        "`implies()` edge so the Postgres expansion matches what the schema's\n"
        "`permission` line says), or add the relation to infra/spicedb/schema.zed.\n"
        "The two must agree: a policy that depends on which backend answered is\n"
        "not a policy."
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
