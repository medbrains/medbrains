#!/usr/bin/env python3
"""Every redactable field must declare what kind of data it is.

    python3 scripts/check_field_classes.py

A field becomes redactable by adding a `const X_FIELD: &str = "..."` somewhere
in the crates. That marks it as *something a role might not see*; it does not
say what it is, and the presentation depends entirely on the class:

    patients.date_of_birth      Identifying   masked as `19**`
    opd.diagnosis               Sensitive     withheld — "Diagnosis: ****"
                                              still says a diagnosis exists
    patients.identifiers.id_number  Restricted  withheld — the visible half of
                                              a government ID is enough to
                                              correlate against another source

An unclassified field falls back to `Routine`, which renders normally. That is
the right default — silence must not hide data — but it means a genuinely
sensitive field added without a class is quietly shown to everyone who can see
the record, and nobody finds out by using the system.

So the check is here rather than relying on the default: adding the constant
and forgetting the class fails the build, at the moment it is cheap to fix.
"""

from __future__ import annotations

import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CRATES = os.path.join(ROOT, "crates")
TABLE = os.path.join(ROOT, "crates/medbrains-authz/src/field_class.rs")

FIELD_CONST = re.compile(r'const\s+[A-Z_0-9]+_FIELD\s*:\s*&str\s*=\s*"([a-z_][a-z_.]*)"')
CLASSIFIED = re.compile(r'key:\s*"([a-z_.]+)"\s*,\s*class:\s*DataClass::(\w+)')


def declared_fields() -> set[str]:
    found: set[str] = set()
    for dirpath, dirs, files in os.walk(CRATES):
        dirs[:] = [d for d in dirs if d not in {"target", "vendor"}]
        for name in files:
            if not name.endswith(".rs"):
                continue
            try:
                with open(os.path.join(dirpath, name), encoding="utf-8", errors="replace") as f:
                    found.update(FIELD_CONST.findall(f.read()))
            except OSError:
                continue
    return found


def classified() -> dict[str, str]:
    if not os.path.exists(TABLE):
        raise SystemExit(f"missing {os.path.relpath(TABLE, ROOT)}")
    with open(TABLE, encoding="utf-8") as handle:
        return dict(CLASSIFIED.findall(handle.read()))


def main() -> int:
    fields = declared_fields()
    classes = classified()

    if not fields:
        print("found no *_FIELD constants — has the naming convention changed?")
        return 1

    missing = sorted(fields - set(classes))
    orphaned = sorted(set(classes) - fields)

    print(f"redactable fields: {len(fields)}   classified: {len(fields & set(classes))}")

    if missing:
        print(f"\n{len(missing)} redactable field(s) with no declared class:\n")
        for key in missing:
            print(f"   {key}")
        print(
            "\nAdd each to FIELD_CLASSES in crates/medbrains-authz/src/field_class.rs.\n"
            "The class decides how the field is withheld — masking a clinical value\n"
            "or a government ID leaks more than it protects, so the choice is not a\n"
            "detail. Until then these render normally to anyone who can see the record."
        )
        return 1

    if orphaned:
        # Not fatal: a class left behind after a field was removed is dead
        # weight, not a risk. Worth saying so it gets cleaned up.
        print(f"\n{len(orphaned)} classified key(s) with no matching constant (stale):")
        for key in orphaned:
            print(f"   {key}")

    print("\n✓ every redactable field declares its class.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
