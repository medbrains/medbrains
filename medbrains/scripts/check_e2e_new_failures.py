#!/usr/bin/env python3
"""No new E2E failure: a failing journey is either in quarantine, with a ticket, or it blocks.

docs/AI-SDLC.md, check 2. About 180 journeys failed on the release branch itself, so the
Playwright check was red on every pull request and nobody read it. This check is red only for
what a change broke. A quarantined test still runs and is still reported.

Reads Playwright's JSON report for the whole run (the shards merged) and
apps/web/e2e/quarantine.json, whose entries are

    {"test": "<file> › <describe> › <title>", "ticket": "#123", "owner": "<who fixes it>",
     "added": "2026-11-22", "expires": "2026-12-22"}

Refused:
- a test that failed and is not in quarantine;
- a quarantine entry past its `expires` date, or that is malformed: no ticket (`#123` or an
  issue URL), no owner, an expiry more than MAX_DAYS after `added`, a test listed twice;
- a quarantined test that passed: remove its entry. A warning until STRICT_FROM, an error from
  that day on. (A test that failed and then passed on retry counts as neither.)
- a report with no test in it: no results is not a pass.

A test this run did not select is not judged. `TBD` as ticket or owner is accepted only on
the entries seeded on SEED_DATE, which expire like any other.

Usage:
    check_e2e_new_failures.py <results.json> <quarantine.json> [--today YYYY-MM-DD]
    check_e2e_new_failures.py --self-test
"""

import json
import re
import sys
from datetime import date, timedelta
from pathlib import Path

SEED_DATE = date(2026, 11, 22)
# From this day a quarantined test that passes fails the check, instead of warning.
STRICT_FROM = date(2026, 12, 6)
MAX_DAYS = 60
TICKET = re.compile(r"^(#\d+|https://github\.com/[\w.-]+/[\w.-]+/issues/\d+)$")
FIELDS = ("test", "ticket", "owner", "added", "expires")


def outcomes(report: dict) -> dict[str, str]:
    """Each test's outcome across its projects: failed, flaky, passed or skipped."""
    found: dict[str, str] = {}
    rank = {"unexpected": "failed", "flaky": "flaky", "expected": "passed", "skipped": "skipped"}
    order = ["skipped", "passed", "flaky", "failed"]
    stack = [(suite, []) for suite in report.get("suites", [])]
    while stack:
        suite, path = stack.pop()
        stack.extend((child, path + [child["title"]]) for child in suite.get("suites", []))
        for spec in suite.get("specs", []):
            name = " › ".join([spec["file"], *path, spec["title"]])
            for test in spec.get("tests", []):
                outcome = rank.get(test.get("status"), "failed")
                if order.index(outcome) > order.index(found.get(name, "skipped")):
                    found[name] = outcome
                found.setdefault(name, outcome)
    return found


def entry_problems(entries: list[dict], today: date) -> list[str]:
    """What is wrong with the quarantine file itself, whatever the run did."""
    found, seen = [], set()
    for entry in entries:
        name = entry.get("test", "<no test>")
        missing = [f for f in FIELDS if not str(entry.get(f, "")).strip()]
        if missing:
            found.append(f"{name}: no {', '.join(missing)}")
            continue
        if name in seen:
            found.append(f"{name}: listed twice")
        seen.add(name)
        try:
            added, expires = date.fromisoformat(entry["added"]), date.fromisoformat(entry["expires"])
        except ValueError:
            found.append(f"{name}: `added` and `expires` must be YYYY-MM-DD")
            continue
        seeded = added == SEED_DATE
        if not TICKET.match(entry["ticket"]) and not (seeded and entry["ticket"] == "TBD"):
            found.append(f"{name}: ticket `{entry['ticket']}` is not `#123` or an issue URL")
        if entry["owner"] == "TBD" and not seeded:
            found.append(f"{name}: no owner")
        if expires > added + timedelta(days=MAX_DAYS):
            found.append(f"{name}: expires more than {MAX_DAYS} days after it was added")
        if expires < today:
            found.append(f"{name}: quarantine expired on {expires} (ticket {entry['ticket']}): fix the test or delete it")
    return found


def judge(report: dict, entries: list[dict], today: date) -> tuple[list[str], list[str], str]:
    """The refusals, the warnings and a one-line summary for this run."""
    results = outcomes(report)
    quarantined = {entry.get("test") for entry in entries}
    errors = entry_problems(entries, today)
    if not any(outcome != "skipped" for outcome in results.values()):
        errors.append("the report has no test that ran: no results is not a pass")
    failed = sorted(name for name, outcome in results.items() if outcome == "failed")
    errors += [f"new failure, not in quarantine: {name}" for name in failed if name not in quarantined]
    stale = [f"quarantined but it passed, remove its entry: {name}"
             for name in sorted(quarantined & results.keys()) if results[name] == "passed"]
    warnings = []
    if today >= STRICT_FROM:
        errors += stale
    else:
        warnings = [f"{line} (an error from {STRICT_FROM})" for line in stale]
    summary = (f"{len(results)} tests: {len(failed)} failed, {len([n for n in failed if n in quarantined])} "
               f"of them quarantined; {len(entries)} entries in quarantine, {len(stale)} now passing")
    return errors, warnings, summary


