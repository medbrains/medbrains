#!/usr/bin/env python3
"""Support dates only get longer: fail if a published end-of-support date moved earlier.

Lesson from CentOS 8 (2020): a promised support date was cut by eight years and users fled.
A hospital buys hardware and signs vendor contracts against our dates, so a date may be
extended, never shortened, and a supported line may never disappear from the table.

Reads every Markdown table in the watched files whose header names a support date
("until", "end of support", "EOL"), keyed by file and the row's first cell, and compares
the latest date in each such cell with the same row on the base ref.

  python3 scripts/check_support_dates.py origin/main
  python3 scripts/check_support_dates.py --self-test
"""

from __future__ import annotations

import re
import subprocess
import sys

# Where support dates are published: the promise, release notes, and the website's pages.
WATCHED = re.compile(
    r"^(medbrains/docs/COMPATIBILITY\.md|CHANGELOG\.md|medbrains/CHANGELOG\.md"
    r"|medbrains/docs/release-notes/.+\.mdx?|website/src/.+\.mdx?)$"
)
DATE_COLUMN = re.compile(r"until|end[- ]of[- ](support|life)|\beol\b", re.IGNORECASE)
DATE = re.compile(r"\b(\d{4}-\d{2}-\d{2})\b")


def cells(line: str) -> list[str]:
    """Splits one Markdown table row into trimmed cells, without the outer pipes."""
    return [c.strip() for c in line.strip().strip("|").split("|")]


def support_dates(text: str) -> dict[str, str]:
    """Maps each table row's first cell to the latest date in its support-date columns."""
    found: dict[str, str] = {}
    lines = text.splitlines()
    for i, line in enumerate(lines):
        if not line.lstrip().startswith("|") or i + 1 >= len(lines):
            continue
        if not re.fullmatch(r"\s*\|?[\s:|-]+\|?\s*", lines[i + 1]) or "-" not in lines[i + 1]:
            continue
        header = cells(line)
        cols = [n for n, name in enumerate(header) if DATE_COLUMN.search(name)]
        if not cols:
            continue
        for row in lines[i + 2 :]:
            if not row.lstrip().startswith("|"):
                break
            row_cells = cells(row)
            dates = [d for n in cols if n < len(row_cells) for d in DATE.findall(row_cells[n])]
            if dates:
                found[re.sub(r"[*`]", "", row_cells[0])] = max(dates)
    return found


def regressions(base: dict[str, str], head: dict[str, str]) -> list[str]:
    """Lists every row whose date moved earlier or that was removed, as messages."""
    out = []
    for key, old in sorted(base.items()):
        new = head.get(key)
        if new is None:
            out.append(f"{key}: support date {old} was removed; a supported line cannot vanish")
        elif new < old:
            out.append(f"{key}: support date moved earlier, {old} -> {new}")
    return out


def git(*args: str) -> str:
    """Runs git and returns stdout; an error stops the check rather than passing it."""
    return subprocess.run(["git", *args], check=True, capture_output=True, text=True).stdout


def dates_at(ref: str | None) -> dict[str, str]:
    """Collects support dates from every watched file at a ref, or in the working tree."""
    names = git("ls-tree", "-r", "--name-only", ref).splitlines() if ref else git("ls-files").splitlines()
    out: dict[str, str] = {}
    for name in filter(WATCHED.match, names):
        if ref:
            text = git("show", f"{ref}:{name}")
        else:
            with open(name, encoding="utf-8") as fh:
                text = fh.read()
        out.update({f"{name}: {k}": v for k, v in support_dates(text).items()})
    return out


def self_test() -> None:
    """Checks parsing and the ratchet against tables that must and must not pass."""
    table = (
        "| Major | Released | Security fixes until | Status |\n|---|---|---|---|\n"
        "| **1.x** | 2026-01-01 | 12 months after 2.0, never before **2029-12-31** | ok |\n"
        "| 2.x | 2027-01-01 | 2031-06-30 | ok |\n\ntext\n"
    )
    assert support_dates(table) == {"1.x": "2029-12-31", "2.x": "2031-06-30"}
    assert support_dates("| a | b |\n|---|---|\n| x | 2029-01-01 |\n") == {}
    later = table.replace("2029-12-31", "2030-12-31")
    earlier = table.replace("2031-06-30", "2030-06-30")
    removed = table.replace("| 2.x | 2027-01-01 | 2031-06-30 | ok |\n", "")
    base = support_dates(table)
    assert regressions(base, support_dates(later)) == []
    assert regressions(base, support_dates(table)) == []
    assert regressions(base, support_dates(earlier)) == ["2.x: support date moved earlier, 2031-06-30 -> 2030-06-30"]
    assert len(regressions(base, support_dates(removed))) == 1
    assert WATCHED.match("medbrains/docs/COMPATIBILITY.md") and WATCHED.match("website/src/pages/support.mdx")


def main() -> int:
    """Compares the working tree's support dates with the base ref and exits 1 on a cut."""
    if "--self-test" in sys.argv:
        self_test()
        print("check-support-dates: self-test OK")
        return 0
    if len(sys.argv) != 2:
        print("usage: check_support_dates.py <base-ref> | --self-test", file=sys.stderr)
        return 2
    base, head = dates_at(sys.argv[1]), dates_at(None)
    if not head:
        print("check-support-dates: no support dates found; the table moved or its header changed")
        return 1
    bad = regressions(base, head)
    for msg in bad:
        print(msg)
    if bad:
        print("\nSupport dates may only get longer (COMPATIBILITY.md §4, #5499). Extend, never cut.")
        return 1
    print(f"check-support-dates: OK, {len(head)} support dates, none earlier than on {sys.argv[1]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
