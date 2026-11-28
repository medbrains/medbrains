#!/usr/bin/env python3
""""Today" is the hospital's date, read through `hospital_time`, never UTC's.

    python3 scripts/check_utc_today.py               # check (make check-utc-today)
    python3 scripts/check_utc_today.py --self-test
    python3 scripts/check_utc_today.py --tighten     # lower the baseline after a fix

`Utc::now().date_naive()` is yesterday's date in India from 00:00 to 05:30,
and `chrono::Local` is the server's zone, which is not the hospital's: 66
sites used one or the other for pack expiry, consent validity, a newborn's
lab band, a patient's age, OT and queue boards and the kiosk. Use
`medbrains_server_core::hospital_time::tenant_local_today`, or a date from
SQL inside a tenant transaction (`CURRENT_DATE` follows the hospital).

A genuinely UTC date says why on the line or the line before:
`// utc-date: <reason>`. Sites that existed when this check landed are counted
per file in `scripts/utc_today.baseline.json`; a file may only lose them.
Exempt: `medbrains-server-core/src/hospital_time.rs`, `#[cfg(test)]` blocks
and test files.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BASELINE = Path(__file__).resolve().parent / "utc_today.baseline.json"
EXEMPT = {"crates/medbrains-server-core/src/hospital_time.rs"}
UTC_TODAY = re.compile(
    r"Utc::now\(\)\s*\.date_naive\(\)|\bLocal::now\(\)|\bLocal::today\(\)|chrono::Local\b"
)
MARKER = re.compile(r"//\s*utc-date:\s*\S")
TEST_MOD = re.compile(r"#\[cfg\(test\)\]\s*(?:#\[[^\]]*\]\s*)*(?:pub(?:\([^)]*\))?\s+)?mod\s+\w+\s*\{")


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


def sites(text: str) -> list[int]:
    """Line numbers of unmarked UTC/server-zone dates in one file."""
    lines = strip_test_mods(text).splitlines()
    found = []
    for n, line in enumerate(lines):
        prev = lines[n - 1] if n else ""
        if UTC_TODAY.search(line) and not (MARKER.search(line) or MARKER.search(prev)):
            found.append(n + 1)
    return found


def scan() -> dict[str, list[int]]:
    """Every unmarked site under `crates/`, by file."""
    out = {}
    for path in sorted((ROOT / "crates").rglob("*.rs")):
        rel = path.relative_to(ROOT).as_posix()
        if "/target/" in rel or "/tests/" in rel or rel in EXEMPT or rel.endswith("tests.rs"):
            continue
        found = sites(path.read_text(encoding="utf-8", errors="replace"))
        if found:
            out[rel] = found
    return out


def self_test() -> None:
    """Prove the check fails what it should and passes what it should."""
    assert sites("let d = Utc::now().date_naive();\n") == [1]
    assert sites("let d = chrono::Local::now();\n") == [1]
    assert not sites("// utc-date: a UTC file name\nlet d = Utc::now().date_naive();\n")
    assert not sites("let d = tenant_local_today(&mut *tx, t).await?;\n")
    assert not sites("#[cfg(test)]\nmod tests {\n    fn f() { Utc::now().date_naive(); }\n}\n")
    print("check_utc_today self-test: ok")


def main() -> int:
    """Run the check, its self-test, or tighten the baseline."""
    if "--self-test" in sys.argv:
        self_test()
        return 0
    found = scan()
    counts = {f: len(v) for f, v in found.items()}
    if "--tighten" in sys.argv or "--init" in sys.argv:
        base = {} if "--init" in sys.argv else json.loads(BASELINE.read_text())
        new = counts if "--init" in sys.argv else {f: min(n, counts.get(f, 0)) for f, n in base.items()}
        BASELINE.write_text(json.dumps({f: n for f, n in sorted(new.items()) if n}, indent=1) + "\n")
        return 0
    base = json.loads(BASELINE.read_text())
    grew = [f for f, n in counts.items() if n > base.get(f, 0)]
    if grew:
        print("\"Today\" must be the hospital's date: use hospital_time::tenant_local_today,")
        print("or say why a UTC date is right: `// utc-date: <reason>`.\n")
        for f in grew:
            print(f"{f}: {counts[f]} (allowed {base.get(f, 0)}) at lines {found[f]}")
        return 1
    print(f"utc-today: no new UTC dates ({sum(counts.values())} baselined sites left)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
