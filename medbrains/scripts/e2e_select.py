#!/usr/bin/env python3
"""Pick the Playwright projects a pull request's changed paths need.

The map is `apps/web/e2e/path-projects.json`: ordered glob rules, first match per path, the
union over all paths. It fails safe: a path no rule matches runs every project, so a new
directory costs time, never coverage. Pushes to main and release/** run everything without
asking this (e2e.yml).

  e2e_select.py select <changed-paths-file>   # project names, one per line (none: no run)
  e2e_select.py all                           # every project the suite runs in CI
  e2e_select.py --check                       # the map names only real projects; self-test
"""

import fnmatch
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MAP = ROOT / "apps" / "web" / "e2e" / "path-projects.json"
CONFIG = ROOT / "apps" / "web" / "playwright.config.ts"


def load_map(path: Path = MAP) -> dict:
    """The rules and groups, as committed."""
    return json.loads(path.read_text())


def expand(names: list[str], groups: dict) -> set[str]:
    """Replace group names with their projects."""
    out: set[str] = set()
    for name in names:
        out |= set(groups[name]) if name in groups else {name}
    return out


def select(paths: list[str], mapping: dict) -> list[str]:
    """The projects these repository-relative paths need, in the order `all` lists them."""
    groups = mapping["groups"]
    needed: set[str] = set()
    for path in filter(None, (p.strip() for p in paths)):
        rule = next((r for r in mapping["rules"] if fnmatch.fnmatchcase(path, r["glob"])), None)
        needed |= expand(rule["projects"], groups) if rule else set(groups["all"])
    return [p for p in groups["all"] if p in needed]


def check(mapping: dict) -> list[str]:
    """Problems with the map: names that are neither a group nor a project in the config."""
    projects = set(re.findall(r'\bname: "([^"]+)"', CONFIG.read_text()))
    named = {n for r in mapping["rules"] for n in r["projects"]} | {
        n for members in mapping["groups"].values() for n in members
    }
    return [f"unknown project {n!r}" for n in sorted(named - projects - set(mapping["groups"]))]


def self_test(mapping: dict) -> None:
    """The cases the map promises: docs run nothing, unknown runs all, server skips mock."""
    every = mapping["groups"]["all"]
    assert select(["medbrains/docs/decisions/2026-11-22-a.md", "README.md"], mapping) == []
    assert select(["somewhere/new.txt"], mapping) == every
    assert select(["medbrains/apps/web/src/main.tsx"], mapping) == every
    server = select(["medbrains/crates/medbrains-auth/src/lib.rs"], mapping)
    assert "journeys" in server and "api" in server and "mock-chromium" not in server
    assert select(["medbrains/apps/web/e2e/crud/a.spec.ts"], mapping) == ["crud"]
    assert select(["medbrains/apps/web/e2e/helpers/api.ts"], mapping) == every
    assert select([".github/workflows/e2e.yml"], mapping) == every
    assert select(["", "  "], mapping) == []


def main() -> int:
    """Dispatch select, all and --check."""
    args = sys.argv[1:]
    mapping = load_map()
    if args == ["--check"]:
        problems = check(mapping)
        for problem in problems:
            print(f"path-projects.json: {problem}")
        if problems:
            return 1
        self_test(mapping)
        print("path-projects.json is valid; self-test passed")
        return 0
    if args == ["all"]:
        print("\n".join(mapping["groups"]["all"]))
        return 0
    if len(args) == 2 and args[0] == "select":
        print("\n".join(select(Path(args[1]).read_text().splitlines(), mapping)))
        return 0
    print(__doc__, file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
