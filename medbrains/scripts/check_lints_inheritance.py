#!/usr/bin/env python3
"""Every workspace crate inherits the workspace lints.

    python3 scripts/check_lints_inheritance.py              # check (CI)
    python3 scripts/check_lints_inheritance.py --self-test

A crate without `[lints] workspace = true` silently escapes every denied lint
(`unwrap_used`, `panic`, `print_stdout`, ...). Eleven crates did, authz-gate,
signing and payment-gateway among them (#5976). Reads files only, no cargo.
"""

from __future__ import annotations

import sys
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Crate directory name -> written reason. Cargo cannot mix `workspace = true`
# with local overrides, so a crate that needs one carries its own full table.
# Adding an entry takes a reason here, seen in review.
EXCEPTIONS: dict[str, str] = {
    "medbrains-edge-rn": "UniFFI scaffolding needs unsafe_code allowed; own table repeats "
    "every clippy denial",
    "medbrains-loadtest": "goose load-test harness, not shipped; relaxes clippy::all to warn",
    "medbrains-shell": "outside the workspace (built in the Linux image with Debian rustc); "
    "own table repeats the denials",
}


def inherits_workspace_lints(manifest: dict) -> bool:
    """True when the manifest has `[lints] workspace = true`."""
    return manifest.get("lints", {}).get("workspace") is True


def find_offenders(crates_dir: Path) -> list[str]:
    """Names of crates under `crates_dir` that neither inherit nor are excepted."""
    offenders = []
    for path in sorted(crates_dir.glob("*/Cargo.toml")):
        name = path.parent.name
        if name in EXCEPTIONS:
            continue
        if not inherits_workspace_lints(tomllib.loads(path.read_text())):
            offenders.append(name)
    return offenders


def self_test() -> None:
    """The check must catch a missing table, `workspace = false` and a stray key."""
    assert inherits_workspace_lints(tomllib.loads("[lints]\nworkspace = true\n"))
    assert not inherits_workspace_lints(tomllib.loads("[package]\nname = 'x'\n"))
    assert not inherits_workspace_lints(tomllib.loads("[lints]\nworkspace = false\n"))
    assert not inherits_workspace_lints(tomllib.loads("[lints.clippy]\nall = 'deny'\n"))
    print("check_lints_inheritance self-test: ok")


def main() -> int:
    """Fail listing every crate that escapes the workspace lints."""
    if "--self-test" in sys.argv:
        self_test()
        return 0
    offenders = find_offenders(ROOT / "crates")
    stale = sorted(n for n in EXCEPTIONS if not (ROOT / "crates" / n).is_dir())
    for name in offenders:
        print(f"crates/{name}/Cargo.toml: add `[lints]\\nworkspace = true`")
    for name in stale:
        print(f"EXCEPTIONS lists {name}, which no longer exists: remove it")
    if offenders or stale:
        return 1
    print("every crate inherits the workspace lints")
    return 0


if __name__ == "__main__":
    sys.exit(main())
