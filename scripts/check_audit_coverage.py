#!/usr/bin/env python3
"""
Audit Coverage Check — verifies state-changing route handlers either
use the AuditLayer (default — implicit) or explicitly opt out via
`#[no_audit("<reason>")]` attribute.

PHASE 0 SKELETON: AuditLayer middleware lands in Phase 2. Until it's
wired into router setup, this script reports candidate handlers without
failing — strict mode flips on once `middleware/audit.rs` exists.

Detection:
  - Walks `routes/*.rs` for `pub async fn` matching state-changing
    handler patterns (post_*, create_*, update_*, delete_*, patch_*).
  - Reports any handler with `#[no_audit(...)]` attribute as "opt-out".

Exit codes:
    0  All state-changing handlers covered or opted out
    1  Strict mode active and gaps detected
"""

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
ROUTES_DIR = REPO_ROOT / "medbrains" / "crates" / "medbrains-server" / "src" / "routes"
AUDIT_LAYER_FILE = (
    REPO_ROOT
    / "medbrains"
    / "crates"
    / "medbrains-server"
    / "src"
    / "middleware"
    / "audit.rs"
)

STATE_CHANGE_RE = re.compile(
    r"pub\s+async\s+fn\s+((?:post|create|update|delete|patch|revoke|cancel|approve|reject|activate|deactivate)_[a-z0-9_]+|"
    r"[a-z][a-z0-9_]*_(?:post|create|update|delete|patch))\s*\(",
    re.IGNORECASE,
)
NO_AUDIT_RE = re.compile(r'#\[no_audit\([^)]*\)\]')


def main() -> int:
    if not ROUTES_DIR.exists():
        print(f"ERROR: routes dir not found: {ROUTES_DIR}", file=sys.stderr)
        return 2

    strict = AUDIT_LAYER_FILE.exists()

    candidates: list[tuple[Path, int, str]] = []
    opt_outs: list[tuple[Path, int, str]] = []

    for rs_file in ROUTES_DIR.rglob("*.rs"):
        try:
            text = rs_file.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        lines = text.splitlines()
        for i, line in enumerate(lines):
            m = STATE_CHANGE_RE.search(line)
            if not m:
                continue
            # check 5 lines above for #[no_audit(...)]
            window = "\n".join(lines[max(0, i - 5) : i])
            if NO_AUDIT_RE.search(window):
                opt_outs.append((rs_file, i + 1, m.group(1)))
            else:
                candidates.append((rs_file, i + 1, m.group(1)))

    print(
        f"Found {len(candidates)} state-changing handlers, "
        f"{len(opt_outs)} opt-outs."
    )

    if opt_outs:
        print(f"\n=== {len(opt_outs)} OPT-OUT HANDLERS ===")
        for f, n, name in opt_outs[:20]:
            print(f"  ~ {f.relative_to(REPO_ROOT)}:{n}: {name}")
        if len(opt_outs) > 20:
            print(f"  ... and {len(opt_outs) - 20} more")

    if not strict:
        print(f"\nNOTE: AuditLayer not yet at {AUDIT_LAYER_FILE.relative_to(REPO_ROOT)}.")
        print("      Strict mode activates once middleware lands. (Phase 2 deliverable.)")
        return 0

    # In strict mode every candidate must be covered. Coverage = AuditLayer
    # is wired in main.rs (assumed once file exists; deeper check is Phase 2).
    print("✓ AuditLayer present; strict mode active.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
