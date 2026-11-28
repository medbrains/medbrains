#!/usr/bin/env python3
"""The server shell only shrinks: its lines and its directly declared routes.

    python3 scripts/check_shell_size.py              # check (CI)
    python3 scripts/check_shell_size.py --update     # record a drop (never a rise)
    python3 scripts/check_shell_size.py --self-test

`crates/medbrains-server` is meant to end as a thin shell: `main.rs`, preflight
and a table of the routers it mounts. Today it still holds whole areas of domain
code and declares routes itself. Two numbers are measured over `src/**/*.rs`:

- `lines`   every line, comments and tests included, so the number is the one
            `wc -l` gives and nobody argues over what counts;
- `routes`  occurrences of `.route(`, a route declared in the shell and not in
            the crate that owns it.

Either one above `scripts/shell_size.baseline.txt` fails. Below it passes, and
the PR that moved code out lowers the baseline with `--update`, which refuses to
raise a number. New code goes in the crate that owns it, not in the shell.
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SHELL = ROOT / "crates" / "medbrains-server" / "src"
BASELINE = ROOT / "scripts" / "shell_size.baseline.txt"
KEYS = ("lines", "routes")
HEADER = """\
# Ceiling for crates/medbrains-server/src, checked by scripts/check_shell_size.py.
# Lowered with --update by the PR that moves code out of the shell. Never raised:
# the script will not do it, and a hand edit upward needs the owner.
"""


def measure(sources: list[str]) -> dict[str, int]:
    """Lines and `.route(` occurrences across the given source texts."""
    return {
        "lines": sum(text.count("\n") for text in sources),
        "routes": sum(text.count(".route(") for text in sources),
    }


def read_baseline(text: str) -> dict[str, int]:
    """The baseline file as `{lines, routes}`."""
    pairs = (line.split() for line in text.splitlines() if line.strip() and not line.startswith("#"))
    return {key: int(value) for key, value in pairs}


def grown(live: dict[str, int], base: dict[str, int]) -> list[str]:
    """One failure line for each number above its baseline."""
    return [f"{key} grew {base[key]} -> {live[key]} (+{live[key] - base[key]})" for key in KEYS if live[key] > base[key]]


def lowered(live: dict[str, int], base: dict[str, int]) -> dict[str, int]:
    """The baseline after `--update`: each number may fall to the measurement, never rise."""
    return {key: min(live[key], base[key]) for key in KEYS}


def self_test() -> int:
    """Prove growth fails, a drop passes, and `--update` cannot raise the ceiling."""
    live = measure(["a\nb\n", 'Router::new()\n    .route("/a", get(a))\n    .route("/b", get(b))\n'])
    assert live == {"lines": 5, "routes": 2}
    assert not grown(live, {"lines": 5, "routes": 2})
    assert not grown(live, {"lines": 9, "routes": 3})
    assert grown(live, {"lines": 4, "routes": 2}) == ["lines grew 4 -> 5 (+1)"]
    assert grown(live, {"lines": 5, "routes": 1}) == ["routes grew 1 -> 2 (+1)"]
    assert lowered(live, {"lines": 9, "routes": 1}) == {"lines": 5, "routes": 1}
    assert read_baseline(HEADER + "lines 5\nroutes 2\n") == {"lines": 5, "routes": 2}
    print("✓ self-test passed")
    return 0


def main() -> int:
    """Check the shell against its ceiling, or lower the ceiling with `--update`."""
    if "--self-test" in sys.argv:
        return self_test()
    live = measure([path.read_text(encoding="utf-8") for path in sorted(SHELL.rglob("*.rs"))])
    base = read_baseline(BASELINE.read_text(encoding="utf-8"))
    if "--update" in sys.argv:
        new = lowered(live, base)
        BASELINE.write_text(HEADER + "".join(f"{key} {new[key]}\n" for key in KEYS), encoding="utf-8")
        print(f"✓ baseline now {new}")
    found = grown(live, base)
    if found:
        print("✗ the server shell only shrinks (docs/architecture/MODULE-BRICKS.md):")
        for line in found:
            print(f"  {line}")
        print("  put new code and routes in the crate that owns them; if this PR also moves code out, move more than it adds")
        return 1
    room = ", ".join(f"{key} {live[key]}/{base[key]}" for key in KEYS)
    below = any(live[key] < base[key] for key in KEYS) and "--update" not in sys.argv
    print(f"✓ shell within its ceiling ({room})" + ("; lower it: check_shell_size.py --update" if below else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
