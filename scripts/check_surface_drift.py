#!/usr/bin/env python3
"""
Deployment-surface drift check.

The list of deployment surfaces is declared in two places and nothing else
keeps them in step:

    scripts/assign_apps.py                        drives the Apps column of
                                                  the feature tracker
    packages/device-catalog/src/index.ts          the catalog package

edge-gateway is in the catalog only. It is not a UI surface, so the tracker
having no entry for it is expected. Web is the catalog's name for the web app,
which the tracker treats as the default column rather than a surface code.

The React Native mobile shell was a third list until it was deleted
(2026-11-17); the native apps take their module list from the server.

Adding a catalog entry means choosing a factor, pairing model and module list,
and adding a tracker entry changes the spreadsheet — both are decisions rather
than lint. What this stops is a divergence appearing unnoticed.

Exit codes:
    0  Drift matches what is recorded
    1  A new divergence appeared
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
ASSIGN_APPS = REPO_ROOT / "scripts" / "assign_apps.py"
CATALOG = REPO_ROOT / "medbrains" / "packages" / "device-catalog" / "src" / "index.ts"
# Divergences already present. Removing an entry — because the lists were
# reconciled — is always welcome; a new one fails.
RECORDED_DRIFT = {
    "in catalog, not in assign_apps.py": {"Web", "edge-gateway"},
    "in assign_apps.py, not in catalog": set(),
}


def surfaces(path: Path, patterns: list[str]) -> set[str]:
    text = path.read_text(encoding="utf-8")
    found: set[str] = set()
    for pattern in patterns:
        found.update(re.findall(pattern, text))
    return found


def main() -> int:
    """Compare the tracker's surfaces with the catalog's and fail on unrecorded drift."""
    for path in (ASSIGN_APPS, CATALOG):
        if not path.exists():
            print(f"ERROR: {path.relative_to(REPO_ROOT)} not found", file=sys.stderr)
            return 2

    catalog = surfaces(CATALOG, [r'code:\s*"([^"]+)"'])
    tracker = surfaces(ASSIGN_APPS, [r"'((?:TV|Mobile|Desktop)-[A-Za-z0-9-]+)'"])

    print(f"surfaces — tracker {len(tracker)}, catalog {len(catalog)}")

    # The tracker drives the feature spreadsheet, so a surface it does not know
    # about can never have a feature assigned to it.
    actual = {
        "in catalog, not in assign_apps.py": catalog - tracker,
        "in assign_apps.py, not in catalog": tracker - catalog,
    }

    failures: list[str] = []
    for label, codes in actual.items():
        for code in sorted(codes - RECORDED_DRIFT[label]):
            failures.append(f"{code} — {label}")

    if failures:
        print(f"\n=== {len(failures)} NEW SURFACE DIVERGENCE ===")
        for failure in failures:
            print(f"  ✗ {failure}")
        print(
            "\nA surface the tracker does not list cannot have features assigned to "
            "it. Reconcile the lists, or record the divergence with a reason."
        )
        return 1

    print("✓ Surface drift matches what is recorded.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
