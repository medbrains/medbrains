#!/usr/bin/env python3
"""Money is rounded in one place: `medbrains_core::money::RoundMoney`.

    python3 scripts/check_money_rounding.py              # check (make check-money-rounding)
    python3 scripts/check_money_rounding.py --self-test

Billing rounded half-to-even (`round_dp(2)`) at ~80 sites while the payer
split, the storefront and PostgreSQL rounded half away from zero, so one bill
could disagree with its own receipt by a paisa. Every `round_dp(` and
`round_dp_with_strategy(` in Rust outside `medbrains-core/src/money.rs` fails,
unless the same or the previous line says `// rounding: <reason>` (a
percentage, a ratio, a vital sign, a deliberate cap). Exempt: `#[cfg(test)]`
blocks and test files (`tests/`, `tests.rs`, `*_tests.rs`).
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HELPER = "crates/medbrains-core/src/money.rs"
ROUND = re.compile(r"\.round_dp(?:_with_strategy)?\(")
MARKER = re.compile(r"//\s*rounding:\s*\S")
TEST_MOD = re.compile(r"#\[cfg\(test\)\]\s*(?:#\[[^\]]*\]\s*)*(?:pub(?:\([^)]*\))?\s+)?mod\s+\w+\s*\{")


def is_test_file(rel: str) -> bool:
    """Whether a path is a test file, which may round however its fixture needs."""
    return "/tests/" in rel or rel.endswith(("tests.rs", "_tests.rs"))


def strip_test_mods(text: str) -> str:
    """Blank `#[cfg(test)] mod … { … }` bodies, keeping line numbers."""
    out = list(text)
    for m in TEST_MOD.finditer(text):
        depth, i = 1, m.end()
        while i < len(text) and depth:
            depth += {"{": 1, "}": -1}.get(text[i], 0)
            i += 1
        for j in range(m.start(), i):
            if out[j] != "\n":
                out[j] = " "
    return "".join(out)


def violations(rel: str, text: str) -> list[str]:
    """Each unmarked rounding call in one file, as `path:line: source`."""
    lines = strip_test_mods(text).splitlines()
    found = []
    for n, line in enumerate(lines):
        if not ROUND.search(line):
            continue
        prev = lines[n - 1] if n else ""
        if MARKER.search(line) or MARKER.search(prev):
            continue
        found.append(f"{rel}:{n + 1}: {line.strip()}")
    return found


def scan() -> list[str]:
    """Every unmarked rounding call under `crates/`."""
    found = []
    for path in sorted((ROOT / "crates").rglob("*.rs")):
        rel = path.relative_to(ROOT).as_posix()
        if "/target/" in rel or rel == HELPER or is_test_file(rel):
            continue
        found += violations(rel, path.read_text(encoding="utf-8", errors="replace"))
    return found


def self_test() -> None:
    """Prove the check fails what it should and passes what it should."""
    assert violations("a.rs", "let t = x.round_dp(2);\n")
    assert violations("a.rs", "x.round_dp_with_strategy(2, S::ToZero)\n")
    assert not violations("a.rs", "x.to_paisa()\n")
    assert not violations("a.rs", "// rounding: a percentage\nlet p = x.round_dp(2);\n")
    assert not violations("a.rs", "let p = x.round_dp(1); // rounding: a vital sign\n")
    assert not violations("a.rs", "#[cfg(test)]\nmod tests {\n    fn f() { x.round_dp(2); }\n}\n")
    assert is_test_file("crates/x/tests/a.rs") and not is_test_file("crates/x/src/a.rs")
    print("check_money_rounding self-test: ok")


def main() -> int:
    """Run the check, or its self-test with `--self-test`."""
    if "--self-test" in sys.argv:
        self_test()
        return 0
    found = scan()
    if found:
        print("Money is rounded with `.to_paisa()` (medbrains_core::money::RoundMoney).")
        print("A value that is not money says why on the line: `// rounding: <reason>`.\n")
        print("\n".join(found))
        return 1
    print("money-rounding: every rounding call is the money rule or says why not")
    return 0


if __name__ == "__main__":
    sys.exit(main())
