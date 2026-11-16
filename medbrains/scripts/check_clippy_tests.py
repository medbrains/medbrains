#!/usr/bin/env python3
"""Clippy errors in test targets may only fall (ci.yml, Rust clippy, #5978).

    cargo clippy --workspace --exclude medbrains-desktop --all-targets --keep-going \\
        --message-format=json | python3 scripts/check_clippy_tests.py
    ... | python3 scripts/check_clippy_tests.py --update   # tighten the baseline
    python3 scripts/check_clippy_tests.py --self-test

Library and binary code must be clippy-clean, and CI holds that with a plain
`cargo clippy`. Test targets (`--all-targets`) carried ~5,000 denied lints when
this landed, nearly all `expect_used` in test helpers. Integration-test crate
roots now allow `expect`/`unwrap`/`panic`, as the repo's other test crates do;
what is left is `scripts/clippy_tests.baseline.json`, counted per file and lint.

A count above its baseline fails, and so does any error the baseline does not
name, including a compile error. A count below its baseline also fails until the
baseline is tightened with `--update`, so the slack cannot be spent again.
`--update` only lowers counts and drops cleared entries; it never raises one.
Raising a count means editing the JSON by hand, which the owner reviews.
The baseline is the Linux runner's: macOS-only code (os-setup `peer.rs`) differs.
"""

from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

BASELINE = Path(__file__).resolve().parent / "clippy_tests.baseline.json"


def count_errors(lines: list[str]) -> dict[str, dict[str, int]]:
    """Map file -> lint code -> count of error-level compiler messages, de-duplicated."""
    seen: set[tuple[str, int, int, str]] = set()
    counts: Counter[tuple[str, str]] = Counter()
    for line in lines:
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            continue
        if msg.get("reason") != "compiler-message" or msg["message"]["level"] != "error":
            continue
        body = msg["message"]
        if body["message"].startswith("aborting due to"):
            continue
        code = (body.get("code") or {}).get("code") or "error"
        span = next((s for s in body["spans"] if s["is_primary"]), None)
        where = (span["file_name"], span["line_start"], span["column_start"]) if span else ("-", 0, 0)
        # A file shared by two targets (lib + lib test) reports the same site twice.
        if (*where, code) in seen:
            continue
        seen.add((*where, code))
        counts[(where[0], code)] += 1
    found: dict[str, dict[str, int]] = {}
    for (file, code), n in sorted(counts.items()):
        found.setdefault(file, {})[code] = n
    return found


def compare(found: dict, baseline: dict) -> tuple[list[str], list[str]]:
    """Return (over-baseline lines, under-baseline lines)."""
    over, under = [], []
    keys = {(f, c) for f, cs in found.items() for c in cs} | {
        (f, c) for f, cs in baseline.items() for c in cs
    }
    for file, code in sorted(keys):
        n, allowed = found.get(file, {}).get(code, 0), baseline.get(file, {}).get(code, 0)
        if n > allowed:
            over.append(f"  {file}: {code} x{n} (baseline {allowed})")
        elif n < allowed:
            under.append(f"  {file}: {code} x{n} (baseline {allowed})")
    return over, under


def tighten(found: dict, baseline: dict | None) -> dict:
    """The lower of each count; with no baseline yet, the counts found."""
    if baseline is None:
        return found
    out: dict[str, dict[str, int]] = {}
    for file, codes in baseline.items():
        for code, allowed in codes.items():
            n = min(allowed, found.get(file, {}).get(code, 0))
            if n:
                out.setdefault(file, {})[code] = n
    return out


def self_test() -> int:
    """The ratchet's three answers on a two-message sample."""
    msg = {
        "reason": "compiler-message",
        "message": {
            "level": "error",
            "message": "used `expect()`",
            "code": {"code": "clippy::expect_used"},
            "spans": [{"is_primary": True, "file_name": "a.rs", "line_start": 1, "column_start": 1}],
        },
    }
    found = count_errors([json.dumps(msg), json.dumps(msg), "not json"])
    assert found == {"a.rs": {"clippy::expect_used": 1}}, found
    assert compare(found, {}) == (["  a.rs: clippy::expect_used x1 (baseline 0)"], [])
    assert compare({}, found) == ([], ["  a.rs: clippy::expect_used x0 (baseline 1)"])
    assert tighten({}, found) == {}
    assert tighten({"a.rs": {"clippy::expect_used": 5}}, found) == found
    print("check-clippy-tests: self-test passed")
    return 0


def main(argv: list[str]) -> int:
    """Compare stdin's clippy JSON with the baseline; `--update` tightens it."""
    if "--self-test" in argv:
        return self_test()
    found = count_errors(sys.stdin.read().splitlines())
    baseline = json.loads(BASELINE.read_text(encoding="utf-8")) if BASELINE.exists() else None
    if "--update" in argv:
        new = tighten(found, baseline)
        rows = [f"  {json.dumps(k)}: {json.dumps(v, sort_keys=True)}" for k, v in sorted(new.items())]
        BASELINE.write_text("{\n" + ",\n".join(rows) + "\n}\n", encoding="utf-8")
        print(f"check-clippy-tests: baseline written, {sum(map(len, new.values()))} entries")
        return 0
    over, under = compare(found, baseline or {})
    total = sum(n for codes in found.values() for n in codes.values())
    if over:
        print("check-clippy-tests: new clippy errors in test targets:\n" + "\n".join(over))
        print("\nFix them; test modules may use #[allow(clippy::unwrap_used, clippy::expect_used)].")
    if under:
        print("check-clippy-tests: fewer errors than the baseline (good):\n" + "\n".join(under))
        print("\nTighten it: rerun with --update and commit scripts/clippy_tests.baseline.json.")
    if over or under:
        return 1
    print(f"check-clippy-tests: {total} test-target errors, as the baseline allows")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
