"""Publish enterprise-audit backlog to GitHub as epics + user stories.

Usage:
  python3 scripts/create_backlog_issues.py --docs      # write docs/backlog/*.md only
  python3 scripts/create_backlog_issues.py --publish   # create GitHub issues + INDEX.md

Idempotent: skips any issue whose exact title already exists (open or closed).
Requires: gh CLI authenticated with repo scope.
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from backlog_data import EPICS

ROOT = Path(__file__).resolve().parent.parent
BACKLOG_DIR = ROOT / "medbrains" / "docs" / "backlog"
EFFORT_LEGEND = {"S": "S (<1 day)", "M": "M (1-3 days)", "L": "L (1-2 weeks)", "XL": "XL (>2 weeks)"}


def gh(*args: str) -> str:
    result = subprocess.run(["gh", *args], capture_output=True, text=True, check=True)
    return result.stdout.strip()


def story_body(s: dict, epic_number: int | None) -> str:
    lines = [f"> As a **{s['role']}**, I want {s['want']}, so that {s['so_that']}.", ""]
    if epic_number:
        lines += [f"**Epic:** #{epic_number}", ""]
    lines += ["**Acceptance criteria**"]
    lines += [f"- [ ] {c}" for c in s["ac"]]
    lines += ["", f"**Audit ref:** {s['refs']} (ENTERPRISE_READINESS_AUDIT.md)"]
    lines += ["**Files:** " + ", ".join(f"`{f}`" for f in s["files"])]
    lines += [f"**Effort:** {EFFORT_LEGEND[s['effort']]}"]
    return "\n".join(lines)


def epic_body(e: dict) -> str:
    return f"{e['summary']}\n\n_Source: ENTERPRISE_READINESS_AUDIT.md (2026-06-11)._"


def write_docs() -> None:
    BACKLOG_DIR.mkdir(parents=True, exist_ok=True)
    for e in EPICS:
        lines = [f"# {e['title']}", "", epic_body(e), "",
                 f"Priority: {e['priority']} · Area: {e['area']} · Milestone: {e['milestone']}", ""]
        for s in e["stories"]:
            lines += [f"## {s['title']}", "", story_body(s, None), "",
                      f"Labels: {s['priority']}, {s['area']} · Milestone: {s['milestone']}", ""]
        (BACKLOG_DIR / f"{e['key']}.md").write_text("\n".join(lines))
        print(f"wrote docs/backlog/{e['key']}.md ({len(e['stories'])} stories)")


def existing_titles() -> set[str]:
    out = gh("issue", "list", "--state", "all", "--limit", "500", "--json", "title")
    return {i["title"] for i in json.loads(out)}


def create_issue(title: str, body: str, labels: list[str], milestone: str) -> int:
    url = gh("issue", "create", "--title", title, "--body", body,
             "--label", ",".join(labels), "--milestone", milestone)
    return int(url.rstrip("/").rsplit("/", 1)[-1])


def publish() -> None:
    seen = existing_titles()
    index = ["# Backlog Index — Enterprise Readiness Audit", "",
             "| Issue | Type | Title | Priority | Milestone |", "|---|---|---|---|---|"]
    for e in EPICS:
        if e["title"] in seen:
            print(f"SKIP (exists): {e['title']}")
            continue
        epic_num = create_issue(e["title"], epic_body(e), ["epic", e["priority"], e["area"]], e["milestone"])
        print(f"#{epic_num} {e['title']}")
        index.append(f"| #{epic_num} | epic | {e['title']} | {e['priority']} | {e['milestone']} |")
        checklist = []
        for s in e["stories"]:
            if s["title"] in seen:
                print(f"  SKIP (exists): {s['title']}")
                continue
            num = create_issue(s["title"], story_body(s, epic_num),
                               ["user-story", s["priority"], s["area"]], s["milestone"])
            print(f"  #{num} {s['title']}")
            checklist.append(f"- [ ] #{num}")
            index.append(f"| #{num} | story | {s['title']} | {s['priority']} | {s['milestone']} |")
        if checklist:
            gh("issue", "edit", str(epic_num), "--body",
               epic_body(e) + "\n\n## Stories\n" + "\n".join(checklist))
    (BACKLOG_DIR / "INDEX.md").write_text("\n".join(index) + "\n")
    print("wrote docs/backlog/INDEX.md")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--docs", action="store_true")
    parser.add_argument("--publish", action="store_true")
    args = parser.parse_args()
    if args.docs:
        write_docs()
    if args.publish:
        publish()
    if not (args.docs or args.publish):
        parser.print_help()


if __name__ == "__main__":
    main()
