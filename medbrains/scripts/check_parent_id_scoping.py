#!/usr/bin/env python3
"""A nested route must not discard the parent id it was given.

    python3 scripts/check_parent_id_scoping.py

`PUT /api/ipd/admissions/{admission_id}/checklist/{item_id}` binds both ids and
then does:

    Path((_admission_id, item_id)): Path<(Uuid, Uuid)>
    ...
    "UPDATE admission_checklists SET ... WHERE id = $1 AND tenant_id = $2"

The admission id is accepted, underscore-prefixed, and never used. The statement
is scoped by tenant alone, so the item is updated whichever admission it
actually belongs to — the URL is not merely unchecked, it is *ignored*.

Two things go wrong, and the second is the one that bites later:

1. Any item id in the tenant can be reached through any parent, so the parent
   segment provides no authorization at all — a per-record check on the parent
   (which most of these also lack) would still be bypassed by the child.
2. **The audit trail records the URL.** The row says the clinician acted on
   admission A while the write landed on admission B. An investigation reading
   that log reaches a confidently wrong conclusion.

The fix is to bind the parent and scope by it:

    Path((admission_id, item_id)): Path<(Uuid, Uuid)>
    "UPDATE ... WHERE id = $1 AND admission_id = $2 AND tenant_id = $3"

and, separately, to authorize the parent record. Scoping is not authorization —
it makes the URL honest; `require_admission_access` decides who may act on it.
"""

from __future__ import annotations

import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CRATES = os.path.join(ROOT, "crates")

# `Path((_parent, child))` — a tuple extractor whose FIRST element is discarded.
DISCARDED_PARENT = re.compile(r"Path\(\(\s*(_\w+)\s*,")
HANDLER = re.compile(r"pub async fn (\w+)\s*\(")

# Reviewed and deliberately allowed, with the reason.
#
# These three discard the URL's admission id and then resolve the device's
# ACTUAL admission from the database before authorizing it:
#
#     SELECT admission_id FROM icu_devices WHERE id = $1 AND tenant_id = $2
#     require_admission_access(&state, &claims, admission_id).await?;
#
# That is stronger than scoping by the URL, because it authorizes the real
# owner rather than trusting a path segment. This checker cannot see that —
# it detects a discarded parent, not what the handler does instead — so the
# exemption is recorded here rather than the code being changed to satisfy it.
ACCEPTED: dict[str, str] = {
    "crates/medbrains-facilities/src/icu.rs::remove_device":
        "resolves the device's real admission and authorizes that",
    "crates/medbrains-facilities/src/icu.rs::list_bundle_checks":
        "resolves the device's real admission and authorizes that",
    "crates/medbrains-facilities/src/icu.rs::create_bundle_check":
        "resolves the device's real admission and authorizes that",
}


def offenders() -> list[tuple[str, int, str, str]]:
    found = []
    for dirpath, dirs, files in os.walk(CRATES):
        dirs[:] = [d for d in dirs if d != "target"]
        for name in files:
            if not name.endswith(".rs"):
                continue
            path = os.path.join(dirpath, name)
            rel = os.path.relpath(path, ROOT)
            try:
                text = open(path, encoding="utf-8", errors="replace").read()
            except OSError:
                continue
            for m in DISCARDED_PARENT.finditer(text):
                before = text[: m.start()]
                names = HANDLER.findall(before)
                handler = names[-1] if names else "?"
                if f"{rel}::{handler}" in ACCEPTED:
                    continue
                line = before.count("\n") + 1
                found.append((rel, line, handler, m.group(1)))
    return found


def main() -> int:
    found = offenders()
    if not found:
        print(f"✓ no nested route discards its parent id ({len(ACCEPTED)} reviewed exception(s))")
        return 0

    print(f"{len(found)} handler(s) bind a parent id and discard it:\n")
    for rel, line, handler, param in found:
        print(f"   {rel}:{line}")
        print(f"      {handler}  —  {param}")
    print(
        "\nBind the parent and add it to the statement's WHERE clause, so the URL\n"
        "cannot address a child under the wrong parent. Then authorize the parent\n"
        "record separately — scoping makes the URL honest, it does not decide who\n"
        "may act on it.\n"
        "A genuinely safe case goes in ACCEPTED in this script, with the reason."
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
