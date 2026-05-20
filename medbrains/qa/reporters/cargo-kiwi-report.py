#!/usr/bin/env python3
"""Pass Cargo test output through and fail when the run failed.

The Kiwi sync pipeline consumes test case metadata separately. This reporter
keeps the `make test-rust` contract intact without hiding Cargo failures behind
the shell pipeline exit status.
"""

from __future__ import annotations

import re
import sys


FAILED_RESULT = re.compile(r"test result:\s+FAILED", re.IGNORECASE)
ERROR_LINE = re.compile(r"^(error(\[E\d+\])?:|error: could not compile)", re.IGNORECASE)


def main() -> int:
    saw_failure = False
    saw_success_summary = False

    for line in sys.stdin:
        sys.stdout.write(line)
        if FAILED_RESULT.search(line) or ERROR_LINE.search(line):
            saw_failure = True
        if "test result: ok" in line:
            saw_success_summary = True

    sys.stdout.flush()

    if saw_failure:
        return 1
    if not saw_success_summary:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
