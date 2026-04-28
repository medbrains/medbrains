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
    0  Coverage above threshold (or zero handlers)
    1  Coverage below threshold
"""

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
ROUTES_DIR = REPO_ROOT / "medbrains" / "crates" / "medbrains-server" / "src" / "routes"

THRESHOLD = 0.90  # 90% of handlers must be instrumented

HANDLER_RE = re.compile(r"pub\s+async\s+fn\s+([a-z][a-z0-9_]+)\s*\(", re.IGNORECASE)
INSTRUMENT_RE = re.compile(r"#\[(?:tracing::)?instrument\b")
TENANT_FIELD_RE = re.compile(r"tenant_id")


def main() -> int:
    if not ROUTES_DIR.exists():
        print(f"ERROR: routes dir not found: {ROUTES_DIR}", file=sys.stderr)
        return 2

    instrumented = 0
    missing: list[tuple[Path, int, str]] = []
    missing_tenant: list[tuple[Path, int, str]] = []
    total = 0

    for rs_file in ROUTES_DIR.rglob("*.rs"):
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
            else:
                missing.append((rs_file, i + 1, m.group(1)))

    if total == 0:
        print("No handlers found.")
        return 0

    coverage = instrumented / total
    print(f"Tracing coverage: {instrumented}/{total} = {coverage:.1%} (threshold {THRESHOLD:.0%})")

    if missing_tenant:
        print(f"\n=== {len(missing_tenant)} INSTRUMENTED BUT MISSING tenant_id FIELD ===")
        for f, n, name in missing_tenant[:20]:
            print(f"  ~ {f.relative_to(REPO_ROOT)}:{n}: {name}")
        if len(missing_tenant) > 20:
            print(f"  ... and {len(missing_tenant) - 20} more")

    if missing:
        print(f"\n=== {len(missing)} HANDLERS WITHOUT #[instrument] ===")
        for f, n, name in missing[:20]:
            print(f"  ✗ {f.relative_to(REPO_ROOT)}:{n}: {name}")
        if len(missing) > 20:
            print(f"  ... and {len(missing) - 20} more")

    if coverage < THRESHOLD:
        print(f"\nCoverage {coverage:.1%} below threshold {THRESHOLD:.0%}.")
        return 1

    print("\n✓ Tracing coverage above threshold.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
