#!/usr/bin/env python3
"""An authorization check must not have its error collapsed into `false`.

    python3 scripts/check_authz_collapse.py

`AuthzBackend::check` returns `Result<bool, AuthzError>`, and the shortest way
to use one is `.unwrap_or(false)`. It reads as "deny on error", which sounds
like the safe choice and is how this pattern reached thirty-one call sites.

It is not safe, because the caller then answers with whatever it answers a
genuine refusal with — and those answers are deliberately indistinguishable
from absence:

    require_encounter_access -> NotFound   a fault says "no such encounter"
    list_accessible          -> empty Vec  a fault says "you have no patients"
    grounding gate           -> None       the AI answers with the chart
                                           silently missing from it

None of those are refusals. They are statements about the world, made by a
system that has just lost the ability to know anything about it, to a
clinician who has no reason to doubt them.

The fix is `outcome_of` + `collapse` in `middleware/authorization.rs`, which
keeps the third value:

    Allow   -> Ok(())
    Deny    -> NotFound / Forbidden, as that call site already chose
    Unknown -> 503, which is retryable, alertable, and visibly not an answer

Note that not every `Err` is an outage — `AuthzError::Forbidden` and
`CaveatFailed` are answers, and `outcome_of` maps them to `Deny`. That is the
reason to route through it rather than hand-write a `match`.
"""

from __future__ import annotations

import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CRATES = os.path.join(ROOT, "crates")

COLLAPSE = re.compile(r"unwrap_or\(false\)|unwrap_or_default\(\)|\.is_ok\(\)|\.is_err\(\)")
# An authz call within the preceding few lines — the call chains over several
# lines, so a single-line match misses most of them (it missed 20 of 31 once).
AUTHZ_CALL = re.compile(
    r"\.authz\b|\.check\(&authz_ctx|list_accessible|bulk_check|"
    r"require_patient_access|require_patient_viewer|"
    r"require_encounter_access|require_admission_access"
)
LOOKBACK = 8

# Sites reviewed and deliberately left collapsing, with the reason. A decision
# recorded here is a decision; one left in the code is an accident waiting to
# be copied.
ACCEPTED = {
    # Decorates list rows with per-row can-edit flags for UI buttons. An empty
    # map hides buttons: fails closed, and claims nothing about the patient.
    "crates/medbrains-patients/src/lib.rs:1310",
}


def offenders() -> list[tuple[str, int, str]]:
    found: list[tuple[str, int, str]] = []
    for dirpath, dirs, files in os.walk(CRATES):
        dirs[:] = [d for d in dirs if d != "target"]
        for name in files:
            if not name.endswith(".rs"):
                continue
            path = os.path.join(dirpath, name)
            rel = os.path.relpath(path, ROOT)
            if rel.endswith("medbrains-authz/src/decision.rs"):
                continue  # the module that documents the anti-pattern
            try:
                lines = open(path, encoding="utf-8", errors="replace").read().split("\n")
            except OSError:
                continue
            for i, line in enumerate(lines):
                if not COLLAPSE.search(line):
                    continue
                # The collapse must be on the authz call's own chain. Without
                # this, an unrelated `body.is_primary.unwrap_or(false)` later in
                # a function that happens to do an authz check reads as a hit.
                stripped = line.lstrip()
                if not (stripped.startswith(".") or ".await" in line):
                    continue
                context = "\n".join(lines[max(0, i - LOOKBACK) : i + 1])
                if not AUTHZ_CALL.search(context):
                    continue
                if f"{rel}:{i + 1}" in ACCEPTED:
                    continue
                found.append((rel, i + 1, line.strip()))
    return found


def main() -> int:
    found = offenders()
    if not found:
        print(f"✓ no authorization check collapses its error ({len(ACCEPTED)} reviewed exception(s))")
        return 0

    print(f"{len(found)} authorization check(s) collapse an error into a denial:\n")
    for rel, line_no, code in found:
        print(f"   {rel}:{line_no}")
        print(f"      {code}")
    print(
        "\nRoute these through `outcome_of` + `collapse` in\n"
        "crates/medbrains-server-core/src/middleware/authorization.rs so an\n"
        "outage answers 503 instead of claiming the record does not exist.\n"
        "If a site genuinely should collapse, add it to ACCEPTED in this script\n"
        "with the reason — the decision belongs somewhere a reader will find it."
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
