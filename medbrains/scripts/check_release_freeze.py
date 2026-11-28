#!/usr/bin/env python3
"""The release freeze, and the two facts a tag needs (docs/AI-SDLC.md, check 4).

A merge loop once merged a pull request between a release bump's CI run and its tag, so the
tag carried code that run never saw. Two refusals close that:

    check_release_freeze.py pr <number>
        Fails while the pull request's base branch has an OPEN pull request labelled
        `release:bump`, unless this is that bump PR or it carries `release:hotfix`.
        release-freeze.yml runs it on every pull request. A check run is only as fresh as
        its last event, so a merge loop must also run this just before each merge.

    check_release_freeze.py tag <version> <branch>
        Fails unless the CI run for the exact HEAD commit finished green (the push run:
        "CI" on main, "CI release" on a release or hotfix branch), and HEAD's tree is the
        tree of the merged `release:bump` PR for <version>. scripts/release.sh runs it.

    check_release_freeze.py --self-test

A `gh` or `git` call that fails is a refusal, never a pass: a fault is not an allow.
"""

import json
import subprocess
import sys

BUMP, HOTFIX = "release:bump", "release:hotfix"
CI_WORKFLOWS = ("CI", "CI release")


def run(*cmd: str) -> str:
    """Output of a command; a failure stops the check with the command's own error."""
    done = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if done.returncode != 0:
        sys.exit(f"release freeze: FAIL: could not run `{' '.join(cmd)}`: {done.stderr.strip()}")
    return done.stdout.strip()


def frozen_by(number: int, labels: list[str], bumps: list[int]) -> list[int]:
    """The open bump PRs that freeze this pull request; empty when it may merge."""
    if number in bumps or HOTFIX in labels:
        return []
    return bumps


def ci_problem(runs: list[dict]) -> str | None:
    """Why this commit's CI is not a pass, from its workflow runs; None when it finished green."""
    ci = [r for r in runs if r["event"] == "push" and r["workflowName"] in CI_WORKFLOWS]
    if not ci:
        return "no CI run for this commit (is GitHub Actions running?)"
    for r in ci:
        if r["status"] != "completed":
            return f'{r["workflowName"]} is {r["status"]}, not finished'
        if r["conclusion"] != "success":
            return f'{r["workflowName"]} finished {r["conclusion"]}, not success'
    return None


def tree_problem(version: str, head_tree: str, bumps: list[dict]) -> str | None:
    """Why HEAD is not the bump's tree; `bumps` are the merged bump PRs for this version."""
    if len(bumps) != 1:
        found = ", ".join(f'#{b["number"]}' for b in bumps) or "none"
        return f"need exactly one merged `{BUMP}` PR titled with {version}; found {found}"
    if bumps[0]["tree"] != head_tree:
        return f'HEAD is not the tree #{bumps[0]["number"]} merged: something landed after the bump'
    return None


def check_pr(number: int) -> int:
    """Refuse a pull request whose base branch is frozen by an open bump PR."""
    pr = json.loads(run("gh", "pr", "view", str(number), "--json", "baseRefName,labels"))
    base = pr["baseRefName"]
    listed = run("gh", "pr", "list", "--state", "open", "--base", base, "--label", BUMP,
                 "--limit", "50", "--json", "number")
    bumps = [b["number"] for b in json.loads(listed)]
    blocking = frozen_by(number, [label["name"] for label in pr["labels"]], bumps)
    if blocking:
        named = ", ".join(f"#{n}" for n in blocking)
        print(f"::error title=Release freeze::{base} is frozen by the open release bump {named}. "
              f"Nothing else merges until its tag is pushed; a fix the release needs takes `{HOTFIX}`.")
        return 1
    print(f"release freeze: ok, #{number} may merge into {base} (open bump PRs: {bumps or 'none'})")
    return 0


def check_tag(version: str, branch: str) -> int:
    """Refuse a tag on a commit CI did not finish green on, or that is not the bump's tree."""
    sha = run("git", "rev-parse", "HEAD")
    runs = json.loads(run("gh", "run", "list", "--commit", sha, "--limit", "100",
                          "--json", "workflowName,status,conclusion,event"))
    merged = json.loads(run("gh", "pr", "list", "--state", "merged", "--base", branch, "--label", BUMP,
                            "--search", f"{version} in:title", "--limit", "10",
                            "--json", "number,mergeCommit"))
    bumps = [{"number": b["number"], "tree": run("git", "rev-parse", b["mergeCommit"]["oid"] + "^{tree}")}
             for b in merged]
    found = [p for p in (ci_problem(runs), tree_problem(version, run("git", "rev-parse", "HEAD^{tree}"), bumps)) if p]
    for problem in found:
        print(f"release freeze: FAIL: {sha[:9]}: {problem}")
    if not found:
        print(f"release freeze: ok, CI finished green on {sha[:9]} and it is the tree #{bumps[0]['number']} merged")
    return 1 if found else 0


def self_test() -> None:
    """The three decisions, each with the case it must refuse."""
    assert frozen_by(7, [], []) == []
    assert frozen_by(7, [], [9]) == [9]
    assert frozen_by(9, [], [9]) == [], "the bump PR itself is not frozen"
    assert frozen_by(7, [HOTFIX], [9]) == [], "a hotfix goes through"
    assert frozen_by(7, ["ai-authored"], [9, 12]) == [9, 12]

    def ci(name: str, status: str, conclusion: str, event: str = "push") -> dict:
        """One workflow run as `gh run list --json` gives it."""
        return {"workflowName": name, "status": status, "conclusion": conclusion, "event": event}

    assert ci_problem([ci("CI release", "completed", "success")]) is None
    assert "no CI run" in ci_problem([])
    assert "no CI run" in ci_problem([ci("CI", "completed", "success", "pull_request")])
    assert "no CI run" in ci_problem([ci("E2E", "completed", "success")])
    assert "not finished" in ci_problem([ci("CI release", "in_progress", "")])
    assert "cancelled" in ci_problem([ci("CI release", "completed", "cancelled")])
    assert "failure" in ci_problem([ci("CI", "completed", "success"), ci("CI", "completed", "failure")])

    assert tree_problem("1.2.3", "aaa", [{"number": 5, "tree": "aaa"}]) is None
    assert "landed after" in tree_problem("1.2.3", "bbb", [{"number": 5, "tree": "aaa"}])
    assert "found none" in tree_problem("1.2.3", "aaa", [])
    assert "#5, #6" in tree_problem("1.2.3", "aaa", [{"number": 5, "tree": "aaa"}, {"number": 6, "tree": "aaa"}])
    print("check_release_freeze self-test: ok")


def main() -> int:
    """Dispatch `pr`, `tag` or `--self-test`."""
    args = sys.argv[1:]
    if args == ["--self-test"]:
        self_test()
        return 0
    if len(args) == 2 and args[0] == "pr" and args[1].isdigit():
        return check_pr(int(args[1]))
    if len(args) == 3 and args[0] == "tag":
        return check_tag(args[1], args[2])
    sys.exit(__doc__)


if __name__ == "__main__":
    sys.exit(main())
