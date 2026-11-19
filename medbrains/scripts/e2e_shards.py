#!/usr/bin/env python3
"""Split the Playwright suite into CI shards of equal measured duration.

Playwright's own `--shard` cuts the suite into equal *counts* of test groups, so one shard
drew the 100-minute crawl and another a handful of API checks: on run 44302452592 the shards
took 12 to 103 minutes and the slowest set the wall time. This plans by duration instead.

The unit is a spec file, because the tests in a file keep their order and can share a
journey. A file that declares `test.describe.configure({ mode: "parallel" })` says its tests
are independent, so its tests are split one by one. Units are placed largest first on the
lightest shard (LPT), deterministically, so every shard job computes the same plan.

Durations come from `apps/web/e2e/timings.json` ({"file": seconds}), refreshed with the
`timings` command from a run's merged JUnit file. A file with no measurement is weighed at
the median per-test time, so a new spec still lands somewhere sensible.

  e2e_shards.py plan <list.json> <shard>/<total>   # prints a --test-list file on stdout
  e2e_shards.py timings <playwright.xml>           # rewrites timings.json from a run
  e2e_shards.py --self-test
"""

import json
import re
import statistics
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

WEB = Path(__file__).resolve().parent.parent / "apps" / "web"
TIMINGS = WEB / "e2e" / "timings.json"
SETUP_PROJECTS = {"tenants", "setup"}
PARALLEL_FILE = re.compile(r"test\.describe\.configure\(\{\s*mode:\s*\"parallel\"")


def list_tests(listing: dict) -> list[tuple[str, str, str]]:
    """Flatten `playwright test --list --reporter=json` into (project, file, title path)."""
    out: list[tuple[str, str, str]] = []

    def walk(suite: dict, titles: list[str]) -> None:
        for spec in suite.get("specs", []):
            path = " › ".join([*titles, spec["title"]])
            out.extend((test["projectName"], spec["file"], path) for test in spec["tests"])
        for child in suite.get("suites", []):
            walk(child, [*titles, child["title"]])

    # The top-level suites are the files; their titles are the file, not a describe.
    for root in listing["suites"]:
        walk(root, [])
    return out


def make_units(tests, timings: dict, parallel_files: set) -> list[tuple[float, str, list[str]]]:
    """Group tests into weighted units: one per (project, file), or per test for parallel files."""
    groups: dict[tuple[str, str], list[str]] = {}
    for project, file, title in tests:
        groups.setdefault((project, file), []).append(f"[{project}] › {file} › {title}")
    per_test = [timings[f] / n for (p, f), ts in groups.items() if f in timings for n in [len(ts)]]
    default = statistics.median(per_test) if per_test else 5.0
    units = []
    for (project, file), lines in sorted(groups.items()):
        # A file's measured time is spread over the projects that run it.
        share = sum(1 for (_, f) in groups if f == file)
        weight = timings[file] / share if file in timings else default * len(lines)
        if file in parallel_files:
            units += [(weight / len(lines), line, [line]) for line in lines]
        else:
            units.append((weight, f"[{project}] › {file}", lines))
    return units


def plan(units, total: int) -> tuple[list[list[str]], list[float]]:
    """Place units largest first on the lightest shard; ties by name and index. Also the loads."""
    loads = [0.0] * total
    shards: list[list[str]] = [[] for _ in range(total)]
    for weight, _, lines in sorted(units, key=lambda u: (-u[0], u[1])):
        lightest = min(range(total), key=lambda i: (loads[i], i))
        loads[lightest] += weight
        shards[lightest] += lines
    return shards, loads


def parallel_files_in(files) -> set:
    """The spec files that declare their tests independent."""
    return {f for f in files if (WEB / "e2e" / f).is_file() and PARALLEL_FILE.search((WEB / "e2e" / f).read_text())}


def timings_from_junit(xml_path: Path) -> dict:
    """Seconds per spec file, summed over projects, from a merged Playwright JUnit file."""
    times: dict[str, float] = {}
    for suite in ET.parse(xml_path).getroot().iter("testsuite"):
        name = suite.get("name", "")
        times[name] = round(times.get(name, 0.0) + float(suite.get("time", 0)), 1)
    return dict(sorted(times.items()))


def self_test() -> None:
    """Check the flattening, the weighting and that the plan is balanced and complete."""
    listing = {"suites": [{"title": "a.spec.ts", "file": "a.spec.ts", "line": 0, "specs": [], "suites": [
        {"title": "grp", "file": "a.spec.ts", "line": 3, "specs": [
            {"title": "one", "file": "a.spec.ts", "tests": [{"projectName": "p"}]}], "suites": []}]}]}
    assert list_tests(listing) == [("p", "a.spec.ts", "grp › one")]
    tests = [("p", "big.spec.ts", f"t{i}") for i in range(4)] + [("p", "s.spec.ts", "x"), ("q", "s.spec.ts", "x")]
    units = make_units(tests, {"big.spec.ts": 40.0, "s.spec.ts": 10.0}, {"big.spec.ts"})
    assert sorted(u[0] for u in units) == [5.0, 5.0, 10.0, 10.0, 10.0, 10.0]
    shards, loads = plan(units, 3)
    assert sorted(sum(shards, [])) == sorted(sum((u[2] for u in units), []))
    assert sorted(loads) == [15.0, 15.0, 20.0], loads
    listed = [("p", "new.spec.ts", "a"), ("p", "new.spec.ts", "b"), ("p", "s.spec.ts", "x")]
    unknown = make_units(listed, {"s.spec.ts": 3.0}, set())
    assert unknown[0][0] == 6.0
    print("self-test passed")


def main() -> int:
    """Dispatch the plan, timings and self-test commands."""
    args = sys.argv[1:]
    if args == ["--self-test"]:
        self_test()
        return 0
    if len(args) == 3 and args[0] == "plan":
        current, total = (int(n) for n in args[2].split("/"))
        # The setup projects run in every shard as dependencies; they are not shared out.
        listed = list_tests(json.loads(Path(args[1]).read_text()))
        tests = [t for t in listed if t[0] not in SETUP_PROJECTS]
        timings = json.loads(TIMINGS.read_text()) if TIMINGS.exists() else {}
        units = make_units(tests, timings, parallel_files_in({f for _, f, _ in tests}))
        shards, loads = plan(units, total)
        minutes = ", ".join(f"{load / 60:.0f}" for load in loads)
        print(f"shard {current}/{total}: {len(shards[current - 1])} tests; measured minutes per shard: {minutes}", file=sys.stderr)
        print("\n".join(shards[current - 1]))
        return 0
    if len(args) == 2 and args[0] == "timings":
        TIMINGS.write_text(json.dumps(timings_from_junit(Path(args[1])), indent=1) + "\n")
        return 0
    print(__doc__, file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
