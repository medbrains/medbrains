#!/usr/bin/env python3
"""Fail an E2E shard whose suite did not load, whose setup failed, or that ran no tests.

The Playwright step is report-only (`continue-on-error`), so a failing journey does not block
a merge. That also hid a suite that could not load: from #6079 every shard stopped at a load
error in about five seconds, ran nothing, and the check stayed green. Failing tests are still
allowed here, and so is an error raised while tests run (a worker fixture that times out in
teardown is reported, not failed). What is refused:

- an error before the run begins: a spec or the config that does not load;
- the `setup` project's test not passing on its last attempt: nothing after it is real;
- no finished test at all.

Usage: check_e2e_ran.py <blob-report-dir>
"""

import json
import sys
import zipfile
from pathlib import Path


def setup_test_ids(project: dict) -> set[str]:
    """Every test id under a project's suites, walked through nested entries."""
    ids: set[str] = set()
    stack = list(project.get("suites", []))
    while stack:
        entry = stack.pop()
        if "testId" in entry:
            ids.add(entry["testId"])
        stack.extend(entry.get("entries", []))
    return ids


def read_events(blob_dir: Path):
    """Yield every event of every blob in the shard's report directory."""
    for blob in sorted(blob_dir.glob("*.zip")):
        with zipfile.ZipFile(blob) as archive:
            for name in archive.namelist():
                if name.endswith(".jsonl"):
                    for line in archive.read(name).decode("utf-8").splitlines():
                        yield json.loads(line)


def problems_in(events) -> tuple[int, list[str], list[str]]:
    """Finished-test count, the refusals, and errors that are only reported."""
    tests, refusals, reported = 0, [], []
    begun, setup_ids, setup_last = False, set(), {}
    for event in events:
        method, params = event.get("method"), event.get("params") or {}
        if method == "onProject" and params["project"]["name"] == "setup":
            setup_ids |= setup_test_ids(params["project"])
        elif method == "onBegin":
            begun = True
        elif method == "onTestEnd":
            tests += 1
            test_id = params.get("test", {}).get("testId")
            if test_id in setup_ids:
                setup_last[test_id] = params.get("result", {}).get("status")
        elif method == "onError":
            message = params["error"].get("message", "unknown error").splitlines()[0]
            (reported if begun else refusals).append(message)
    refusals += [f"setup test {tid} ended {status}" for tid, status in setup_last.items() if status != "passed"]
    if tests == 0:
        refusals.append("no tests ran: the suite did not load")
    return tests, refusals, reported


def main() -> int:
    """Print the shard's counts and exit 1 on any refusal."""
    if len(sys.argv) != 2:
        print(__doc__, file=sys.stderr)
        return 2
    tests, refusals, reported = problems_in(read_events(Path(sys.argv[1])))
    print(f"tests finished: {tests}, refusals: {len(refusals)}, errors during the run: {len(reported)}")
    for message in reported:
        print(f"::warning::Playwright error during the run: {message}")
    for message in refusals:
        print(f"::error::{message}")
    return 1 if refusals else 0


if __name__ == "__main__":
    sys.exit(main())
