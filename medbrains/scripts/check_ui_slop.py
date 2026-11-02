#!/usr/bin/env python3
"""Decorative effects in the web app only ever go down.

    python3 scripts/check_ui_slop.py            # check (CI)
    python3 scripts/check_ui_slop.py --update   # record an improvement
    python3 scripts/check_ui_slop.py --self-test

Clinical screens are flat: sharp corners, no glass, no shadows on page surfaces
(docs/CARBON-COLOR-RULES.md, docs/CARBON-LAYOUT-RULES.md). Round dots, avatars and
floating menus are allowed, which is why this counts exact patterns.
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "apps/web/src"
BASELINE = ROOT / "scripts/ui_slop_baseline.json"

PATTERNS = {
    "glass blur": (".scss", r"backdrop-filter"),
    "gradients": (".scss", r"(linear|radial|conic)-gradient"),
    "gradients in tsx": (".tsx", r"(linear|radial|conic)-gradient|variant=\"gradient\""),
    "hover lift": (".scss", r"translateY\(-|transform: *scale\(1\."),
    "round surfaces": (".tsx", r"<(Card|Paper|Box|Button|Badge|ThemeIcon)\b[^>]*\bradius=\"(md|lg|xl)\""),
    "surface shadows": (".tsx", r"<(Card|Paper|Box)\b[^>]*\bshadow=\"(xs|sm|md|lg|xl)\""),
    "uppercase field labels": (".tsx", r"<Text\b[^>]*\btt=\"uppercase\""),
    "emoji": (".tsx", "[\U0001F300-\U0001FAFF✨]"),
}


def count(text: str, pattern: str) -> int:
    """How many times a pattern occurs, across line breaks inside a JSX tag."""
    return len(re.findall(pattern, text))


def measure() -> dict[str, int]:
    """Count every pattern across the app's source, tests excluded."""
    totals = dict.fromkeys(PATTERNS, 0)
    for name, (suffix, pattern) in PATTERNS.items():
        for path in SRC.rglob(f"*{suffix}"):
            if ".test." not in path.name:
                totals[name] += count(path.read_text(encoding="utf-8"), pattern)
    return totals


def self_test() -> None:
    """Fail if the patterns stop telling a surface from an allowed element."""
    _, round_surface = PATTERNS["round surfaces"]
    assert count('<Card\n  withBorder\n  radius="md">', round_surface) == 1
    assert count('<Avatar radius="xl">', round_surface) == 0
    assert count('<Menu shadow="md">', PATTERNS["surface shadows"][1]) == 0
    assert count('<Text tt="uppercase">', PATTERNS["uppercase field labels"][1]) == 1
    print("self-test passed")


def main() -> int:
    """Compare today's counts with the baseline; any rise fails."""
    if "--self-test" in sys.argv:
        self_test()
        return 0
    now = measure()
    if "--update" in sys.argv:
        BASELINE.write_text(json.dumps(now, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(now, indent=2))
        return 0
    baseline = json.loads(BASELINE.read_text(encoding="utf-8"))
    worse = {k: (baseline.get(k, 0), v) for k, v in now.items() if v > baseline.get(k, 0)}
    for name, (before, after) in worse.items():
        print(f"{name}: {before} -> {after}. Use the flat design tokens instead.")
    better = {k for k, v in now.items() if v < baseline.get(k, 0)}
    if better:
        print(f"improved: {', '.join(sorted(better))}. Run with --update to lock it in.")
    return 1 if worse or better else 0


if __name__ == "__main__":
    sys.exit(main())
