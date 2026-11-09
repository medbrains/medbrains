#!/usr/bin/env python3
"""Ratchet on source file length: new files stay under the cap, long files never grow.

The project rule is 450 lines per file (ENGINEERING.md). About 400 files were
already longer when this check arrived, so they are recorded in a baseline at
their current length: each may shrink, never grow. A file not in the baseline
must be at or under the cap.

  python3 scripts/check_file_lengths.py              # check (CI, hooks)
  python3 scripts/check_file_lengths.py FILE...      # check only these files
  python3 scripts/check_file_lengths.py --update     # tighten the baseline (owner)
  python3 scripts/check_file_lengths.py --self-test

A shrink passes and is reported; --update locks it in. Growth is never
recorded by --update: an entry only ever moves down or disappears.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BASELINE = ROOT / "scripts" / "file_lengths.baseline.json"
CAP = 450
SCAN = [
    "crates",
    "apps/web/src",
    "packages",
    "apps/ios",
    "apps/android",
    "apps/desktop/src-tauri/src",
    "scripts",
]
SUFFIXES = {".rs", ".ts", ".tsx", ".scss", ".swift", ".kt", ".py"}
SKIP_PARTS = {
    "node_modules", "target", "dist", "build", ".gradle", ".sqlx", "vendor",
    "migrations", "migrations-archive", "DerivedData", ".build",
}
GENERATED = {
    "packages/types/src/permissions.ts",
    "packages/types/src/permission-catalog.ts",
}


def is_generated(rel: str) -> bool:
    """Generated files are written by tools, so their length is the tool's business."""
    return rel in GENERATED or "generated" in Path(rel).name


def source_files(only: list[str] | None = None) -> dict[str, int]:
    """Map each checked file (repo-relative to medbrains/) to its line count."""
    paths: list[Path] = []
    if only:
        paths = [Path(p).resolve() for p in only]
    else:
        for top in SCAN:
            base = ROOT / top
            if base.exists():
                paths.extend(p for p in base.rglob("*") if p.is_file())
    out: dict[str, int] = {}
    for p in paths:
        try:
            rel = p.relative_to(ROOT).as_posix()
        except ValueError:
            continue
        if p.suffix not in SUFFIXES or SKIP_PARTS & set(p.parts) or is_generated(rel):
            continue
        with p.open("rb") as fh:
            out[rel] = sum(1 for _ in fh)
    return out


def judge(counts: dict[str, int], baseline: dict[str, int]) -> tuple[list[str], list[str]]:
    """Return (failures, improvements) for the given counts against the baseline."""
    fails, better = [], []
    for rel, n in sorted(counts.items()):
        limit = baseline.get(rel, CAP)
        if n > limit:
            why = f"grew past its baseline {limit}" if rel in baseline else f"is over the {CAP}-line cap"
            fails.append(f"{rel}: {n} lines, {why}. Split it by responsibility.")
        elif rel in baseline and n < baseline[rel]:
            better.append(f"{rel}: {baseline[rel]} -> {n}")
    return fails, better


def self_test() -> int:
    """Pin the rules: new files capped, baselined files may shrink but not grow."""
    base = {"a.rs": 900}
    assert judge({"a.rs": 900}, base) == ([], [])
    assert judge({"a.rs": 901}, base)[0]
    assert judge({"a.rs": 800}, base) == ([], ["a.rs: 900 -> 800"])
    assert judge({"b.rs": CAP}, base) == ([], [])
    assert judge({"b.rs": CAP + 1}, base)[0]
    assert is_generated("crates/x/src/generated.rs")
    print("self-test ok")
    return 0


def main(argv: list[str]) -> int:
    """Check, update or self-test, per the module docstring."""
    if "--self-test" in argv:
        return self_test()
    baseline = json.loads(BASELINE.read_text()) if BASELINE.exists() else {}
    if "--update" in argv:
        counts = source_files()
        tightened = {
            rel: min(n, baseline.get(rel, n))
            for rel, n in counts.items()
            if n > CAP and (rel in baseline or not BASELINE.exists())
        }
        BASELINE.write_text(json.dumps(dict(sorted(tightened.items())), indent=1) + "\n")
        print(f"baseline: {len(tightened)} files over {CAP} lines, none may grow")
        return 0
    files = [a for a in argv if not a.startswith("--")]
    counts = source_files(files or None)
    fails, better = judge(counts, baseline)
    for line in better:
        print(f"shorter: {line} (run --update to lock it in)")
    if fails:
        print("✗ file length:", *fails, sep="\n  ")
        return 1
    print(f"✓ {len(counts)} files: none over {CAP} lines except the {len(baseline)} baselined, and none grew")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
