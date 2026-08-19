#!/usr/bin/env python3
"""A record check must not sit inside a branch.

    python3 scripts/check_conditional_authz.py

Third sibling of `check_authz_collapse.py` and `check_query_collapse.py`. Those
two stop a fault from answering like a refusal. This one stops a check from
being SKIPPED — which is worse, because nothing about it looks wrong:

    let is_reprint = prior_print_count > 0;
    if is_reprint {
        require_permission(&claims, permissions::opd::consents::REPRINT)?;
        require_access_via(&state, &claims, links::PROCEDURE_CONSENT, id).await?;
        …
    }

That guarded the SECOND print of a consent and never the first — and the first
is the one that hands out the patient's name, UHID, date of birth and gender.
It compiled, it read as careful code, and the authorization ledger counted the
handler as record-checked the whole time, because the call is present in the
span. The only tell was the indentation.

It was written by an earlier pass of the access-control sweep itself: a
scripted insertion that landed in the wrong block. A check in the wrong place
is still valid Rust, so nothing but a reader was ever going to catch it.

Detection is indentation: a record check in a handler body sits at four
spaces. Anything deeper is inside something.

Conditional authorization IS sometimes right — an optional filter that is only
a clinical read when supplied, a bypass-role short-circuit — so those go in
ACCEPTED with the reason, and the bar is that the UNGUARDED branch must be
safe on its own, not merely different.
"""

from __future__ import annotations

import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CRATES = os.path.join(ROOT, "crates")

CALL = re.compile(
    r"^(\s*)(?:medbrains_authz_gate::)?"
    r"(require_access_via(?:_optional)?|require_patient_access|require_encounter_access"
    r"|require_admission_access|require_patient_billing_access)\s*\("
)
# Leading whitespace allowed: a method inside an `impl` block is indented, and
# without this the tracker kept the last TOP-LEVEL fn name, so the AI tool's
# `overview` was reported under `retrieve_kb` — a handler two hundred lines
# away that has nothing to do with it.
FN = re.compile(r"^\s*(?:pub(?:\([a-z]+\))? )?(?:async )?fn (\w+)")
HANDLER = re.compile(r"^pub async fn (\w+)\s*\(", re.M)
PERM = re.compile(r"^(\s*)require_(?:any_)?permission\s*\(", re.M)

# A handler whose ONLY permission check is nested. Not the same test as the
# record-check one above: a stricter code on a stricter branch is normal and
# right (a reprint wanting `reprint` ON TOP OF `print`). What is not right is
# the branch being the sole check, because then some other path has none.
#
# `print_case_sheet_packet` was exactly that: `mrd.case_sheets.reprint` inside
# `if is_reprint`, and nothing at all on the first print — of an entire case
# sheet. `mrd.case_sheets.print` existed and was never asked for.
PERMISSION_ONLY_NESTED: dict[str, str] = {
    # Each of these branches exhaustively, and every path either checks a
    # permission or returns an error. Read individually, not pattern-matched.
    "crates/medbrains-camp/src/lib.rs::list_camps":
        "outer condition already tests camp.list; the fallback narrows to active camps",
    "crates/medbrains-camp/src/lib.rs::update_camp_referral":
        "if/else-if/else, and the final else rejects an empty payload",
    "crates/medbrains-camp/src/lib.rs::update_followup":
        "outcome and conversion each gated; neither present is a BadRequest",
    "crates/medbrains-device-pairing/src/lib.rs::get_peer_roster":
        "either-of-two rights, written as a fallback; both paths check",
    "crates/medbrains-identity/src/iam.rs::create_access_request":
        "requesting access FOR YOURSELF needs no permission; on another's behalf it does",
    "crates/medbrains-setup/src/lib.rs::get_settings":
        "category split — sensitive categories take the admin code, the rest take read",
    # A loop, not a branch, and exhaustive by construction:
    # `required_discharge_tat_update_permissions` returns one code per milestone
    # the body touches and errors when the body touches none, so the loop always
    # runs at least once. The RECORD check used to sit inside it too and has
    # been hoisted — it was doing up to six identical ReBAC round-trips.
    "crates/medbrains-ipd/src/lib.rs::update_discharge_tat":
        "one permission per milestone touched; the helper rejects an empty body",
    "crates/medbrains-emergency/src/lib.rs::update_mass_casualty_event":
        "exhaustive match; the unknown-status arm rejects",
}

