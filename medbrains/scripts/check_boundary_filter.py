#!/usr/bin/env python3
"""Fail if a deploy mode declares it needs the PHI boundary filter and the
filter is neither wired nor refused at startup.

medbrains_core::boundary_filter strips PHI from payloads crossing the on-prem
to cloud boundary -- the outbox worker's event egress and the audit forwarder's
access_log shipping. DeployMode::requires_boundary_filter() returns true for
hybrid. As of 2026-08-31 nothing in the repo ever constructs a BoundaryFilter,
so hybrid would ship Aadhaar and clinical data unredacted, and the only signal
would be `true` returned by a function nobody calls.

main.rs therefore refuses to boot in that mode. This check exists so that guard
cannot be deleted without either wiring the filter or consciously removing this
script -- the failure mode being guarded against is precisely a safety control
that is present in the tree and absent from the code path.

Passes when EITHER:
  - a BoundaryFilter is constructed somewhere outside its own module, or
  - the startup guard on requires_boundary_filter() is still present.
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FILTER_MODULE = ROOT / "crates/medbrains-core/src/boundary_filter.rs"
GUARD_FILE = ROOT / "crates/medbrains-server/src/main.rs"
CONSTRUCTOR = re.compile(r"BoundaryFilter::(?:new|defaults)")


def find_constructions() -> list[str]:
    """Rust files constructing a BoundaryFilter, excluding its own module.

    Plain stdlib walk rather than ripgrep: a checker that exits non-zero
    because a tool is missing is the same silent-failure shape it exists
    to prevent.
    """
    hits = []
    for base in ("crates", "apps"):
        for path in (ROOT / base).rglob("*.rs"):
            if path == FILTER_MODULE or "target" in path.parts:
                continue
            if CONSTRUCTOR.search(path.read_text(encoding="utf-8", errors="ignore")):
                hits.append(str(path.relative_to(ROOT)))
    return sorted(hits)


def main() -> int:
    wired = find_constructions()
    if wired:
        print("check-boundary-filter: filter is wired in " + ", ".join(wired))
        print("  The startup guard in main.rs can now be removed.")
        return 0

    if not GUARD_FILE.is_file():
        print(f"check-boundary-filter: {GUARD_FILE} missing", file=sys.stderr)
        return 1

    guard = GUARD_FILE.read_text(encoding="utf-8", errors="ignore")
    if re.search(r"requires_boundary_filter\(\)", guard):
        print("check-boundary-filter: filter not wired; startup guard present. OK.")
        return 0

    print(
        "check-boundary-filter: FAIL\n"
        "  No BoundaryFilter is constructed anywhere, and the startup guard on\n"
        "  requires_boundary_filter() is gone from main.rs.\n"
        "\n"
        "  MEDBRAINS_DEPLOY_MODE=hybrid would now boot and ship outbox events\n"
        "  and audit entries across the on-prem boundary with no PHI redaction.\n"
        "\n"
        "  Fix by wiring medbrains_core::boundary_filter into the outbox worker\n"
        "  and the audit forwarder, or restore the guard.",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
