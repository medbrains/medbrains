#!/usr/bin/env python3
"""The system stays small: size budgets, measured from the tree and enforced.

    python3 scripts/check_size_budgets.py              # check (CI)
    python3 scripts/check_size_budgets.py --update     # record new numbers
    python3 scripts/check_size_budgets.py --self-test

RFC-HOSPITAL-OS §3a, phase SM1. Reads files only, so no cargo build is needed.

- Kernel code lines: hard limit, no baseline can raise it. Blank lines, comments
  and test code do not count, so documenting the kernel never costs budget.
- Kernel direct dependencies: an allowlist in the baseline. `--update` drops
  entries that left, but never adds one: that takes a hand edit, seen in review.
- Kernel package closure, workspace packages and crates: growth fails until `--update` is committed, so
  it is always a visible choice. A drop also fails until recorded, or the room
  it freed could be silently refilled.
- Web first-load JS (gzip): a ceiling, checked only when a build output exists.

Binary size per profile is not measured: profiles arrive with phase SM2.
"""

from __future__ import annotations

import gzip
import json
import re
import sys
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BASELINE = ROOT / "scripts" / "size_budgets.json"
KERNEL = ROOT / "crates" / "medbrains-kernel"
WEB_DIST = ROOT / "apps" / "web" / "dist"

KERNEL_LINE_LIMIT = 2000
# Bundles move with every screen, so the ceiling sits above the measurement.
WEB_HEADROOM = 1.10

WEB_ENTRY = re.compile(
    r'<script\b[^>]*\bsrc="([^"]+)"|<link\b[^>]*\brel="modulepreload"[^>]*\bhref="([^"]+)"'
)


def count_code_lines(text: str) -> int:
    """Count Rust code lines, leaving out blanks, `//` comments and `#[cfg(test)]` items."""
    # ponytail: braces are counted naively and /* */ counts as code. A lone brace
    # in a string could misjudge a test item's end; use a Rust parser if that bites.
    total, skipping, depth, opened = 0, False, 0, False
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("//"):
            continue
        if line.startswith("#[cfg(test)]"):
            skipping, depth, opened = True, 0, False
            line = line.removeprefix("#[cfg(test)]").strip()
            if not line:
                continue
        if not skipping:
            total += 1
            continue
        depth += line.count("{") - line.count("}")
        opened = opened or "{" in line
        if (opened and depth <= 0) or (not opened and line.endswith(";")):
            skipping = False
    return total


def measure_kernel_lines(src: Path) -> int:
    """Total code lines across a kernel source tree, leaving out test files."""
    return sum(
        count_code_lines(path.read_text(encoding="utf-8"))
        for path in src.rglob("*.rs")
        if path.name != "tests.rs" and "tests" not in path.relative_to(src).parts
    )


def direct_dependencies(manifest: dict) -> set[str]:
    """Dependencies that reach the built kernel: runtime, build and target-specific, not dev."""
    tables = [manifest, *manifest.get("target", {}).values()]
    return {
        name
        for table in tables
        for section in ("dependencies", "build-dependencies")
        for name in table.get(section, {})
    }


def lock_closure(lock: dict, start: str) -> int:
    """How many packages `start` can pull in, itself included, walking `Cargo.lock` by version.

    An upper bound: the lock records what any workspace member enabled, on any platform, and not
    which features this crate turns on, so `cargo tree -e normal` reports fewer. It needs no
    build and cannot be fooled by a feature flag, which is why the ratchet uses it.
    """
    versions: dict[str, list[str]] = {}
    packages: dict[tuple[str, str], list[str]] = {}
    for package in lock["package"]:
        versions.setdefault(package["name"], []).append(package["version"])
        packages[(package["name"], package["version"])] = package.get("dependencies", [])

    def resolve(dep: str) -> tuple[str, str]:
        """The exact package a lock entry means; it names a version only when several are locked."""
        name, *rest = dep.split()
        return (name, rest[0] if rest else versions[name][0])

    seen: set[tuple[str, str]] = set()
    stack = [resolve(start)]
    while stack:
        package = stack.pop()
        if package not in seen:
            seen.add(package)
            stack.extend(resolve(dep) for dep in packages[package])
    return len(seen)


