#!/usr/bin/env python3
"""
Deployment-surface drift check.

The list of deployment surfaces is declared in three places and nothing keeps
them in step:

    scripts/assign_apps.py                        drives the Apps column of
                                                  the feature tracker
    packages/device-catalog/src/index.ts          the catalog package
    packages/mobile-shell/src/app-surfaces.ts     what the mobile shell offers

They already disagree, and the disagreement is recorded rather than resolved:

    Mobile-Camp and Mobile-Vendor are declared by mobile-shell and shipped as
    real apps — apps/mobile-camp and apps/mobile-vendor both tag their modules
    with those codes — but neither the catalog nor the tracker lists them, so
    no feature can be assigned to either surface.

    edge-gateway is in the catalog only. It is not a UI surface, so the
    tracker having no entry for it is expected.

Adding a catalog entry means choosing a factor, pairing model and module list,
and adding a tracker entry changes the spreadsheet — both are decisions rather
than lint. What this stops is a fourth divergence appearing unnoticed.

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
MOBILE_SHELL = (
    REPO_ROOT / "medbrains" / "packages" / "mobile-shell" / "src" / "app-surfaces.ts"
)

SURFACE_SHAPE = re.compile(r"^(Web|(?:TV|Mobile|Desktop)-[A-Za-z0-9-]+)$")

# Divergences already present. Removing an entry — because the lists were
# reconciled — is always welcome; a new one fails.
RECORDED_DRIFT = {
    "in mobile-shell, not in catalog": {"Mobile-Camp", "Mobile-Vendor"},
    "in catalog, not in mobile-shell": {"edge-gateway"},
}


def surfaces(path: Path, patterns: list[str]) -> set[str]:
    text = path.read_text(encoding="utf-8")
    found: set[str] = set()
    for pattern in patterns:
        found.update(re.findall(pattern, text))
    return found


def main() -> int:
    for path in (ASSIGN_APPS, CATALOG, MOBILE_SHELL):
        if not path.exists():
            print(f"ERROR: {path.relative_to(REPO_ROOT)} not found", file=sys.stderr)
            return 2

    catalog = surfaces(CATALOG, [r'code:\s*"([^"]+)"'])
    shell = {
        code
        for code in surfaces(MOBILE_SHELL, [r'code:\s*"([^"]+)"'])
        if SURFACE_SHAPE.match(code)
    }
    tracker = surfaces(ASSIGN_APPS, [r"'((?:TV|Mobile|Desktop)-[A-Za-z0-9-]+)'"])

    print(
        f"surfaces — tracker {len(tracker)}, catalog {len(catalog)}, mobile-shell {len(shell)}"
    )

    actual = {
        "in mobile-shell, not in catalog": shell - catalog,
        "in catalog, not in mobile-shell": catalog - shell - {"Web"},
    }

    failures: list[str] = []
    for label, codes in actual.items():
        for code in sorted(codes - RECORDED_DRIFT.get(label, set())):
            failures.append(f"{code} — {label}")

    # The tracker drives the feature spreadsheet, so a surface it does not know
    # about can never have a feature assigned to it.
    for code in sorted(shell - tracker - RECORDED_DRIFT["in mobile-shell, not in catalog"]):
        if code != "Web":
            failures.append(f"{code} — in mobile-shell, not in assign_apps.py")

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
