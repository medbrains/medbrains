#!/usr/bin/env python3
"""Refuse a pull request whose body leaves out the evidence the lifecycle asks for.

docs/AI-SDLC.md, check 3. Agents write most pull requests, and a rule that depends on care
gets skipped: the unverified parts went last, a layout fix shipped that nobody had looked at.
The section names are the ones in .github/PULL_REQUEST_TEMPLATE.md. Refused:

- the first section is not "## Not verified", or it is empty (write "Nothing" if that is true);
- no line "Risk class: safety | standard | low" naming exactly one class;
- a UI path changed (medbrains/apps/web/src except tests, apps/ios, apps/android) and
  "## How verified on screen" names no screenshot or attachment and has no
  "no-screen-change: <reason>" line;
- no linked issue ("Closes #12", "Refs #12"), unless the PR is labelled `no-issue`.

Pull requests opened by a bot (Dependabot) are exempt.

Usage (pr-evidence.yml): changed paths on stdin, one per line; the body in PR_BODY, the labels
as a JSON list in PR_LABELS, the author in PR_AUTHOR and PR_AUTHOR_TYPE.

    check_pr_evidence.py < changed.txt
    check_pr_evidence.py --self-test
"""

import json
import os
import re
import sys

CLASSES = ("safety", "standard", "low")
UI_PATH = re.compile(r"^medbrains/apps/(web/src|ios|android)/")
WEB_TEST = re.compile(r"^medbrains/apps/web/src/.*((^|/)(__tests__|tests?)/|\.(test|spec)\.[jt]sx?$)")
SCREENSHOT = re.compile(
    r"!\[[^\]]*\]\([^)\s]+\)|<(img|video)\b|user-attachments/(assets|files)/"
    r"|\S+\.(png|jpe?g|gif|webp|mp4|mov)\b",
    re.I,
)
NO_SCREEN_CHANGE = re.compile(r"^[\s>*-]*no[- ]screen[- ]change\s*:\s*\S", re.I | re.M)
ISSUE = re.compile(
    r"\b(close[sd]?|fix(e[sd])?|resolve[sd]?|refs?)\b:?\s+"
    r"(#\d+|https://github\.com/[\w.-]+/[\w.-]+/(issues|pull)/\d+)",
    re.I,
)


def sections(body: str) -> tuple[str, list[tuple[str, str]]]:
    """The text before the first `## ` heading, then each (heading, text); HTML comments removed."""
    text = re.sub(r"<!--.*?-->", "", body or "", flags=re.S).replace("\r\n", "\n")
    parts = re.split(r"^##[ \t]+(.+?)[ \t]*$", text, flags=re.M)
    pairs = [(parts[i].strip().lower(), parts[i + 1].strip()) for i in range(1, len(parts) - 1, 2)]
    return parts[0].strip(), pairs


def names_risk_class(text: str) -> bool:
    """True if some "Risk class:" line names exactly one class (read up to a `·` separator)."""
    named = re.compile(r"\b(%s)\b" % "|".join(CLASSES))
    lines = re.findall(r"risk class\s*:([^\n·]*)", text, re.I)
    return any(len(named.findall(line.lower())) == 1 for line in lines)


def problems(body: str, paths: list[str], labels: list[str]) -> list[str]:
    """Every reason this pull request is refused; empty when it carries its evidence."""
    found = []
    before, parts = sections(body)
    text = before + "\n" + "\n".join(f"{heading}\n{content}" for heading, content in parts)
    if before or not parts or parts[0][0] != "not verified":
        found.append('the first section must be "## Not verified", before any other text')
    elif not parts[0][1]:
        found.append('"## Not verified" is empty: list what was not checked, or write "Nothing"')
    if not names_risk_class(text):
        found.append('no line "Risk class: <one of safety, standard, low>"')
    ui = [p for p in paths if UI_PATH.match(p) and not WEB_TEST.match(p)]
    screen = "\n".join(content for heading, content in parts if heading == "how verified on screen")
    if ui and not (SCREENSHOT.search(screen) or NO_SCREEN_CHANGE.search(screen)):
        found.append(
            f'{len(ui)} UI file(s) changed (first: {ui[0]}) and "## How verified on screen" has '
            'no screenshot or attachment, and no "no-screen-change: <reason>" line'
        )
    if "no-issue" not in labels and not ISSUE.search(text):
        found.append('no linked issue ("Closes #123" or "Refs #123"), and no `no-issue` label')
    return found