def first_load_gzip_bytes(dist: Path) -> int | None:
    """Gzipped size of the JS `index.html` loads up front, or None with no build output."""
    index = dist / "index.html"
    if not index.exists():
        return None
    html = re.sub(r"<!--.*?-->", "", index.read_text(encoding="utf-8"), flags=re.DOTALL)
    urls = {script or preload for script, preload in WEB_ENTRY.findall(html)}
    local = {url.split("?", 1)[0].lstrip("/") for url in urls if "//" not in url}
    # A missing file raises: counting it as zero would pass a broken measurement.
    return sum(len(gzip.compress((dist / name).read_bytes(), 9)) for name in local)


def measure() -> dict:
    """Read every budgeted number from the tree."""
    workspace = tomllib.loads((ROOT / "Cargo.toml").read_text(encoding="utf-8"))
    lock = tomllib.loads((ROOT / "Cargo.lock").read_text(encoding="utf-8"))
    kernel = tomllib.loads((KERNEL / "Cargo.toml").read_text(encoding="utf-8"))
    return {
        "kernel_lines": measure_kernel_lines(KERNEL / "src"),
        "kernel_deps": direct_dependencies(kernel),
        "kernel_closure": lock_closure(lock, KERNEL.name),
        "packages": len(lock["package"]),
        "crates": len(workspace["workspace"]["members"]),
        "web_gzip": first_load_gzip_bytes(WEB_DIST),
    }


def compare(live: dict, base: dict) -> tuple[list[str], list[str], list[str]]:
    """Sort findings into (update cannot fix, growth to accept, drops to record)."""
    hard, grown, dropped = [], [], []
    if live["kernel_lines"] > KERNEL_LINE_LIMIT:
        hard.append(f"kernel code is {live['kernel_lines']} lines, limit {KERNEL_LINE_LIMIT}")
    allowed = set(base["kernel_deps"])
    if extra := sorted(live["kernel_deps"] - allowed):
        hard.append(f"kernel dependencies not on the allowlist: {extra}")
    if gone := sorted(allowed - live["kernel_deps"]):
        dropped.append(f"kernel dependencies no longer used: {gone}")
    for key in ("kernel_closure", "packages", "crates"):
        if live[key] > base[key]:
            grown.append(f"{key} grew {base[key]} -> {live[key]}")
        elif live[key] < base[key]:
            dropped.append(f"{key} fell {base[key]} -> {live[key]}")
    ceiling = base.get("web_first_load_gzip_limit")
    if live["web_gzip"] is not None and ceiling is not None and live["web_gzip"] > ceiling:
        grown.append(f"web first-load JS is {live['web_gzip']} bytes gzip, ceiling {ceiling}")
    return hard, grown, dropped


def updated_baseline(live: dict, base: dict) -> dict:
    """The baseline after `--update`; the web ceiling stays put when nothing was built."""
    web = base.get("web_first_load_gzip_limit")
    if live["web_gzip"] is not None:
        web = int(live["web_gzip"] * WEB_HEADROOM)
    return {
        "kernel_deps": sorted(live["kernel_deps"]),
        "kernel_closure": live["kernel_closure"],
        "packages": live["packages"],
        "crates": live["crates"],
        "web_first_load_gzip_limit": web,
    }


