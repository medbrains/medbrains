#!/usr/bin/env python3
"""Every workspace member inherits the workspace lints.

    python3 scripts/check_lints_inheritance.py              # check (CI)
    python3 scripts/check_lints_inheritance.py --self-test

A crate without `[lints] workspace = true` silently escapes every denied lint
(`unwrap_used`, `panic`, `print_stdout`, ...). Eleven crates did, authz-gate,
signing and payment-gateway among them (#5976). Reads files only, no cargo.

The crates checked are the workspace `members` of `Cargo.toml` (globs
expanded, `exclude` honoured), so `apps/edge` and `apps/desktop/src-tauri` are
covered too. Packages outside the workspace are out of scope: they cannot
inherit, being built by another toolchain (`crates/medbrains-shell` with
Debian's rustc in the OS image, `tools/svc-activator` likewise).
"""

from __future__ import annotations

import sys
import tempfile
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Member path (relative to ROOT) -> written reason. Cargo cannot mix
# `workspace = true` with local overrides, so a crate that needs one carries its
# own full table. Adding an entry takes a reason here, seen in review.
EXCEPTIONS: dict[str, str] = {
    "crates/medbrains-edge-rn": "UniFFI scaffolding needs unsafe_code allowed and emits "
    "qualified paths; its own table repeats every clippy denial but relaxes rustc's "
    "unreachable_pub (warn) and unused_qualifications (allow), and omits unused/dead_code",
    "crates/medbrains-loadtest": "goose load-test harness, not shipped; relaxes clippy::all to warn",
}


def inherits_workspace_lints(manifest: dict) -> bool:
    """True when the manifest has `[lints] workspace = true`."""
    return manifest.get("lints", {}).get("workspace") is True


def workspace_members(root: Path) -> list[str]:
    """Member directories (relative to `root`) named by its `Cargo.toml`, globs expanded."""
    workspace = tomllib.loads((root / "Cargo.toml").read_text())["workspace"]
    excluded = set(workspace.get("exclude", []))
    members: set[str] = set()
    for pattern in workspace.get("members", []):
        for path in root.glob(pattern):
            rel = path.relative_to(root).as_posix()
            if (path / "Cargo.toml").is_file() and rel not in excluded:
                members.add(rel)
    return sorted(members)


def find_offenders(root: Path, exceptions: dict[str, str]) -> tuple[list[str], list[str]]:
    """Members that neither inherit nor are excepted, and exceptions naming no member."""
    members = workspace_members(root)
    offenders = [
        m
        for m in members
        if m not in exceptions
        and not inherits_workspace_lints(tomllib.loads((root / m / "Cargo.toml").read_text()))
    ]
    stale = sorted(set(exceptions) - set(members))
    return offenders, stale


def write_crate(root: Path, rel: str, body: str) -> None:
    """Self-test helper: a member manifest at `root/rel` with `body` after `[package]`."""
    (root / rel).mkdir(parents=True)
    (root / rel / "Cargo.toml").write_text(f"[package]\nname = 'x'\n{body}")


def self_test() -> None:
    """The check must catch a missing table, `workspace = false`, a stray key and stale exceptions."""
    assert inherits_workspace_lints(tomllib.loads("[lints]\nworkspace = true\n"))
    assert not inherits_workspace_lints(tomllib.loads("[package]\nname = 'x'\n"))
    assert not inherits_workspace_lints(tomllib.loads("[lints]\nworkspace = false\n"))
    assert not inherits_workspace_lints(tomllib.loads("[lints.clippy]\nall = 'deny'\n"))
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        (root / "Cargo.toml").write_text(
            '[workspace]\nmembers = ["crates/*", "apps/edge"]\nexclude = ["crates/skip"]\n'
        )
        write_crate(root, "crates/good", "[lints]\nworkspace = true\n")
        write_crate(root, "crates/bad", "")
        write_crate(root, "crates/excused", "")
        write_crate(root, "crates/skip", "")
        write_crate(root, "apps/edge", "")
        write_crate(root, "apps/outside", "")
        offenders, stale = find_offenders(root, {"crates/excused": "r", "crates/gone": "r"})
        assert offenders == ["apps/edge", "crates/bad"], offenders
        assert stale == ["crates/gone"], stale
    print("check_lints_inheritance self-test: ok")


def main() -> int:
    """Fail listing every member that escapes the workspace lints."""
    if "--self-test" in sys.argv:
        self_test()
        return 0
    offenders, stale = find_offenders(ROOT, EXCEPTIONS)
    for name in offenders:
        print(f"{name}/Cargo.toml: add `[lints]\\nworkspace = true`")
    for name in stale:
        print(f"EXCEPTIONS lists {name}, which is not a workspace member: remove it")
    if offenders or stale:
        return 1
    print(f"every workspace member inherits the workspace lints ({len(EXCEPTIONS)} excepted)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