def is_bot(author: str, author_type: str) -> bool:
    """True for a pull request GitHub says a bot opened (Dependabot)."""
    return author_type == "Bot" or author.endswith("[bot]")


GOOD = """## Not verified
- The 390 wide layout: no phone at hand.

## What & why
Fixes the header overlap. Closes #12

- Risk class: standard

## How verified on screen
![header at 1366, dark](https://github.com/user-attachments/assets/0000)
"""
WEB = ["medbrains/apps/web/src/pages/opd.tsx"]


def self_test() -> None:
    """A complete body passes, and each missing piece is refused on its own."""
    template = (
        "<!-- note -->\n\n## Not verified\n\n<!-- FIRST -->\n\n## What & why\n\n"
        "- Risk class: <!-- safety | standard | low -->\n\n## How verified on screen\n\n<!-- shots -->\n"
    )
    no_shot = GOOD.replace("![header at 1366, dark](https://github.com/user-attachments/assets/0000)", "Looked fine.")
    cases = [
        ("complete", GOOD, WEB, [], 0),
        ("unfilled template", template, WEB, [], 4),
        ("empty body", "", [], [], 3),
        ("not verified is last", GOOD.replace("## Not verified", "## Later") + "\n## Not verified\nNothing\n", WEB, [], 1),
        ("text before the first section", "Done, all good.\n\n" + GOOD, WEB, [], 1),
        ("every class named", GOOD.replace("standard", "safety | standard | low"), WEB, [], 1),
        ("the words quoted before the real line", GOOD.replace("no phone at hand.", 'the "Risk class:" line is below.'), WEB, [], 0),
        ("class in the lifecycle's one-line form", GOOD.replace("- Risk class: standard", "Refs #3 · risk class: low · severity: S3"), WEB, [], 0),
        ("ui change, words only", no_shot, WEB, [], 1),
        ("ui change, android", no_shot, ["medbrains/apps/android/app-staff/Home.kt"], [], 1),
        ("no ui path", no_shot, ["medbrains/crates/x/src/lib.rs"], [], 0),
        ("web test only", no_shot, ["medbrains/apps/web/src/pages/opd.test.tsx"], [], 0),
        ("stated no screen change", no_shot.replace("Looked fine.", "no-screen-change: a rename only"), WEB, [], 0),
        ("no screen change without a reason", no_shot.replace("Looked fine.", "no-screen-change:"), WEB, [], 1),
        ("screenshot path", no_shot.replace("Looked fine.", "docs/shots/header-1366-dark.png"), WEB, [], 0),
        ("no issue", GOOD.replace("Closes #12", ""), WEB, [], 1),
        ("no issue, labelled", GOOD.replace("Closes #12", ""), WEB, ["no-issue"], 0),
    ]
    for name, body, paths, labels, want in cases:
        got = problems(body, paths, labels)
        assert len(got) == want, f"{name}: wanted {want} refusal(s), got {got}"
    assert is_bot("dependabot[bot]", "Bot") and is_bot("x[bot]", "User") and not is_bot("someone", "User")
    print("check_pr_evidence self-test: ok")


def main() -> int:
    """Check the pull request described by the environment and stdin."""
    if sys.argv[1:] == ["--self-test"]:
        self_test()
        return 0
    if is_bot(os.environ.get("PR_AUTHOR", ""), os.environ.get("PR_AUTHOR_TYPE", "")):
        print("PR evidence: opened by a bot, exempt")
        return 0
    paths = [line.strip() for line in sys.stdin if line.strip()]
    found = problems(os.environ.get("PR_BODY", ""), paths, json.loads(os.environ.get("PR_LABELS") or "[]"))
    for problem in found:
        print(f"::error title=PR evidence::{problem}")
    if found:
        print("Edit the pull request body (see .github/PULL_REQUEST_TEMPLATE.md); the check reruns on edit.")
        return 1
    print(f"PR evidence: ok ({len(paths)} changed path(s))")
    return 0


if __name__ == "__main__":
    sys.exit(main())
