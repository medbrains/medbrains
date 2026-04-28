#!/usr/bin/env python3
"""
Sharing Registry Coverage Check — verifies every shareable entity is
declared in `crates/medbrains-core/src/sharing/registry.rs`.

PHASE 0 SKELETON: until the sharing module lands in Phase 3, this script
emits a soft warning summary instead of failing. Once the registry file
exists with at least one EntityShareSpec entry, strict mode activates
automatically and unregistered entities cause exit code 1.

Detection:
  - Walks `routes/*.rs` for `pub async fn create_<entity>` patterns
  - Cross-references with `medbrains-core/src/sharing/registry.rs`
    (looks for `EntityShareSpec { object_type: "<name>", ... }`)

Exit codes:
    0  All shareable entities registered (or registry not yet created)
    1  Registry exists but entities missing
"""

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
ROUTES_DIR = REPO_ROOT / "medbrains" / "crates" / "medbrains-server" / "src" / "routes"
REGISTRY_FILE = (
    REPO_ROOT
    / "medbrains"
    / "crates"
    / "medbrains-core"
    / "src"
    / "sharing"
    / "registry.rs"
)

CREATE_FN_RE = re.compile(r"pub\s+async\s+fn\s+create_([a-z][a-z0-9_]*)\s*\(", re.IGNORECASE)
ENTITY_SPEC_RE = re.compile(r'object_type:\s*"([a-z_][a-z0-9_]*)"', re.IGNORECASE)


def main() -> int:
    if not ROUTES_DIR.exists():
        print(f"ERROR: routes dir not found: {ROUTES_DIR}", file=sys.stderr)
        return 2

    # Collect entity types observed via create handlers
    create_entities: set[str] = set()
    for rs_file in ROUTES_DIR.rglob("*.rs"):
        try:
            text = rs_file.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for match in CREATE_FN_RE.finditer(text):
            entity = match.group(1).lower()
            create_entities.add(entity)

    # Read registry if present
    if not REGISTRY_FILE.exists():
        print(f"NOTE: sharing registry not yet created at {REGISTRY_FILE.relative_to(REPO_ROOT)}")
        print(f"      Discovered {len(create_entities)} candidate entities via routes:")
        for e in sorted(create_entities):
            print(f"        - {e}")
        print("      Strict mode activates once registry exists. (Phase 3 deliverable.)")
        return 0

    registered: set[str] = set()
    text = REGISTRY_FILE.read_text(encoding="utf-8")
    for match in ENTITY_SPEC_RE.finditer(text):
        registered.add(match.group(1).lower())

    if not registered:
        print(f"NOTE: registry exists but empty. Awaiting Phase 3 entries.")
        return 0

    missing = sorted(create_entities - registered)
    extra = sorted(registered - create_entities)

    print(f"Registry: {len(registered)} entities, routes: {len(create_entities)} create-fns")

    if missing:
        print(f"\n=== {len(missing)} ENTITIES MISSING FROM REGISTRY ===")
        for e in missing:
            print(f"  ✗ {e}")
    if extra:
        print(f"\n=== {len(extra)} REGISTRY ENTRIES WITH NO CREATE-FN ===")
        for e in extra:
            print(f"  ? {e}")

    if missing:
        return 1
    print("✓ Every create-fn has a registry entry.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
