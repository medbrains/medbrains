#!/usr/bin/env python3
"""Move the rows a branch added to DECISIONS.md into decision files.

For a pull request opened before decisions became one file each (check_decisions.py). It reads
the rows this branch added to `medbrains/docs/DECISIONS.md` since its merge base, writes each
as `medbrains/docs/decisions/YYYY-MM-DD-slug.md`, and takes the rows back out of DECISIONS.md.
Nothing is committed: read the files, fix the title, area and status, then commit.

  python3 medbrains/scripts/decision_row_to_file.py origin/release/3.35.3 [--area ci]
  python3 medbrains/scripts/decision_row_to_file.py --self-test
"""

from __future__ import annotations

import re
import subprocess
import sys

import check_decisions
from check_decisions import FOLDER, HISTORY, ROOT

ROW = re.compile(r"^\| *(\d{4}-\d{2}-\d{2}) *\| *(.+?) *\|\s*$")
MISSING = "Not recorded in the original row."


def added_rows(old: str, new: str) -> list[str]:
    """Table rows in `new` that `old` does not have, in file order."""
    had = set(old.splitlines())
    return [line for line in new.splitlines() if line not in had and ROW.match(line)]


def split_text(text: str) -> tuple[str, str, str]:
    """What, why and rejected, cut at the row's own `Why:` and `Rejected:` markers."""
    what, _, rest = text.partition(" Why: ")
    if " Rejected: " in what:
        what, _, rejected = what.partition(" Rejected: ")
        return what, MISSING, rejected
    why, _, rejected = rest.partition(" Rejected: ")
    return what, why or MISSING, rejected or MISSING


def slug(title: str) -> str:
    """The first six words of the title, lowercase, joined by hyphens."""
    return "-".join(re.findall(r"[a-z0-9]+", title.lower())[:6]) or "decision"


def row_to_file(row: str, area: str) -> tuple[str, str]:
    """The file name and contents for one DECISIONS.md row."""
    match = ROW.match(row)
    assert match, row
    date, text = match.groups()
    what, why, rejected = split_text(text)
    title = re.split(r"(?<=[^.]{12})\. ", what, maxsplit=1)[0].rstrip(".").replace("`", "")[:120]
    status = "proposed" if what.startswith("Proposed") else "decided"
    front = f"---\ndate: {date}\ntitle: {title}\nstatus: {status}\narea: {area}\n---\n"
    body = f"\n## What\n\n{what}\n\n## Why\n\n{why}\n\n## Rejected\n\n{rejected}\n"
    return f"{date}-{slug(title)}.md", front + body


def git(*args: str) -> str:
    """Run git at the repository root and return what it printed."""
    done = subprocess.run(["git", *args], cwd=ROOT.parent, capture_output=True, text=True, check=True)
    return done.stdout


def convert(base: str, area: str) -> int:
    """Write a file per added row and remove the rows from DECISIONS.md."""
    history = ROOT.parent / HISTORY
    new = history.read_text()
    rows = added_rows(git("show", f"{git('merge-base', 'HEAD', base).strip()}:{HISTORY}"), new)
    if not rows:
        print("This branch added no row to DECISIONS.md; nothing to move.")
        return 0
    FOLDER.mkdir(exist_ok=True)
    for row in rows:
        name, text = row_to_file(row, area)
        if (FOLDER / name).exists():
            print(f"{name} already exists; rename one of them. Nothing more was moved.")
            return 1
        (FOLDER / name).write_text(text)
        new = new.replace(row + "\n", "", 1)
        history.write_text(new)
        print(f"wrote medbrains/docs/decisions/{name}")
    print("Now check each file's title, area and status (a reversal names what it reverses).")
    return 0


def self_test() -> int:
    """A row becomes a file the checker accepts; only added rows are picked up."""
    old = "# t\n| Date | What |\n|---|---|\n| 2026-11-01 | Old row. Why: x. Rejected: y. |\n"
    row = "| 2026-11-22 | Run `e2e` in the queue, not on each push. Why: 80 minutes a push. Rejected: paths-ignore (never reports). |"
    assert added_rows(old, old + row + "\n") == [row]
    name, text = row_to_file(row, "ci")
    assert name == "2026-11-22-run-e2e-in-the-queue-not.md", name
    assert check_decisions.problems(name, text, {name}) == [], text
    assert "## Why\n\n80 minutes a push.\n" in text and "paths-ignore" in text.split("## Rejected")[1]
    bare_name, bare = row_to_file("| 2026-11-22 | Failure: the thing broke. Fix: mended. |", "general")
    assert check_decisions.problems(bare_name, bare, {bare_name}) == [] and MISSING in bare
    assert split_text("A. Rejected: b.") == ("A.", MISSING, "b.")
    print("decision-row-to-file self-test: OK")
    return 0


def main() -> int:
    """Dispatch the self-test and the conversion."""
    args = sys.argv[1:]
    if args == ["--self-test"]:
        return self_test()
    if len(args) == 1 and not args[0].startswith("-"):
        return convert(args[0], "general")
    if len(args) == 3 and args[1] == "--area":
        return convert(args[0], args[2])
    print(__doc__, file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