def self_test() -> None:
    """Each refusal on its own, the dated switch, and a clean run."""

    def report(**tests: str) -> dict:
        """A JSON report with one describe block in a.spec.ts holding the named tests."""
        specs = [{"title": t, "file": "x/a.spec.ts", "tests": [{"status": s}]} for t, s in tests.items()]
        return {"suites": [{"title": "x/a.spec.ts", "specs": [], "suites": [{"title": "Bills", "specs": specs}]}]}

    def entry(test: str, **over: str) -> dict:
        """A valid quarantine entry for a test in that describe block."""
        base = {"test": f"x/a.spec.ts › Bills › {test}", "ticket": "#7", "owner": "billing",
                "added": "2026-12-01", "expires": "2026-12-20"}
        return base | over

    day = date(2026, 12, 2)
    clean = report(pays="expected", refunds="unexpected", prints="flaky", later="skipped")
    assert outcomes(clean)["x/a.spec.ts › Bills › refunds"] == "failed"
    assert judge(clean, [entry("refunds")], day)[:2] == ([], [])
    assert "new failure" in judge(clean, [], day)[0][0]
    assert "expired" in judge(clean, [entry("refunds", expires="2026-12-01")], day)[0][0]
    assert "no ticket" in judge(clean, [entry("refunds", ticket="")], day)[0][0]
    assert "is not `#123`" in judge(clean, [entry("refunds", ticket="TBD")], day)[0][0]
    seeded = {"added": str(SEED_DATE), "ticket": "TBD", "owner": "TBD"}
    assert judge(clean, [entry("refunds", **seeded)], day)[0] == []
    assert "no owner" in judge(clean, [entry("refunds", owner="TBD")], day)[0][0]
    assert "more than" in judge(clean, [entry("refunds", expires="2099-01-01")], day)[0][0]
    assert "YYYY-MM-DD" in judge(clean, [entry("refunds", added="soon")], day)[0][0]
    assert "listed twice" in judge(clean, [entry("refunds"), entry("refunds")], day)[0][0]
    errors, warnings, _ = judge(clean, [entry("refunds"), entry("pays")], day)
    assert errors == [] and "remove its entry" in warnings[0], "a passing quarantined test warns first"
    errors, warnings, _ = judge(clean, [entry("refunds"), entry("pays")], STRICT_FROM)
    assert "remove its entry" in errors[0] and warnings == [], "and is an error from STRICT_FROM"
    assert judge(clean, [entry("refunds"), entry("prints"), entry("later")], day)[:2] == ([], []), \
        "flaky or not run is neither a pass nor a failure"
    assert "no results" in judge(report(later="skipped"), [], day)[0][0]
    assert "no results" in judge({}, [], day)[0][0]
    both = {"suites": [{"title": "a.spec.ts", "specs": [
        {"title": "t", "file": "a.spec.ts", "tests": [{"status": "expected"}, {"status": "unexpected"}]}]}]}
    assert outcomes(both) == {"a.spec.ts › t": "failed"}, "failing in one project is failing"
    print("check_e2e_new_failures self-test: ok")


def main() -> int:
    """Judge one run against the quarantine file."""
    args = sys.argv[1:]
    if args == ["--self-test"]:
        self_test()
        return 0
    today = date.today()
    if "--today" in args:
        at = args.index("--today")
        today = date.fromisoformat(args[at + 1])
        del args[at:at + 2]
    if len(args) != 2:
        sys.exit(__doc__)
    try:
        report = json.loads(Path(args[0]).read_text(encoding="utf-8"))
        entries = json.loads(Path(args[1]).read_text(encoding="utf-8"))["entries"]
    except (OSError, ValueError, KeyError, TypeError) as error:
        sys.exit(f"E2E no new failures: FAIL: cannot read the results or the quarantine file: {error!r}")
    errors, warnings, summary = judge(report, entries, today)
    print(summary)
    for line in warnings:
        print(f"::warning title=E2E quarantine::{line}")
    for line in errors:
        print(f"::error title=E2E no new failures::{line}")
    if errors:
        print(f"{len(errors)} refusal(s). Fix the test, or the code; quarantine needs a ticket and the owner's yes.")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
