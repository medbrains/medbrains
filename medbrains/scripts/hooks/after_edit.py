#!/usr/bin/env python3
"""Claude Code PostToolUse hook: check the rules a just-edited file can break.

Runs only the fast static checks that apply to the file's kind, in parallel,
and reports a violation back to the agent at once (exit 2, the reason on
stderr) — so a rule is met when the code is written, not at the merge gate.
Silent when everything passes or the file is outside the checked areas.

    route / handler Rust  → authz collapse, soft-delete filter, partial upserts,
                            API contract (when it registers routes)
    migration SQL         → migration headers, RLS coverage, partial upserts
    web TS/TSX            → Biome on the file, raw HTML, UI seam, AI label
    packages/api client   → API contract
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TIMEOUT_SECS = 60
OUTPUT_LINES = 15


def py(script: str, *args: str) -> list[str]:
    return ["python3", script, *args]


def checks_for(path: str) -> dict[str, list[str]]:
    rel = os.path.relpath(path, ROOT)
    if rel.startswith("..") or "/target/" in rel or "/node_modules/" in rel:
        return {}
    checks: dict[str, list[str]] = {}
    if rel.startswith("crates/") and rel.endswith(".rs"):
        checks["authz-collapse"] = py("scripts/check_authz_collapse.py")
        checks["soft-delete-filter"] = py("scripts/check_soft_delete_filter.py")
        checks["partial-upserts"] = py("scripts/check_partial_upserts.py", path)
        with open(path, encoding="utf-8") as fh:
            if ".route(" in fh.read():
                checks["api-contract"] = py("../scripts/check_api_contract.py")
    elif "/migrations/" in rel and rel.endswith(".sql"):
        checks["migration-headers"] = ["make", "-s", "check-migration-headers"]
        checks["rls"] = py("../scripts/check_rls.py")
        checks["partial-upserts"] = py("scripts/check_partial_upserts.py")
    elif rel == "packages/api/src/client.ts":
        checks["api-contract"] = py("../scripts/check_api_contract.py")
    elif rel.startswith("apps/web/src/") and rel.endswith((".ts", ".tsx")):
        checks["biome"] = ["npx", "biome", "check", rel]
        if rel.endswith(".tsx"):
            checks["raw-html"] = py("scripts/check_raw_html.py")
            checks["ui-seam"] = py("scripts/check_ui_seam.py")
            checks["ai-label"] = py("scripts/check_ai_label.py")
    return checks


def run(name: str, cmd: list[str]) -> str | None:
    try:
        done = subprocess.run(
            cmd, cwd=ROOT, capture_output=True, text=True, timeout=TIMEOUT_SECS, check=False
        )
    except subprocess.TimeoutExpired:
        # A slow check is not a failed one; never block an edit on it.
        return None
    if done.returncode == 0:
        return None
    tail = (done.stdout + done.stderr).strip().splitlines()[-OUTPUT_LINES:]
    return f"[{name}] failed:\n" + "\n".join(tail)


def main() -> int:
    try:
        event = json.load(sys.stdin)
    except json.JSONDecodeError:
        return 0
    path = (event.get("tool_input") or {}).get("file_path") or ""
    if not path.endswith((".rs", ".sql", ".ts", ".tsx")) or not os.path.exists(path):
        return 0
    checks = checks_for(os.path.abspath(path))
    if not checks:
        return 0
    with ThreadPoolExecutor(max_workers=len(checks)) as pool:
        failures = [f for f in pool.map(lambda kv: run(*kv), checks.items()) if f]
    if not failures:
        return 0
    rel = os.path.relpath(path, ROOT)
    print(f"MedBrains rules broken by the edit to {rel}:\n", file=sys.stderr)
    print("\n\n".join(failures), file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
