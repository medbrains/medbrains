#!/usr/bin/env python3
"""Fail an E2E shard that ran no tests or hit a suite-level error.

The Playwright step is report-only (`continue-on-error`), so a failing journey does not block
a merge. That also hid a suite that could not load: from #6079 every shard stopped at a load
error in about five seconds, ran nothing, and the check stayed green. A failing test is still
allowed here. What is refused is a shard whose blob has a suite-level error (a spec or
config that does not load, a global setup that throws) or no finished test at all.

Usage: check_e2e_ran.py <blob-report-dir>
"""

import json
import sys
import zipfile
from pathlib import Path


def count_events(blob_dir: Path) -> tuple[int, list[str]]:
    """Count finished tests and collect suite-level error messages across a shard's blobs."""
    tests = 0
    errors: list[str] = []
    for blob in sorted(blob_dir.glob("*.zip")):
        with zipfile.ZipFile(blob) as archive:
            for name in archive.namelist():
                if not name.endswith(".jsonl"):
                    continue
                for line in archive.read(name).decode("utf-8").splitlines():
                    event = json.loads(line)
                    if event.get("method") == "onTestEnd":
                        tests += 1
                    elif event.get("method") == "onError":
                        errors.append(event["params"]["error"].get("message", "unknown error"))
    return tests, errors


def main() -> int:
    """Print the shard's counts and exit 1 when it ran nothing or errored outside a test."""
    if len(sys.argv) != 2:
        print(__doc__, file=sys.stderr)
        return 2
    tests, errors = count_events(Path(sys.argv[1]))
    print(f"tests finished: {tests}, suite-level errors: {len(errors)}")
    for message in errors:
        print(f"::error::Playwright suite error: {message.splitlines()[0]}")
    if tests == 0:
        print("::error::This shard ran no tests; the suite did not load or global setup failed")
    return 1 if errors or tests == 0 else 0


if __name__ == "__main__":
    sys.exit(main())
