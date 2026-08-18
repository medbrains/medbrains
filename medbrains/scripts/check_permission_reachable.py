#!/usr/bin/env python3
"""A permission nobody holds and nothing checks is not a permission.

    python3 scripts/check_permission_reachable.py            # summary
    python3 scripts/check_permission_reachable.py --detail    # list them

The sibling of `check_permission_codes_defined.py`, pointed the other way.
That one catches a guard checking a code the catalogue does not define. This
one catches a code the catalogue defines that nothing uses, and separates the
two ways that happens, because they need opposite fixes:

  GUARDED, NEVER GRANTED   a handler demands it and no built-in role has it.
                           Every non-bypass caller gets 403 and the endpoint
                           looks broken. Either grant it or the guard is wrong.

  GRANTED, NEVER GUARDED   a role carries it and nothing checks it. Harmless
                           today, misleading tomorrow: the admin UI offers a
                           switch that changes nothing, which is worse than
                           offering no switch at all.

  ORPHANED                 neither. Dead vocabulary, or a feature that was
                           planned and never wired.

CLAUDE.md records the shape this comes from: "105 permissions existed in Rust
that the admin UI could not grant". Reporting, not gating — deciding whether a
code is dead or merely unwired needs a person, and a check that fails the
build on day one gets excluded from the build.

Resolution is exact, not fuzzy. `permissions.rs` is walked as a module tree so
`permissions::abdm::abha::VIEW` resolves to `abdm.abha.view` by construction; a
suffix-matching heuristic guessed wrong often enough to be worth replacing.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CRATES = os.path.join(ROOT, "crates")
CATALOGUE = os.path.join(CRATES, "medbrains-core", "src", "permissions.rs")
ROLES = os.path.join(CRATES, "medbrains-core", "src", "access", "roles.rs")

MOD = re.compile(r"pub mod (\w+)\s*\{")
CONST = re.compile(r'pub const ([A-Z_0-9]+): &str = "([a-z0-9_.]+)"')
USE = re.compile(r"permissions::([a-z_0-9:]+)::([A-Z_0-9]+)")
LITERAL = re.compile(r'"([a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+)"')


def catalogue() -> dict[str, str]:
    """`a::b::CONST` -> `a.b.const`, by walking the module tree exactly."""
    paths: dict[str, str] = {}
    stack: list[str] = []
    for line in open(CATALOGUE, encoding="utf-8"):
        s = line.strip()
        if m := MOD.match(s):
            stack.append(m.group(1))
            continue
        if m := CONST.match(s):
            paths["::".join(stack + [m.group(1)])] = m.group(2)
            continue
        if s.startswith("}") and stack:
            stack.pop()
    return paths


def codes_in(text: str, paths: dict[str, str], known: set[str]) -> set[str]:
    found = set()
    for m in USE.finditer(text):
        key = f"{m.group(1)}::{m.group(2)}"
        if key in paths:
            found.add(paths[key])
    for m in LITERAL.finditer(text):
        if m.group(1) in known:
            found.add(m.group(1))
    return found


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--detail", action="store_true")
    args = ap.parse_args()

    paths = catalogue()
    known = set(paths.values())

    granted = codes_in(open(ROLES, encoding="utf-8").read(), paths, known)

    guarded: set[str] = set()
    for dirpath, dirs, files in os.walk(CRATES):
        dirs[:] = [d for d in dirs if d != "target"]
        for name in files:
            if not name.endswith(".rs"):
                continue
            path = os.path.join(dirpath, name)
            if os.path.abspath(path) in (os.path.abspath(CATALOGUE), os.path.abspath(ROLES)):
                continue
            try:
                guarded |= codes_in(
                    open(path, encoding="utf-8", errors="replace").read(), paths, known
                )
            except OSError:
                continue

    unreachable = sorted(guarded - granted)
    inert = sorted(granted - guarded)
    orphan = sorted(known - granted - guarded)

    print(f"catalogue {len(known)}   granted {len(granted)}   guarded {len(guarded)}\n")
    print(f"  guarded, never granted : {len(unreachable):>4}   403 for every non-bypass caller")
    print(f"  granted, never guarded : {len(inert):>4}   a switch that changes nothing")
    print(f"  neither                : {len(orphan):>4}   dead or never wired")

    if args.detail:
        for title, group in (
            ("GUARDED, NEVER GRANTED", unreachable),
            ("GRANTED, NEVER GUARDED", inert),
            ("ORPHANED", orphan),
        ):
            if not group:
                continue
            print(f"\n=== {title} ({len(group)})")
            for code in group:
                print(f"   {code}")
    else:
        for title, group in (
            ("guarded, never granted", unreachable),
            ("orphaned", orphan),
        ):
            if group:
                top = Counter(c.split(".")[0] for c in group).most_common(8)
                print(f"\n  {title}, by module: " + ", ".join(f"{m} {n}" for m, n in top))
        print("\n  `--detail` for the codes.")

    print(
        "\nGuarded-never-granted is the one that bites: the handler demands a code no\n"
        "built-in role carries, so it answers 403 to everyone except a bypass role and\n"
        "looks like a broken feature rather than a missing grant.\n"
        "\n"
        "Read the number with care. `super_admin` and `hospital_admin` bypass every\n"
        "check, so an `admin.*` code with no grant is usually correct — administration\n"
        "is what those roles are for. The ones that matter are the clinical and\n"
        "operational modules, where a nurse or a doctor plainly needs the capability\n"
        "and no built-in role has it: `icu.*` (ventilator settings, flowsheets,\n"
        "neonatal, sepsis scores) and `bedside.*` (the tablet at the bed) are named by\n"
        "no role at all, so every one of those endpoints answers 403 to the staff who\n"
        "use them."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
