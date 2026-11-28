#!/usr/bin/env python3
"""Refuse a change that is too big to review well (ENGINEERING.md, pull request guidelines).

Counts hand-written lines and files only: lockfiles, `.sqlx` metadata, generated code and
snapshots are left out. Limits, after Google's small-CL guidance:

- at most 400 changed lines (added + removed), or 500 when tests are at least half of them;
- at most 10 changed files.

A mechanical change (a pure move, a rename, a generated file) may go over, when the pull
request body has a line "mechanical: <how it was produced>" and its risk class is not
safety; the pre-commit hook takes MB_MECHANICAL=1 for the same. Security, money and
clinical changes never go over.

Input on stdin, one file per line, as `git diff --numstat` prints it: added<TAB>removed<TAB>path
("-" for a binary file). Environment: PR_BODY (optional).

    git diff --numstat origin/release/3.35.3...HEAD | check_pr_size.py
    check_pr_size.py --self-test
"""

import os
import re
import sys

MAX_LINES = 400
MAX_LINES_TESTS = 500
MAX_FILES = 10
EXCLUDED = re.compile(
    r"(^|/)(Cargo\.lock|pnpm-lock\.yaml|package-lock\.json|gradle\.lockfile|Package\.resolved)$"
    r"|(^|/)\.sqlx/|\.snapshot$|(^|/)generated[^/]*\.|\.generated\.|(^|/)__snapshots__/"
    r"|^medbrains/packages/types/src/permissions\.ts$|\.(png|jpe?g|gif|webp|svg|pdf)$"
)
TEST = re.compile(r"(^|/)(tests?|__tests__|e2e)/|_test\.rs$|_tests\.rs$|\.(test|spec)\.[jt]sx?$|Tests?\.(swift|kt)$")
MECHANICAL = re.compile(r"^[\s>*-]*mechanical\s*:\s*\S", re.I | re.M)
SAFETY = re.compile(r"^[\s>*-]*risk class\s*:\s*safety\b", re.I | re.M)


def count(lines):
    """Return (changed lines, test lines, files) for hand-written files in numstat lines."""
    total = tests = files = 0
    for line in lines:
        parts = line.rstrip("\n").split("\t")
        if len(parts) != 3 or EXCLUDED.search(parts[2]):
            continue
        added, removed, path = parts
        n = (int(added) if added.isdigit() else 0) + (int(removed) if removed.isdigit() else 0)
        total += n
        files += 1
        if TEST.search(path):
            tests += n
    return total, tests, files


def problems(lines, body, mechanical_env=False):
    """List why this change is too big; empty when it is within the limits or exempt."""
    total, tests, files = count(lines)
    limit = MAX_LINES_TESTS if tests * 2 >= total else MAX_LINES
    found = []
    if total > limit:
        found.append(f"{total} hand-written lines changed (limit {limit})")
    if files > MAX_FILES:
        found.append(f"{files} hand-written files changed (limit {MAX_FILES})")
    exempt = (mechanical_env or MECHANICAL.search(body)) and not SAFETY.search(body)
    return [] if exempt else found


def self_test():
    """Check the counting and the exemptions on fixed examples."""
    small = ["10\t5\tsrc/a.rs", "300\t0\tCargo.lock", "50\t0\t.sqlx/q.json"]
    assert count(small) == (15, 0, 1)
    big = ["300\t150\tsrc/a.rs"]
    assert problems(big, "")
    assert not problems(["100\t50\tsrc/a.rs", "300\t0\tcrates/x/tests/t.rs"], "")
    assert problems(["300\t150\tsrc/a.rs"], "")
    many = [f"1\t0\tsrc/f{i}.rs" for i in range(11)]
    assert problems(many, "")
    assert not problems(big, "mechanical: moved by git mv")
    assert problems(big, "mechanical: moved\nRisk class: safety")
    assert not problems(big, "", mechanical_env=True)
    print("check-pr-size: self-test ok")


def main():
    """Read numstat lines from stdin and fail when the change is over the limits."""
    if sys.argv[1:] == ["--self-test"]:
        self_test()
        return 0
    lines = sys.stdin.readlines()
    found = problems(lines, os.environ.get("PR_BODY", ""), os.environ.get("MB_MECHANICAL") == "1")
    if found:
        for f in found:
            print(f"::error title=PR size::{f}")
        print("Split it (refactor first, then the behaviour change; or schema, server, screen).")
        return 1
    total, _, files = count(lines)
    print(f"PR size: ok ({total} hand-written lines, {files} files)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
