#!/usr/bin/env python3
"""A database read must not have its error collapsed into an empty result.

    python3 scripts/check_query_collapse.py

Sibling of `check_authz_collapse.py`, and the same mistake one layer down.
That one stops an authorization *fault* from answering like a refusal; this
one stops a database *fault* from answering like an absence:

    .fetch_all(&mut *tx).await.unwrap_or_default()

reads as "no rows", and every caller then presents it as a fact about the
world. What that looked like in practice:

    bedside tablet   -> "no medications due", "no vitals recorded", at the bed
    discharge        -> a total bill of 0, shown to the patient being discharged
    death certificate-> the "other significant conditions" section printed blank
    NABH/NMC report  -> a compliance section printed empty, which reads as a
                        finding rather than as a database that was unreachable

None of those are empty results. They are statements made by a system that
has just lost the ability to know anything, in the one format that cannot be
distinguished from a real answer.

`?` is almost always the fix — 27 of the 28 sites found sat in a function
already returning `Result`, so propagating cost nothing but the character.

A site that genuinely should degrade goes in ACCEPTED below with its reason.
The bar: empty must be a *true* answer for that caller, not merely a safe one.
"""

from __future__ import annotations

import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CRATES = os.path.join(ROOT, "crates")

# `unwrap_or_default()` was the only shape this caught for its first two weeks,
# which left seventeen sites invisible — `.unwrap_or(0)` on a `COUNT`, and
# `.unwrap_or(None)` on a lookup. A zero from a count is arguably worse than an
# empty list: a list can be read as "nothing yet", but a compliance report that
# says 0 infections is making a claim.
COLLAPSE = re.compile(
    r"\.fetch_(?:all|optional|one)\([^)]*\)\s*\n\s*\.await\s*\n\s*"
    r"\.unwrap_or(?:_default\(\)|\(\s*(?:None|false|0|Decimal::ZERO)\s*\))"
)

# Reviewed and deliberately left degrading, with the reason.
#
# All five are the demo simulator and the push-notification worker: developer
# tooling and a background task, neither of which renders a clinical document
# or answers a clinician. `send_push` additionally sits in a function that
# returns nothing, so it has no error to propagate.
ACCEPTED: dict[str, str] = {
    "crates/medbrains-server/src/routes/admin_simulator.rs::preview":
        "simulator preview — developer tooling, not a clinical read",
    "crates/medbrains-server/src/services/notification_listener.rs::send_push":
        "background worker; the function returns no Result to propagate into",
    "crates/medbrains-server/src/services/simulator/mod.rs::run":
        "demo data generator — degrading produces a thinner simulation, not a claim",
    "crates/medbrains-server/src/services/simulator/mod.rs::pick_lab_tests":
        "demo data generator — as above",
    "crates/medbrains-server/src/services/simulator/mod.rs::pick_modalities":
        "demo data generator — as above",
    # The module-entitlement gate fails open ON PURPOSE and says so in its own
    # docstring: an absent `module_config` row means enabled, so a transient
    # database fault never takes a live clinical module offline. A licensing
    # gate erring towards "the hospital keeps working" is a business risk, not
    # a safety one — the opposite trade to a clinical read, and the right one.
    "crates/medbrains-server-core/src/middleware/entitlement.rs::require_module_enabled":
        "licensing gate; documented fail-open so a fault cannot black out a live module",
    # Drives the read-only/maintenance banner. Unknown means normal operation.
    "crates/medbrains-server-core/src/middleware/system_state.rs::fetch_mode":
        "system-mode probe; returns no Result, and unknown means normal operation",
    # Background push to the TV queue boards, and the demo pacer. Neither
    # answers a clinician and neither has a Result to propagate into.
    "crates/medbrains-tv/src/lib.rs::broadcast_queue_update":
        "background board broadcast; no Result to propagate",
    "crates/medbrains-server/src/services/simulator/pacer.rs::produced_today":
        "demo pacer; developer tooling, not a clinical read",
    # The mirror image of the entitlement gate above, and deliberately so — its
    # own doc comment argues the case. This one faces the PATIENT, where the
    # failure directions are not symmetric: showing a companion feature the
    # hospital never bought is harder to withdraw than one that was briefly
    # missing, so a missing row, an unreadable status and a database error all
    # resolve to `false`. It gates a wellness add-on, not a clinical read.
    "crates/medbrains-server/src/routes/portal.rs::portal_entitlements":
        "patient-facing entitlement; documented fail-CLOSED for a non-clinical add-on",
}

# `[^{]*` so the captured text includes the RETURN TYPE. Without it the match
# stopped at the name, `"Result" in signature` was always false, and every
# site was reported as "fn returns no Result" — including handlers that
# plainly return one, which would talk a reader out of the `?` that fixes it.
FN = re.compile(r"(?:pub )?(?:async )?fn (\w+)[^{]*")


def offenders() -> list[tuple[str, int, str, bool]]:
    found: list[tuple[str, int, str, bool]] = []
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
            fns = [(m.start(), m.group(0), m.group(1)) for m in FN.finditer(text)]
            for match in COLLAPSE.finditer(text):
                prior = [f for f in fns if f[0] < match.start()]
                signature, handler = (prior[-1][1], prior[-1][2]) if prior else ("", "?")
                if f"{rel}::{handler}" in ACCEPTED:
                    continue
                line = text[: match.start()].count("\n") + 1
                found.append((rel, line, handler, "Result" in signature))
    return found


def main() -> int:
    found = offenders()
    if not found:
        print(
            "✓ no database read collapses its error "
            f"({len(ACCEPTED)} reviewed exception(s))"
        )
        return 0

    print(f"{len(found)} database read(s) collapse an error into an empty result:\n")
    for rel, line, handler, returns_result in found:
        print(f"   {rel}:{line}")
        print(f"      {handler}{'' if returns_result else '   (fn returns no Result)'}")
    print(
        "\nUse `?`. The enclosing function almost always returns `Result` already —\n"
        "if it does not, that is the thing to change, because the alternative is a\n"
        "clinical surface presenting a database outage as an empty chart.\n"
        "If a site genuinely should degrade, add it to ACCEPTED in this script with\n"
        "the reason — and the bar is that empty is a TRUE answer for that caller,\n"
        "not merely a safe-looking one."
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
