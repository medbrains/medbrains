#!/usr/bin/env python3
"""
Print-data placeholder check.

Several print endpoints substitute invented rows when the real query comes
back empty, so the rendered document shows data no one entered. That is
harmless for a preview and misleading on a document a hospital files.

The three sites below already exist and are recorded rather than removed —
whether a print endpoint should render sample rows at all is a product
decision, not something a check should make unilaterally. What this stops is
a fourth appearing unnoticed.

    HR staff credential form  fabricates an MBBS degree and a medical
                              council registration number, both marked
                              "Verified", which then sets the form's overall
                              status to "Complete". A credential
                              verification document is exactly where
                              invented registration numbers matter.

    HR visitor register       fabricates a visitor with a masked Aadhaar
                              number and a patient name.

    BME contract coverage     fabricates a covered equipment item.

Exit codes:
    0  No new placeholder fallbacks
    1  A fallback appeared outside the recorded set
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
PRINT_DATA = REPO_ROOT / "medbrains" / "crates" / "medbrains-print-data" / "src"

# file -> number of recorded fallbacks. New ones fail; removing them is free.
RECORDED: dict[str, int] = {
    "bme.rs": 1,
    "hr.rs": 2,
}

EMPTY_BRANCH_RE = re.compile(r"\.is_empty\(\)\s*\{")


def fallback_lines(source: str) -> list[int]:
    """Lines where an empty real result is replaced by a literal vec."""
    lines = source.split("\n")
    found = []
    for index, line in enumerate(lines):
        if not EMPTY_BRANCH_RE.search(line):
            continue
        window = "\n".join(lines[index : index + 6])
        if "vec![" in window:
            found.append(index + 1)
    return found


def main() -> int:
    if not PRINT_DATA.exists():
        print(f"ERROR: print-data crate not found at {PRINT_DATA}", file=sys.stderr)
        return 2

    failures: list[str] = []
    total = 0

    for path in sorted(PRINT_DATA.rglob("*.rs")):
        lines = fallback_lines(path.read_text(encoding="utf-8"))
        total += len(lines)
        allowed = RECORDED.get(path.name, 0)
        if len(lines) > allowed:
            failures.append(
                f"{path.relative_to(REPO_ROOT)}: {len(lines)} placeholder fallback(s), "
                f"{allowed} recorded — new one(s) at line(s) "
                f"{', '.join(str(n) for n in lines)}"
            )

    print(f"Scanned {PRINT_DATA.relative_to(REPO_ROOT)}: {total} placeholder fallback(s).")

    if failures:
        print("\n=== NEW PLACEHOLDER FALLBACK IN A PRINT ENDPOINT ===")
        for failure in failures:
            print(f"  ✗ {failure}")
        print(
            "\nA print endpoint that invents rows when the query is empty puts data "
            "on a document that nobody entered. Return the empty result instead, or "
            "add the site to RECORDED with a reason."
        )
        return 1

    print("✓ No new placeholder fallbacks in print endpoints.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
