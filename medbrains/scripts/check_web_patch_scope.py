#!/usr/bin/env python3
"""May this change ship as a web-only patch on top of an installed server?

    python3 medbrains/scripts/check_web_patch_scope.py v3.35.3          # HEAD vs the tag
    python3 medbrains/scripts/check_web_patch_scope.py v3.35.3 my-branch
    python3 medbrains/scripts/check_web_patch_scope.py --self-test

A web patch replaces only the web bundle; the server, its routes, its schema
and its generated types stay those of the base tag. So every path that differs
between the base tag and the head must be a screen, a style, an asset, a
locale, a test or a doc. Anything else, including any path this file does not
know, refuses the lane: the change then ships in a full release. Exit 0 when
eligible, 1 when not (the refusing paths are printed), 2 when git fails.

One-release RFC (RFC-ONE-RELEASE-LEGO-BRICKS.md), lane A step 3.
"""

from __future__ import annotations

import re
import subprocess
import sys
import tempfile
from pathlib import Path

WEB = "medbrains/apps/web/"

# Refused with a named reason, checked before the allow-list, so a generated
# file inside a screen folder is still refused.
DENY: list[tuple[str, str]] = [
    (r"\.generated\.", "generated from server code"),
    (r"^medbrains/packages/(api|types|schemas)/", "the server contract (API client, types, schemas)"),
    (r"^medbrains/crates/|(^|/)Cargo\.(toml|lock)$", "server code"),
    (r"^medbrains/\.sqlx/|/migrations/", "the database schema"),
    (r"(^|/)(package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml)$", "dependencies"),
    (r"(^|/)vite\.config\.", "the build"),
]

# Everything a web patch may change. Tests and docs never reach the bundle.
ALLOW = [
    rf"^{WEB}src/(pages|components|features|layouts|styles|assets)/",
    rf"^{WEB}public/",
    rf"^{WEB}src/.*\.test\.tsx?$",
    rf"^{WEB}(e2e|src/test|src/__fixtures__)/",
    r"^medbrains/docs/",
]


def refusal(path: str) -> str | None:
    """Why `path` keeps a change out of the web-patch lane, or None if it may ship."""
    for pattern, reason in DENY:
        if re.search(pattern, path):
            return reason
    if any(re.search(pattern, path) for pattern in ALLOW):
        return None
    return "outside the web-patch allow-list"


def changed_paths(base: str, head: str, cwd: str | None = None) -> list[str]:
    """Every path that differs between the two trees; a rename counts as both names."""
    out = subprocess.run(
        ["git", "diff", "--name-only", "--no-renames", base, head],
        capture_output=True, text=True, check=True, cwd=cwd,
    )
    return [line for line in out.stdout.splitlines() if line]


def report(base: str, head: str, cwd: str | None = None) -> int:
    """Prints the verdict and each refusing path; returns the exit code."""
    try:
        paths = changed_paths(base, head, cwd)
    except subprocess.CalledProcessError as err:
        print(f"web-patch scope: git diff {base} {head} failed: {err.stderr.strip()}")
        return 2
    refused = [(p, r) for p in paths if (r := refusal(p))]
    verdict = "no" if refused or not paths else "yes"
    print(f"web-patch eligible: {verdict} ({len(paths)} paths changed since {base})")
    for path, reason in refused:
        print(f"  refused: {path} ({reason})")
    return 0 if verdict == "yes" else 1


def self_test() -> int:
    """Checks the rules on known paths, then the verdict on a scratch git repo."""
    ok = [
        "medbrains/apps/web/src/pages/opd/Queue.tsx",
        "medbrains/apps/web/src/components/ui/Button.module.scss",
        "medbrains/apps/web/src/styles/tokens.scss",
        "medbrains/apps/web/public/locales/hi/common.json",
        "medbrains/apps/web/src/lib/chunk-reload.test.ts",
        "medbrains/docs/DECISIONS.md",
        "medbrains/docs/decisions/2026-11-22-one-file-per-decision.md",
    ]
    bad = [
        "medbrains/apps/web/src/lib/print/print-registry.generated.ts",
        "medbrains/apps/web/src/lib/api-permission-sets.ts",
        "medbrains/apps/web/src/App.tsx",
        "medbrains/apps/web/vite.config.ts",
        "medbrains/apps/web/package.json",
        "medbrains/packages/api/src/client.ts",
        "medbrains/packages/types/src/permissions.ts",
        "medbrains/packages/schemas/src/index.ts",
        "medbrains/crates/medbrains-server/src/main.rs",
        "medbrains/Cargo.lock",
        "medbrains/.sqlx/query-abc.json",
        "medbrains/crates/medbrains-db/src/migrations/0900_x.sql",
        "medbrains/pnpm-lock.yaml",
        ".github/workflows/release.yml",
        "README.md",
    ]
    failures = [p for p in ok if refusal(p)] + [p for p in bad if not refusal(p)]
    with tempfile.TemporaryDirectory() as tmp:
        page, crate = Path(tmp, ok[0]), Path(tmp, bad[8])
        git = ["git", "-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false"]
        for path in (page, crate):
            path.parent.mkdir(parents=True)
            path.write_text("a\n")
        subprocess.run(["git", "init", "-q", tmp], check=True)
        subprocess.run([*git, "-C", tmp, "add", "-A"], check=True)
        subprocess.run([*git, "-C", tmp, "commit", "-qm", "base"], check=True)
        subprocess.run([*git, "-C", tmp, "tag", "v1.0.0"], check=True)
        page.write_text("b\n")
        if report("v1.0.0", "HEAD", tmp) != 1:  # uncommitted: no tree difference yet
            failures.append("an unchanged tree must not be eligible")
        subprocess.run([*git, "-C", tmp, "commit", "-qam", "screen"], check=True)
        if report("v1.0.0", "HEAD", tmp) != 0:
            failures.append("a screen-only change must be eligible")
        crate.write_text("b\n")
        subprocess.run([*git, "-C", tmp, "commit", "-qam", "server"], check=True)
        if report("v1.0.0", "HEAD", tmp) != 1:
            failures.append("a crate change must refuse the lane")
        if report("v9.9.9", "HEAD", tmp) != 2:
            failures.append("an unknown base tag must be an error, not a verdict")
    for failure in failures:
        print(f"self-test FAIL: {failure}")
    print("web-patch scope: self-test " + ("failed" if failures else "passed"))
    return 1 if failures else 0


def main(argv: list[str]) -> int:
    """Runs the self-test or checks HEAD (or the given ref) against a base tag."""
    if argv[:1] == ["--self-test"]:
        return self_test()
    if len(argv) not in (1, 2):
        print(__doc__)
        return 2
    return report(argv[0], argv[1] if len(argv) == 2 else "HEAD")


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
