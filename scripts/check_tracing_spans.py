#!/usr/bin/env python3
"""
Tracing Span Coverage Check — verifies every route handler has a
`#[tracing::instrument(...)]` attribute carrying `tenant_id` in fields.

Required pattern (anywhere in the attribute):
    #[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id, ...))]
or
    #[instrument(skip_all, fields(tenant_id, ...))]

PHASE 0 SKELETON: emits warnings for every uninstrumented handler;
flips to hard failure once a configurable threshold is reached. Default
threshold: 90% coverage.

Exit codes:
    0  Coverage above threshold, or no regression from baseline
    1  Coverage below threshold with new violations
"""

import argparse
import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
ROUTES_DIR = REPO_ROOT / "medbrains" / "crates" / "medbrains-server" / "src" / "routes"
BASELINE_FILE = REPO_ROOT / "scripts" / ".tracing_spans_baseline.json"

THRESHOLD = 0.90  # 90% of handlers must be instrumented

HANDLER_RE = re.compile(r"pub\s+async\s+fn\s+([a-z][a-z0-9_]+)\s*\(", re.IGNORECASE)
INSTRUMENT_RE = re.compile(r"#\[(?:tracing::)?instrument\b")
TENANT_FIELD_RE = re.compile(r"tenant_id")


def load_baseline() -> set[str]:
    if not BASELINE_FILE.exists():
        return set()
    try:
        payload = json.loads(BASELINE_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        print(f"ERROR: invalid baseline JSON: {BASELINE_FILE}", file=sys.stderr)
        return set()
    return set(payload.get("violations", []))


def write_baseline(*, total: int, instrumented: int, violations: set[str]) -> None:
    payload = {
        "description": (
            "Route tracing baseline. New handlers must carry "
            "#[tracing::instrument(... fields(tenant_id ...))]."
        ),
        "total_handlers": total,
        "instrumented_handlers": instrumented,
        "coverage": round(instrumented / total, 6) if total else 1.0,
        "violation_count": len(violations),
        "violations": sorted(violations),
    }
    BASELINE_FILE.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Check route handlers for tracing::instrument tenant_id coverage."
    )
    parser.add_argument(
        "--update-baseline",
        action="store_true",
        help="Refresh the current legacy baseline and exit successfully.",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Print baseline violations as well as new violations.",
    )
    args = parser.parse_args()

    if not ROUTES_DIR.exists():
        print(f"ERROR: routes dir not found: {ROUTES_DIR}", file=sys.stderr)
        return 2

    instrumented = 0
    missing: list[tuple[Path, int, str]] = []
    missing_tenant: list[tuple[Path, int, str]] = []
    violations: set[str] = set()
    total = 0

    for rs_file in sorted(ROUTES_DIR.rglob("*.rs")):
        try:
            text = rs_file.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        lines = text.splitlines()
        for i, line in enumerate(lines):
            m = HANDLER_RE.search(line)
            if not m:
                continue
            total += 1
            window = "\n".join(lines[max(0, i - 8) : i])
            if INSTRUMENT_RE.search(window):
                if TENANT_FIELD_RE.search(window):
                    instrumented += 1
                else:
                    missing_tenant.append((rs_file, i + 1, m.group(1)))
                    rel = rs_file.relative_to(REPO_ROOT)
                    violations.add(f"{rel}:{m.group(1)}:missing_tenant_field")
            else:
                missing.append((rs_file, i + 1, m.group(1)))
                rel = rs_file.relative_to(REPO_ROOT)
                violations.add(f"{rel}:{m.group(1)}:missing_instrument")

    if total == 0:
        print("No handlers found.")
        return 0

    if args.update_baseline:
        write_baseline(total=total, instrumented=instrumented, violations=violations)
        print(
            f"Updated tracing baseline: {len(violations)} violations across "
            f"{total} handlers ({instrumented} instrumented)."
        )
        print(f"Baseline: {BASELINE_FILE.relative_to(REPO_ROOT)}")
        return 0

    coverage = instrumented / total
    print(f"Tracing coverage: {instrumented}/{total} = {coverage:.1%} (threshold {THRESHOLD:.0%})")

    if missing_tenant:
        heading = (
            f"\n=== {len(missing_tenant)} INSTRUMENTED BUT MISSING tenant_id FIELD ==="
            if args.verbose
            else f"\n=== {len(missing_tenant)} baseline tenant_id-field violations ==="
        )
        print(heading)
        rows = missing_tenant if args.verbose else missing_tenant[:0]
        for f, n, name in rows[:20]:
            print(f"  ~ {f.relative_to(REPO_ROOT)}:{n}: {name}")
        if args.verbose and len(missing_tenant) > 20:
            print(f"  ... and {len(missing_tenant) - 20} more")
        elif not args.verbose:
            print("  Details suppressed by default. Use --verbose to print them.")

    if missing:
        heading = (
            f"\n=== {len(missing)} HANDLERS WITHOUT #[instrument] ==="
            if args.verbose
            else f"\n=== {len(missing)} baseline missing-instrument violations ==="
        )
        print(heading)
        rows = missing if args.verbose else missing[:0]
        for f, n, name in rows[:20]:
            print(f"  ✗ {f.relative_to(REPO_ROOT)}:{n}: {name}")
        if args.verbose and len(missing) > 20:
            print(f"  ... and {len(missing) - 20} more")
        elif not args.verbose:
            print("  Details suppressed by default. Use --verbose to print them.")

    if coverage >= THRESHOLD:
        print("\n✓ Tracing coverage above threshold.")
        return 0

    baseline = load_baseline()
    new_violations = sorted(violations - baseline)
    resolved = baseline - violations

    if new_violations:
        print(f"\nCoverage {coverage:.1%} below threshold {THRESHOLD:.0%}.")
        print(f"New tracing violations: {len(new_violations)}")
        for violation in new_violations[:20]:
            print(f"  ✗ {violation}")
        if len(new_violations) > 20:
            print(f"  ... and {len(new_violations) - 20} more")
        return 1

    print(
        f"\n✓ Baseline OK. {len(violations)} tracing violations across {total} handlers "
        f"(no increases)."
    )
    if resolved:
        print(f"  {len(resolved)} baseline violations have been resolved; run --update-baseline.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
