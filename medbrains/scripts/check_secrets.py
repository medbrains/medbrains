#!/usr/bin/env python3
"""Committed-secrets guard — fail if a live credential is tracked in git.

Closes the spirit of #155 (P0): the repo must hold no live secrets. Secrets are
sourced from the SecretResolver (env / file / AWS Secrets Manager); .env files
with secrets are gitignored. This blocks regressions — an AWS key, GitHub PAT,
private key, or Slack/Google token committed by accident fails CI.

High-confidence patterns only (near-zero false positives). Third-party vendored
fixtures and lock/example files are excluded.

  python3 scripts/check_secrets.py    # wired into `make check-secrets`
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# path substrings / suffixes that are not our secrets
SKIP_DIRS = ("vendor/", "node_modules/", ".sqlx/", "target/")
SKIP_SUFFIXES = (".example", ".sample", ".lock")
SKIP_NAMES = {"pnpm-lock.yaml", "package-lock.json", "Cargo.lock", "check_secrets.py"}

PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("AWS access key", re.compile(r"AKIA[0-9A-Z]{16}")),
    ("GitHub PAT", re.compile(r"ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{40,}")),
    ("private key", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")),
    ("Slack token", re.compile(r"xox[baprs]-[A-Za-z0-9-]{10,}")),
    ("Google API key", re.compile(r"AIza[0-9A-Za-z_-]{35}")),
]


def tracked_files() -> list[str]:
    out = subprocess.run(
        ["git", "ls-files"], cwd=ROOT, capture_output=True, text=True, check=True
    )
    return out.stdout.splitlines()


def is_skipped(path: str) -> bool:
    if any(d in path for d in SKIP_DIRS):
        return True
    if path.endswith(SKIP_SUFFIXES):
        return True
    return Path(path).name in SKIP_NAMES


def main() -> int:
    findings: list[str] = []
    for rel in tracked_files():
        if is_skipped(rel):
            continue
        full = ROOT / rel
        try:
            text = full.read_text(encoding="utf-8", errors="ignore")
        except (OSError, ValueError):
            continue
        for label, pattern in PATTERNS:
            for lineno, line in enumerate(text.splitlines(), 1):
                if pattern.search(line):
                    findings.append(f"  {rel}:{lineno}: possible {label}")

    if findings:
        print("Committed secrets detected — rotate + remove them, source from the secret backend:\n")
        print("\n".join(findings))
        print(
            "\nNever commit live credentials. Use env / the SecretResolver "
            "(env / file / AWS Secrets Manager). If this is a non-secret false positive, "
            "exclude the file in scripts/check_secrets.py."
        )
        return 1

    print("check-secrets: OK. No live credentials tracked in git.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
