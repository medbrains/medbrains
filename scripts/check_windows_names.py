#!/usr/bin/env python3
"""Fails on any tracked path Windows cannot check out.

CON, PRN, AUX, NUL, COM1-9 and LPT1-9 are device names on Windows, with any
extension and in any case, so `prn.test.ts` stops `git checkout` there and the
desktop build never starts (3.33 release trial, 2026-11-09).

    python3 scripts/check_windows_names.py [--self-test]
"""

import re
import subprocess
import sys

RESERVED = re.compile(r"^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$", re.IGNORECASE)


def bad_paths(paths):
    """Returns the paths that have a Windows device name as any component."""
    return [p for p in paths if any(RESERVED.match(part) for part in p.split("/"))]


def self_test():
    """Checks the rule against names that must and must not match."""
    assert bad_paths(["a/prn.test.ts", "CON", "x/lpt9/y", "Aux.txt", "nul"]) == [
        "a/prn.test.ts", "CON", "x/lpt9/y", "Aux.txt", "nul"]
    assert bad_paths(["a/prn-orders.ts", "console.ts", "com10", "lpt0", "auxiliary"]) == []


def main():
    """Lists every tracked path with a reserved name and exits 1 if there is one."""
    if "--self-test" in sys.argv:
        self_test()
        return 0
    out = subprocess.run(["git", "ls-files", "-z"], check=True, capture_output=True).stdout
    bad = bad_paths(out.decode().split("\0"))
    for path in bad:
        print(f"{path}: a Windows device name; rename it so Windows can check out the repo")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