def self_test() -> None:
    """Fail loudly if the measuring or the comparing stops telling good from bad."""
    source = "//! Doc.\n\n/// Doc.\nfn a() {} // tail\n#[cfg(test)]\nmod t {\n    fn b() {\n    }\n}\nfn c() {}\n"
    assert count_code_lines(source) == 2
    assert count_code_lines("#[cfg(test)]\nuse x;\nfn c() {}\n") == 1
    assert count_code_lines("#[cfg(test)] mod t {\n}\nfn c() {}\n") == 1
    assert count_code_lines("#[cfg(test)]\n#[allow(x)]\nfn t() {\n}\nfn c() {}\n") == 1

    manifest = {
        "dependencies": {"serde": "1"},
        "dev-dependencies": {"tokio": "1"},
        "build-dependencies": {"cc": "1"},
        "target": {"cfg(unix)": {"dependencies": {"libc": "1"}}},
    }
    assert direct_dependencies(manifest) == {"serde", "cc", "libc"}

    lock = {
        "package": [
            {"name": "kernel", "version": "1.0.0", "dependencies": ["a", "b 1.0.0"]},
            {"name": "a", "version": "1.0.0", "dependencies": ["b 2.0.0", "kernel"]},
            {"name": "b", "version": "1.0.0"},
            {"name": "b", "version": "2.0.0"},
            {"name": "axum", "version": "1.0.0", "dependencies": ["kernel"]},
        ]
    }
    # Versions are distinct packages, a cycle ends, and what depends on the kernel is not in it.
    assert lock_closure(lock, "kernel") == 4
    assert lock_closure(lock, "axum") == 5

    live = {
        "kernel_lines": 10,
        "kernel_deps": {"serde"},
        "kernel_closure": 3,
        "packages": 5,
        "crates": 2,
        "web_gzip": None,
    }
    base = {
        "kernel_deps": ["serde"],
        "kernel_closure": 3,
        "packages": 5,
        "crates": 2,
        "web_first_load_gzip_limit": 9,
    }
    assert compare(live, base) == ([], [], [])
    assert compare({**live, "kernel_lines": KERNEL_LINE_LIMIT + 1}, base)[0]
    assert compare({**live, "kernel_deps": {"serde", "axum"}}, base)[0]
    assert compare({**live, "kernel_deps": set()}, base)[2]
    assert compare({**live, "kernel_closure": 4}, base)[1]
    assert compare({**live, "kernel_closure": 2}, base)[2]
    assert updated_baseline({**live, "kernel_closure": 2}, base)["kernel_closure"] == 2
    assert compare({**live, "packages": 6}, base)[1]
    assert compare({**live, "packages": 4}, base)[2]
    assert compare({**live, "crates": 3}, base)[1]
    assert compare({**live, "web_gzip": 10}, base)[1]
    assert compare({**live, "web_gzip": 9}, base) == ([], [], [])
    assert updated_baseline(live, base)["web_first_load_gzip_limit"] == 9
    assert updated_baseline({**live, "web_gzip": 100}, base)["web_first_load_gzip_limit"] == 110
    print("self-test passed")


def main() -> int:
    """Run the check, or record the numbers with `--update`."""
    if "--self-test" in sys.argv:
        self_test()
        return 0
    live = measure()
    if BASELINE.exists():
        base = json.loads(BASELINE.read_text(encoding="utf-8"))
    elif "--update" in sys.argv:  # the first baseline is seeded from the tree as it stands
        base = {"kernel_deps": sorted(live["kernel_deps"]), "kernel_closure": 0, "packages": 0, "crates": 0}
    else:
        print(f"✗ no baseline at {BASELINE.name}; run with --update")
        return 1
    hard, grown, dropped = compare(live, base)
    web = live["web_gzip"]
    web_note = f"{web} bytes gzip" if web is not None else "skipped, no build output in apps/web/dist"
    summary = (
        f"kernel {live['kernel_lines']}/{KERNEL_LINE_LIMIT} lines, "
        f"{len(live['kernel_deps'])} kernel deps, {live['kernel_closure']} packages under the kernel, "
        f"{live['packages']} packages, "
        f"{live['crates']} crates, web first load {web_note}"
    )
    if hard:
        print("✗ size budget broken, and --update cannot accept it:")
        print("\n".join(f"  {h}" for h in hard))
        print("  cut it; a new kernel dependency needs a reasoned hand edit of the allowlist")
        return 1
    if "--update" in sys.argv:
        new = json.dumps(updated_baseline(live, base), indent=2) + "\n"
        BASELINE.write_text(new, encoding="utf-8")
        print(f"✓ baseline updated ({summary})")
        return 0
    if grown or dropped:
        print("✗ size budgets differ from the baseline:")
        print("\n".join(f"  {f}" for f in grown + dropped))
        print("  run: python3 scripts/check_size_budgets.py --update (say why in the PR if it grew)")
        return 1
    print(f"✓ size budgets hold ({summary})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
