#!/usr/bin/env python3
"""
Runtime SQLx ratchet — enforce compile-time queries on new code.

Rule: new SQL in route handlers should use the macros (`sqlx::query!`,
`sqlx::query_as!`, `sqlx::query_scalar!`) so the SQL is verified against
the live schema at compile time. Runtime variants (`sqlx::query`,
`sqlx::query_as::<_, T>()`, etc.) silently ship typos that only surface
in production — this session alone shipped 3 such bugs (`scope` vs
`category`, `copay_percent` vs `co_pay_percent`, `ipd_admissions` vs
`admissions`).

We can't migrate the legacy runtime call sites in one go, so:

  - Per-file baseline in scripts/.runtime_sqlx_baseline.json
  - PRs may NOT increase the count for any file (new violation = fail)
  - Removing violations is always free; baseline auto-tightens on
    `--update-baseline` after a cleanup PR
  - New files default to baseline 0 — no runtime SQL in fresh code
  - No escape hatch: dynamic filters must be expressed through compile-time
    checked base queries plus typed post-filtering, or a reviewed helper
    that keeps raw SQL out of route handlers.

Usage:
    python3 scripts/check_runtime_sqlx.py
    python3 scripts/check_runtime_sqlx.py --update-baseline

Exit codes:
    0  Counts at or below baseline
    1  One or more files exceed their baseline
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SCAN_DIRS = [
    REPO_ROOT / "medbrains" / "crates" / "medbrains-server" / "src" / "routes",
]
BASELINE = REPO_ROOT / "scripts" / ".runtime_sqlx_baseline.json"

# Match runtime variants only — the macros (with !) are explicitly excluded
# by the negative lookahead `(?![\w!])` after the call name.
RE_RUNTIME = re.compile(
    r"\bsqlx::(query|query_as|query_scalar|query_with|query_as_with|query_scalar_with)"
    r"(?:::<[^>]*>)?\s*\("
)

def count_violations(path: Path) -> int:
    src = path.read_text(errors="replace")
    return len(RE_RUNTIME.findall(src))


def collect_counts() -> dict[str, int]:
    counts: dict[str, int] = {}
    for d in SCAN_DIRS:
        if not d.exists():
            continue
        for f in d.rglob("*.rs"):
            n = count_violations(f)
            if n > 0:
                rel = str(f.relative_to(REPO_ROOT))
                counts[rel] = n
    return counts


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--update-baseline", action="store_true")
    args = ap.parse_args()

    counts = collect_counts()
    baseline: dict[str, int] = {}
    if BASELINE.exists():
        baseline = json.loads(BASELINE.read_text())

    if args.update_baseline:
        BASELINE.write_text(json.dumps(counts, indent=2, sort_keys=True) + "\n")
        total = sum(counts.values())
        print(f"updated baseline: {len(counts)} files, {total} runtime SQL call sites")
        return 0

    breaches: list[str] = []
    new_files: list[str] = []
    for f, n in counts.items():
        prev = baseline.get(f, 0)
        if prev == 0 and n > 0:
            new_files.append(f"{f}: {n} runtime SQL calls (no baseline — must be 0 in new files)")
        elif n > prev:
            breaches.append(f"{f}: {prev} → {n} (+{n - prev})")

    if breaches or new_files:
        if breaches:
            print("Runtime SQLx ratchet failed — these files added runtime queries:")
            for b in breaches:
                print(f"  {b}")
        if new_files:
            print("New files with runtime SQL (must use sqlx::query! / query_as! macros):")
            for n in new_files:
                print(f"  {n}")
        print()
        print("Fix options:")
        print("  1. Convert to compile-time macros: sqlx::query!() / query_as!() / query_scalar!()")
        print("     Run `make prepare-sqlx` after to refresh .sqlx/ cache.")
        print("  2. After a cleanup PR, run `python3 scripts/check_runtime_sqlx.py --update-baseline`.")
        return 1

    total = sum(counts.values())
    base_total = sum(baseline.values())
    print(f"runtime SQLx ratchet: {total} call sites (baseline {base_total}). OK.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
