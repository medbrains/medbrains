#!/usr/bin/env python3
"""
Requirement-flag enforcement check.

A boolean column named requires_x / x_required / mandatory_x reads as a
control: it says this record demands a witness, a consent, a dual signature.
Several are stored and read back and never consulted by any code, so the
control exists on paper only.

This records the ones already in that state and fails when a new one appears,
so the list shrinks rather than grows. Enforcing an existing flag means
deciding what happens to records that predate the rule, which is a compliance
question rather than a lint.

The one worth reading first:

    requires_dual_sign on pharmacy_ndps_register — dual signature on the
    narcotics register. It is referenced nowhere in the codebase at all:
    never written, never read. NDPS controlled substances are exactly where
    a second signature is the control.

Exit codes:
    0  No new unenforced requirement flag
    1  A requirement flag appeared outside the recorded set
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
MIGRATIONS = REPO_ROOT / "medbrains" / "crates" / "medbrains-db" / "src" / "migrations"
CRATES = REPO_ROOT / "medbrains" / "crates"

COLUMN_RE = re.compile(
    r"^\s+(requires_[a-z_]+|[a-z_]*_required|mandatory_[a-z_]+)\s+bool(ean)?\b",
    re.MULTILINE,
)

# Flags known to have no enforcement today. Removing one — because it is now
# enforced — is always welcome; adding one fails the check.
RECORDED_UNENFORCED = {
    "ambulance_required",
    "drug_license_required",
    "is_read_aloud_required",
    "is_required",
    "quarantine_required",
    "requires_anesthesia",
    "requires_batch_tracking",
    "requires_consent",
    "requires_doctor",
    "requires_dual_sign",
    "requires_expiry_tracking",
    "requires_license_tracking",
    "requires_medical_review",
    "requires_temperature_log",
    "requires_witness",
    "vendor_visit_required",
}


# Control-shaped columns that no Rust file mentions at all — not read, not
# written, not even named in an INSERT column list. This is a stricter and
# heuristic-free test than the enforcement scan below: it asks only whether the
# identifier appears anywhere in the crates, so it cannot false-positive.
#
#   requires_dual_sign      pharmacy_ndps_register  — dual signature on the
#                           narcotics register
#   msbos_limit             crossmatch_requests     — maximum surgical blood
#                           order schedule ceiling
#   max_order_qty           pharmacy_catalog        — per-order quantity cap
#   drug_license_required   pharmacy_catalog        — licence needed to dispense
RECORDED_ORPHANS = {
    "drug_license_required",
    "max_order_qty",
    "msbos_limit",
    "requires_dual_sign",
}

CONTROL_COLUMN_RE = re.compile(
    r"^\s+([a-z][a-z0-9_]{3,})\s+"
    r"(numeric|integer|int|smallint|bigint|bool(ean)?|interval)\b",
    re.MULTILINE,
)
CONTROL_NAME_RE = re.compile(r"^(requires_|min_|max_|mandatory_)|_(required|limit|threshold)$")


def orphan_controls() -> set[str]:
    """Control columns whose name appears in no Rust source at all."""
    declared: set[str] = set()
    for path in MIGRATIONS.rglob("*.sql"):
        declared.update(
            m.group(1) for m in CONTROL_COLUMN_RE.finditer(path.read_text(encoding="utf-8"))
        )
    controls = {c for c in declared if CONTROL_NAME_RE.search(c)}

    blob = "".join(
        p.read_text(encoding="utf-8", errors="ignore") for p in CRATES.rglob("*.rs")
    )
    return {c for c in controls if c not in blob}


def declared_flags() -> set[str]:
    flags: set[str] = set()
    for path in MIGRATIONS.rglob("*.sql"):
        flags.update(m.group(1) for m in COLUMN_RE.finditer(path.read_text(encoding="utf-8")))
    return flags


def is_enforcement_line(line: str) -> bool:
    """A line that reads the flag to decide something, rather than store it.

    Struct fields, binds, comments and SQL column lists are storage. SQL text
    counts as enforcement when the flag appears in a predicate rather than a
    column list, so quoted lines with WHERE/AND/CASE are kept.
    """
    stripped = line.strip()
    if stripped.startswith(("pub ", "//", "///", "-", "*")):
        return False
    if ".bind(" in stripped or "COALESCE" in stripped:
        return False
    if '"' in stripped:
        return bool(re.search(r"\b(WHERE|AND|OR|CASE|HAVING)\b", stripped, re.IGNORECASE))
    return "," not in stripped


def unenforced(flags: set[str]) -> set[str]:
    sources = [
        p
        for p in CRATES.rglob("*.rs")
        if "/tests/" not in str(p) and "medbrains-seed" not in str(p)
    ]
    texts = [p.read_text(encoding="utf-8", errors="ignore") for p in sources]

    result = set()
    for flag in flags:
        enforced = any(
            is_enforcement_line(line)
            for text in texts
            if flag in text
            for line in text.split("\n")
            if flag in line
        )
        if not enforced:
            result.add(flag)
    return result


def main() -> int:
    if not MIGRATIONS.exists():
        print(f"ERROR: migrations not found at {MIGRATIONS}", file=sys.stderr)
        return 2

    flags = declared_flags()
    missing = unenforced(flags)
    print(
        f"{len(flags)} requirement flag(s) declared, "
        f"{len(missing)} with no enforcement in any crate."
    )

    orphans = orphan_controls()
    print(f"{len(orphans)} control column(s) referenced by no Rust source at all.")

    failures: list[str] = []
    for flag in sorted(missing - RECORDED_UNENFORCED):
        failures.append(f"{flag} — declared and never enforced")
    for column in sorted(orphans - RECORDED_ORPHANS):
        failures.append(f"{column} — declared and referenced by no Rust source at all")

    if failures:
        print(f"\n=== {len(failures)} NEW UNENFORCED CONTROL ===")
        for failure in failures:
            print(f"  ✗ {failure}")
        print(
            "\nA requires_/_required/limit column that nothing reads is a control on "
            "paper only. Enforce it, or record it with a reason."
        )
        return 1

    print("✓ No new unenforced controls.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