# Reviewed, and each one already carries its reasoning in the code beside it.
#
# The first six are the same shape: a list whose patient/encounter filter is
# OPTIONAL. Supplied, it is a clinical read and gets gated; omitted, the
# endpoint is an operational queue — the MRD processing backlog, the document
# audit list, the vitals round — which is role-gated and deliberately not
# narrowed to a care team. Hiding a due observation from the nurse who is not
# yet linked to that encounter is how an observation gets missed.
ACCEPTED: dict[str, str] = {
    "crates/medbrains-documents/src/documents.rs::list_outputs":
        "optional patient filter; the unscoped list is the operational audit queue",
    "crates/medbrains-documents/src/documents.rs::get_output":
        "optional patient filter; as above",
    "crates/medbrains-case-sheet-scan/src/lib.rs::list_scans":
        "optional patient filter; the unscoped list is the MRD processing queue",
    "crates/medbrains-regulatory/src/lib.rs::create_adr_report":
        "patient_id is optional on the report; the unguarded branch is a "
        "reaction filed against a batch with nobody identified",
    "crates/medbrains-regulatory/src/lib.rs::create_mv_report":
        "patient_id is optional on the report; a device can fail on the shelf",
    "crates/medbrains-telehealth/src/cds.rs::create_pg_logbook_entry":
        "encounter_id is optional on the request; the unguarded branch is the "
        "entry that names no encounter, so there is no record to authorize",
    "crates/medbrains-pharmacy/src/lib.rs::create_otc_sale":
        "over-the-counter sale to a walk-in has no patient; the named branch is gated",
    "crates/medbrains-pharmacy/src/lib.rs::create_pos_sale":
        "counter sale may have no patient; the named branch is gated",
    "crates/medbrains-telehealth/src/cds.rs::check_drug_safety":
        "optional patient turns it into an allergy read; without one it is a pure "
        "drug-drug catalogue lookup that names nobody",
    "crates/medbrains-nursing/src/nurse_vitals.rs::list_vitals_schedules":
        "optional encounter filter; the unscoped list is the shift's vitals round",
    "crates/medbrains-nursing/src/nurse_clinical.rs::list_restraint_for_order":
        "encounter resolved from the order's events; no events means an empty "
        "result, so the unguarded branch leaks nothing",
    # Two writes whose subject is genuinely optional in the domain: a bed can be
    # cleaned with nobody in it, and transport moves equipment as well as people.
    "crates/medbrains-ipd/src/lib.rs::create_bed_turnaround":
        "admission is Option — a bed is also turned around with no patient in it",
    "crates/medbrains-analytics/src/command_center.rs::create_transport_request":
        "patient is Option — transport also moves equipment",
    # A bypass-role short-circuit, which is how bypass works everywhere.
    "crates/medbrains-ai/src/lib.rs::overview":
        "admin bypass, matching the grounding gate it sits behind",
    # The gate crate's own internals: these BUILD the permitted set, so the
    # per-item call is loop body, not a branch.
    "crates/medbrains-authz-gate/src/lib.rs::require_patient_billing_filter":
        "gate internals — builds the permitted set",
    "crates/medbrains-authz-gate/src/lib.rs::patient_filter":
        "gate internals — builds the permitted set",
}


def permission_offenders() -> list[tuple[str, int, str]]:
    """Handlers whose only permission check sits inside a branch."""
    found: list[tuple[str, int, str]] = []
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
            marks = [(m.group(1), m.start()) for m in HANDLER.finditer(text)]
            for i, (fn, start) in enumerate(marks):
                end = marks[i + 1][1] if i + 1 < len(marks) else len(text)
                indents = [len(m.group(1)) for m in PERM.finditer(text[start:end])]
                if not indents or min(indents) <= 4:
                    continue
                if f"{rel}::{fn}" in PERMISSION_ONLY_NESTED:
                    continue
                found.append((rel, text[:start].count("\n") + 1, fn))
    return found


def offenders() -> list[tuple[str, int, str, int, str]]:
    found: list[tuple[str, int, str, int, str]] = []
    for dirpath, dirs, files in os.walk(CRATES):
        dirs[:] = [d for d in dirs if d != "target"]
        for name in files:
            if not name.endswith(".rs"):
                continue
            path = os.path.join(dirpath, name)
            rel = os.path.relpath(path, ROOT)
            try:
                lines = open(path, encoding="utf-8", errors="replace").read().split("\n")
            except OSError:
                continue
            handler = "?"
            for i, line in enumerate(lines):
                if m := FN.match(line):
                    handler = m.group(1)
                if (c := CALL.match(line)) and len(c.group(1)) > 4:
                    if f"{rel}::{handler}" in ACCEPTED:
                        continue
                    found.append((rel, i + 1, handler, len(c.group(1)), c.group(2)))
    return found


def main() -> int:
    perms = permission_offenders()
    if perms:
        print(f"{len(perms)} handler(s) whose ONLY permission check is nested:\n")
        for rel, line, handler in perms:
            print(f"   {rel}:{line}\n      {handler}")
        print(
            "\nEvery other path through the handler is unpermissioned. Hoist an\n"
            "unconditional base check to the top and keep the branch for the stricter\n"
            "code — a reprint wants `reprint` ON TOP OF `print`, not instead of it.\n"
            "If the branching genuinely is the rule, add it to PERMISSION_ONLY_NESTED\n"
            "with the reason, and the bar is that EVERY path checks or errors."
        )
        return 1

    found = offenders()
    if not found:
        print(
            "✓ no record check or sole permission check sits inside a branch "
            f"({len(ACCEPTED) + len(PERMISSION_ONLY_NESTED)} reviewed exception(s))"
        )
        return 0

    print(f"{len(found)} record check(s) nested inside a branch:\n")
    for rel, line, handler, indent, call in found:
        print(f"   {rel}:{line}")
        print(f"      {handler} — {call} at indent {indent}, expected 4")
    print(
        "\nA check inside `if`/`match`/`else` runs on some requests and not others,\n"
        "and the ledger counts the handler as guarded either way. Hoist it to the\n"
        "top of the handler body.\n"
        "If the condition is genuinely part of the rule — an optional filter, a\n"
        "bypass short-circuit — add it to ACCEPTED with the reason. The bar is that\n"
        "the UNGUARDED branch is safe on its own, not merely different."
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
