#!/usr/bin/env python3
"""Claude Code PreToolUse hook (Bash): never start a build while one runs.

CLAUDE.md makes `scripts/build_guard.sh` mandatory before any cargo build,
check, test or clippy: two builds on this workspace thrash, and on a laptop
can take the machine down. This turns the rule into a gate. A command that
already waits on the guard (`build_guard.sh --wait && cargo …`) passes, and
so does anything that is not a build.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
# Only where a command starts — the head of the line, after `&&`/`;`/`|`/`(`,
# behind `timeout N` or env assignments — so a cargo command that is merely
# mentioned (a grep pattern, a pgrep) is not mistaken for one being run.
COMMAND_START = r"(?:^|[;&|(]\s*)(?:(?:timeout\s+\d+|[A-Z_][A-Z0-9_]*=\S*)\s+)*"
BUILD = re.compile(
    COMMAND_START
    + r"(?:cargo\s+(?:\+\S+\s+)?(?:build|check|test|clippy|run|zigbuild|sqlx\s+prepare)\b"
    r"|make\s+(?:-\S+\s+)*(?:prepare-sqlx|check-sqlx|native-core|build-starter)\b)",
    re.M,
)
WAITS = re.compile(r"build_guard\.sh\s+--wait")


def main() -> int:
    try:
        event = json.load(sys.stdin)
    except json.JSONDecodeError:
        return 0
    command = (event.get("tool_input") or {}).get("command") or ""
    if not BUILD.search(command) or WAITS.search(command):
        return 0
    guard = subprocess.run(
        ["bash", "scripts/build_guard.sh"], cwd=ROOT, capture_output=True, text=True, check=False
    )
    if guard.returncode == 0:
        return 0
    print(
        "Blocked: another build is running (scripts/build_guard.sh).\n"
        f"{guard.stdout.strip()}\n\n"
        "Prefix the command with `bash scripts/build_guard.sh --wait && ` to queue "
        "behind it. Never stop someone else's build to make room.",
        file=sys.stderr,
    )
    return 2


if __name__ == "__main__":
    sys.exit(main())
